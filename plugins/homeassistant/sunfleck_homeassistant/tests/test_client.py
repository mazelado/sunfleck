import json
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta, timezone
from email.message import Message
from io import BytesIO
from typing import Any

import pydantic
import pytest
from sunfleck.accounts.models import Household
from sunfleck.plugins import SensorChoice, SensorReading, SettingsCheck
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry

from sunfleck_homeassistant import Settings, client, hooks

BASE = "http://homeassistant.local:8123"
TOKEN = "eyJ-test-token"
REPORTED = "2026-11-27T10:15:00.123456+00:00"


def entity(
    entity_id: str,
    state: str = "21.5",
    device_class: str | None = "temperature",
    **attributes: Any,
) -> dict[str, Any]:
    """A state as Home Assistant answers it."""
    if device_class is not None:
        attributes["device_class"] = device_class
    return {
        "entity_id": entity_id,
        "state": state,
        "attributes": attributes,
        "last_changed": "2026-11-27T09:00:00+00:00",
        "last_reported": REPORTED,
        "last_updated": "2026-11-27T09:00:00+00:00",
    }


def ok(data: Any) -> client.Response:
    return client.Response(200, json.dumps(data).encode())


class FakeServer:
    """Stands in for Home Assistant: answers each address from `answers` (404 otherwise)."""

    def __init__(self) -> None:
        self.answers: dict[str, client.Response | Exception] = {}
        self.requests: list[tuple[str, str]] = []

    def __call__(self, url: str, token: str) -> client.Response:
        self.requests.append((url, token))
        answer = self.answers.get(url.removeprefix(BASE), client.Response(404, b"Not Found"))
        if isinstance(answer, Exception):
            raise answer
        return answer

    @property
    def paths(self) -> list[str]:
        return [url.removeprefix(BASE) for url, _ in self.requests]


@pytest.fixture
def server(monkeypatch: pytest.MonkeyPatch) -> FakeServer:
    fake = FakeServer()
    fake.answers["/api/"] = ok({"message": "API running."})
    monkeypatch.setattr(client, "get", fake)
    return fake


def settings(**values: Any) -> Settings:
    return Settings.model_validate({"base_url": BASE, "token": TOKEN, **values})


# --- Settings ---------------------------------------------------------------------------------


def test_the_address_loses_its_trailing_slash() -> None:
    assert settings(base_url=" https://ha.example.org/ ").base_url == "https://ha.example.org"


@pytest.mark.parametrize("address", ["homeassistant.local:8123", "file:///etc/passwd", "http://"])
def test_only_http_addresses_are_accepted(address: str) -> None:
    with pytest.raises(pydantic.ValidationError, match="http:// or https://"):
        settings(base_url=address)


def test_the_token_is_only_for_the_address_it_was_saved_with() -> None:
    schema = Settings.model_json_schema()["properties"]["token"]

    assert schema["bound_to"] == ["base_url"]
    assert "Long-lived access tokens" in schema["description"]


# --- Testing the settings ---------------------------------------------------------------------


def test_testing_says_how_many_sensors_it_found(server: FakeServer) -> None:
    server.answers["/api/states"] = ok(
        [entity("sensor.kitchen_temperature"), entity("light.kitchen", "on", None)]
    )

    found = hooks.check_settings(settings())

    assert found == SettingsCheck(
        details=(
            "Connected to Home Assistant at http://homeassistant.local:8123. Found 1 sensor for "
            "soil moisture, light, temperature or humidity."
        )
    )
    assert server.requests == [(f"{BASE}/api/", TOKEN), (f"{BASE}/api/states", TOKEN)]


@pytest.mark.parametrize(
    ("answer", "problem", "says"),
    [
        (client.Response(401, b"401: Unauthorized"), "invalid_api_key", "refused the access"),
        (client.Response(403, b"Forbidden"), "invalid_api_key", "Long-lived access tokens"),
        (urllib.error.URLError("Connection refused"), "unavailable", "not localhost"),
        (TimeoutError("timed out"), "unavailable", "couldn't be reached"),
        (client.Response(502, b"Bad Gateway"), "unavailable", "answered with an error"),
        (client.Response(404, b"Not Found"), "invalid_answer", "Check the address"),
        (client.Response(200, b"<html>A router's page</html>"), "invalid_answer", "not as"),
        (ok(["not", "an", "object"]), "invalid_answer", "not as Home Assistant does"),
    ],
)
def test_testing_says_what_went_wrong(
    server: FakeServer, answer: client.Response | Exception, problem: str, says: str
) -> None:
    server.answers["/api/"] = answer

    found = hooks.check_settings(settings())

    assert found.problem == problem
    assert says in found.details
    assert TOKEN not in found.details


