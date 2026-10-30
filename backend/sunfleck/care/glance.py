"""Care at a glance: how far each plant is through its watering and fertilizing, and how its
light compares with what it likes, for the slim bars on plant cards and pages.

Everything here is already known: the schedules' last predictions and the light estimate.
Nothing is recalculated, so a long list of plants stays quick.
"""

from dataclasses import dataclass
from datetime import date

from sunfleck.care.models import CareSchedule
from sunfleck.care.schedules import local_today, plant_lights
from sunfleck.places.models import LocationKind
from sunfleck.plants.models import Plant
from sunfleck.prediction.engine import Conditions, Profile, light_level
from sunfleck.prediction.seasons import season_of


@dataclass(frozen=True)
class CareLevel:
    """Where a plant is between two waterings (or fertilizings).

    `level` goes from 1 just after the care to 0 when it's due (and stays 0 when overdue).
    While the care rests (a resting season or a pause in fertilizing), `level` and
    `due_in_days` are None and `resting_until` says when it starts again, if known.
    """

    level: float | None
    due_in_days: int | None
    resting_until: date | None = None


@dataclass(frozen=True)
class LightLevel:
    """The light at the plant's spot (DLI, mol/m²/day) and what its care profile likes there
    at this time of year."""

    dli: float
    ideal: float


@dataclass(frozen=True)
class Glance:
    water: CareLevel | None
    fertilizer: CareLevel | None
    light: LightLevel | None


def glance(plant: Plant, today: date | None = None) -> Glance:
    """Reads `plant.schedules` and `plant.light_links`: prefetch `schedules__care_type` and
    `light_links__light_source` when doing this for many plants."""
    today = today or local_today(plant)
    schedules = [schedule for schedule in plant.schedules.all() if schedule.enabled]
    water = next((s for s in schedules if s.care_type.counts_as_watering), None)
    fertilizer = next((s for s in schedules if s.care_type.key == "fertilize"), None)
    return Glance(
        water=care_level(water, today) if water else None,
        fertilizer=care_level(fertilizer, today) if fertilizer else None,
        light=light_glance(plant, today),
    )


def care_level(schedule: CareSchedule, today: date) -> CareLevel | None:
    if schedule.next_due is None:
        return None
    if schedule.interval_days is None:
        return CareLevel(None, None, resting_until=schedule.next_due)
    due = max(schedule.next_due, schedule.snoozed_until or schedule.next_due)
    days_left = (due - today).days
    level = min(max(days_left / schedule.interval_days, 0.0), 1.0)
    return CareLevel(round(level, 2), days_left)


def light_glance(plant: Plant, today: date) -> LightLevel | None:
    archetype = plant.effective_care_profile
    location = plant.location
    if archetype is None or location is None:
        return None
    latitude = location.site.latitude
    if location.kind == LocationKind.OUTDOOR:
        conditions = Conditions(indoor=False, latitude=latitude, exposure=location.exposure or None)
    else:
        windows, grow_lights = plant_lights(plant)
        conditions = Conditions(
            indoor=True, latitude=latitude, windows=windows, grow_lights=grow_lights
        )
    level = light_level(
        Profile.from_dataset(archetype.profile), conditions, season_of(today, latitude)
    )
    if level is None:
        return None
    dli, ideal = level
    return LightLevel(round(dli, 1), round(ideal, 1))
