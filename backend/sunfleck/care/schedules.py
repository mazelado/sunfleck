"""Care schedules: suggesting a routine, and keeping each schedule's prediction up to date.

The prediction engine (sunfleck.prediction) does the calculation; this module gathers its
inputs from the database and stores the results. Schedules are recalculated when they're
created or changed, whenever they're read, and by `manage.py recalculate_schedules` (which the
nightly job will run), so they follow changes to the plant, its location and light, its care
log, and the date.
"""

from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from sunfleck.care.models import (
    CareEvent,
    CareSchedule,
    CareType,
    ScheduleAdjustment,
    ScheduleMode,
    ScheduleOrigin,
)
from sunfleck.care.services import CareError, care_types_for
from sunfleck.places.light import grow_light_dli
from sunfleck.places.models import LightSourceKind, LocationKind
from sunfleck.plants.models import Plant, PlantStatus
from sunfleck.prediction.engine import (
    FEEDBACK_MEMORY,
    Conditions,
    Factor,
    History,
    Prediction,
    Profile,
    predict_fertilizing,
    predict_fixed,
    predict_watering,
)
from sunfleck.prediction.light import GrowLight, Window

# Care that isn't predicted, suggested for every plant, or only indoor ones:
# (care type key, every so many days, indoor only).
SUGGESTED_FIXED = [("rotate", 14, True), ("pest_check", 30, False)]


def can_predict(care_type: CareType) -> bool:
    """Whether the engine can predict this care: watering of any kind, and fertilizing."""
    return care_type.counts_as_watering or care_type.key == "fertilize"


def plant_zone(plant: Plant) -> ZoneInfo:
    """The time zone of the plant's site, which decides what "today" is for it."""
    return ZoneInfo(plant.location.site.timezone if plant.location else settings.TIME_ZONE)


def local_today(plant: Plant) -> date:
    return timezone.now().astimezone(plant_zone(plant)).date()


# --- Inputs -----------------------------------------------------------------------------------


def conditions_for(plant: Plant) -> Conditions:
    """Where and how the plant grows, as the engine needs it."""
    plant_only = Conditions(
        pot_diameter_cm=plant.container_diameter_cm,
        pot_material=plant.container_material or None,
        dormant=plant.status == PlantStatus.DORMANT,
    )
    location = plant.location
    if location is None:
        return plant_only
    if location.kind == LocationKind.OUTDOOR:
        return replace(
            plant_only,
            indoor=False,
            latitude=location.site.latitude,
            exposure=location.exposure or None,
        )
    windows = []
    grow_lights = []
    for link in plant.light_links.select_related("light_source").filter(light_source__enabled=True):
        light = link.light_source
        if light.kind == LightSourceKind.WINDOW and light.direction:
            windows.append(Window(light.direction, link.distance_cm))
        elif light.ppfd and light.on_time and light.off_time:
            grow_lights.append(GrowLight(grow_light_dli(light.ppfd, light.on_time, light.off_time)))
    return replace(
        plant_only,
        indoor=True,
        latitude=location.site.latitude,
        windows=tuple(windows),
        grow_lights=tuple(grow_lights),
        temperature_min_c=location.temperature_min_c,
        temperature_max_c=location.temperature_max_c,
    )


def history_for(plant: Plant, care_type: CareType, started_on: date) -> History:
    """When this care was last done, and (for watering) recent soil feedback.

    Any kind of watering counts for a watering schedule. Skipped care counts too: checking and
    deciding not to water starts the wait again.
    """
    events = CareEvent.objects.filter(plant=plant)
    if care_type.counts_as_watering:
        events = events.filter(care_type__counts_as_watering=True)
    else:
        events = events.filter(care_type=care_type)
    last = events.order_by("-performed_at").values_list("performed_at", flat=True).first()
    feedback: list[str] = []
    if care_type.counts_as_watering:
        recent = (
            events.exclude(feedback="")
            .order_by("-performed_at", "-id")
            .values_list("feedback", flat=True)[:FEEDBACK_MEMORY]
        )
        feedback = list(reversed(recent))
    return History(
        last_done=last.astimezone(plant_zone(plant)).date() if last else None,
        started_on=started_on,
        feedback=feedback,
    )


