"""Django admin pages for sensors."""

from django.contrib import admin

from sunfleck.sensors.models import CareReading, PlantSensor, SensorDay


class SensorDayInline(admin.TabularInline[SensorDay, PlantSensor]):
    model = SensorDay
    fields = ("date", "low", "high", "mean", "last", "count")
    readonly_fields = fields
    extra = 0
    can_delete = False


@admin.register(PlantSensor)
class PlantSensorAdmin(admin.ModelAdmin[PlantSensor]):
    list_display = ("name", "kind", "plant", "plugin_id", "value", "measured_at")
    list_filter = ("kind", "plugin_id")
    raw_id_fields = ("plant",)
    inlines = [SensorDayInline]


@admin.register(CareReading)
class CareReadingAdmin(admin.ModelAdmin[CareReading]):
    list_display = ("kind", "value", "measured_at", "event")
    list_filter = ("kind",)
    raw_id_fields = ("event",)
