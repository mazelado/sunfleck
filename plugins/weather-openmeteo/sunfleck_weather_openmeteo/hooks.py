"""The weather plugin's hooks: conditions for the Today page, and outdoor watering factors."""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone
from sunfleck.places.models import LocationKind, Site
from sunfleck.plugins import (
    Adjustment,
    Alert,
    CareContext,
    Factor,
    SiteConditions,
    hookimpl,
)

from sunfleck_weather_openmeteo import Settings
from sunfleck_weather_openmeteo.weather import Forecast, WeatherError, forecast_for

ATTRIBUTION = "Weather data by Open-Meteo.com"
# Frost warnings look at tonight and the next two nights.
FROST_DAYS = 3
# Rain keeps outdoor soil moist for about this long.
RAIN_WAIT_DAYS = 2
# A hot spell: the next few days' highs, compared with the care profile's ideal maximum.
HEAT_DAYS = 3
HEAT_PER_DEGREE = 0.03
MOST_HEAT = 0.75


def site_today(site: Site) -> date:
    return timezone.now().astimezone(ZoneInfo(site.timezone)).date()


@hookimpl
def site_conditions(site: Site, settings: Settings) -> SiteConditions:
    """The site's weather now and today, and a frost warning for sites with outdoor plants.

    Raises:
        WeatherError: If there's no forecast; the app shows the error to Admins.
    """
    forecast = forecast_for(site)
    today = site_today(site)
    day = forecast.day(today)
    alerts = []
    if site.locations.filter(kind=LocationKind.OUTDOOR).exists():
        frost = _first_frost(forecast, today, settings.frost_c)
        if frost:
            alerts.append(frost)
    return SiteConditions(
        attribution=ATTRIBUTION,
        updated_at=forecast.fetched_at,
        temperature_c=forecast.temperature_c,
        today_min_c=day.min_c if day else None,
        today_max_c=day.max_c if day else None,
        precipitation_mm=day.precipitation_mm if day else None,
        weather_code=forecast.weather_code,
        alerts=tuple(alerts),
    )


def _first_frost(forecast: Forecast, today: date, frost_c: float) -> Alert | None:
    for day in forecast.between(today, today + timedelta(days=FROST_DAYS - 1)):
        if day.min_c is not None and day.min_c <= frost_c:
            return Alert("frost", day.date, {"min_c": day.min_c})
    return None


@hookimpl
def care_factors(context: CareContext, settings: Settings) -> list[Adjustment]:
    """For outdoor plants: put watering off after rain (or before forecast rain), and water
    sooner in a hot spell.

    Cool weather isn't counted: the care profile's seasonal intervals already allow for it.
    """
    if context.site is None or context.conditions.indoor is not False:
        return []
    try:
        forecast = forecast_for(context.site)
    except WeatherError:
        # Predictions carry on without the weather; the Today page reports the problem.
        return []
    today = context.today
    adjustments = []

    highs = [
        day.max_c
        for day in forecast.between(today, today + timedelta(days=HEAT_DAYS - 1))
        if day.max_c is not None
    ]
    if highs:
        high = sum(highs) / len(highs)
        excess = high - context.profile.temperature_ideal_max
        if excess > 0:
            multiplier = max(1 - HEAT_PER_DEGREE * excess, MOST_HEAT)
            adjustments.append(
                Adjustment(
                    Factor(
                        "hot_spell",
                        multiplier,
                        {
                            "max_c": round(high, 1),
                            "ideal_max_c": context.profile.temperature_ideal_max,
                        },
                    )
                )
            )

    recent = forecast.between(today - timedelta(days=1), today)
    rain = sum(day.precipitation_mm or 0 for day in recent)
    tomorrow = forecast.day(today + timedelta(days=1))
    if rain >= settings.rain_mm:
        adjustments.append(
            Adjustment(
                Factor("rain", details={"mm": round(rain, 1)}),
                not_before=today + timedelta(days=RAIN_WAIT_DAYS),
            )
        )
    elif (
        settings.wait_for_rain
        and tomorrow is not None
        and (tomorrow.precipitation_mm or 0) >= settings.rain_mm
    ):
        adjustments.append(
            Adjustment(
                Factor(
                    "rain_forecast",
                    details={
                        "mm": round(tomorrow.precipitation_mm or 0, 1),
                        "on": tomorrow.date.isoformat(),
                    },
                ),
                not_before=tomorrow.date + timedelta(days=1),
            )
        )
    return adjustments
