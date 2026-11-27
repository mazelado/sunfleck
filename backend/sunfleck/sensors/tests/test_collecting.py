"""Reading the chosen sensors every 15 minutes, and the daily summaries."""

from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
import time_machine
from huey.contrib.djhuey import HUEY

from sunfleck.accounts.models import Household
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import PluginInfo, SensorReading, hookimpl, services
from sunfleck.plugins.registry import registry
from sunfleck.sensors import kinds, tasks
from sunfleck.sensors.models import PlantSensor, SensorDay
from sunfleck.sensors.services import Collected, collect_readings
from sunfleck.sensors.tests.factories import PlantSensorFactory, SensorDayFactory

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 27, 10, 0, tzinfo=UTC)
SOIL = "sensor.monstera_soil"
AIR = "sensor.living_room_temperature"


class Gauge:
    """A fake sensor plugin: answers with `readings`, and remembers what it was asked."""

    def __init__(self) -> None:
        self.readings: dict[str, Any] = {}
        self.asked: list[list[str]] = []
        self.extra: list[Any] = []  # answers besides the readings
        self.fail = False

    @hookimpl
    def read_sensors(self, sensor_ids: list[str]) -> list[Any]:
        self.asked.append(sensor_ids)
        if self.fail:
            raise RuntimeError("the gauge is offline")
        return [self.readings[id] for id in sensor_ids if id in self.readings] + self.extra


@pytest.fixture
def gauge() -> Iterator[Gauge]:
    hooks = Gauge()
    registry.add(PluginInfo("gauge", "Gauge", "1", "1"), hooks)
    yield hooks
    registry.remove("gauge")


@pytest.fixture
def other() -> Iterator[Gauge]:
    hooks = Gauge()
    registry.add(PluginInfo("other", "Other", "1", "1"), hooks)
    yield hooks
    registry.remove("other")


@pytest.fixture(autouse=True)
def frozen() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


def sensor(household: Household, sensor_id: str = SOIL, **fields: Any) -> PlantSensor:
    fields = {"plugin_id": "gauge", "value": None, "measured_at": None, **fields}
    fields.setdefault("plant", PlantFactory.create(household=household))
    return PlantSensorFactory.create(sensor_id=sensor_id, **fields)


def reading(sensor_id: str, value: Any, minutes_ago: int = 5) -> SensorReading:
    return SensorReading(sensor_id, value, NOW - timedelta(minutes=minutes_ago))


def test_sensors_are_read_every_15_minutes() -> None:
    def due(minute: int) -> list[str]:
        at = datetime(2026, 11, 27, 10, minute)  # noqa: DTZ001 - Huey takes UTC without a zone
        return [task.name for task in HUEY.read_periodic(at)]

    assert "sensors.read_sensors" in due(0)
    assert "sensors.read_sensors" in due(45)
    assert "sensors.read_sensors" not in due(20)


