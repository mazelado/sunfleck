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
    PeriodicJob,
    SettingsCheck,
    SiteConditions,
    hookimpl,
    is_enabled,
    soil_water_mm,
    water_use,
)

from sunfleck_weather_openmeteo import Settings, plugin, weather
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
# The first millimetres of each day's rain mostly wet leaves and the soil's surface, and
# evaporate: only the rest counts for the soil (as in FAO-56's effective rainfall, simplified).
RAIN_LOST_MM = 2


# Every hour, refresh forecasts that are 3 hours old (see weather.REFRESH_AFTER).
REFRESH_CRON = "7 * * * *"


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
        dew_point_c=day.dew_point_c if day else None,
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
    balance = _water_balance(context, forecast)
    if balance is not None:
        # It counts the rain and the heat itself.
        return [balance]
    return _rules_of_thumb(context, forecast, settings)


def _water_balance(context: CareContext, forecast: Forecast) -> Adjustment | None:
    """When the soil is dry again, from a simplified FAO-56 water balance.

    Since the last watering, each day takes ET₀ times the plant's water use out of the water the
    soil holds (see soil_water_mm), and each day's rain beyond RAIN_LOST_MM puts water back,
    up to what the soil holds. Past days are as measured, coming days as forecast. The plant is
    due the day the soil runs dry, or after the forecast if it doesn't. None when Open-Meteo
    has no ET₀ for every day needed (forecasts stored before 0.6): the rules of thumb apply.
    """
    today = context.today
    first = forecast.days[0].date if forecast.days else today
    start = context.last_done or context.started_on or first
    # Watered longer ago than the forecast goes back: count from its first day, the soil
    # full then (the soonest it could be due is today anyway).
    day = max(start, first - timedelta(days=1)) + timedelta(days=1)
    capacity = soil_water_mm(context.profile, context.conditions)
    use = water_use(context.profile)
    water = capacity
    used = rain = 0.0
    last = forecast.days[-1].date if forecast.days else today
    dry_on = None
    while day <= last:
        weather = forecast.day(day)
        if weather is None or weather.et0_mm is None:
            return None
        out = weather.et0_mm * use
        into = max((weather.precipitation_mm or 0) - RAIN_LOST_MM, 0)
        water = min(water - out + into, capacity)
        if day <= today:
            used += out
            rain += into
        if water <= 0:
            dry_on = day
            break
        day += timedelta(days=1)
    details = {
        "capacity_mm": round(capacity, 1),
        "used_mm": round(used, 1),
        "rain_mm": round(rain, 1),
        "water_use": use,
        "since": start.isoformat(),
        "dry_on": dry_on.isoformat() if dry_on else None,
    }
    return Adjustment(
        Factor("water_balance", details=details),
        due_on=dry_on or last + timedelta(days=1),
    )


def _rules_of_thumb(
    context: CareContext, forecast: Forecast, settings: Settings
) -> list[Adjustment]:
    """Without ET₀: put watering off after rain (or before forecast rain), and water sooner in
    a hot spell."""
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


@hookimpl
def register_periodic_jobs() -> list[PeriodicJob]:
    return [PeriodicJob("refresh", REFRESH_CRON, refresh_forecasts)]


def refresh_forecasts() -> int:
    """Refresh the forecasts of sites in households that turned the plugin on (when they're a
    few hours old), so the Today page and predictions don't wait for Open-Meteo. Returns how
    many sites have a usable forecast."""
    usable = 0
    enabled: dict[int, bool] = {}
    for site in Site.objects.select_related("household").order_by("pk"):
        household_id = site.household_id
        if household_id not in enabled:
            enabled[household_id] = is_enabled(site.household, plugin.id)
        if not enabled[household_id]:
            continue
        try:
            forecast_for(site)
        except WeatherError:
            continue  # logged in forecast_for; tried again next time
        usable += 1
    return usable


@hookimpl
def check_settings() -> SettingsCheck:
    """Whether Open-Meteo can be reached from this server: its settings can't be wrong in a way
    a test would show."""
    return weather.check()
