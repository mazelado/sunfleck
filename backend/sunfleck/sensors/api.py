"""Sensors API: the sensors plugins offer, a plant's chosen sensors and their daily summaries.

Everyone in the household can see a plant's sensors; Gardeners and Admins choose them.
"""

import datetime as dt

from django.http import HttpRequest
from ninja import Query, Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.pagination import ListQuery, paginate
from sunfleck.plants.selectors import get_plant
from sunfleck.sensors import choosing, selectors
from sunfleck.sensors.models import PlantSensor, SensorDay

router = Router(tags=["sensors"], auth=django_auth)

KIND = (
    "soil_moisture (%), illuminance (lx), temperature (°C) or humidity (%); "
    "more kinds may be added."
)


class PlantSensorOut(Schema):
    kind: str = Field(description=f"What it measures: {KIND}")
    plugin_id: str = Field(description="The plugin it's read through.")
    sensor_id: str = Field(description="The plugin's own id for it.")
    name: str = Field(description="As the plugin named it when it was chosen.")
    value: float | None = Field(
        description="The latest reading, in the kind's unit; none until it's first read, or "
        "while the sensor is unavailable."
    )
    measured_at: dt.datetime | None = Field(description="When the sensor last reported.")


def _sensor_out(sensor: PlantSensor) -> PlantSensorOut:
    return PlantSensorOut(
        kind=sensor.kind,
        plugin_id=sensor.plugin_id,
        sensor_id=sensor.sensor_id,
        name=sensor.name,
        value=sensor.value,
        measured_at=sensor.measured_at,
    )


class PlantSensorsOut(Schema):
    items: list[PlantSensorOut] = Field(description="By kind; at most one of each.")
    count: int = Field(description="How many sensors the plant has, across all pages.")
    plugin_on: bool = Field(
        description="Whether a plugin that offers sensors is on for the household."
    )


@router.get("/plants/{plant_id}/sensors", response=PlantSensorsOut)
def list_plant_sensors(
    request: HttpRequest, plant_id: int, query: Query[ListQuery]
) -> PlantSensorsOut:
    """The plant's chosen sensors, with their latest readings."""
    household = require_role(request, Role.VIEWER).household
    plant = get_plant(household, plant_id)
    sensors, count = paginate(selectors.plant_sensors(plant), query)
    return PlantSensorsOut(
        items=[_sensor_out(sensor) for sensor in sensors],
        count=count,
        plugin_on=selectors.plugin_on(household),
    )


class ChoicesQuery(ListQuery):
    kind: str | None = Field(default=None, description="Only sensors of this kind.")


class SensorChoiceOut(Schema):
    plugin_id: str
    sensor_id: str = Field(description="The plugin's own id for it.")
    name: str
    kind: str = Field(description=KIND)


class SensorChoicesOut(Schema):
    items: list[SensorChoiceOut] = Field(description="By name.")
    count: int = Field(description="How many sensors there are to choose from.")


@router.get("/sensors/choices", response=SensorChoicesOut)
def list_sensor_choices(request: HttpRequest, query: Query[ChoicesQuery]) -> SensorChoicesOut:
    """The sensors the plugins that are on can read, for choosing one for a plant. Each plugin
    is asked now; one that fails is left out, and its error shown on its settings page."""
    household = require_role(request, Role.GARDENER).household
    choices = selectors.sensor_choices(household, query.kind)
    page = choices[query.offset : query.offset + query.limit]
    return SensorChoicesOut(
        items=[
            SensorChoiceOut(
                plugin_id=choice.plugin_id,
                sensor_id=choice.sensor_id,
                name=choice.name,
                kind=choice.kind,
            )
            for choice in page
        ],
        count=len(choices),
    )


class SensorIn(Schema):
    plugin_id: str = Field(max_length=64, description="As in the sensor choices.")
    sensor_id: str = Field(max_length=255, description="As in the sensor choices.")


@router.put("/plants/{plant_id}/sensors/{kind}", response=PlantSensorOut)
def choose_plant_sensor(
    request: HttpRequest, plant_id: int, kind: str, data: SensorIn
) -> PlantSensorOut:
    """Choose the plant's sensor of this kind, from the sensor choices. Choosing another
    sensor than the plant has replaces it, and its daily summaries start afresh."""
    household = require_role(request, Role.GARDENER).household
    plant = get_plant(household, plant_id)
    sensor = choosing.choose_sensor(plant, kind, data.plugin_id, data.sensor_id)
    return _sensor_out(sensor)


@router.delete("/plants/{plant_id}/sensors/{kind}", response={204: None})
def remove_plant_sensor(request: HttpRequest, plant_id: int, kind: str) -> Status[None]:
    """Stop reading the plant's sensor of this kind, and forget its daily summaries."""
    household = require_role(request, Role.GARDENER).household
    choosing.remove_sensor(get_plant(household, plant_id), kind)
    return Status(204, None)


class SensorDayOut(Schema):
    # Not `date: date`: the field's name would hide the type.
    date: dt.date = Field(description="The plant's local day.")
    low: float
    high: float
    mean: float = Field(description="The average of the day's readings.")
    last: float = Field(description="The day's last reading.")
    count: int = Field(description="How many readings there were that day.")


def _day_out(day: SensorDay) -> SensorDayOut:
    return SensorDayOut(
        date=day.date, low=day.low, high=day.high, mean=day.mean, last=day.last, count=day.count
    )


class SensorDaysOut(Schema):
    items: list[SensorDayOut] = Field(description="The newest first.")
    count: int = Field(description="How many days there are, across all pages.")


@router.get("/plants/{plant_id}/sensors/{kind}/days", response=SensorDaysOut)
def list_sensor_days(
    request: HttpRequest, plant_id: int, kind: str, query: Query[ListQuery]
) -> SensorDaysOut:
    """A summary of the sensor's readings for each day, the newest first."""
    household = require_role(request, Role.VIEWER).household
    sensor = choosing.get_sensor(get_plant(household, plant_id), kind)
    days, count = paginate(selectors.sensor_days(sensor), query)
    return SensorDaysOut(items=[_day_out(day) for day in days], count=count)
