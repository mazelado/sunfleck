"""Frost dates from 20 years of Open-Meteo's past daily lows."""

from collections.abc import Callable, Iterator
from datetime import date, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import time_machine
from sunfleck.accounts.models import Household
from sunfleck.places import frost as places_frost
from sunfleck.places.models import FrostSource, Site
from sunfleck.places.tests.factories import SiteFactory
from sunfleck.plugins import FrostDates

from sunfleck_weather_openmeteo import frost, weather
from sunfleck_weather_openmeteo.tests.test_weather import NOW, FakeOpenMeteo, turn_on
from sunfleck_weather_openmeteo.weather import WeatherError

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):  # 15 April 2026
        yield


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> FakeOpenMeteo:
    fake = FakeOpenMeteo()
    monkeypatch.setattr(weather, "download", fake)
    return fake


@pytest.fixture
def site(household: Household) -> Site:
    return SiteFactory.create(household=household, latitude=52.37403, longitude=4.88969)


def archive(
    first_year: int = 2006,
    last_year: int = 2025,
    frost_on: Callable[[date], bool] = lambda day: False,
) -> dict[str, Any]:
    """An answer like Open-Meteo's archive: a low of -2 °C on frost days, else 5 °C."""
    days, lows = [], []
    day = date(first_year, 1, 1)
    while day <= date(last_year, 12, 31):
        days.append(day.isoformat())
        lows.append(-2.0 if frost_on(day) else 5.0)
        day += timedelta(days=1)
    return {"daily": {"time": days, "temperature_2m_min": lows}}


def northern(day: date) -> bool:
    """Frosts until 10 April and from 25 October, shifted by a day each year."""
    shift = day.year % 3 - 1  # -1, 0 or 1 day
    return day < date(day.year, 4, 10 + shift) or day >= date(day.year, 10, 25 + shift)


def test_the_typical_dates_are_the_median_of_the_years() -> None:
    dates = frost.estimate(archive(frost_on=northern), latitude=52.4)

    # The last frost is the day before frosts stop.
    assert dates == FrostDates(date(2000, 4, 9), date(2000, 10, 25), years=20)


def test_in_the_south_spring_comes_in_the_second_half_of_the_year() -> None:
    def southern(day: date) -> bool:
        return date(day.year, 5, 20) <= day < date(day.year, 9, 15)

    dates = frost.estimate(archive(frost_on=southern), latitude=-37.8)

    assert (dates.last_frost, dates.first_frost) == (date(2000, 9, 14), date(2000, 5, 20))


def test_where_most_years_have_no_frost_there_are_no_dates() -> None:
    def rarely(day: date) -> bool:  # a frosty January every third year
        return day.year % 3 == 0 and day.month == 1

    dates = frost.estimate(archive(frost_on=rarely), latitude=36.7)

    assert dates == FrostDates(None, None, years=20)


def test_too_few_years_or_an_odd_answer_give_no_estimate() -> None:
    with pytest.raises(WeatherError, match="Only 5 years"):
        frost.estimate(archive(first_year=2021, frost_on=northern), latitude=52.4)
    with pytest.raises(WeatherError, match="Unexpected answer"):
        frost.estimate({"daily": {}}, latitude=52.4)


def test_years_with_missing_days_are_left_out() -> None:
    data = archive(frost_on=northern)
    # Most of 2006 is missing.
    data["daily"]["temperature_2m_min"][:300] = [None] * 300

    assert frost.estimate(data, latitude=52.4).years == 19


def test_the_plugin_estimates_a_new_sites_frost_dates(
    service: FakeOpenMeteo, household: Household
) -> None:
    site = SiteFactory.create(household=household, latitude=52.37403, longitude=4.88969)
    service.answer = archive(frost_on=northern)
    turn_on(household)

    assert places_frost.estimate_missing() == 1

    site.refresh_from_db()
    assert (site.last_frost, site.first_frost) == (date(2000, 4, 9), date(2000, 10, 25))
    assert (site.frost_source, site.frost_years) == (FrostSource.ESTIMATED, 20)
    # From the rounded location, up to last year (it's 2026).
    [url] = service.urls
    assert url.startswith("https://archive-api.open-meteo.com/v1/archive?")
    query = {key: value[0] for key, value in parse_qs(urlparse(url).query).items()}
    assert query == {
        "latitude": "52.37",
        "longitude": "4.89",
        "start_date": "2006-01-01",
        "end_date": "2025-12-31",
        "daily": "temperature_2m_min",
        "timezone": "auto",
    }
    # Only once.
    assert places_frost.estimate_missing() == 0


def test_without_an_answer_it_asks_again_later(service: FakeOpenMeteo, site: Site) -> None:
    service.answer = OSError("Name or service not known")
    turn_on(site.household)

    assert places_frost.estimate_missing() == 0

    site.refresh_from_db()
    assert site.frost_source == ""
    service.answer = archive(frost_on=northern)
    assert places_frost.estimate_missing() == 1


def test_entered_dates_are_never_replaced(service: FakeOpenMeteo, site: Site) -> None:
    service.answer = archive(frost_on=northern)
    turn_on(site.household)
    places_frost.set_frost_dates(site, date(2026, 5, 15), None)

    assert places_frost.estimate_missing() == 0
    site.refresh_from_db()
    assert (site.last_frost, site.frost_source) == (date(2000, 5, 15), FrostSource.ENTERED)
    assert service.urls == []
