"""Reading sensors through Home Assistant's REST API (GET /api/, /api/states and
/api/states/<entity_id>, with a long-lived access token).

See https://developers.home-assistant.io/docs/api/rest/.
"""

import json
import logging
import math
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote

from sunfleck.plugins import SensorChoice, SensorReading, SettingsCheck

logger = logging.getLogger(__name__)

# Home Assistant usually runs on the same network; a slow answer means something's wrong.
TIMEOUT_SECONDS = 15

# Up to this many sensors are read one by one (GET /api/states/<entity_id>, about 1 KB
# each); more are read from one GET /api/states. That answer has every entity Home Assistant
# knows (lights, automations, ...), easily a few hundred KB to a few MB, which a Raspberry Pi
# would download and parse every 15 minutes. A household reads only a few sensors, so the
# small requests are usually cheaper; past about 10 round trips, one list is.
FEW_SENSORS = 10

# Home Assistant's device classes, and the kind of sensor Sunfleck reads each as. Plant
# sensors (Mi Flora, Zigbee soil sensors) report the soil's moisture as `moisture`.
KINDS = {
    "moisture": "soil_moisture",
    "illuminance": "illuminance",
    "temperature": "temperature",
    "humidity": "humidity",
}

# A sensor's state while it can't be read.
NO_VALUE = ("unavailable", "unknown")


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes


class HomeAssistantError(Exception):
    """Home Assistant couldn't be reached, refused the token, or answered something unexpected.

    `problem` is the matching `SettingsCheck` problem.
    """

    def __init__(self, message: str, problem: str) -> None:
        super().__init__(message)
        self.problem = problem


def get(url: str, token: str) -> Response:
    """Send a GET request; return the status and body, for errors too. Replaced in tests."""
    request = urllib.request.Request(  # noqa: S310 - the server the Admin set
        url, headers={"Accept": "application/json"}
    )
    # Not passed on if the server redirects elsewhere: the token is only for the server set.
    request.add_unredirected_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as answer:  # noqa: S310
            return Response(answer.status, answer.read())
    except urllib.error.HTTPError as exc:
        # An error answer holds the connection open, like a good one: close it.
        with exc:
            return Response(exc.code, exc.read())


def check(base_url: str, token: str) -> SettingsCheck:
    """Whether Home Assistant answers with these settings, and how many sensors it has."""
    try:
        answer = _get_json(base_url, "/api/", token)
        if not isinstance(answer, dict) or "message" not in answer:
            raise HomeAssistantError(
                "/api/ didn't answer as Home Assistant does.", "invalid_answer"
            )
        found = choices(base_url, token)
    except HomeAssistantError as exc:
        return SettingsCheck(exc.problem, _problem_details(exc, base_url))
    sensors = "1 sensor" if len(found) == 1 else f"{len(found)} sensors"
    return SettingsCheck(
        details=(
            f"Connected to Home Assistant at {base_url}. Found {sensors} for soil moisture, "
            "light, temperature or humidity."
        )
    )


def choices(base_url: str, token: str) -> list[SensorChoice]:
    """The sensors of the kinds Sunfleck reads, sorted by name.

    Raises:
        HomeAssistantError: If Home Assistant can't be reached or answers something unexpected.
    """
    found = []
    for state in _states(_get_json(base_url, "/api/states", token)):
        entity_id = state.get("entity_id")
        attributes = _attributes(state)
        kind = KINDS.get(str(attributes.get("device_class")))
        if not isinstance(entity_id, str) or not entity_id.startswith("sensor.") or not kind:
            continue
        name = attributes.get("friendly_name")
        name = name.strip() if isinstance(name, str) and name.strip() else entity_id
        found.append(SensorChoice(id=entity_id, name=name, kind=kind))
    return sorted(found, key=lambda choice: (choice.name.casefold(), choice.id))


