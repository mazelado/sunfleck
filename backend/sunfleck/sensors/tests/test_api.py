import json
from collections.abc import Callable, Iterator
from datetime import date
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import PluginInfo, SensorChoice, hookimpl, services
from sunfleck.plugins.registry import registry
from sunfleck.sensors.models import PlantSensor, SensorDay
from sunfleck.sensors.tests.factories import PlantSensorFactory, SensorDayFactory

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

SOIL = SensorChoice("sensor.monstera_soil", "Monstera soil moisture", "soil_moisture")
OTHER_SOIL = SensorChoice("sensor.fern_soil", "Fern soil moisture", "soil_moisture")
AIR = SensorChoice("sensor.living_room", "Living room temperature", "temperature")


class SensorHooks:
    """A fake plugin offering sensors, or failing to."""

    def __init__(self, choices: list[Any]) -> None:
        self.choices = choices
        self.fail = False

    @hookimpl
    def sensor_choices(self) -> list[Any]:
        if self.fail:
            raise RuntimeError("the hub is offline")
        return self.choices


@pytest.fixture
def gauge(household: Household) -> Iterator[SensorHooks]:
    hooks = SensorHooks([SOIL, OTHER_SOIL, AIR])
    registry.add(PluginInfo("gauge", "Gauge", "1", "1"), hooks)
    services.update(household, "gauge", True, {})
    yield hooks
    registry.remove("gauge")


@pytest.fixture
def plant(household: Household) -> Plant:
    return PlantFactory.create(household=household)


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def choose(
    client: Client, plant: Plant, kind: str, sensor: SensorChoice, plugin: str = "gauge"
) -> Any:
    return send(
        client,
        "PUT",
        f"/api/v1/plants/{plant.pk}/sensors/{kind}",
        {"plugin_id": plugin, "sensor_id": sensor.id},
    )


def test_everyone_sees_a_plants_sensors_with_their_latest_readings(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks, django_assert_max_num_queries: Any
) -> None:
    PlantSensorFactory.create(plant=plant, kind="temperature", sensor_id=AIR.id, name=AIR.name)
    PlantSensorFactory.create(plant=plant, value=None, measured_at=None)
    PlantSensorFactory.create(plant=PlantFactory.create(household=plant.household))
    client = client_as(Role.VIEWER)

    with django_assert_max_num_queries(6):  # session, user, membership, plant, sensors, plugins
        response = client.get(f"/api/v1/plants/{plant.pk}/sensors")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert body["plugin_on"] is True
    assert body["items"][0] == {
        "kind": "soil_moisture",
        "plugin_id": "homeassistant",
        "sensor_id": "sensor.monstera_soil_moisture",
        "name": "Monstera soil moisture",
        "value": None,
        "measured_at": None,
    }
    assert (body["items"][1]["kind"], body["items"][1]["value"]) == ("temperature", 42.0)
    assert body["items"][1]["measured_at"] == "2026-05-01T08:45:00Z"


def test_plugin_on_says_whether_a_sensor_plugin_is_on(
    client_as: ClientAs, household: Household, plant: Plant
) -> None:
    client = client_as(Role.VIEWER)
    url = f"/api/v1/plants/{plant.pk}/sensors"

    assert client.get(url).json() == {"items": [], "count": 0, "plugin_on": False}
    registry.add(PluginInfo("gauge", "Gauge", "1", "1"), SensorHooks([SOIL]))
    try:
        assert client.get(url).json()["plugin_on"] is False  # installed, but off
        services.update(household, "gauge", True, {})
        assert client.get(url).json()["plugin_on"] is True
    finally:
        registry.remove("gauge")


def test_editors_see_the_sensors_plugins_offer_by_name(
    client_as: ClientAs, household: Household, gauge: SensorHooks
) -> None:
    # Things that aren't sensor choices, kinds Sunfleck doesn't know, and duplicates: left out.
    gauge.choices += ["sensor.x", SensorChoice("sensor.ph", "Soil pH", "ph"), SOIL]
    client = client_as(Role.GARDENER)

    every = client.get("/api/v1/sensors/choices").json()
    soil = client.get("/api/v1/sensors/choices?kind=soil_moisture&limit=1&offset=1").json()

    assert [item["name"] for item in every["items"]] == [
        "Fern soil moisture",
        "Living room temperature",
        "Monstera soil moisture",
    ]
    assert every["count"] == 3
    assert every["items"][1] == {
        "plugin_id": "gauge",
        "sensor_id": "sensor.living_room",
        "name": "Living room temperature",
        "kind": "temperature",
    }
    assert soil == {
        "items": [
            {
                "plugin_id": "gauge",
                "sensor_id": "sensor.monstera_soil",
                "name": "Monstera soil moisture",
                "kind": "soil_moisture",
            }
        ],
        "count": 2,
    }


