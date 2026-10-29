from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import time_machine
from django.test import Client
from sunfleck.accounts.models import Household, Role
from sunfleck.care import schedules
from sunfleck.care.models import CareSchedule, ScheduleMode
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.models import Location, LocationKind, Site
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import services as plugin_services
from sunfleck.taxonomy.models import CareArchetype

from sunfleck_weather_openmeteo import Settings, hooks, weather
from sunfleck_weather_openmeteo.models import SiteWeather

ClientAs = Callable[[Role], Client]
NOW = datetime(2026, 4, 15, 10, tzinfo=UTC)  # noon in Amsterdam
TODAY = date(2026, 4, 15)

pytestmark = pytest.mark.django_db


def open_meteo(
    lows: list[float] | None = None,
    highs: list[float] | None = None,
    rain: list[float] | None = None,
) -> dict[str, Any]:
    """An answer like Open-Meteo's: 3 past days, today (the 15th), and 6 days ahead."""
    days = [(TODAY + timedelta(days=offset)).isoformat() for offset in range(-3, 7)]
    return {
        "latitude": 52.38,
        "longitude": 4.9,
        "timezone": "Europe/Amsterdam",
        "current_units": {"temperature_2m": "°C", "weather_code": "wmo code"},
        "current": {"time": "2026-04-15T12:00", "temperature_2m": 13.4, "weather_code": 3},
        "daily_units": {"temperature_2m_min": "°C", "precipitation_sum": "mm"},
        "daily": {
            "time": days,
            "temperature_2m_min": lows or [6.0] * 10,
            "temperature_2m_max": highs or [15.0] * 10,
            "precipitation_sum": rain or [0.0] * 10,
            "weather_code": [3] * 10,
        },
    }


class FakeOpenMeteo:
    """Stands in for the network: answers with `answer`, or raises it."""

    def __init__(self) -> None:
        self.answer: Any = open_meteo()
        self.urls: list[str] = []

    def __call__(self, url: str) -> Any:
        self.urls.append(url)
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> FakeOpenMeteo:
    fake = FakeOpenMeteo()
    monkeypatch.setattr(weather, "download", fake)
    return fake


@pytest.fixture
def site(household: Household) -> Site:
    return SiteFactory.create(household=household, latitude=52.37403, longitude=4.88969)


@pytest.fixture
def garden(site: Site) -> Location:
    # Its exposure isn't set, so light doesn't change the watering here.
    return LocationFactory.create(site=site, name="Garden", kind=LocationKind.OUTDOOR)


def turn_on(household: Household, **settings: Any) -> None:
    plugin_services.update(household, "weather_openmeteo", True, settings)


# --- Fetching ---------------------------------------------------------------------------------


def test_it_sends_only_the_rounded_location(service: FakeOpenMeteo, site: Site) -> None:
    weather.forecast_for(site)

    [url] = service.urls
    assert url.startswith("https://api.open-meteo.com/v1/forecast?")
    query = {key: value[0] for key, value in parse_qs(urlparse(url).query).items()}
    assert query == {
        "latitude": "52.37",
        "longitude": "4.89",
        "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code",
        "timezone": "auto",
        "past_days": "3",
        "forecast_days": "7",
    }


def test_the_forecast_is_read_and_kept(service: FakeOpenMeteo, site: Site) -> None:
    forecast = weather.forecast_for(site)

    assert forecast.temperature_c == 13.4
    assert forecast.weather_code == 3
    assert forecast.day(TODAY) == weather.Day(TODAY, 6.0, 15.0, 0.0, 3)
    assert len(forecast.days) == 10
    stored = SiteWeather.objects.get(site=site)
    assert stored.fetched_at == NOW
    assert weather.Forecast.from_json(stored.data, NOW) == forecast


def test_a_recent_forecast_isnt_fetched_again(service: FakeOpenMeteo, site: Site) -> None:
    weather.forecast_for(site)
    with time_machine.travel(NOW + timedelta(hours=2, minutes=59), tick=False):
        weather.forecast_for(site)
    with time_machine.travel(NOW + timedelta(hours=3), tick=False):
        weather.forecast_for(site)

    assert len(service.urls) == 2


def test_when_open_meteo_is_down_the_last_forecast_is_used_for_a_day(
    service: FakeOpenMeteo, site: Site
) -> None:
    weather.forecast_for(site)
    service.answer = TimeoutError("timed out")

    with time_machine.travel(NOW + timedelta(hours=5), tick=False):
        assert weather.forecast_for(site).temperature_c == 13.4
        # Not asked again for 15 minutes.
        weather.forecast_for(site)
    assert len(service.urls) == 2

    with (
        time_machine.travel(NOW + timedelta(hours=25), tick=False),
        pytest.raises(weather.WeatherError),
    ):
        weather.forecast_for(site)