@pytest.mark.parametrize("values", [{"base_url": ""}, {"token": " "}])
def test_testing_without_an_address_or_token_asks_for_them(
    server: FakeServer, values: dict[str, str]
) -> None:
    found = hooks.check_settings(settings(**values))

    assert found == SettingsCheck(
        "missing_settings", "Set the server address and the access token."
    )
    assert server.requests == []


def test_testing_reports_a_list_of_states_it_cant_read(server: FakeServer) -> None:
    server.answers["/api/states"] = ok({"message": "not a list"})

    assert hooks.check_settings(settings()).problem == "invalid_answer"


# --- Listing sensors --------------------------------------------------------------------------


def test_sensors_of_the_kinds_sunfleck_reads_are_listed_by_name(server: FakeServer) -> None:
    server.answers["/api/states"] = ok(
        [
            entity("sensor.monstera_moisture", "41", "moisture", friendly_name="Monstera soil"),
            entity("sensor.desk_lux", "350", "illuminance", friendly_name="desk light"),
            entity("sensor.bathroom_humidity", "64", "humidity", friendly_name="Bathroom"),
            entity("sensor.outside", "8.5"),  # no friendly name: its id
            entity("sensor.phone_battery", "80", "battery", friendly_name="Phone battery"),
            entity("sensor.no_class", "3", None, friendly_name="Something"),
            entity("binary_sensor.leak", "off", "moisture", friendly_name="Leak"),
            entity("weather.home", "sunny", "temperature", friendly_name="Home"),
            "not a state",
        ]
    )

    found = hooks.sensor_choices(settings())

    assert found == [
        SensorChoice("sensor.bathroom_humidity", "Bathroom", "humidity"),
        SensorChoice("sensor.desk_lux", "desk light", "illuminance"),
        SensorChoice("sensor.monstera_moisture", "Monstera soil", "soil_moisture"),
        SensorChoice("sensor.outside", "sensor.outside", "temperature"),
    ]
    assert server.paths == ["/api/states"]


def test_unavailable_sensors_can_still_be_chosen(server: FakeServer) -> None:
    server.answers["/api/states"] = ok([entity("sensor.fern_moisture", "unavailable", "moisture")])

    assert hooks.sensor_choices(settings()) == [
        SensorChoice("sensor.fern_moisture", "sensor.fern_moisture", "soil_moisture")
    ]


# --- Reading sensors --------------------------------------------------------------------------


def test_a_few_sensors_are_read_one_by_one(server: FakeServer) -> None:
    server.answers["/api/states/sensor.fern_moisture"] = ok(
        entity("sensor.fern_moisture", "37.5", "moisture", unit_of_measurement="%")
    )
    server.answers["/api/states/sensor.desk_lux"] = ok(
        entity("sensor.desk_lux", "1200", "illuminance", unit_of_measurement="lx")
    )

    readings = hooks.read_sensors(["sensor.fern_moisture", "sensor.desk_lux"], settings())

    measured_at = datetime(2026, 11, 27, 10, 15, 0, 123456, tzinfo=UTC)
    assert readings == [
        SensorReading("sensor.fern_moisture", 37.5, measured_at),
        SensorReading("sensor.desk_lux", 1200.0, measured_at),
    ]
    assert server.paths == ["/api/states/sensor.fern_moisture", "/api/states/sensor.desk_lux"]
    assert {token for _, token in server.requests} == {TOKEN}


