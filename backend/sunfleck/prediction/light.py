"""Estimating the daily light integral (DLI, mol/m²/day) that reaches a plant.

These are rough estimates for a typical day, good enough to tell a dim corner from a sunny
windowsill. They assume clear-ish glass and average weather; the prediction only uses them to
nudge the watering interval, within limits.
"""

import math
from dataclasses import dataclass

from sunfleck.prediction.seasons import Season, is_southern

# DLI right at a window in spring or autumn at mid-latitudes, by the way it faces relative to
# the equator: equator-facing windows (south in the north, north in the south) get the most sun.
_WINDOW_DLI = {
    "equator": 18.0,
    "equator_diagonal": 15.0,  # SE, SW in the north
    "side": 11.0,  # E, W
    "pole_diagonal": 6.0,  # NE, NW in the north
    "pole": 4.0,
}
_NORTHERN_FACING = {
    "S": "equator",
    "SE": "equator_diagonal",
    "SW": "equator_diagonal",
    "E": "side",
    "W": "side",
    "NE": "pole_diagonal",
    "NW": "pole_diagonal",
    "N": "pole",
}
_SOUTHERN_FACING = {
    "N": "equator",
    "NE": "equator_diagonal",
    "NW": "equator_diagonal",
    "E": "side",
    "W": "side",
    "SE": "pole_diagonal",
    "SW": "pole_diagonal",
    "S": "pole",
}

# Light indoors falls off quickly away from the glass: to about a third at 1 m.
WINDOW_FALLOFF_CM = 90.0
# When a plant's distance from a window isn't known, assume it's about a metre away.
ASSUMED_WINDOW_DISTANCE_CM = 100

# Outdoor DLI in spring or autumn at mid-latitudes.
_EXPOSURE_DLI = {"full_sun": 35.0, "part_shade": 18.0, "shade": 8.0}

# Even a glasshouse rarely gets more than this indoors.
MAX_INDOOR_DLI = 45.0

# Where a site's latitude isn't known, assume a mid-latitude one.
ASSUMED_LATITUDE = 45.0


@dataclass(frozen=True)
class Window:
    direction: str  # N, NE, E, SE, S, SW, W, NW
    distance_cm: int | None = None


@dataclass(frozen=True)
class GrowLight:
    dli: float


def seasonal_sun(season: Season, latitude: float | None) -> float:
    """How much daylight a season gets compared with spring and autumn.

    Further from the equator, summers are brighter and winters darker. Near the equator,
    seasons barely differ.
    """
    strength = min(abs(latitude if latitude is not None else ASSUMED_LATITUDE), 60.0) / 45.0
    if season is Season.SUMMER:
        return 1 + 0.35 * strength
    if season is Season.WINTER:
        return 1 - 0.45 * strength
    return 1.0


def window_dli(window: Window, season: Season, latitude: float | None) -> float:
    facing = (_SOUTHERN_FACING if is_southern(latitude) else _NORTHERN_FACING)[window.direction]
    distance = window.distance_cm if window.distance_cm is not None else ASSUMED_WINDOW_DISTANCE_CM
    falloff = math.exp(-distance / WINDOW_FALLOFF_CM)
    return _WINDOW_DLI[facing] * falloff * seasonal_sun(season, latitude)


def indoor_dli(
    windows: tuple[Window, ...],
    grow_lights: tuple[GrowLight, ...],
    season: Season,
    latitude: float | None,
) -> float | None:
    """The estimated DLI for an indoor plant, or None if no light sources are known."""
    if not windows and not grow_lights:
        return None
    total = sum(window_dli(window, season, latitude) for window in windows) + sum(
        light.dli for light in grow_lights
    )
    return min(total, MAX_INDOOR_DLI)


def outdoor_dli(exposure: str | None, season: Season, latitude: float | None) -> float | None:
    """The estimated DLI for an outdoor plant, or None if its exposure isn't known."""
    if not exposure:
        return None
    return _EXPOSURE_DLI[exposure] * seasonal_sun(season, latitude)
