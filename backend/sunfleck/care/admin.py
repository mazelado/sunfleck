"""Django admin pages for care."""

from django.contrib import admin

from sunfleck.care.models import CareEvent, CareType


@admin.register(CareType)
class CareTypeAdmin(admin.ModelAdmin[CareType]):
    list_display = ("name", "key", "household", "icon", "affects_prediction")
    list_filter = ("household",)


@admin.register(CareEvent)
class CareEventAdmin(admin.ModelAdmin[CareEvent]):
    list_display = ("care_type", "plant", "performed_at", "performed_by", "feedback", "skipped")
    list_filter = ("care_type", "feedback", "skipped")
    raw_id_fields = ("plant", "performed_by")
    date_hierarchy = "performed_at"