@pytest.mark.parametrize(
    "answer",
    [
        {"error": True, "reason": "Latitude must be in range of -90 to 90°."},
        {**open_meteo(), "daily": {**open_meteo()["daily"], "precipitation_sum": [0.0]}},
        {**open_meteo(), "daily": {**open_meteo()["daily"], "time": ["yesterday"] * 10}},
        "not a forecast",
    ],
)
def test_unexpected_answers_are_refused(service: FakeOpenMeteo, site: Site, answer: Any) -> None:
    service.answer = answer

    with pytest.raises(weather.WeatherError):
        weather.forecast_for(site)


def test_new_weather_has_the_sites_plants_recalculated(
    service: FakeOpenMeteo, household: Household, garden: Location
) -> None:
    plant = PlantFactory.create(household=household, location=garden)
    schedule = schedules.create_schedule(
        plant, schedules.ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 7)
    )

    weather.forecast_for(garden.site)

    schedule.refresh_from_db()
    assert schedule.calculated_on is None


# --- Today ------------------------------------------------------------------------------------


def test_the_today_page_shows_each_sites_weather(
    service: FakeOpenMeteo, client_as: ClientAs, household: Household, garden: Location
) -> None:
    service.answer = open_meteo(lows=[6.0] * 4 + [8.0, 1.5, -2.0] + [6.0] * 3)
    turn_on(household)

    sites = client_as(Role.VIEWER).get("/api/v1/today").json()["sites"]

    assert sites == [
        {
            "site_id": garden.site_id,
            "site_name": "Home",
            "today": "2026-04-15",
            "plugin_id": "weather_openmeteo",
            "attribution": "Weather data by Open-Meteo.com",
            "updated_at": "2026-04-15T10:00:00Z",
            "temperature_c": 13.4,
            "today_min_c": 6.0,
            "today_max_c": 15.0,
            "precipitation_mm": 0.0,
            "weather_code": 3,
            # The first night at or below 2 °C in the next three.
            "alerts": [{"kind": "frost", "on": "2026-04-17", "details": {"min_c": 1.5}}],
        }
    ]


def test_no_frost_warning_without_outdoor_plants_or_frost(
    service: FakeOpenMeteo, client_as: ClientAs, household: Household, site: Site
) -> None:
    service.answer = open_meteo(lows=[-5.0] * 10)
    turn_on(household)
    viewer = client_as(Role.VIEWER)

    indoor_only = viewer.get("/api/v1/today").json()["sites"]
    LocationFactory.create(site=site, kind=LocationKind.OUTDOOR)
    turn_on(household, frost_c=-6)
    colder_threshold = viewer.get("/api/v1/today").json()["sites"]

    assert indoor_only[0]["alerts"] == []
    assert colder_threshold[0]["alerts"] == []


def test_weather_is_only_fetched_once_turned_on(
    service: FakeOpenMeteo, client_as: ClientAs, garden: Location
) -> None:
    sites = client_as(Role.VIEWER).get("/api/v1/today").json()["sites"]

    assert sites == []
    assert service.urls == []


def test_no_weather_is_reported_to_admins(
    service: FakeOpenMeteo, client_as: ClientAs, household: Household, garden: Location
) -> None:
    service.answer = OSError("Network is unreachable")
    turn_on(household)

    response = client_as(Role.VIEWER).get("/api/v1/today")

    assert response.status_code == 200
    assert response.json()["sites"] == []
    error = plugin_services.states(household)["weather_openmeteo"].last_error
    assert error.startswith("site_conditions: WeatherError: Open-Meteo couldn't be reached")


# --- Outdoor watering -------------------------------------------------------------------------


@pytest.fixture
def rose(household: Household, garden: Location) -> CareSchedule:
    plant = PlantFactory.create(
        household=household,
        location=garden,
        nickname="Rose",
        care_profile=CareArchetype.objects.get(key="temperate_shrub"),
    )
    CareEventFactory.create(plant=plant, performed_at=datetime(2026, 4, 9, 8, tzinfo=UTC))
    return schedules.create_schedule(
        plant, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )


def factor(schedule: CareSchedule, code: str) -> dict[str, Any] | None:
    return next((f for f in schedule.factors if f["code"] == code), None)


def recalculated(schedule: CareSchedule) -> CareSchedule:
    schedules.recalculate(schedule)
    return schedule


