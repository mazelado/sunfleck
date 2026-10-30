"""Fetching forecasts from Open-Meteo, and keeping the latest one for each site.

A forecast is fetched when it's asked for and the stored one is a few hours old. When
Open-Meteo can't be reached, the stored forecast is used while it's less than a day old.
"""

import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from django.utils import timezone
from sunfleck.places.models import Site
from sunfleck.plugins import mark_site_out_of_date

from sunfleck_weather_openmeteo import plugin
from sunfleck_weather_openmeteo.models import SiteWeather

logger = logging.getLogger(__name__)

URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_SECONDS = 10
# How long a forecast is used before fetching a new one; and at most, if Open-Meteo is down.
REFRESH_AFTER = timedelta(hours=3)
USABLE_FOR = timedelta(hours=24)
# After a failed fetch, wait this long before trying again.
RETRY_AFTER = timedelta(minutes=15)
PAST_DAYS = 3
FORECAST_DAYS = 7
# Rounding coordinates to 2 decimals keeps a site's location to about 1 km.
COORDINATE_DECIMALS = 2


class WeatherError(Exception):
    """No forecast: Open-Meteo couldn't be reached, or answered something unexpected."""


@dataclass(frozen=True)
class Day:
    date: date
    min_c: float | None
    max_c: float | None
    precipitation_mm: float | None
    weather_code: int | None
    # The day's average dew point, for estimating indoor humidity.
    dew_point_c: float | None = None


@dataclass(frozen=True)
class Forecast:
    fetched_at: datetime
    temperature_c: float | None
    weather_code: int | None
    days: tuple[Day, ...]

    def day(self, on: date) -> Day | None:
        return next((day for day in self.days if day.date == on), None)

    def between(self, first: date, last: date) -> list[Day]:
        return [day for day in self.days if first <= day.date <= last]

    def to_json(self) -> dict[str, Any]:
        return {
            "temperature_c": self.temperature_c,
            "weather_code": self.weather_code,
            "days": [
                {
                    "date": day.date.isoformat(),
                    "min_c": day.min_c,
                    "max_c": day.max_c,
                    "precipitation_mm": day.precipitation_mm,
                    "weather_code": day.weather_code,
                    "dew_point_c": day.dew_point_c,
                }
                for day in self.days
            ],
        }

    @classmethod
    def from_json(cls, data: dict[str, Any], fetched_at: datetime) -> "Forecast":
        return cls(
            fetched_at=fetched_at,
            temperature_c=data["temperature_c"],
            weather_code=data["weather_code"],
            days=tuple(
                Day(
                    date=date.fromisoformat(day["date"]),
                    min_c=day["min_c"],
                    max_c=day["max_c"],
                    precipitation_mm=day["precipitation_mm"],
                    weather_code=day["weather_code"],
                    # Forecasts stored before 0.4 don't have it.
                    dew_point_c=day.get("dew_point_c"),
                )
                for day in data["days"]
            ),
        )


def request_url(latitude: float, longitude: float) -> str:
    query = {
        "latitude": round(latitude, COORDINATE_DECIMALS),
        "longitude": round(longitude, COORDINATE_DECIMALS),
        "current": "temperature_2m,weather_code",
        "daily": (
            "temperature_2m_min,temperature_2m_max,precipitation_sum,weather_code,dew_point_2m_mean"
        ),
        "timezone": "auto",
        "past_days": PAST_DAYS,
        "forecast_days": FORECAST_DAYS,
    }
    return f"{URL}?{urllib.parse.urlencode(query)}"


def download(url: str) -> Any:
    """Fetch and decode a JSON response. Replaced in tests."""
    request = urllib.request.Request(  # noqa: S310 - always the https URL above
        url,
        headers={
            "User-Agent": f"sunfleck-weather-openmeteo/{plugin.version} "
            "(+https://github.com/mazelado/sunfleck)"
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
        return json.load(response)


def parse(data: Any, fetched_at: datetime) -> Forecast:
    """Read Open-Meteo's answer.

    Raises:
        WeatherError: If it isn't a forecast in the expected shape.
    """
    try:
        current = data["current"]
        daily = data["daily"]
        dates = daily["time"]
        columns = [
            daily[name]
            for name in (
                "temperature_2m_min",
                "temperature_2m_max",
                "precipitation_sum",
                "weather_code",
            )
        ]
        dew_points = daily.get("dew_point_2m_mean") or [None] * len(dates)
        if any(len(column) != len(dates) for column in [*columns, dew_points]):
            raise WeatherError("The daily forecast's columns have different lengths.")
        days = tuple(
            Day(
                date.fromisoformat(day),
                low,
                high,
                rain,
                None if code is None else int(code),
                dew_point,
            )
            for day, low, high, rain, code, dew_point in zip(
                dates, *columns, dew_points, strict=True
            )
        )
        code = current.get("weather_code")
        return Forecast(
            fetched_at=fetched_at,
            temperature_c=current.get("temperature_2m"),
            weather_code=None if code is None else int(code),
            days=days,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise WeatherError(f"Unexpected answer from Open-Meteo: {exc!r}") from exc


def fetch(site: Site) -> Forecast:
    """Ask Open-Meteo for the site's forecast.

    Raises:
        WeatherError: If it can't be reached or answers something unexpected.
    """
    try:
        data = download(request_url(site.latitude, site.longitude))
    except (OSError, ValueError) as exc:  # network errors, timeouts, invalid JSON
        raise WeatherError(f"Open-Meteo couldn't be reached: {exc}") from exc
    return parse(data, timezone.now())


def forecast_for(site: Site) -> Forecast:
    """The site's forecast, fetching a new one if the stored one is a few hours old.

    When a new forecast differs from the stored one, the site's plants' predictions are
    recalculated.

    Raises:
        WeatherError: If there's no usable forecast: none could be fetched, and any stored one
            is more than a day old.
    """
    now = timezone.now()
    stored, _ = SiteWeather.objects.get_or_create(site=site)
    fresh = stored.fetched_at is not None and now - stored.fetched_at < REFRESH_AFTER
    tried_recently = stored.failed_at is not None and now - stored.failed_at < RETRY_AFTER
    failure: WeatherError | None = None
    if not fresh and not tried_recently:
        try:
            forecast = fetch(site)
        except WeatherError as exc:
            logger.warning("No new forecast for site %s", site.pk, exc_info=True)
            failure = exc
            stored.failed_at = now
            stored.save(update_fields=["failed_at"])
        else:
            changed = forecast.to_json() != stored.data
            stored.data = forecast.to_json()
            stored.fetched_at = forecast.fetched_at
            stored.failed_at = None
            stored.save(update_fields=["data", "fetched_at", "failed_at"])
            if changed:
                mark_site_out_of_date(site)
            return forecast
    if stored.fetched_at is None or now - stored.fetched_at >= USABLE_FOR:
        raise failure or WeatherError("There's no recent forecast for this site.")
    return Forecast.from_json(stored.data, stored.fetched_at)
