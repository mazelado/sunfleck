"""Web Push: notifications from the installed app itself, through the browser's push service.

Each device that turns them on becomes a notification channel of the `webpush` kind, whose
encrypted "address" is the browser's subscription (JSON). Pushes are signed with the server's
VAPID key (see PushKey) and encrypted for the device, so the push service can't read them.
"""

import base64
import json
import logging
from typing import Any
from urllib.parse import urlsplit

from cryptography.hazmat.primitives import serialization
from django.conf import settings
from django.db import transaction
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush

from sunfleck.core.crypto import decrypt, encrypt
from sunfleck.notifications.delivery import MAX_ERROR_LENGTH, TIMEOUT_SECONDS, DeliveryError
from sunfleck.notifications.models import PushKey

logger = logging.getLogger(__name__)

SERVICE = "webpush"
# How long the push service keeps a notification for a device that's off: past that, the
# day's digest is out of date anyway.
TTL_SECONDS = 12 * 60 * 60
# Who push services can contact about these pushes (Apple's requires it): the site's own
# address when it's public over HTTPS, as Web Push needs anyway.
FALLBACK_CONTACT = "mailto:admin@localhost"


class SubscriptionGoneError(DeliveryError):
    """The device unsubscribed (or the browser dropped it): nothing can be sent to it again."""


def contact() -> str:
    """The `sub` claim: a mailto: address, or an https:// origin without a path."""
    url = urlsplit(settings.PUBLIC_URL)
    if url.scheme == "https" and url.netloc:
        return f"https://{url.netloc}"
    return FALLBACK_CONTACT


def _key() -> PushKey:
    with transaction.atomic():
        key = PushKey.objects.select_for_update().first()
        if key is None:
            vapid = Vapid02()
            vapid.generate_keys()
            public = vapid.public_key.public_bytes(
                serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
            )
            key = PushKey.objects.create(
                private_key_encrypted=encrypt(vapid.private_pem().decode()),
                public_key=base64.urlsafe_b64encode(public).rstrip(b"=").decode(),
            )
    return key


def public_key() -> str:
    """The server's public key, for browsers to subscribe with."""
    return _key().public_key


def check_subscription(subscription: dict[str, Any]) -> str:
    """The subscription as stored (JSON), if it's one a browser could have made.

    Raises:
        ValueError: If it isn't.
    """
    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    if not isinstance(endpoint, str) or not endpoint.startswith("https://"):
        raise ValueError("The subscription has no https endpoint.")
    if not all(isinstance(keys.get(name), str) and keys[name] for name in ("p256dh", "auth")):
        raise ValueError("The subscription has no keys.")
    return json.dumps(
        {"endpoint": endpoint, "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]}}
    )


def endpoint_of(stored: str) -> str:
    endpoint: str = json.loads(stored)["endpoint"]
    return endpoint


def send(stored: str, title: str, body: str) -> None:
    """Push a notification to a device; tapping it opens Sunfleck.

    Raises:
        SubscriptionGoneError: If the device no longer accepts pushes.
        DeliveryError: If the push service refused it, or couldn't be reached.
    """
    payload = json.dumps({"title": title, "body": body, "url": "/"})
    claims: dict[str, str | int] = {"sub": contact()}
    try:
        webpush(
            subscription_info=json.loads(stored),
            data=payload,
            vapid_private_key=Vapid02.from_pem(decrypt(_key().private_key_encrypted).encode()),
            vapid_claims=claims,
            ttl=TTL_SECONDS,
            timeout=TIMEOUT_SECONDS,
        )
    except WebPushException as exc:
        status = exc.response.status_code if exc.response is not None else None
        if status in (404, 410):
            raise SubscriptionGoneError(
                "This device no longer accepts notifications. Turn them on again there."
            ) from exc
        raise DeliveryError(f"The push service refused it: {exc}"[:MAX_ERROR_LENGTH]) from exc
    except OSError as exc:  # network errors, timeouts
        raise DeliveryError(
            f"The push service couldn't be reached: {exc}"[:MAX_ERROR_LENGTH]
        ) from exc