def test_many_sensors_are_read_from_one_list(server: FakeServer) -> None:
    ids = [f"sensor.plant_{number}" for number in range(client.FEW_SENSORS + 1)]
    server.answers["/api/states"] = ok(
        [entity(entity_id, str(number)) for number, entity_id in enumerate(reversed(ids))]
        + [entity("sensor.not_asked_for")]
    )

    readings = hooks.read_sensors(ids, settings())

    assert server.paths == ["/api/states"]
    assert [reading.id for reading in readings] == ids  # in the order asked, only those
    assert readings[0].value == client.FEW_SENSORS


def test_up_to_the_threshold_they_are_read_one_by_one(server: FakeServer) -> None:
    ids = [f"sensor.plant_{number}" for number in range(client.FEW_SENSORS)]

    hooks.read_sensors([*ids, ids[0]], settings())  # the same id twice is read once

    assert server.paths == [f"/api/states/{entity_id}" for entity_id in ids]


def test_fahrenheit_is_read_as_celsius(server: FakeServer) -> None:
    server.answers["/api/states/sensor.porch"] = ok(
        entity("sensor.porch", "70.5", unit_of_measurement="°F")
    )
    server.answers["/api/states/sensor.attic"] = ok(
        entity("sensor.attic", "21.5", unit_of_measurement="°C")
    )

    [porch, attic] = hooks.read_sensors(["sensor.porch", "sensor.attic"], settings())

    assert porch.value == 21.39
    assert attic.value == 21.5


@pytest.mark.parametrize("state", ["unavailable", "unknown", "dry", "", "nan", "inf"])
def test_a_sensor_without_a_number_is_read_as_no_value(server: FakeServer, state: str) -> None:
    server.answers["/api/states/sensor.fern_moisture"] = ok(
        entity("sensor.fern_moisture", state, "moisture")
    )

    [reading] = hooks.read_sensors(["sensor.fern_moisture"], settings())

    assert reading.value is None
    assert reading.measured_at == datetime(2026, 11, 27, 10, 15, 0, 123456, tzinfo=UTC)


def test_the_time_is_when_it_last_reported(server: FakeServer) -> None:
    older = entity("sensor.old")
    del older["last_reported"]  # before Home Assistant 2024.7
    older["last_updated"] = "2026-11-27T11:00:00+01:00"
    naive = entity("sensor.naive")
    naive["last_reported"] = "2026-11-27T10:00:00"
    timeless = entity("sensor.timeless")
    del timeless["last_reported"]
    timeless["last_updated"] = "yesterday"
    for state in (older, naive, timeless):
        server.answers[f"/api/states/{state['entity_id']}"] = ok(state)

    readings = hooks.read_sensors(["sensor.old", "sensor.naive", "sensor.timeless"], settings())

    assert readings == [
        SensorReading("sensor.old", 21.5, datetime(2026, 11, 27, 10, tzinfo=UTC)),
        SensorReading("sensor.naive", 21.5, datetime(2026, 11, 27, 10, tzinfo=UTC)),
    ]
    assert readings[0].measured_at.tzinfo == timezone(timedelta(hours=1))
    assert readings[1].measured_at.tzinfo == UTC


def test_sensors_it_cant_find_are_left_out(server: FakeServer) -> None:
    server.answers["/api/states/sensor.here"] = ok(entity("sensor.here"))

    readings = hooks.read_sensors(["sensor.gone", "sensor.here"], settings())

    assert [reading.id for reading in readings] == ["sensor.here"]


def test_entity_ids_are_quoted_in_the_address(server: FakeServer) -> None:
    hooks.read_sensors(["sensor.a/../../config"], settings())

    assert server.paths == ["/api/states/sensor.a%2F..%2F..%2Fconfig"]


def test_nothing_to_read_asks_nothing(server: FakeServer) -> None:
    assert hooks.read_sensors([], settings()) == []
    assert server.requests == []


@pytest.mark.parametrize(
    ("answer", "says"),
    [
        (urllib.error.URLError("Connection refused"), "couldn't be reached"),
        (client.Response(401, b"401: Unauthorized"), "refused the access token"),
        (client.Response(500, b"oops"), "HTTP 500"),
        (client.Response(200, b"not json"), "didn't answer with JSON"),
    ],
)
def test_reading_fails_clearly(
    server: FakeServer, answer: client.Response | Exception, says: str
) -> None:
    server.answers["/api/states/sensor.fern"] = answer

    with pytest.raises(client.HomeAssistantError, match=says):
        hooks.read_sensors(["sensor.fern"], settings())


