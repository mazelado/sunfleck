"""Notification channels and preferences, and sending the daily digest and evening reminder."""

import logging
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, available_timezones

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.translation import gettext

from sunfleck.accounts.models import User
from sunfleck.accounts.permissions import get_membership
from sunfleck.core.crypto import DecryptionError, decrypt, encrypt
from sunfleck.notifications import delivery
from sunfleck.notifications.digest import Message, compose
from sunfleck.notifications.models import (
    NotificationChannel,
    NotificationKind,
    NotificationLog,
    NotificationPreferences,
    NotificationStatus,
)
from sunfleck.places.models import Site

logger = logging.getLogger(__name__)

# A digest or reminder is sent at its time or, if the worker was down then, up to this much
# later the same day. After that, it's left out rather than arriving at an odd hour.
SEND_WINDOW = timedelta(hours=3)


class NotificationError(Exception):
    """A notification setting was refused, or a test message failed. `field` names the form
    field at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


# --- Preferences ------------------------------------------------------------------------------


def preferences_for(user: User) -> NotificationPreferences:
    """The person's preferences; new ones use the time zone of their household's first site."""
    existing = NotificationPreferences.objects.filter(user=user).first()
    if existing:
        return existing
    membership = get_membership(user)
    site = (
        Site.objects.filter(household=membership.household).order_by("pk").first()
        if membership
        else None
    )
    zone = site.timezone if site else settings.TIME_ZONE
    preferences, _ = NotificationPreferences.objects.get_or_create(
        user=user, defaults={"timezone": zone}
    )
    return preferences


@dataclass(frozen=True)
class PreferencesData:
    digest_time: time
    reminder_time: time | None
    timezone: str


def update_preferences(user: User, data: PreferencesData) -> NotificationPreferences:
    """
    Raises:
        NotificationError: If the time zone isn't a known one.
    """
    if data.timezone not in available_timezones():
        raise NotificationError("unknown_timezone", "This time zone isn't known.", "timezone")
    preferences = preferences_for(user)
    preferences.digest_time = data.digest_time.replace(second=0, microsecond=0)
    preferences.reminder_time = (
        data.reminder_time.replace(second=0, microsecond=0) if data.reminder_time else None
    )
    preferences.timezone = data.timezone
    preferences.save()
    return preferences


# --- Channels ---------------------------------------------------------------------------------


def _check_url(url: str) -> str:
    url = url.strip()
    if not delivery.is_supported(url):
        raise NotificationError(
            "unsupported_channel_url", "Apprise doesn't know this address.", "url"
        )
    return url


def add_channel(user: User, label: str, url: str) -> NotificationChannel:
    """
    Raises:
        NotificationError: If Apprise doesn't support the URL.
    """
    url = _check_url(url)
    return NotificationChannel.objects.create(
        user=user,
        label=label.strip(),
        url_encrypted=encrypt(url),
        service=delivery.service_of(url),
    )


def update_channel(
    channel: NotificationChannel, label: str, enabled: bool, url: str | None = None
) -> NotificationChannel:
    """Rename, pause or resume a channel; with `url`, change its address too.

    Raises:
        NotificationError: If Apprise doesn't support the new URL.
    """
    if url:
        url = _check_url(url)
        channel.url_encrypted = encrypt(url)
        channel.service = delivery.service_of(url)
        channel.last_error = ""
    channel.label = label.strip()
    channel.enabled = enabled
    channel.save()
    return channel


def _send(channel: NotificationChannel, message: Message) -> str | None:
    """Send a message on a channel and record how it went; return the error, if any."""
    try:
        delivery.send(decrypt(channel.url_encrypted), message.title, message.body)
    except (delivery.DeliveryError, DecryptionError) as exc:
        logger.warning("Notification to channel %s failed: %s", channel.pk, exc)
        channel.last_error = str(exc)
        channel.save(update_fields=["last_error"])
        return str(exc)
    channel.last_sent_at = timezone.now()
    channel.last_error = ""
    channel.save(update_fields=["last_sent_at", "last_error"])
    return None


def send_test(channel: NotificationChannel) -> None:
    """
    Raises:
        NotificationError: If the message couldn't be sent.
    """
    message = Message(
        gettext("Sunfleck test"),
        gettext("Notifications to %(label)s work.") % {"label": channel.label},
    )
    error = _send(channel, message)
    if error:
        raise NotificationError("delivery_failed", error)


# --- The digest and reminder ------------------------------------------------------------------


def send_due(now: datetime | None = None) -> int:
    """Send digests and reminders whose time has come, once a day each; return how many."""
    now = now or timezone.now()
    sent = 0
    people = User.objects.filter(notification_channels__enabled=True, is_active=True).distinct()
    for person in people.order_by("pk"):
        # Default preferences for people who added a channel but never changed them.
        prefs = preferences_for(person)
        local = now.astimezone(ZoneInfo(prefs.timezone))
        for kind, at in [
            (NotificationKind.DIGEST, prefs.digest_time),
            (NotificationKind.REMINDER, prefs.reminder_time),
        ]:
            if at is not None and _in_window(local, at):
                sent += _send_once(person, kind, local)
    return sent


def _in_window(local: datetime, at: time) -> bool:
    start = local.replace(hour=at.hour, minute=at.minute, second=0, microsecond=0)
    return start <= local < start + SEND_WINDOW


def _send_once(user: User, kind: NotificationKind, local: datetime) -> int:
    """Send the day's digest or reminder unless it was sent (or wasn't needed) already.

    A failed one (every channel failed, or something broke) is tried again on the next run,
    while still within its window.
    """
    membership = get_membership(user)
    if membership is None:
        return 0
    try:
        # Claim the day first, so two workers can't both send it.
        with transaction.atomic():
            log, created = NotificationLog.objects.get_or_create(
                user=user,
                kind=kind,
                local_date=local.date(),
                defaults={"status": NotificationStatus.SENT},
            )
    except IntegrityError:
        return 0
    if not created:
        if log.status != NotificationStatus.FAILED:
            return 0
        log.status = NotificationStatus.SENT
        log.detail = ""
        log.save(update_fields=["status", "detail"])
    try:
        message = compose(user, membership.household, kind)
        if message is None:
            log.status = NotificationStatus.NOTHING_DUE
            log.save(update_fields=["status"])
            return 0
        channels = list(user.notification_channels.filter(enabled=True))
        errors = [error for channel in channels if (error := _send(channel, message))]
    except Exception as exc:  # recorded, and tried again next run
        logger.exception("The %s for user %s failed", kind, user.pk)
        errors, channels = [f"{type(exc).__name__}: {exc}"], []
    if errors and len(errors) >= len(channels):
        log.status = NotificationStatus.FAILED
        log.detail = "\n".join(errors)
        log.save(update_fields=["status", "detail"])
        return 0
    return 1


def preview(user: User, kind: NotificationKind = NotificationKind.DIGEST) -> Message | None:
    """What the person's digest would say now (without sending it)."""
    membership = get_membership(user)
    return compose(user, membership.household, kind) if membership else None
