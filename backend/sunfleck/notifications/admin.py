"""Django admin pages for notifications. Channel URLs are encrypted, so they aren't shown."""

from django.contrib import admin

from sunfleck.notifications.models import (
    NotificationChannel,
    NotificationLog,
    NotificationPreferences,
)


@admin.register(NotificationChannel)
class NotificationChannelAdmin(admin.ModelAdmin[NotificationChannel]):
    list_display = ("label", "service", "user", "enabled", "last_sent_at")
    list_filter = ("service", "enabled")
    exclude = ("url_encrypted",)
    readonly_fields = ("service", "last_sent_at", "last_error")


@admin.register(NotificationPreferences)
class NotificationPreferencesAdmin(admin.ModelAdmin[NotificationPreferences]):
    list_display = ("user", "digest_time", "reminder_time", "timezone")


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin[NotificationLog]):
    list_display = ("user", "kind", "local_date", "status", "created_at")
    list_filter = ("kind", "status")
    date_hierarchy = "created_at"