def test_the_latest_reading_and_the_days_summary_are_kept(
    household: Household, gauge: Gauge, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO")
    services.update(household, "gauge", True, {})
    soil = sensor(household)
    gauge.readings[SOIL] = reading(SOIL, 42.5)

    tasks.read_sensors.call_local()

    soil.refresh_from_db()
    assert (soil.value, soil.measured_at) == (42.5, NOW - timedelta(minutes=5))
    day = SensorDay.objects.get(sensor=soil)
    assert (day.date, day.low, day.high, day.mean, day.last, day.count) == (
        date(2026, 11, 27),
        42.5,
        42.5,
        42.5,
        42.5,
        1,
    )
    assert "Read 1 plant sensors, 1 daily summaries updated" in caplog.text


def test_readings_are_added_to_the_days_summary(household: Household, gauge: Gauge) -> None:
    services.update(household, "gauge", True, {})
    soil = sensor(household, measured_at=NOW - timedelta(minutes=20))
    SensorDayFactory.create(
        sensor=soil, date=date(2026, 11, 27), low=40, high=50, mean=45, last=40, count=2
    )
    gauge.readings[SOIL] = reading(SOIL, 30.0)

    assert collect_readings() == Collected(sensors=1, days=1)

    day = SensorDay.objects.get(sensor=soil)
    assert (day.low, day.high, day.mean, day.last, day.count) == (30, 50, 40, 30, 3)


def test_the_day_is_the_plants_own(household: Household, gauge: Gauge) -> None:
    services.update(household, "gauge", True, {})
    tokyo = LocationFactory.create(
        site=SiteFactory.create(household=household, timezone="Asia/Tokyo")
    )
    soil = sensor(household, plant=PlantFactory.create(household=household, location=tokyo))
    # 23:30 in UTC is already the next morning in Tokyo.
    gauge.readings[SOIL] = SensorReading(SOIL, 42.0, datetime(2026, 11, 26, 23, 30, tzinfo=UTC))

    with time_machine.travel(datetime(2026, 11, 26, 23, 45, tzinfo=UTC), tick=False):
        collect_readings()

    assert SensorDay.objects.get(sensor=soil).date == date(2026, 11, 27)


def test_a_reading_already_kept_isnt_counted_again(household: Household, gauge: Gauge) -> None:
    services.update(household, "gauge", True, {})
    soil = sensor(household)
    gauge.readings[SOIL] = reading(SOIL, 42.0)

    collect_readings()
    assert collect_readings() == Collected(sensors=0, days=0)

    assert SensorDay.objects.get(sensor=soil).count == 1


def test_old_readings_and_no_value_are_kept_as_the_latest_but_not_summarized(
    household: Household, gauge: Gauge
) -> None:
    services.update(household, "gauge", True, {})
    soil = sensor(household)
    air = sensor(household, AIR, kind=kinds.TEMPERATURE, plant=soil.plant)
    gauge.readings[SOIL] = reading(SOIL, 42.0, minutes_ago=3 * 60 + 1)
    gauge.readings[AIR] = reading(AIR, None)

    assert collect_readings() == Collected(sensors=2, days=0)

    soil.refresh_from_db()
    air.refresh_from_db()
    assert soil.value == 42.0
    assert (air.value, air.measured_at) == (None, NOW - timedelta(minutes=5))
    assert not SensorDay.objects.exists()


def test_answers_that_arent_readings_of_the_sensors_asked_for_are_left_out(
    household: Household, gauge: Gauge
) -> None:
    services.update(household, "gauge", True, {})
    soil = sensor(household)
    naive = datetime(2026, 11, 27, 9, 55)  # noqa: DTZ001 - a plugin's mistake
    gauge.extra = [
        "42%",
        reading("sensor.not_asked", 10.0),
        SensorReading(SOIL, 42.0, naive),
        reading(SOIL, float("nan")),
        reading(SOIL, "42"),
        reading(SOIL, True),
    ]

    assert collect_readings() == Collected(sensors=0, days=0)

    soil.refresh_from_db()
    assert (soil.value, soil.measured_at) == (None, None)


def test_a_shared_sensor_is_read_once_per_household_and_plugin(
    household: Household, gauge: Gauge, other: Gauge
) -> None:
    services.update(household, "gauge", True, {})
    services.update(household, "other", True, {})
    first, second = (sensor(household, AIR, kind=kinds.TEMPERATURE) for _ in range(2))
    soil = sensor(household, plant=first.plant)
    theirs = PlantSensorFactory.create(
        plant=first.plant, kind=kinds.HUMIDITY, plugin_id="other", sensor_id=AIR, value=None
    )
    gauge.readings = {SOIL: reading(SOIL, 42.0), AIR: reading(AIR, 21.5)}
    other.readings = {AIR: reading(AIR, 60.0)}

    collect_readings()

    assert gauge.asked == [[AIR, SOIL]]
    assert other.asked == [[AIR]]
    values = {s.pk: s.value for s in PlantSensor.objects.all()}
    assert values == {first.pk: 21.5, second.pk: 21.5, soil.pk: 42.0, theirs.pk: 60.0}
    assert SensorDay.objects.count() == 4


def test_only_plugins_that_are_on_for_the_household_are_asked(
    household: Household, gauge: Gauge
) -> None:
    sensor(household)
    sensor(HouseholdFactory.create(), plugin_id="uninstalled")
    gauge.readings[SOIL] = reading(SOIL, 42.0)

    assert collect_readings() == Collected(sensors=0, days=0)
    assert gauge.asked == []


def test_a_plugin_that_fails_doesnt_stop_the_others(
    household: Household, gauge: Gauge, other: Gauge
) -> None:
    services.update(household, "gauge", True, {})
    services.update(household, "other", True, {})
    sensor(household)
    theirs = PlantSensorFactory.create(plugin_id="other", sensor_id=AIR, value=None)
    services.update(theirs.plant.household, "other", True, {})
    gauge.fail = True
    other.readings[AIR] = reading(AIR, 21.5)

    assert collect_readings() == Collected(sensors=1, days=1)

    theirs.refresh_from_db()
    assert theirs.value == 21.5
    error = services.states(household)["gauge"].last_error
    assert error == "read_sensors: RuntimeError: the gauge is offline"


@pytest.mark.parametrize("households", [1, 3])
def test_reading_takes_few_queries_however_many_plants(
    households: int, gauge: Gauge, django_assert_num_queries: Any
) -> None:
    for _ in range(households):
        household = HouseholdFactory.create()
        services.update(household, "gauge", True, {})
        site = SiteFactory.create(household=household)
        for index in range(3):
            plant = PlantFactory.create(
                household=household, location=LocationFactory.create(site=site)
            )
            sensor(household, f"sensor.soil_{index}", plant=plant)
            shared = sensor(household, AIR, kind=kinds.TEMPERATURE, plant=plant)
        SensorDayFactory.create(sensor=shared, date=date(2026, 11, 27), count=1)
        gauge.readings.update(
            {f"sensor.soil_{index}": reading(f"sensor.soil_{index}", 40.0) for index in range(3)}
        )
    gauge.readings[AIR] = reading(AIR, 21.0)

    # The sensors, each household's plugin settings, then the summaries (read, changed, added)
    # and the latest readings, in a transaction.
    with django_assert_num_queries(1 + households + 6):
        collected = collect_readings()

    assert collected == Collected(sensors=6 * households, days=6 * households)
    assert len(gauge.asked) == households
