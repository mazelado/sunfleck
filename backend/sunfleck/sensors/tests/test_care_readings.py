"""The soil moisture reading kept with each watering that has a "How was the soil?" answer."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
import time_machine

from sunfleck.accounts.models import Household
from sunfleck.care.models import CareEvent, Feedback
from sunfleck.care.services import (
    CareEventData,
    log_care,
    log_care_for_plants,
    update_care_event,
)
from sunfleck.care.tests.factories import builtin
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import PluginInfo, SensorReading, hookimpl, services
from sunfleck.plugins.registry import registry
from sunfleck.sensors import kinds
from sunfleck.sensors.models import CareReading, PlantSensor
from sunfleck.sensors.tests.factories import PlantSensorFactory

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 27, 10, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


@pytest.fixture
def plant(household: Household) -> Plant:
    return PlantFactory.create(household=household)


def soil_sensor(plant: Plant, minutes_ago: int = 10, value: float | None = 35.0) -> PlantSensor:
    return PlantSensorFactory.create(
        plant=plant, value=value, measured_at=NOW - timedelta(minutes=minutes_ago)
    )


def watering(
    feedback: Feedback | None = Feedback.TOO_DRY, performed_at: datetime | None = None
) -> CareEventData:
    return CareEventData(builtin("water").pk, performed_at=performed_at, feedback=feedback)


def kept(event: CareEvent) -> list[tuple[str, float, datetime]]:
    return [(r.kind, r.value, r.measured_at) for r in CareReading.objects.filter(event=event)]


def test_watering_with_an_answer_keeps_the_soil_reading(plant: Plant) -> None:
    soil_sensor(plant)

    event = log_care(plant, watering(), None)

    assert kept(event) == [(kinds.SOIL_MOISTURE, 35.0, NOW - timedelta(minutes=10))]


def test_no_plugin_is_asked_while_logging(plant: Plant) -> None:
    asked: list[list[str]] = []

    class Gauge:
        @hookimpl
        def read_sensors(self, sensor_ids: list[str]) -> list[SensorReading]:
            asked.append(sensor_ids)
            return []

    registry.add(PluginInfo("gauge", "Gauge", "1", "1"), Gauge())
    try:
        services.update(plant.household, "gauge", True, {})
        soil_sensor(plant)
        log_care(plant, watering(), None)
    finally:
        registry.remove("gauge")

    assert asked == []


@pytest.mark.parametrize(
    ("minutes_ago", "value"),
    [(61, 35.0), (-1, 35.0), (10, None)],
    ids=["more than an hour before", "after the care", "unavailable"],
)
def test_no_reading_is_kept_unless_it_has_a_value_from_the_hour_before(
    plant: Plant, minutes_ago: int, value: float | None
) -> None:
    soil_sensor(plant, minutes_ago, value)

    event = log_care(plant, watering(), None)

    assert kept(event) == []


def test_the_hour_is_the_one_before_the_care_not_now(plant: Plant) -> None:
    soil_sensor(plant, minutes_ago=90)

    event = log_care(plant, watering(performed_at=NOW - timedelta(minutes=60)), None)

    assert [value for _, value, _ in kept(event)] == [35.0]


def test_no_reading_is_kept_without_an_answer_or_a_soil_sensor(plant: Plant) -> None:
    PlantSensorFactory.create(plant=plant, kind=kinds.TEMPERATURE, measured_at=NOW)
    without_answer = log_care(plant, watering(feedback=None), None)
    without_soil_sensor = log_care(plant, watering(), None)

    assert kept(without_answer) == []
    assert kept(without_soil_sensor) == []


def test_watering_several_plants_keeps_each_ones_reading(household: Household) -> None:
    first, second, third = PlantFactory.create_batch(3, household=household)
    soil_sensor(first, value=20.0)
    soil_sensor(second, value=60.0)

    events = log_care_for_plants(household, [first.pk, second.pk, third.pk], watering(), None)

    assert [[value for _, value, _ in kept(event)] for event in events] == [[20.0], [60.0], []]


def test_an_answer_added_later_keeps_the_reading(plant: Plant) -> None:
    soil_sensor(plant)
    event = log_care(plant, watering(feedback=None), None)

    update_care_event(event, watering(performed_at=event.performed_at))

    assert [value for _, value, _ in kept(event)] == [35.0]


def test_a_corrected_watering_keeps_its_reading_while_it_still_fits(plant: Plant) -> None:
    sensor = soil_sensor(plant)
    event = log_care(plant, watering(), None)
    sensor.value, sensor.measured_at = 50.0, NOW
    sensor.save()

    update_care_event(event, watering(Feedback.JUST_RIGHT, performed_at=event.performed_at))

    assert [value for _, value, _ in kept(event)] == [35.0]


def test_a_corrected_watering_loses_a_reading_that_no_longer_fits(plant: Plant) -> None:
    soil_sensor(plant)
    event = log_care(plant, watering(), None)
    other = log_care(plant, watering(), None)

    update_care_event(event, watering(feedback=None))
    update_care_event(other, watering(performed_at=NOW - timedelta(hours=5)))

    assert kept(event) == []
    assert kept(other) == []
