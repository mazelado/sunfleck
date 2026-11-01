import base64
import json
from collections.abc import Callable
from typing import Any

import pytest
from cryptography.hazmat.primitives import serialization
from django.test import Client, override_settings
from py_vapid import _check_sub
from pywebpush import WebPushException

from sunfleck.accounts.models import Membership, Role, User
from sunfleck.core.crypto import decrypt
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

    def __call__(self, **kwargs: Any) -> None:
        if self.status is not None:
            response = type("Response", (), {"status_code": self.status})()
            raise WebPushException(f"Push failed: {self.status}", response=response)
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