def test_watering_waits_two_days_after_rain(
    service: FakeOpenMeteo, household: Household, rose: CareSchedule
) -> None:
    # Spring garden shrubs are watered about every 10 days: due on the 19th without rain.
    assert rose.next_due == date(2026, 4, 19)
    service.answer = open_meteo(rain=[0, 0, 4.0, 2.5, 0, 0, 0, 0, 0, 0])
    turn_on(household)

    recalculated(rose)

    assert factor(rose, "rain") == {"code": "rain", "multiplier": 1.0, "details": {"mm": 6.5}}
    assert rose.next_due == date(2026, 4, 19)  # already later than the 17th

    rose.plant.care_events.all().delete()
    CareEventFactory.create(plant=rose.plant, performed_at=datetime(2026, 4, 1, 8, tzinfo=UTC))
    recalculated(rose)
    assert rose.next_due == date(2026, 4, 17)  # overdue, but the soil is wet


def test_watering_waits_for_forecast_rain(
    service: FakeOpenMeteo, household: Household, rose: CareSchedule
) -> None:
    rose.plant.care_events.all().delete()
    CareEventFactory.create(plant=rose.plant, performed_at=datetime(2026, 4, 1, 8, tzinfo=UTC))
    service.answer = open_meteo(rain=[0, 0, 0, 0, 8.0, 0, 0, 0, 0, 0])
    turn_on(household)

    recalculated(rose)
    assert factor(rose, "rain_forecast") == {
        "code": "rain_forecast",
        "multiplier": 1.0,
        "details": {"mm": 8.0, "on": "2026-04-16"},
    }
    assert rose.next_due == date(2026, 4, 17)

    turn_on(household, wait_for_rain=False)
    recalculated(rose)
    assert factor(rose, "rain_forecast") is None
    assert rose.next_due == date(2026, 4, 11)


def test_a_hot_spell_waters_sooner(
    service: FakeOpenMeteo, household: Household, rose: CareSchedule
) -> None:
    # Garden shrubs are happiest up to 25 °C: 31 °C highs are 6 °C too hot.
    service.answer = open_meteo(highs=[15.0] * 3 + [31.0] * 7)
    turn_on(household)

    recalculated(rose)

    assert factor(rose, "hot_spell") == {
        "code": "hot_spell",
        "multiplier": 0.82,
        "details": {"max_c": 31.0, "ideal_max_c": 25},
    }
    assert rose.interval_days == 8


def test_indoor_plants_and_cool_weather_are_left_alone(
    service: FakeOpenMeteo, household: Household, rose: CareSchedule, site: Site
) -> None:
    service.answer = open_meteo(highs=[2.0] * 10, rain=[20.0] * 10)
    indoor = PlantFactory.create(
        household=household,
        location=LocationFactory.create(site=site),
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
    )
    indoor_water = schedules.create_schedule(
        indoor, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )
    turn_on(household)

    recalculated(rose)
    recalculated(indoor_water)

    assert factor(rose, "hot_spell") is None
    assert [f["code"] for f in indoor_water.factors] == [
        "season",
        "no_light_info",
        "no_pot_size",
        "not_logged",
    ]


def test_without_weather_watering_is_predicted_as_usual(
    service: FakeOpenMeteo, household: Household, rose: CareSchedule
) -> None:
    service.answer = OSError("Network is unreachable")
    turn_on(household)

    recalculated(rose)

    assert rose.next_due == date(2026, 4, 19)


# --- Background refresh -----------------------------------------------------------------------


def test_forecasts_are_refreshed_in_the_background_every_hour() -> None:
    [job] = hooks.register_periodic_jobs()

    assert (job.name, job.cron, job.function) == ("refresh", "7 * * * *", hooks.refresh_forecasts)


def test_only_households_that_turned_it_on_are_refreshed(
    service: FakeOpenMeteo, household: Household, site: Site
) -> None:
    other = SiteFactory.create(latitude=-33.87, longitude=151.21)
    turn_on(household)

    assert hooks.refresh_forecasts() == 1
    assert len(service.urls) == 1
    assert "latitude=52.37" in service.urls[0]
    assert not SiteWeather.objects.filter(site=other).exists()

    # Not fetched again while it's recent.
    assert hooks.refresh_forecasts() == 1
    assert len(service.urls) == 1


def test_a_failed_refresh_is_tried_again_next_time(
    service: FakeOpenMeteo, household: Household, site: Site
) -> None:
    service.answer = OSError("Network is unreachable")
    turn_on(household)

    assert hooks.refresh_forecasts() == 0
    service.answer = open_meteo()
    with time_machine.travel(NOW + timedelta(minutes=15), tick=False):
        assert hooks.refresh_forecasts() == 1


def test_settings_say_their_units_so_people_see_their_own() -> None:
    properties = Settings.model_json_schema()["properties"]

    assert properties["frost_c"]["unit"] == "celsius"
    assert properties["rain_mm"]["unit"] == "mm"
    assert "°C" not in properties["frost_c"]["title"]