def test_listing_fails_clearly(server: FakeServer) -> None:
    server.answers["/api/states"] = urllib.error.URLError("Name or service not known")

    with pytest.raises(client.HomeAssistantError, match="Name or service not known"):
        hooks.sensor_choices(settings())


def test_reading_without_settings_says_what_is_missing(server: FakeServer) -> None:
    with pytest.raises(client.HomeAssistantError, match="Set the server address"):
        hooks.read_sensors(["sensor.fern"], settings(token=""))
    assert server.requests == []


# --- The request itself -----------------------------------------------------------------------


class FakeAnswer(BytesIO):
    status = 200


def test_the_token_is_sent_only_to_the_address_set(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[tuple[urllib.request.Request, float]] = []

    def urlopen(request: urllib.request.Request, timeout: float) -> FakeAnswer:
        sent.append((request, timeout))
        return FakeAnswer(b'{"message": "API running."}')

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)

    answer = client.get(f"{BASE}/api/", TOKEN)

    assert answer == client.Response(200, b'{"message": "API running."}')
    [(request, timeout)] = sent
    assert timeout == client.TIMEOUT_SECONDS
    # Unredirected: urllib doesn't pass it on if the server redirects to another one.
    assert request.unredirected_hdrs == {"Authorization": f"Bearer {TOKEN}"}
    assert "Authorization" not in request.headers


def test_http_errors_are_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    def urlopen(request: urllib.request.Request, timeout: float) -> FakeAnswer:
        raise urllib.error.HTTPError(
            request.full_url, 401, "Unauthorized", Message(), BytesIO(b"no")
        )

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)

    assert client.get(f"{BASE}/api/", TOKEN) == client.Response(401, b"no")


# --- Through Sunfleck -------------------------------------------------------------------------


def turn_on(household: Household, **values: Any) -> None:
    plugin_services.update(household, "homeassistant", True, values)


@pytest.mark.django_db
def test_it_is_off_until_an_admin_turns_it_on(server: FakeServer, household: Household) -> None:
    server.answers["/api/states"] = ok([entity("sensor.kitchen_temperature")])
    assert registry.call("sensor_choices", household, expect=list) == []

    turn_on(household, base_url=BASE, token=TOKEN)

    [answer] = registry.call("sensor_choices", household, expect=list)
    assert answer.result == [
        SensorChoice("sensor.kitchen_temperature", "sensor.kitchen_temperature", "temperature")
    ]


@pytest.mark.django_db
def test_failures_are_shown_to_the_admin(server: FakeServer, household: Household) -> None:
    turn_on(household, base_url=BASE, token=TOKEN)
    server.answers["/api/states/sensor.fern"] = urllib.error.URLError("Connection refused")

    assert registry.call("read_sensors", household, expect=list, sensor_ids=["sensor.fern"]) == []

    state = plugin_services.states(household, ["homeassistant"])["homeassistant"]
    assert state.last_error.startswith("read_sensors: HomeAssistantError: Home Assistant couldn't")
    assert TOKEN not in state.last_error


@pytest.mark.django_db
def test_a_stored_token_is_not_sent_to_a_changed_address(
    server: FakeServer, household: Household
) -> None:
    turn_on(household, base_url=BASE, token="FIRST-ADMINS-TOKEN")

    with pytest.raises(plugin_services.PluginError) as error:
        plugin_services.check(
            household, "homeassistant", {"base_url": "https://attacker.example", "token": ""}
        )

    assert (error.value.code, error.value.field) == ("invalid_plugin_setting", "token")
    assert server.requests == []


@pytest.mark.django_db
def test_a_stored_token_is_used_for_the_same_address(
    server: FakeServer, household: Household
) -> None:
    turn_on(household, base_url=BASE, token="KEPT-TOKEN")
    server.answers["/api/states"] = ok([])

    found = plugin_services.check(household, "homeassistant", {"base_url": BASE, "token": ""})

    assert found.problem is None
    assert set(server.requests) == {
        (f"{BASE}/api/", "KEPT-TOKEN"),
        (f"{BASE}/api/states", "KEPT-TOKEN"),
    }