# --- Predictions ------------------------------------------------------------------------------


def predict(schedule: CareSchedule, today: date) -> Prediction:
    """The schedule's prediction for `today` (whether or not it's saved)."""
    if not schedule.enabled:
        return Prediction(None, None, (Factor("not_in_use"),))
    history = history_for(schedule.plant, schedule.care_type, schedule.started_on)
    if schedule.mode == ScheduleMode.FIXED:
        return predict_fixed(schedule.fixed_interval_days or 1, history)
    archetype = schedule.plant.effective_care_profile
    if archetype is None:
        return Prediction(None, None, (Factor("no_care_profile"),))
    profile = Profile.from_dataset(archetype.profile)
    conditions = conditions_for(schedule.plant)
    if schedule.care_type.counts_as_watering:
        return predict_watering(profile, conditions, history, today)
    return predict_fertilizing(profile, conditions, history, today)


def factors_json(factors: Iterable[Factor]) -> list[dict[str, Any]]:
    return [
        {"code": factor.code, "multiplier": round(factor.multiplier, 3), "details": factor.details}
        for factor in factors
    ]


def recalculate(schedule: CareSchedule, today: date | None = None) -> CareSchedule:
    """Bring the schedule's prediction up to date, recording it if it changed."""
    today = today or local_today(schedule.plant)
    prediction = predict(schedule, today)
    factors = factors_json(prediction.factors)
    changed = (schedule.interval_days, schedule.next_due, schedule.factors) != (
        prediction.interval_days,
        prediction.next_due,
        factors,
    )
    if not changed and schedule.calculated_on == today:
        return schedule
    schedule.interval_days = prediction.interval_days
    schedule.next_due = prediction.next_due
    schedule.factors = factors
    schedule.calculated_on = today
    schedule.save(
        update_fields=["interval_days", "next_due", "factors", "calculated_on", "updated_at"]
    )
    if changed:
        ScheduleAdjustment.objects.create(
            schedule=schedule,
            calculated_at=timezone.now(),
            interval_days=prediction.interval_days,
            next_due=prediction.next_due,
            factors=factors,
        )
    return schedule


def schedules_for(plant: Plant) -> list[CareSchedule]:
    """The plant's schedules, each up to date."""
    today = local_today(plant)
    schedules = list(
        plant.schedules.select_related("care_type").order_by(
            F("care_type__household_id").asc(nulls_first=True), "care_type_id"
        )
    )
    for schedule in schedules:
        schedule.plant = plant  # already loaded, with its location and profile
        recalculate(schedule, today)
    return schedules


def recalculate_all() -> int:
    """Recalculate every schedule; return how many there are."""
    plants = Plant.objects.filter(schedules__isnull=False).distinct()
    count = 0
    for plant in plants.select_related(
        "location__site", "taxon__archetype", "care_profile"
    ).iterator():
        count += len(schedules_for(plant))
    return count


# --- The suggested routine --------------------------------------------------------------------


@dataclass(frozen=True)
class Suggestion:
    care_type: CareType
    mode: ScheduleMode
    fixed_interval_days: int | None
    # Whether we'd recommend it for this plant, or just offer it.
    recommended: bool
    prediction: Prediction


