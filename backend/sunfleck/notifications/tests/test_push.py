import base64
import json
from collections.abc import Callable
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.test import Client, override_settings
from py_vapid import _check_sub
from pywebpush import WebPushException

from sunfleck.accounts.models import Membership, Role, User
from sunfleck.core.crypto import decrypt, encrypt
from sunfleck.notifications import push, services
from sunfleck.notifications.models import NotificationChannel, PushKey

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

SUBSCRIPTION = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
    "expirationTime": None,
    "keys": {
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ",
        "auth": "tBHItJI5svbpez7KI4CCXg",
    },
}


class FakePushService:
    """Records each push instead of sending it; can answer with an HTTP error instead."""

    def __init__(self) -> None:
        self.pushes: list[dict[str, Any]] = []
        self.status: int | None = None
        self.answer = ""
        self.unreachable = False

    def __call__(self, **kwargs: Any) -> None:
        if self.unreachable:
            raise ConnectionRefusedError("[Errno 111] Connection refused by 10.0.0.5:443")
        if self.status is not None:
            response = type("Response", (), {"status_code": self.status, "text": self.answer})()
            # As pywebpush does: the answer's body is part of the exception's message.
            raise WebPushException(
                f"Push failed: {self.status}\nResponse body:{self.answer}", response=response
            )
        self.pushes.append(kwargs)


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> FakePushService:
    fake = FakePushService()
    monkeypatch.setattr(push, "webpush", fake)
    return fake


@pytest.fixture
def ada(member_of: Callable[[Role], Membership]) -> User:
    return member_of(Role.GARDENER).user


def test_the_server_key_is_made_once_and_kept_encrypted() -> None:
    first = push.public_key()

    assert push.public_key() == first
    assert PushKey.objects.count() == 1
    # An uncompressed P-256 point, base64url without padding, as browsers take it.
    assert len(base64.urlsafe_b64decode(first + "=")) == 65
    assert "PRIVATE KEY" not in PushKey.objects.get().private_key_encrypted


def test_a_device_becomes_a_channel_and_gets_the_messages(
    ada: User, service: FakePushService
) -> None:
    channel = services.add_push_device(ada, "My phone", SUBSCRIPTION)

    services.send_test(channel)

    assert channel.service == "webpush"
    assert json.loads(decrypt(channel.url_encrypted)) == {
        "endpoint": SUBSCRIPTION["endpoint"],
        "keys": SUBSCRIPTION["keys"],
    }
    [sent] = service.pushes
    assert sent["subscription_info"]["endpoint"] == SUBSCRIPTION["endpoint"]
    assert json.loads(sent["data"]) == {
        "title": "Sunfleck test",
        "body": "Notifications to My phone work.",
        "url": "/",
    }
    assert sent["ttl"] == push.TTL_SECONDS
    assert sent["vapid_claims"]["sub"] == push.FALLBACK_CONTACT
    # Signed with the key browsers were given.
    public = sent["vapid_private_key"].public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    assert base64.urlsafe_b64encode(public).rstrip(b"=").decode() == push.public_key()


def test_the_same_device_turning_it_on_again_replaces_its_channel(ada: User) -> None:
    services.add_push_device(ada, "My phone", SUBSCRIPTION)
    services.add_push_device(ada, "My phone again", SUBSCRIPTION)
    services.add_push_device(
        ada,
        "My laptop",
        {**SUBSCRIPTION, "endpoint": "https://updates.push.services.mozilla.com/x"},
    )

    assert sorted(NotificationChannel.objects.values_list("label", flat=True)) == [
        "My laptop",
        "My phone again",
    ]


@pytest.mark.parametrize(
    "subscription",
    [
        {},
        {**SUBSCRIPTION, "endpoint": "http://insecure.example/x"},
        {**SUBSCRIPTION, "keys": {"p256dh": "only-one"}},
    ],
)
def test_subscriptions_a_browser_couldnt_make_are_refused(
    ada: User, subscription: dict[str, Any]
) -> None:
    with pytest.raises(services.NotificationError) as error:
        services.add_push_device(ada, "Odd", subscription)

    assert error.value.code == "invalid_subscription"


def test_a_device_that_unsubscribed_is_paused_with_the_reason(
    ada: User, service: FakePushService
) -> None:
    channel = services.add_push_device(ada, "Old phone", SUBSCRIPTION)
    service.status = 410

    with pytest.raises(services.NotificationError):
        services.send_test(channel)

    channel.refresh_from_db()
    assert channel.enabled is False
    assert "no longer accepts notifications" in channel.last_error


def test_other_push_errors_keep_the_device(ada: User, service: FakePushService) -> None:
    channel = services.add_push_device(ada, "Phone", SUBSCRIPTION)
    service.status = 500

    with pytest.raises(services.NotificationError):
        services.send_test(channel)

    channel.refresh_from_db()
    assert channel.enabled is True
    assert "refused" in channel.last_error


