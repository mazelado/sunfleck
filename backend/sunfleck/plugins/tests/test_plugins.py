import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any

import pluggy
import pytest
import time_machine
from django.test import Client, RequestFactory
from ninja import Router
from pydantic import BaseModel, Field

from sunfleck.accounts.models import Household, Role
from sunfleck.care import schedules
from sunfleck.care.models import CareEvent, CareSchedule, ScheduleMode
from sunfleck.care.services import CareEventData, log_care
from sunfleck.care.tests.factories import builtin
from sunfleck.core.errors import ApiError
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import (
    Adjustment,
    CareContext,
    Factor,
    PluginInfo,
    discovery,
    hookimpl,
    require_enabled,
    services,
)
from sunfleck.plugins.models import PluginSetting
from sunfleck.plugins.registry import registry
from sunfleck.taxonomy.models import CareArchetype

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


class Mood(StrEnum):
    CALM = "calm"
    WILD = "wild"


class RainSettings(BaseModel):
    threshold_mm: int = Field(default=5, ge=1, le=50, title="Rain threshold (mm)")
    mood: Mood = Mood.CALM


class RainHooks:
    """A fake plugin that puts watering off after "rain" and remembers what it saw."""

    def __init__(self) -> None:
        self.seen: list[tuple[str, Any]] = []
        self.fail = False

    @hookimpl
    def care_factors(self, context: CareContext, settings: RainSettings) -> list[Adjustment]:
        if self.fail:
            raise RuntimeError("the rain gauge is broken")
        self.seen.append(("care_factors", settings.threshold_mm))
        return [
            Adjustment(
                Factor("rain", details={"mm": 12}),
                not_before=date(2026, 4, 30),
            )
        ]

    @hookimpl
    def on_care_event_logged(self, event: CareEvent) -> None:
        self.seen.append(("care", event.pk))

    @hookimpl
    def on_plant_created(self, plant: Plant) -> None:
        self.seen.append(("plant", plant.nickname))

    @hookimpl
    def register_api(self, router: Router) -> None:
        @router.get("/hello")
        def hello(request: Any) -> dict[str, str]:
            return {"hello": "rain"}


RAIN = PluginInfo(
    id="rain",
    name="Rain",
    version="1.0",
    api_version="1",
    description="Puts watering off after rain.",
    settings_schema=RainSettings,
    sends_data_to=("rain.example: site latitude and longitude",),
)


@pytest.fixture
def rain() -> Iterator[RainHooks]:
    hooks = RainHooks()
    registry.add(RAIN, hooks)
    yield hooks
    registry.remove("rain")


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(datetime(2026, 4, 15, 10, tzinfo=UTC), tick=False):
        yield


def turn_on(household: Household, **settings: Any) -> None:
    services.update(household, "rain", True, settings)


# --- Discovery --------------------------------------------------------------------------------


class FakeEntryPoint:
    def __init__(self, name: str, value: Any) -> None:
        self.name = name
        self.value = f"{name}:plugin"
        self._value = value

    def load(self) -> Any:
        if isinstance(self._value, Exception):
            raise self._value
        return self._value


