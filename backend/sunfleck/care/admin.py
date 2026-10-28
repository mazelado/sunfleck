"""Django admin pages for care."""

from django.contrib import admin

from sunfleck.care.models import CareEvent, CareSchedule, CareType, ScheduleAdjustment


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


class ScheduleAdjustmentInline(admin.TabularInline[ScheduleAdjustment, CareSchedule]):
    model = ScheduleAdjustment
    fields = ("calculated_at", "interval_days", "next_due", "factors")
    readonly_fields = fields
    extra = 0
    can_delete = False


@admin.register(CareSchedule)
class CareScheduleAdmin(admin.ModelAdmin[CareSchedule]):
    """Schedules with the history of their predictions, for working out why one changed."""

    list_display = ("care_type", "plant", "mode", "interval_days", "next_due", "enabled")
    list_filter = ("mode", "enabled", "care_type")
    raw_id_fields = ("plant",)
    readonly_fields = ("interval_days", "next_due", "factors", "calculated_on")
    inlines = [ScheduleAdjustmentInline]