def test_a_plugin_that_fails_to_offer_sensors_is_left_out(
    client_as: ClientAs, household: Household, gauge: SensorHooks
) -> None:
    broken = SensorHooks([])
    broken.fail = True
    registry.add(PluginInfo("broken", "Broken", "1", "1"), broken)
    services.update(household, "broken", True, {})
    try:
        response = client_as(Role.GARDENER).get("/api/v1/sensors/choices")
        error = services.states(household)["broken"].last_error
    finally:
        registry.remove("broken")

    assert response.status_code == 200
    assert response.json()["count"] == 3
    assert error == "sensor_choices: RuntimeError: the hub is offline"


def test_viewers_cant_see_or_change_the_sensors_to_choose(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks
) -> None:
    PlantSensorFactory.create(plant=plant)
    client = client_as(Role.VIEWER)

    assert client.get("/api/v1/sensors/choices").status_code == 403
    assert choose(client, plant, "soil_moisture", SOIL).status_code == 403
    assert (
        send(client, "DELETE", f"/api/v1/plants/{plant.pk}/sensors/soil_moisture").status_code
        == 403
    )
    assert PlantSensor.objects.get().sensor_id == "sensor.monstera_soil_moisture"


def test_an_editor_chooses_a_sensor_named_as_the_plugin_names_it(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks
) -> None:
    response = choose(client_as(Role.GARDENER), plant, "soil_moisture", SOIL)

    assert response.status_code == 200
    assert response.json() == {
        "kind": "soil_moisture",
        "plugin_id": "gauge",
        "sensor_id": "sensor.monstera_soil",
        "name": "Monstera soil moisture",
        "value": None,
        "measured_at": None,
    }
    assert PlantSensor.objects.get(plant=plant).name == "Monstera soil moisture"


def test_choosing_the_same_sensor_again_keeps_its_readings(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks
) -> None:
    sensor = PlantSensorFactory.create(
        plant=plant, plugin_id="gauge", sensor_id=SOIL.id, name="Old name"
    )
    SensorDayFactory.create(sensor=sensor)

    response = choose(client_as(Role.GARDENER), plant, "soil_moisture", SOIL)

    assert (response.json()["name"], response.json()["value"]) == (SOIL.name, 42.0)
    assert PlantSensor.objects.get().pk == sensor.pk
    assert SensorDay.objects.filter(sensor=sensor).count() == 1


def test_choosing_another_sensor_starts_its_readings_afresh(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks
) -> None:
    sensor = PlantSensorFactory.create(plant=plant, plugin_id="gauge", sensor_id=SOIL.id)
    SensorDayFactory.create(sensor=sensor)
    air = PlantSensorFactory.create(plant=plant, kind="temperature", sensor_id=AIR.id)

    response = choose(client_as(Role.GARDENER), plant, "soil_moisture", OTHER_SOIL)

    assert response.json()["sensor_id"] == "sensor.fern_soil"
    assert (response.json()["value"], response.json()["measured_at"]) == (None, None)
    soil = PlantSensor.objects.get(plant=plant, kind="soil_moisture")
    assert (soil.sensor_id, soil.name) == ("sensor.fern_soil", "Fern soil moisture")
    # The old sensor's reading time mustn't hold back the new sensor's first readings.
    assert (soil.value, soil.measured_at) == (None, None)
    assert not SensorDay.objects.exists()
    assert PlantSensor.objects.filter(pk=air.pk).exists()  # other kinds stay