def suggest_routine(plant: Plant) -> list[Suggestion]:
    """Schedules we'd suggest for the plant, for care it has no schedule for yet.

    Watering and fertilizing are predicted from its care profile, so they're only suggested
    when it has one (and the profile ever needs them). Rotating (indoors) and checking for
    pests are offered every few weeks.
    """
    today = local_today(plant)
    scheduled = set(plant.schedules.values_list("care_type_id", flat=True))
    has_watering = plant.schedules.filter(care_type__counts_as_watering=True).exists()
    builtins = {care_type.key: care_type for care_type in CareType.objects.filter(household=None)}
    candidates: list[tuple[CareType, ScheduleMode, int | None, bool]] = []
    archetype = plant.effective_care_profile
    if archetype is not None:
        profile = Profile.from_dataset(archetype.profile)
        if not has_watering and any(days for days in profile.watering_days.values()):
            candidates.append((builtins["water"], ScheduleMode.PREDICTED, None, True))
        if profile.fertilize_days is not None:
            candidates.append((builtins["fertilize"], ScheduleMode.PREDICTED, None, True))
    indoor = plant.location is not None and plant.location.kind == LocationKind.INDOOR
    for key, days, indoor_only in SUGGESTED_FIXED:
        if indoor or not indoor_only:
            candidates.append((builtins[key], ScheduleMode.FIXED, days, False))

    suggestions = []
    for care_type, mode, interval, recommended in candidates:
        if care_type.pk in scheduled:
            continue
        draft = CareSchedule(
            plant=plant,
            care_type=care_type,
            mode=mode,
            fixed_interval_days=interval,
            started_on=today,
        )
        suggestions.append(
            Suggestion(care_type, mode, interval, recommended, predict(draft, today))
        )
    return suggestions


# --- Changing schedules -----------------------------------------------------------------------


@dataclass(frozen=True)
class ScheduleData:
    care_type_id: int
    mode: ScheduleMode
    fixed_interval_days: int | None = None
    enabled: bool = True


def _apply(schedule: CareSchedule, data: ScheduleData) -> None:
    plant = schedule.plant
    if schedule.pk is None:
        care_type = care_types_for(plant.household).filter(pk=data.care_type_id).first()
        if care_type is None:
            raise CareError("care_type_not_found", "This care type doesn't exist.", "care_type_id")
        if plant.schedules.filter(care_type=care_type).exists():
            raise CareError(
                "schedule_exists", "This plant already has a schedule for this.", "care_type_id"
            )
        if (
            care_type.counts_as_watering
            and plant.schedules.filter(care_type__counts_as_watering=True).exists()
        ):
            raise CareError(
                "watering_scheduled",
                "This plant already has a watering schedule.",
                "care_type_id",
            )
        schedule.care_type = care_type
    if data.mode == ScheduleMode.PREDICTED:
        if not can_predict(schedule.care_type):
            raise CareError(
                "cannot_predict", "Only watering and fertilizing can be predicted.", "mode"
            )
        if plant.effective_care_profile is None:
            raise CareError(
                "no_care_profile",
                "Choose the plant's species or care profile to predict its care.",
                "mode",
            )
    elif not data.fixed_interval_days:
        raise CareError("interval_required", "Say every how many days.", "fixed_interval_days")
    schedule.mode = data.mode
    schedule.fixed_interval_days = (
        data.fixed_interval_days if data.mode == ScheduleMode.FIXED else None
    )
    schedule.enabled = data.enabled
    schedule.save()
    recalculate(schedule)


def create_schedule(
    plant: Plant, data: ScheduleData, origin: ScheduleOrigin = ScheduleOrigin.MANUAL
) -> CareSchedule:
    """Add a schedule to a plant.

    Raises:
        CareError: If the care type isn't the household's, the plant already has a schedule
            for it (or for another kind of watering), it can't be predicted, or a fixed
            schedule has no interval.
    """
    schedule = CareSchedule(plant=plant, origin=origin, started_on=local_today(plant))
    _apply(schedule, data)
    return schedule


@transaction.atomic
def accept_routine(plant: Plant, items: list[ScheduleData]) -> list[CareSchedule]:
    """Add the chosen schedules from the suggested routine (as they are, or changed).

    Raises:
        CareError: As for `create_schedule`; then none are added.
    """
    return [create_schedule(plant, item, ScheduleOrigin.SUGGESTED) for item in items]


def update_schedule(schedule: CareSchedule, data: ScheduleData) -> CareSchedule:
    """Change a schedule's mode, interval, or whether it's in use. (Its care type stays.)

    Raises:
        CareError: As for `create_schedule`.
    """
    _apply(schedule, data)
    return schedule


def delete_schedule(schedule: CareSchedule) -> None:
    schedule.delete()
