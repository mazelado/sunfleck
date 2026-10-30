"""The humidity of an indoor location: the person's setting, or an estimate from the weather."""

from dataclasses import dataclass

from sunfleck.places.models import Location, LocationKind
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import SiteConditions
from sunfleck.prediction.engine import HUMIDITY_SETTING
from sunfleck.prediction.humidity import indoor_humidity

# A room's temperature when the location doesn't say.
TYPICAL_ROOM_C = 21.0


@dataclass(frozen=True)
class LocationHumidity:
    percent: float
    # Worked out from the weather, rather than the location's own setting.
    estimated: bool


def location_humidity(location: Location) -> LocationHumidity | None:
    """The location's own setting wins; without one, today's estimate, if there is one."""
    if location.kind != LocationKind.INDOOR:
        return None
    if location.humidity:
        return LocationHumidity(HUMIDITY_SETTING[location.humidity], estimated=False)
    estimate = estimated_humidity(location)
    return LocationHumidity(estimate, estimated=True) if estimate is not None else None


def estimated_humidity(location: Location) -> float | None:
    """Today's indoor humidity estimated from the site's weather (a plugin), in %.

    None without a weather plugin, or when it isn't cold enough outside for the estimate to
    hold (see prediction.humidity).
    """
    site = location.site
    known = [
        value
        for value in (location.temperature_min_c, location.temperature_max_c)
        if value is not None
    ]
    room_c = sum(known) / len(known) if known else TYPICAL_ROOM_C
    for answer in registry.call("site_conditions", site.household, SiteConditions, site=site):
        weather: SiteConditions = answer.result
        dew_point, low, high = weather.dew_point_c, weather.today_min_c, weather.today_max_c
        if dew_point is None or low is None or high is None:
            continue
        return indoor_humidity(dew_point, (low + high) / 2, room_c)
    return None