@pytest.mark.parametrize(
    ("kind", "sensor", "plugin"),
    [
        ("temperature", SOIL, "gauge"),  # a soil sensor isn't a thermometer
        ("soil_moisture", SOIL, "other"),  # not offered by that plugin
        ("soil_moisture", SensorChoice("sensor.gone", "Gone", "soil_moisture"), "gauge"),
    ],
)
def test_only_a_sensor_the_plugins_offer_for_the_kind_can_be_chosen(
    client_as: ClientAs,
    plant: Plant,
    gauge: SensorHooks,
    kind: str,
    sensor: SensorChoice,
    plugin: str,
) -> None:
    response = choose(client_as(Role.GARDENER), plant, kind, sensor, plugin)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "sensor_not_a_choice"
    assert response.json()["error"]["details"] == {"field": "sensor_id"}
    assert not PlantSensor.objects.exists()


def test_a_sensor_of_a_plugin_thats_off_cant_be_chosen(
    client_as: ClientAs, household: Household, plant: Plant, gauge: SensorHooks
) -> None:
    services.update(household, "gauge", False, {})

    response = choose(client_as(Role.GARDENER), plant, "soil_moisture", SOIL)

    assert response.json()["error"]["code"] == "sensor_not_a_choice"


def test_unknown_kinds_of_sensor_are_not_found(
    client_as: ClientAs, plant: Plant, gauge: SensorHooks
) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{plant.pk}/sensors/ph"

    chosen = choose(client, plant, "ph", SOIL)

    assert chosen.status_code == 404
    assert chosen.json()["error"]["code"] == "sensor_kind_not_found"
    assert send(client, "DELETE", url).json()["error"]["code"] == "sensor_kind_not_found"
    assert client.get(f"{url}/days").json()["error"]["code"] == "sensor_kind_not_found"


def test_an_editor_removes_a_sensor_with_its_days(client_as: ClientAs, plant: Plant) -> None:
    sensor = PlantSensorFactory.create(plant=plant)
    SensorDayFactory.create(sensor=sensor)
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{plant.pk}/sensors/soil_moisture"

    assert send(client, "DELETE", url).status_code == 204
    assert not PlantSensor.objects.exists()
    assert not SensorDay.objects.exists()
    again = send(client, "DELETE", url)
    assert (again.status_code, again.json()["error"]["code"]) == (404, "sensor_not_found")


def test_everyone_sees_a_sensors_days_newest_first(
    client_as: ClientAs, plant: Plant, django_assert_max_num_queries: Any
) -> None:
    sensor = PlantSensorFactory.create(plant=plant)
    for day in (1, 3, 2):
        SensorDayFactory.create(sensor=sensor, date=date(2026, 5, day), last=float(day))
    SensorDayFactory.create(date=date(2026, 5, 4))  # another plant's
    client = client_as(Role.VIEWER)
    url = f"/api/v1/plants/{plant.pk}/sensors/soil_moisture/days"

    with django_assert_max_num_queries(6):  # session, user, membership, plant, sensor, days
        response = client.get(url)
    page = client.get(f"{url}?limit=1&offset=1").json()

    assert [item["date"] for item in response.json()["items"]] == [
        "2026-05-03",
        "2026-05-02",
        "2026-05-01",
    ]
    assert response.json()["items"][0] == {
        "date": "2026-05-03",
        "low": 38.0,
        "high": 51.0,
        "mean": 44.5,
        "last": 3.0,
        "count": 96,
    }
    assert page == {"items": [response.json()["items"][1]], "count": 3}


def test_a_kind_without_a_sensor_has_no_days(client_as: ClientAs, plant: Plant) -> None:
    response = client_as(Role.VIEWER).get(f"/api/v1/plants/{plant.pk}/sensors/humidity/days")

    assert (response.status_code, response.json()["error"]["code"]) == (404, "sensor_not_found")


def test_another_households_plants_sensors_are_not_found(
    client_as: ClientAs, gauge: SensorHooks
) -> None:
    theirs = PlantSensorFactory.create()
    client = client_as(Role.ADMIN)
    url = f"/api/v1/plants/{theirs.plant.pk}/sensors"

    assert client.get(url).status_code == 404
    assert client.get(f"{url}/soil_moisture/days").status_code == 404
    assert choose(client, theirs.plant, "soil_moisture", SOIL).status_code == 404
    assert send(client, "DELETE", f"{url}/soil_moisture").status_code == 404
    assert PlantSensor.objects.get().sensor_id == "sensor.monstera_soil_moisture"