def test_discovery_keeps_good_plugins_and_reports_the_others(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def info(**changes: Any) -> PluginInfo:
        return PluginInfo(**{**RAIN.__dict__, "django_app": "rain_app", **changes})

    found = [
        FakeEntryPoint("rain", info()),
        FakeEntryPoint("not_info", object()),
        FakeEntryPoint("bad_id", info(id="Bad-Id")),
        FakeEntryPoint("future", info(id="future", api_version="2")),
        FakeEntryPoint("broken", ImportError("No module named 'broken'")),
        FakeEntryPoint("twin", info()),
    ]
    monkeypatch.setattr(discovery, "entry_points", lambda group: found)
    discovery.discover.cache_clear()
    try:
        result = discovery.discover()
        apps = discovery.plugin_apps()
    finally:
        discovery.discover.cache_clear()

    assert [plugin.id for plugin in result.plugins] == ["rain"]
    assert apps == ["rain_app"]
    assert [problem.message for problem in result.problems] == [
        "The entry point isn't a PluginInfo.",
        "Invalid plugin id 'Bad-Id'.",
        "Rain 1.0 needs plugin API 2; this version of Sunfleck has 1.",
        "Couldn't be loaded: No module named 'broken'",
        "Another plugin already has id rain.",
    ]


def test_hooks_that_dont_match_their_specification_are_refused() -> None:
    class Wrong:
        @hookimpl
        def care_factors(self, context: Any, weather: Any) -> list[Any]:  # not an argument
            return []

    with pytest.raises(pluggy.PluginValidationError):
        registry.add(PluginInfo("wrong", "Wrong", "1", "1"), Wrong())

    assert "wrong" not in registry.plugins
    assert not registry.manager.has_plugin("wrong")


def test_a_plugin_whose_hooks_cant_be_imported_is_reported(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    broken = PluginInfo("broken", "Broken", "1", "1", hooks="no_such_module.hooks")
    monkeypatch.setattr(
        "sunfleck.plugins.registry.discover", lambda: discovery.Discovered([broken], [])
    )
    problems_before = registry.problems

    registry.load_installed()
    try:
        assert "broken" not in registry.plugins
        assert registry.problems[-1].source == "Broken"
        assert "no_such_module" in registry.problems[-1].message
    finally:
        registry.problems = problems_before


# --- Settings ---------------------------------------------------------------------------------


def test_plugins_are_off_until_turned_on(household: Household, rain: RainHooks) -> None:
    state = services.states(household)["rain"]

    assert state.enabled is False
    assert state.settings == RainSettings()
    assert not services.is_enabled(household, "rain")


def test_turning_a_plugin_on_with_settings(household: Household, rain: RainHooks) -> None:
    state = services.update(household, "rain", True, {"threshold_mm": 8, "mood": "wild"})

    assert state.enabled is True
    assert state.settings == RainSettings(threshold_mm=8, mood=Mood.WILD)
    assert PluginSetting.objects.get().settings == {"threshold_mm": 8, "mood": "wild"}


@pytest.mark.parametrize(
    ("plugin_id", "settings", "code", "field"),
    [
        ("rain", {"threshold_mm": 0}, "invalid_plugin_setting", "threshold_mm"),
        ("rain", {"mood": "grumpy"}, "invalid_plugin_setting", "mood"),
        ("snow", {}, "plugin_not_found", None),
    ],
)
def test_invalid_settings_are_refused(
    household: Household,
    rain: RainHooks,
    plugin_id: str,
    settings: dict[str, Any],
    code: str,
    field: str | None,
) -> None:
    with pytest.raises(services.PluginError) as error:
        services.update(household, plugin_id, True, settings)

    assert (error.value.code, error.value.field) == (code, field)


def test_settings_saved_by_an_older_version_fall_back_to_the_defaults(
    household: Household, rain: RainHooks
) -> None:
    PluginSetting.objects.create(
        household=household, plugin_id="rain", enabled=True, settings={"threshold_mm": "lots"}
    )

    assert services.states(household)["rain"].settings == RainSettings()


# --- Calling hooks ----------------------------------------------------------------------------


@pytest.fixture
def monty(household: Household) -> Plant:
    return PlantFactory.create(
        household=household,
        location=LocationFactory.create(site__household=household),
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
    )


def water(plant: Plant) -> CareSchedule:
    return schedules.create_schedule(
        plant, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )


def test_plugins_adjust_the_watering_of_households_that_turned_them_on(
    household: Household, monty: Plant, rain: RainHooks
) -> None:
    before = water(monty)
    assert before.next_due == date(2026, 4, 22)

    turn_on(household, threshold_mm=7)
    schedules.recalculate(before)

    assert before.next_due == date(2026, 4, 30)
    assert {"code": "rain", "multiplier": 1.0, "details": {"mm": 12}} in before.factors
    assert rain.seen == [("care_factors", 7)]


def test_a_failing_plugin_is_left_out_and_its_error_kept(
    household: Household, monty: Plant, rain: RainHooks
) -> None:
    turn_on(household)
    rain.fail = True

    schedule = water(monty)

    assert schedule.next_due == date(2026, 4, 22)
    state = services.states(household)["rain"]
    assert state.last_error == "care_factors: RuntimeError: the rain gauge is broken"
    assert state.last_error_at is not None
    # Saving its settings again clears the error.
    assert services.update(household, "rain", True, {}).last_error == ""


def test_answers_that_arent_adjustments_are_left_out(
    household: Household, monty: Plant, rain: RainHooks, monkeypatch: pytest.MonkeyPatch
) -> None:
    turn_on(household)
    unstorable = Adjustment(Factor("rain", details={"when": date(2026, 4, 30)}))
    monkeypatch.setattr(
        RainHooks, "care_factors", hookimpl(lambda self, context: ["rain", unstorable])
    )
    registry.remove("rain")
    registry.add(RAIN, rain)

    schedule = water(monty)

    assert [factor["code"] for factor in schedule.factors] == [
        "season",
        "no_light_info",
        "not_logged",
    ]
    assert "not JSON serializable" in services.states(household)["rain"].last_error


def test_plugins_hear_about_new_plants_and_logged_care(
    household: Household, monty: Plant, rain: RainHooks
) -> None:
    other_household = PlantFactory.create().household
    turn_on(household)

    event = log_care(monty, CareEventData(builtin("water").pk), None)
    plant_services.create_plant(household, plant_services.PlantData(nickname="Fern"))
    plant_services.create_plant(other_household, plant_services.PlantData(nickname="Theirs"))

    assert rain.seen == [("care", event.pk), ("plant", "Fern")]


def test_plugins_add_api_endpoints(rain: RainHooks) -> None:
    router = Router()

    registry.call_at_startup("register_api", "rain", router=router)

    assert "/hello" in router.path_operations


def test_a_plugin_failing_at_startup_is_reported(rain: RainHooks) -> None:
    problems_before = list(registry.problems)

    assert registry.call_at_startup("register_api", "rain", router=None) == []
    assert registry.problems[-1].source == "Rain"
    registry.problems = problems_before


def test_plugin_endpoints_require_the_plugin_to_be_on(
    household: Household, rain: RainHooks, member_of: Callable[[Role], Any]
) -> None:
    request = RequestFactory().get("/")
    request.user = member_of(Role.VIEWER).user

    with pytest.raises(ApiError) as error:
        require_enabled(request, "rain")
    assert error.value.status == 404

    turn_on(household)
    assert require_enabled(request, "rain").household == household


# --- API --------------------------------------------------------------------------------------


def send(client: Client, method: str, url: str, data: Any = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def test_admins_see_the_installed_plugins(client_as: ClientAs, rain: RainHooks) -> None:
    response = client_as(Role.ADMIN).get("/api/v1/plugins")

    assert response.status_code == 200
    [plugin] = [p for p in response.json()["plugins"] if p["id"] == "rain"]
    schema = plugin.pop("settings_schema")
    assert plugin == {
        "id": "rain",
        "name": "Rain",
        "version": "1.0",
        "description": "Puts watering off after rain.",
        "sends_data_to": ["rain.example: site latitude and longitude"],
        "enabled": False,
        "settings": {"threshold_mm": 5, "mood": "calm"},
        "last_error": None,
        "last_error_at": None,
    }
    assert schema["properties"]["threshold_mm"] == {
        "default": 5,
        "maximum": 50,
        "minimum": 1,
        "title": "Rain threshold (mm)",
        "type": "integer",
    }


def test_admins_turn_plugins_on(client_as: ClientAs, rain: RainHooks) -> None:
    admin = client_as(Role.ADMIN)

    turned_on = send(admin, "PUT", "/api/v1/plugins/rain", {"enabled": True, "settings": {}})
    invalid = send(
        admin, "PUT", "/api/v1/plugins/rain", {"enabled": True, "settings": {"threshold_mm": 99}}
    )
    missing = send(admin, "PUT", "/api/v1/plugins/snow", {"enabled": True})

    assert turned_on.json()["enabled"] is True
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "invalid_plugin_setting"
    assert invalid.json()["error"]["details"] == {"field": "threshold_mm"}
    assert missing.status_code == 404


def test_only_admins_manage_plugins(client_as: ClientAs, rain: RainHooks) -> None:
    gardener = client_as(Role.GARDENER)

    assert gardener.get("/api/v1/plugins").status_code == 403
    assert send(gardener, "PUT", "/api/v1/plugins/rain", {"enabled": True}).status_code == 403
