"""Where and when each person gets reminders, and what was sent."""

from datetime import time

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class NotificationChannel(models.Model):
    """Somewhere to send a person's notifications: an Apprise URL (ntfy, Telegram, email, ...).

    The URL often contains a token, so it's stored encrypted (see sunfleck.core.crypto).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_channels"
    )
    label = models.CharField(_("name"), max_length=100)
    url_encrypted = models.TextField()
    # The kind of service (the URL's scheme, e.g. "ntfy"), to show without decrypting the URL.
    service = models.CharField(_("service"), max_length=32)
    enabled = models.BooleanField(_("in use"), default=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("notification channel")
        verbose_name_plural = _("notification channels")
        ordering = ["user_id", "id"]

    def __str__(self) -> str:
        return f"{self.label} ({self.service})"


class NotificationPreferences(models.Model):
    """When a person gets their daily digest, and an optional evening reminder."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences"
    )
    digest_time = models.TimeField(_("daily digest at"), default=time(8, 0))
    # Only what's still due by then; none means no evening reminder.
    reminder_time = models.TimeField(_("evening reminder at"), null=True, blank=True)
    timezone = models.CharField(_("time zone"), max_length=64)

    class Meta:
        verbose_name = _("notification preferences")
        verbose_name_plural = _("notification preferences")

    def __str__(self) -> str:
        return f"Notifications · {self.user}"


class NotificationKind(models.TextChoices):
    DIGEST = "digest", _("Daily digest")
    REMINDER = "reminder", _("Evening reminder")


class NotificationStatus(models.TextChoices):
    SENT = "sent", _("Sent")
    NOTHING_DUE = "nothing_due", _("Nothing to send")
    FAILED = "failed", _("Failed")


class NotificationLog(models.Model):
    """A digest or reminder, once a day at most: sent, failed, or not needed (nothing due)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_logs"
    )
    kind = models.CharField(max_length=16, choices=NotificationKind.choices)
    # The person's day it was for, in their time zone.
    local_date = models.DateField()
    status = models.CharField(max_length=16, choices=NotificationStatus.choices)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("notification log entry")
        verbose_name_plural = _("notification log")
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "kind", "local_date"], name="notification_once_a_day"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind} · {self.user} · {self.local_date}: {self.status}"


class CalendarFeed(models.Model):
    """A person's private calendar address (an iCal feed of the household's care).

    The address holds a random token that's shown once. Only its hash is kept, like a password,
    so a leaked database doesn't give the feeds away.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="calendar_feed"
    )
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = _("calendar feed")
        verbose_name_plural = _("calendar feeds")

    def __str__(self) -> str:
        return f"Calendar · {self.user}"


class PushKey(models.Model):
    """The server's key pair for Web Push (VAPID), made once. Browsers get the public key when
    they subscribe; pushes are signed with the private one, which is stored encrypted."""

    private_key_encrypted = models.TextField()
    # Base64url, as browsers take it (`applicationServerKey`).
    public_key = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("push key")
        verbose_name_plural = _("push keys")

    def __str__(self) -> str:
        return f"Push key {self.public_key[:12]}…"
