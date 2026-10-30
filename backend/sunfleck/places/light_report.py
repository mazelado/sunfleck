"""How much light a plant's spot, or each light source in a location, gets through the year.

Uses the same estimates as the watering predictions (sunfleck.prediction.light), season by
season, which is as fine as those estimates go.
"""

from dataclasses import dataclass
from datetime import date

from sunfleck.places.light import grow_light_dli
from sunfleck.places.models import LightSource, LightSourceKind, Location, LocationKind
from sunfleck.plants.models import Plant
from sunfleck.prediction.engine import Profile
from sunfleck.prediction.light import (
    MAX_INDOOR_DLI,
    Window,
    light_verdict,
    outdoor_dli,
    seasonal_sun,
    window_dli,
)
from sunfleck.prediction.seasons import Season, season_of


@dataclass(frozen=True)
class SourceLight:
    """One window or grow light, and the light it gives in each season (DLI, mol/m²/day)."""

    source: LightSource
    distance_cm: int | None
    dli: dict[Season, float]


@dataclass(frozen=True)
class SeasonLight:
    season: Season
    dli: float
    # What the care profile likes there in that season, and how the spot compares.
    ideal: float
    verdict: str


@dataclass(frozen=True)
class PlantLightReport:
    current_season: Season
    seasons: list[SeasonLight]
    sources: list[SourceLight]


def source_light(
    light: LightSource, latitude: float | None, distance_cm: int | None = None
) -> SourceLight | None:
    """A window's light at `distance_cm` from it (a typical distance if None), or a grow
    light's; None if it isn't known (a window without a direction, a grow light without its
    brightness or hours)."""
    if light.kind == LightSourceKind.WINDOW:
        if not light.direction:
            return None
        window = Window(light.direction, distance_cm)
        return SourceLight(
            light,
            distance_cm,
            {season: round(window_dli(window, season, latitude), 1) for season in Season},
        )
    if light.ppfd and light.on_time and light.off_time:
        dli = round(grow_light_dli(light.ppfd, light.on_time, light.off_time), 1)
        return SourceLight(light, None, dict.fromkeys(Season, dli))
    return None


def plant_light_report(plant: Plant, today: date) -> PlantLightReport | None:
    """The light at the plant's spot in each season, compared with what it likes. None without
    a location, a care profile, or anything known about the light there."""
    location = plant.location
    archetype = plant.effective_care_profile
    if location is None or archetype is None:
        return None
    latitude = location.site.latitude
    profile = Profile.from_dataset(archetype.profile)
    sources: list[SourceLight] = []
    if location.kind == LocationKind.OUTDOOR:
        totals = {
            season: outdoor_dli(location.exposure or None, season, latitude) for season in Season
        }
    else:
        for link in plant.light_links.select_related("light_source"):
            if link.light_source.enabled:
                found = source_light(link.light_source, latitude, link.distance_cm)
                if found:
                    sources.append(found)
        totals = {
            season: min(sum(source.dli[season] for source in sources), MAX_INDOOR_DLI)
            if sources
            else None
            for season in Season
        }
    seasons = []
    for season, dli in totals.items():
        if dli is None:
            return None
        ideal = profile.dli_ideal * seasonal_sun(season, latitude)
        seasons.append(
            SeasonLight(season, round(dli, 1), round(ideal, 1), light_verdict(dli, ideal))
        )
    return PlantLightReport(season_of(today, latitude), seasons, sources)


def location_light(location: Location) -> list[SourceLight]:
    """Each window (at a typical distance) and grow light in the location, through the year."""
    latitude = location.site.latitude
    found = (source_light(light, latitude) for light in location.light_sources.all())
    return [light for light in found if light is not None]
