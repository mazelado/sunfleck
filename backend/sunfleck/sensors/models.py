"""Sensors: the ones chosen for each plant, their latest reading, a summary for each day, and
the soil reading kept with care.

Sensors are read through plugins; `sensor_id` is the plugin's own id for one (e.g. a Home
Assistant entity id). Readings are in Sunfleck's unit for their kind (see `kinds.py`). The
full history stays with the plugin's source, so Sunfleck keeps only one row per sensor a day.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _

from sunfleck.care.models import CareEvent
from sunfleck.plants.models import Plant


class PlantSensor(models.Model):
    """A sensor chosen for a plant, with its latest reading. At most one of each kind."""

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="sensors")
    # A plain string, not choices: a kind added later is an addition (see kinds.py).
    kind = models.CharField(_("kind"), max_length=32)
    plugin_id = models.CharField(_("plugin"), max_length=64)
    sensor_id = models.CharField(_("sensor"), max_length=255)
    # As the plugin named it when it was chosen, e.g. "Monstera soil moisture".
    name = models.CharField(_("name"), max_length=200)
    # The latest reading; None until it's first read, or while the sensor is unavailable.
    value = models.FloatField(_("latest reading"), null=True, blank=True)
    measured_at = models.DateTimeField(_("measured at"), null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("plant sensor")
        verbose_name_plural = _("plant sensors")
        ordering = ["plant_id", "kind"]
        constraints = [
            models.UniqueConstraint(fields=["plant", "kind"], name="plant_sensor_unique_kind"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.kind}) → {self.plant}"


class SensorDay(models.Model):
    """A summary of a sensor's readings on one day, in the plant's time zone."""

    sensor = models.ForeignKey(PlantSensor, on_delete=models.CASCADE, related_name="days")
    date = models.DateField(_("date"))
    low = models.FloatField(_("lowest"))
    high = models.FloatField(_("highest"))
    mean = models.FloatField(_("average"))
    last = models.FloatField(_("last"))
    count = models.PositiveIntegerField(_("readings"))

    class Meta:
        verbose_name = _("sensor day")
        verbose_name_plural = _("sensor days")
        ordering = ["sensor_id", "date"]
        constraints = [
            models.UniqueConstraint(fields=["sensor", "date"], name="sensor_day_unique_date"),
        ]

    def __str__(self) -> str:
        return f"{self.sensor} · {self.date}"


class CareReading(models.Model):
    """A sensor's reading kept with care, e.g. the soil moisture just before watering, next to
    the "How was the soil?" answer, for calibrating predictions later."""

    event = models.ForeignKey(CareEvent, on_delete=models.CASCADE, related_name="readings")
    kind = models.CharField(_("kind"), max_length=32)
    value = models.FloatField(_("reading"))
    measured_at = models.DateTimeField(_("measured at"))

    class Meta:
        verbose_name = _("reading kept with care")
        verbose_name_plural = _("readings kept with care")
        ordering = ["event_id", "kind"]
        constraints = [
            models.UniqueConstraint(fields=["event", "kind"], name="care_reading_unique_kind"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.value} · {self.event}"