def read(base_url: str, token: str, entity_ids: list[str]) -> list[SensorReading]:
    """The sensors' current readings, in the order asked; entities Home Assistant doesn't
    have, or that have no time, are left out.

    Raises:
        HomeAssistantError: If Home Assistant can't be reached or answers something unexpected.
    """
    entity_ids = list(dict.fromkeys(entity_ids))
    if not entity_ids:
        return []
    states: dict[str, dict[str, Any]] = {}
    if len(entity_ids) <= FEW_SENSORS:
        for entity_id in entity_ids:
            path = "/api/states/" + quote(entity_id, safe="")
            answer = _get_json(base_url, path, token, missing_ok=True)
            if isinstance(answer, dict):
                states[entity_id] = answer
    else:
        for state in _states(_get_json(base_url, "/api/states", token)):
            if isinstance(state.get("entity_id"), str):
                states[state["entity_id"]] = state
    readings = (
        _reading(entity_id, states[entity_id]) for entity_id in entity_ids if entity_id in states
    )
    return [reading for reading in readings if reading is not None]


def _get_json(base_url: str, path: str, token: str, *, missing_ok: bool = False) -> Any:
    """The JSON Home Assistant answers at `path`, or None for 404 with `missing_ok`."""
    if not base_url or not token:
        raise HomeAssistantError("Set the server address and the access token.", "missing_settings")
    if not base_url.startswith(("http://", "https://")):
        # urlopen also opens file: and ftp: addresses; the settings refuse them, this is a
        # second check.
        raise HomeAssistantError(f"{base_url} isn't an http:// address.", "missing_settings")
    try:
        response = get(base_url + path, token)
    except (OSError, ValueError) as exc:  # network errors and timeouts; ValueError: bad URL
        raise HomeAssistantError(
            f"Home Assistant couldn't be reached: {exc}", "unavailable"
        ) from exc
    if response.status == 404 and missing_ok:
        return None
    if response.status in (401, 403):
        raise HomeAssistantError(
            f"Home Assistant refused the access token (HTTP {response.status}).", "invalid_api_key"
        )
    if response.status >= 500:
        raise HomeAssistantError(
            f"Home Assistant answered HTTP {response.status} at {path}.", "unavailable"
        )
    if response.status != 200:
        raise HomeAssistantError(
            f"Home Assistant answered HTTP {response.status} at {path}.", "invalid_answer"
        )
    try:
        return json.loads(response.body)
    except ValueError as exc:
        raise HomeAssistantError(f"{path} didn't answer with JSON.", "invalid_answer") from exc


def _states(answer: Any) -> list[dict[str, Any]]:
    if not isinstance(answer, list):
        raise HomeAssistantError("/api/states didn't answer with a list.", "invalid_answer")
    return [state for state in answer if isinstance(state, dict)]


def _attributes(state: dict[str, Any]) -> dict[str, Any]:
    attributes = state.get("attributes")
    return attributes if isinstance(attributes, dict) else {}


def _reading(entity_id: str, state: dict[str, Any]) -> SensorReading | None:
    # `last_reported` (Home Assistant 2024.7 and later) changes whenever the sensor reports,
    # even the same value; `last_updated` only when the value or its attributes change.
    measured_at = _time(state.get("last_reported")) or _time(state.get("last_updated"))
    if measured_at is None:
        logger.warning("Home Assistant gave no time for %s", entity_id)
        return None
    unit = _attributes(state).get("unit_of_measurement")
    return SensorReading(
        id=entity_id, value=_value(state.get("state"), unit), measured_at=measured_at
    )


def _value(state: Any, unit: Any) -> float | None:
    """The state as a number in Sunfleck's unit, or None while there's no value."""
    if not isinstance(state, str) or state in NO_VALUE:
        return None
    try:
        value = float(state)
    except ValueError:
        return None
    if not math.isfinite(value):
        return None
    if unit == "°F":
        value = round((value - 32) * 5 / 9, 2)
    return value


def _time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    # Home Assistant always gives the offset; treat a time without one as UTC.
    return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)


def _problem_details(exc: HomeAssistantError, base_url: str) -> str:
    return {
        "missing_settings": str(exc),
        "invalid_api_key": (
            "Home Assistant refused the access token. Make a new one under your profile → "
            "Security → Long-lived access tokens."
        ),
        "unavailable": (
            f"{base_url} couldn't be reached, or answered with an error. With Docker, use the "
            "address of the computer running Home Assistant, not localhost."
        ),
    }.get(exc.problem, f"{base_url} answered, but not as Home Assistant does. Check the address.")
