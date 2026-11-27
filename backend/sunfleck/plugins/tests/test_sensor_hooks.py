"""The sensor hooks (`sensor_choices`, `read_sensors`), called through the registry."""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import BaseModel

from sunfleck.accounts.models import Household
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.plugins import PluginInfo, SensorChoice, SensorReading, hookimpl, services
from sunfleck.plugins.registry import registry

pytestmark = pytest.mark.django_db

AT = datetime(2026, 11, 27, 9, 45, tzinfo=UTC)


class GaugeSettings(BaseModel):
    room: str = "Living room"


class GaugeHooks:
    """A fake plugin with a soil moisture sensor and a thermometer that's unavailable."""

    def __init__(self) -> None:
        self.asked: list[Any] = []
        self.fail = False

    @hookimpl
    def sensor_choices(self, settings: GaugeSettings) -> list[SensorChoice]:
        self.asked.append(settings.room)
        return [
            SensorChoice("sensor.monstera_soil", "Monstera soil moisture", "soil_moisture"),
            SensorChoice("sensor.thermometer", f"{settings.room} temperature", "temperature"),
        ]

    @hookimpl
    def read_sensors(self, sensor_ids: list[str]) -> list[SensorReading]:
        if self.fail:
            raise RuntimeError("the gauge is offline")
        self.asked.append(sensor_ids)
        values = {"sensor.monstera_soil": 42.0, "sensor.thermometer": None}
        return [SensorReading(id, values[id], AT) for id in sensor_ids if id in values]


@pytest.fixture
def gauge() -> Iterator[GaugeHooks]:
    hooks = GaugeHooks()
    registry.add(PluginInfo("gauge", "Gauge", "1", "1", settings_schema=GaugeSettings), hooks)
    yield hooks
    registry.remove("gauge")


def test_plugins_list_the_sensors_they_can_read(household: Household, gauge: GaugeHooks) -> None:
    services.update(household, "gauge", True, {"room": "Kitchen"})

    [answer] = registry.call("sensor_choices", household, expect=list)

    assert answer.plugin_id == "gauge"
    assert answer.result == [
        SensorChoice("sensor.monstera_soil", "Monstera soil moisture", "soil_moisture"),
        SensorChoice("sensor.thermometer", "Kitchen temperature", "temperature"),
    ]
    assert registry.implementers("sensor_choices") == ["gauge"]


def test_plugins_read_the_sensors_they_know(household: Household, gauge: GaugeHooks) -> None:
    services.update(household, "gauge", True, {})

    [answer] = registry.call(
        "read_sensors",
        household,
        expect=list,
        sensor_ids=["sensor.monstera_soil", "sensor.thermometer", "sensor.gone"],
    )

    assert answer.result == [
        SensorReading("sensor.monstera_soil", 42.0, AT),
        SensorReading("sensor.thermometer", None, AT),
    ]


def test_sensors_are_only_read_for_households_that_turned_the_plugin_on(
    household: Household, gauge: GaugeHooks
) -> None:
    services.update(HouseholdFactory.create(), "gauge", True, {})

    assert registry.call("sensor_choices", household) == []
    assert registry.call("read_sensors", household, sensor_ids=["sensor.monstera_soil"]) == []
    assert gauge.asked == []


def test_a_plugin_failing_to_read_sensors_is_left_out_and_its_error_kept(
    household: Household, gauge: GaugeHooks
) -> None:
    services.update(household, "gauge", True, {})
    gauge.fail = True

    assert registry.call("read_sensors", household, sensor_ids=["sensor.monstera_soil"]) == []
    state = services.states(household)["gauge"]
    assert state.last_error == "read_sensors: RuntimeError: the gauge is offline"
