"""Collecting sensor readings from plugins, and keeping the soil's with care.

Every 15 minutes the worker asks each plugin that's on for a household for the current
readings of the sensors chosen from it (`read_sensors`), once per household and plugin
however many plants share a sensor. Each plant's sensor keeps the latest reading, and its
day's summary (in the plant's time zone) takes it in.
"""

import logging
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from django.db import transaction
from django.utils import timezone

from sunfleck.accounts.models import Household
from sunfleck.care.models import CareEvent
from sunfleck.plants.time import plant_zone
from sunfleck.plugins.registry import registry
from sunfleck.plugins.services import remembered_states
from sunfleck.plugins.types import SensorReading
from sunfleck.sensors import kinds
from sunfleck.sensors.models import CareReading, PlantSensor, SensorDay

logger = logging.getLogger(__name__)

READ_HOOK = "read_sensors"
# A reading older than this (e.g. from a sensor whose battery ran out) is still shown as the
# latest one, with its age, but left out of the daily summary: it belongs to another time.
SUMMARY_MAX_AGE = timedelta(hours=3)
# The soil reading kept with watering must be from the hour before it.
CARE_READING_MAX_AGE = timedelta(hours=1)


@dataclass(frozen=True)
class Collected:
    """What one round of reading sensors did."""

    sensors: int  # plant sensors that got a new reading
    days: int  # daily summaries that took one in


def _is_valid(item: object) -> bool:
    """Whether a plugin's answer is a reading Sunfleck can keep."""
    if not isinstance(item, SensorReading):
        return False
    if not isinstance(item.measured_at, datetime) or timezone.is_naive(item.measured_at):
        return False
    value = item.value
    if value is None:
        return True
    return isinstance(value, int | float) and not isinstance(value, bool) and math.isfinite(value)


def _read(household: Household, plugin_id: str, sensor_ids: list[str]) -> dict[str, SensorReading]:
    """The plugin's readings of these sensors, by id. Nothing if it's off or fails."""
    asked = set(sensor_ids)
    readings: dict[str, SensorReading] = {}
    for answer in registry.call_one(
        READ_HOOK, household, plugin_id, expect=list, sensor_ids=sensor_ids
    ):
        for item in answer.result:
            if _is_valid(item) and item.id in asked:
                readings[item.id] = item
    return readings


def _sensors_by_household() -> dict[Household, dict[str, list[PlantSensor]]]:
    implementers = registry.implementers(READ_HOOK)
    sensors = (
        PlantSensor.objects.filter(plugin_id__in=implementers)
        .select_related("plant__household", "plant__location__site")
        .order_by("plant__household_id", "pk")
    )
    grouped: dict[Household, dict[str, list[PlantSensor]]] = defaultdict(lambda: defaultdict(list))
    for sensor in sensors:
        grouped[sensor.plant.household][sensor.plugin_id].append(sensor)
    return grouped


def _add_to_day(day: SensorDay, value: float) -> None:
    day.mean = (day.mean * day.count + value) / (day.count + 1)
    day.low, day.high = min(day.low, value), max(day.high, value)
    day.last = value
    day.count += 1


def _summarize(readings: list[tuple[PlantSensor, date, float]]) -> int:
    """Add each value to its sensor's summary of that day; how many summaries changed."""
    if not readings:
        return 0
    existing = {
        (day.sensor_id, day.date): day
        for day in SensorDay.objects.filter(
            sensor__in=[sensor for sensor, _, _ in readings],
            date__in={day for _, day, _ in readings},
        )
    }
    changed: dict[tuple[int, date], SensorDay] = {}
    created: dict[tuple[int, date], SensorDay] = {}
    for sensor, on, value in readings:
        key = (sensor.pk, on)
        day = existing.get(key) or created.get(key)
        if day is None:
            created[key] = SensorDay(
                sensor=sensor, date=on, low=value, high=value, mean=value, last=value, count=1
            )
        else:
            _add_to_day(day, value)
            if key in existing:
                changed[key] = day
    SensorDay.objects.bulk_update(changed.values(), ["low", "high", "mean", "last", "count"])
    SensorDay.objects.bulk_create(created.values())
    return len(changed) + len(created)


def collect_readings() -> Collected:
    """Read every chosen sensor from its plugin, if that's on for the plant's household, and
    keep the readings that are newer than the ones kept.

    One `read_sensors` call per household and plugin, with the distinct ids chosen from it. A
    plugin that fails is left out (and its error kept for its settings page); the others are
    still read.
    """
    now = timezone.now()
    updated: list[PlantSensor] = []
    to_summarize: list[tuple[PlantSensor, date, float]] = []
    with remembered_states():
        for household, by_plugin in _sensors_by_household().items():
            for plugin_id, sensors in by_plugin.items():
                sensor_ids = sorted({sensor.sensor_id for sensor in sensors})
                readings = _read(household, plugin_id, sensor_ids)
                for sensor in sensors:
                    reading = readings.get(sensor.sensor_id)
                    if reading is None or (
                        sensor.measured_at and reading.measured_at <= sensor.measured_at
                    ):
                        continue  # nothing new: a reading is counted once
                    sensor.value = reading.value
                    sensor.measured_at = reading.measured_at
                    updated.append(sensor)
                    if reading.value is not None and now - reading.measured_at <= SUMMARY_MAX_AGE:
                        on = reading.measured_at.astimezone(plant_zone(sensor.plant)).date()
                        to_summarize.append((sensor, on, float(reading.value)))
    with transaction.atomic():
        PlantSensor.objects.bulk_update(updated, ["value", "measured_at"])
        days = _summarize(to_summarize)
    return Collected(sensors=len(updated), days=days)


def keep_soil_reading(event: CareEvent) -> CareReading | None:
    """Keep the plant's latest soil moisture reading with a watering that has a "How was the
    soil?" answer, if the reading is from the hour before it; the reading kept, if any.

    Only the stored reading is used: no plugin is asked. When the event is corrected, a
    reading that no longer fits it (the answer was removed, or the time moved) goes; one that
    still fits stays as it was.
    """
    readings = CareReading.objects.filter(event=event, kind=kinds.SOIL_MOISTURE)
    if not (event.feedback and event.care_type.counts_as_watering):
        readings.delete()
        return None
    since = event.performed_at - CARE_READING_MAX_AGE
    kept = readings.first()
    if kept and since <= kept.measured_at <= event.performed_at:
        return kept
    sensor = PlantSensor.objects.filter(
        plant_id=event.plant_id,
        kind=kinds.SOIL_MOISTURE,
        value__isnull=False,
        measured_at__gte=since,
        measured_at__lte=event.performed_at,
    ).first()
    if sensor is None or sensor.value is None or sensor.measured_at is None:
        readings.delete()
        return None
    reading, _ = CareReading.objects.update_or_create(
        event=event,
        kind=kinds.SOIL_MOISTURE,
        defaults={"value": sensor.value, "measured_at": sensor.measured_at},
    )
    return reading
