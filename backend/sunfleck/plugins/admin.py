"""Django admin pages for plugin settings."""

from django.contrib import admin

from sunfleck.plugins.models import PluginSetting


@admin.register(PluginSetting)
class PluginSettingAdmin(admin.ModelAdmin[PluginSetting]):
    list_display = ("plugin_id", "household", "enabled", "last_error_at")
    list_filter = ("plugin_id", "enabled")
    readonly_fields = ("last_error", "last_error_at")
    exclude = ("secrets",)