def test_a_devices_address_cant_be_changed(ada: User) -> None:
    channel = services.add_push_device(ada, "Phone", SUBSCRIPTION)

    with pytest.raises(services.NotificationError) as error:
        services.update_channel(channel, "Phone", True, "ntfy://ntfy.sh/elsewhere")
    services.update_channel(channel, "Kitchen phone", False)

    assert error.value.field == "url"
    channel.refresh_from_db()
    assert (channel.label, channel.enabled) == ("Kitchen phone", False)


def test_turning_on_notifications_from_the_app(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    key = client.get("/api/v1/notifications/push/key").json()["public_key"]
    added = client.post(
        "/api/v1/notifications/push/devices",
        {"label": "Pixel", "subscription": SUBSCRIPTION},
        content_type="application/json",
    )
    refused = client.post(
        "/api/v1/notifications/push/devices",
        {"label": "Pixel", "subscription": {"endpoint": "nope"}},
        content_type="application/json",
    )

    assert key == push.public_key()
    assert added.status_code == 201
    assert added.json()["service"] == "webpush"
    assert added.json()["label"] == "Pixel"
    assert refused.status_code == 422
    assert Client().get("/api/v1/notifications/push/key").status_code in (401, 403)


@pytest.mark.parametrize(
    ("public_url", "contact"),
    [
        ("https://plants.example.com", "https://plants.example.com"),
        ("https://example.com/sunfleck", "https://example.com"),
        ("http://192.168.1.20:8000", push.FALLBACK_CONTACT),
        ("", push.FALLBACK_CONTACT),
    ],
)
def test_push_services_get_a_contact_they_accept(public_url: str, contact: str) -> None:
    with override_settings(PUBLIC_URL=public_url):
        assert push.contact() == contact
    # py_vapid refuses anything else (e.g. an https address with a path).
    assert _check_sub(contact)


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://192.168.1.1/admin/status",
        "https://nas.home.example/api/status",
        "https://fcm.googleapis.com.attacker.example/x",
        "https://not-fcm.googleapis.com/x",
        "https://fcm.googleapis.com:8443/x",
        "https://someone@fcm.googleapis.com/x",
    ],
)
def test_push_endpoints_must_be_a_known_push_service(client_as: ClientAs, endpoint: str) -> None:
    client = client_as(Role.VIEWER)

    response = client.post(
        "/api/v1/notifications/push/devices",
        {"label": "Odd", "subscription": {**SUBSCRIPTION, "endpoint": endpoint}},
        content_type="application/json",
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_subscription"
    assert not NotificationChannel.objects.exists()


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://fcm.googleapis.com/fcm/send/abc",
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://web.push.apple.com/abc",
        "https://wns2-par02p.notify.windows.com/w/?token=abc",
        "https://push.example.org/abc",  # added with SUNFLECK_PUSH_HOSTS
    ],
)
def test_the_push_services_browsers_use_are_accepted(ada: User, endpoint: str) -> None:
    with override_settings(PUSH_SERVICE_HOSTS=[*settings.PUSH_SERVICE_HOSTS, "push.example.org"]):
        services.add_push_device(ada, "Device", {**SUBSCRIPTION, "endpoint": endpoint})

    assert NotificationChannel.objects.count() == 1


def test_a_push_services_answer_is_never_shown(
    client_as: ClientAs, service: FakePushService
) -> None:
    client = client_as(Role.VIEWER)
    channel_id = client.post(
        "/api/v1/notifications/push/devices",
        {"label": "Pixel", "subscription": SUBSCRIPTION},
        content_type="application/json",
    ).json()["id"]
    service.status, service.answer = 403, "INTERNAL-SECRET: the answer's body"

    response = client.post(f"/api/v1/notifications/channels/{channel_id}/test")

    assert response.status_code == 422
    assert "INTERNAL-SECRET" not in response.content.decode()
    assert "(HTTP 403)" in response.json()["error"]["message"]
    last_error = NotificationChannel.objects.get().last_error
    assert "INTERNAL-SECRET" not in last_error
    assert "(HTTP 403)" in last_error


def test_connection_errors_dont_say_what_answered(ada: User, service: FakePushService) -> None:
    channel = services.add_push_device(ada, "Phone", SUBSCRIPTION)
    service.unreachable = True

    with pytest.raises(services.NotificationError):
        services.send_test(channel)

    channel.refresh_from_db()
    assert channel.last_error == "The push service couldn't be reached. Try again later."


def test_a_device_stored_with_an_unknown_push_service_isnt_sent_to(
    ada: User, service: FakePushService
) -> None:
    channel = services.add_push_device(ada, "Phone", SUBSCRIPTION)
    # A device from before endpoints were checked.
    channel.url_encrypted = encrypt(
        json.dumps({**SUBSCRIPTION, "endpoint": "https://192.168.1.1/admin/status"})
    )
    channel.save()

    with pytest.raises(services.NotificationError):
        services.send_test(channel)

    assert service.pushes == []
    channel.refresh_from_db()
    assert "isn't a known one" in channel.last_error
