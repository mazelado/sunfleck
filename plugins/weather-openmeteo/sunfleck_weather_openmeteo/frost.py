"""A site's typical frost dates, from 20 years of Open-Meteo's past daily lows.

For each year: the last day at or below 0 °C in spring, and the first in autumn. The typical
date is the median of those years; when most years have no spring (or autumn) frost, there's
none. In the southern hemisphere, spring is in the second half of the calendar year.
"""

import statistics
import urllib.parse
from collections.abc import Sequence
from datetime import date, timedelta
from typing import Any

from sunfleck.places.models import Site
from sunfleck.plugins import FrostDates

from sunfleck_weather_openmeteo import weather
from sunfleck_weather_openmeteo.weather import COORDINATE_DECIMALS, WeatherError

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
YEARS = 20
# At least this many complete years for an estimate.
MIN_YEARS = 10
# Air at 2 m at or below this is counted as a frost (ground frost can come a little sooner).
FROST_C = 0.0
# A year's frosts before 1 July are spring's in the north and autumn's in the south (winter
# falls around the turn of the year in the north, and around July in the south).
SPLIT = (7, 1)


def request_url(latitude: float, longitude: float, last_year: int) -> str:
    query = {
        "latitude": round(latitude, COORDINATE_DECIMALS),
        "longitude": round(longitude, COORDINATE_DECIMALS),
        "start_date": f"{last_year - YEARS + 1}-01-01",
        "end_date": f"{last_year}-12-31",
        "daily": "temperature_2m_min",
        "timezone": "auto",
    }
    return f"{ARCHIVE_URL}?{urllib.parse.urlencode(query)}"


def _day_of_year(day: date) -> int:
    """Days since 1 January, in a leap year, so the same day and month always count the same."""
    return (date(2000, day.month, day.day) - date(2000, 1, 1)).days


def _from_day_of_year(days: float) -> date:
    return date(2000, 1, 1) + timedelta(days=round(days))


def _median(days: Sequence[int], years: int) -> date | None:
    """The typical day, or None when most years didn't have one."""
    if len(days) * 2 <= years:
        return None
    return _from_day_of_year(statistics.median(days))


def estimate(data: Any, latitude: float) -> FrostDates:
    """The typical frost dates in Open-Meteo's daily lows (`daily.time`, `temperature_2m_min`).

    Raises:
        WeatherError: If the answer isn't usable, or has too few years.
    """
    try:
        days = [date.fromisoformat(day) for day in data["daily"]["time"]]
        lows = [None if low is None else float(low) for low in data["daily"]["temperature_2m_min"]]
    except (KeyError, TypeError, ValueError) as exc:
        raise WeatherError(f"Unexpected answer from Open-Meteo: {exc!r}") from exc
    by_year: dict[int, list[tuple[date, float | None]]] = {}
    for day, low in zip(days, lows, strict=True):
        by_year.setdefault(day.year, []).append((day, low))
    # Only years with (almost) every day measured.
    years = {year: entries for year, entries in by_year.items() if _complete(entries)}
    if len(years) < MIN_YEARS:
        raise WeatherError(f"Only {len(years)} years of weather to estimate frost dates from")
    lasts, firsts = [], []
    for year, entries in years.items():
        split = date(year, *SPLIT)
        frosts = [day for day, low in entries if low is not None and low <= FROST_C]
        first_half = [day for day in frosts if day < split]
        second_half = [day for day in frosts if day >= split]
        spring, autumn = (first_half, second_half) if latitude >= 0 else (second_half, first_half)
        if spring:
            lasts.append(_day_of_year(max(spring)))
        if autumn:
            firsts.append(_day_of_year(min(autumn)))
    return FrostDates(
        last_frost=_median(lasts, len(years)),
        first_frost=_median(firsts, len(years)),
        years=len(years),
    )


def _complete(entries: Sequence[tuple[date, float | None]]) -> bool:
    measured = sum(low is not None for _, low in entries)
    return measured >= 360


def frost_dates_for(site: Site, today: date) -> FrostDates:
    """Ask Open-Meteo for the site's past weather, up to last year, and estimate its frost
    dates.

    Raises:
        WeatherError: If it can't be reached, or its answer isn't usable.
    """
    try:
        data = weather.download(request_url(site.latitude, site.longitude, today.year - 1))
    except (OSError, ValueError) as exc:  # network errors, timeouts, invalid JSON
        raise WeatherError(f"Open-Meteo couldn't be reached: {exc}") from exc
    return estimate(data, site.latitude)
