"""Care schedules: suggesting a routine, and keeping each schedule's prediction up to date.

The prediction engine (sunfleck.prediction) does the calculation; this module gathers its
inputs from the database and stores the results. A schedule is recalculated when it's created
or changed, and when it's read if it's out of date: on a new day, or after something it
depends on changed (its plant, location, light, care log, or care profile; see signals.py).
`manage.py recalculate_schedules` (which the nightly job will run) recalculates them all.
"""

import json
from collections.abc import Iterable
from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from sunfleck.accounts.models import Household
from sunfleck.care.models import (
    CareEvent,
    CareSchedule,
    CareType,
    ScheduleAdjustment,
    ScheduleMode,
    ScheduleOrigin,
)
from sunfleck.care.services import CareError, care_types_for
from sunfleck.places.humidity import location_humidity
from sunfleck.places.light import grow_light_dli
from sunfleck.places.models import LightSourceKind, LocationKind
from sunfleck.plants.models import CARED_FOR, Plant, PlantStatus
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import CareContext
from sunfleck.prediction.engine import (
    FEEDBACK_MEMORY,
    Adjustment,
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
        pot_height_cm=plant.container_height_cm,
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
    windows, grow_lights = plant_lights(plant)
    humidity = location_humidity(location)
    return replace(
        plant_only,
        indoor=True,
        latitude=location.site.latitude,
        windows=windows,
        grow_lights=grow_lights,
        temperature_min_c=location.temperature_min_c,
        temperature_max_c=location.temperature_max_c,
        humidity_percent=humidity.percent if humidity else None,
        humidity_estimated=humidity.estimated if humidity else False,
    )


def plant_lights(plant: Plant) -> tuple[tuple[Window, ...], tuple[GrowLight, ...]]:
    """The windows and grow lights in use that reach the plant. Reads `plant.light_links`,
    so prefetch `light_links__light_source` when doing this for many plants."""
    windows = []
    grow_lights = []
    for link in plant.light_links.all():
        light = link.light_source
        if not light.enabled:
            continue
        if light.kind == LightSourceKind.WINDOW and light.direction:
            windows.append(Window(light.direction, link.distance_cm))
        elif light.ppfd and light.on_time and light.off_time:
            grow_lights.append(GrowLight(grow_light_dli(light.ppfd, light.on_time, light.off_time)))
    return tuple(windows), tuple(grow_lights)


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
        context = CareContext(
            plant=schedule.plant,
            site=schedule.plant.location.site if schedule.plant.location else None,
            care_type=schedule.care_type,
            today=today,
            profile=profile,
            conditions=conditions,
            last_done=history.last_done,
            started_on=history.started_on,
        )
        extra = plugin_adjustments(context)
        if schedule.routine_multiplier != 1:
            # Matched to how often the person waters (see learning.py).
            routine = Factor(
                "your_routine",
                schedule.routine_multiplier,
                {"since": schedule.routine_set_on.isoformat() if schedule.routine_set_on else None},
            )
            extra.append(Adjustment(routine))
        return predict_watering(profile, conditions, history, today, extra)
    return predict_fertilizing(profile, conditions, history, today)


def plugin_adjustments(context: CareContext) -> list[Adjustment]:
    """Factors from the household's plugins (e.g. weather) for a plant's watering.

    Answers that aren't adjustments, or whose details can't be stored, are left out and
    reported as the plugin's error.
    """
    household = context.plant.household
    adjustments = []
    for answer in registry.call("care_factors", household, context=context):
        for item in answer.result:
            try:
                if not isinstance(item, Adjustment):
                    raise TypeError(f"expected an Adjustment, got {type(item).__name__}")
                json.dumps(item.factor.details)
            except (TypeError, ValueError) as exc:
                plugin_services.record_error(household, answer.plugin_id, "care_factors", exc)
                continue
            adjustments.append(item)
    return adjustments


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
    if prediction.next_due != schedule.next_due:
        schedule.snoozed_until = None  # a snooze puts off one due date, not the next
    schedule.interval_days = prediction.interval_days
    schedule.next_due = prediction.next_due
    schedule.factors = factors
    schedule.calculated_on = today
    schedule.save(
        update_fields=[
            "interval_days",
            "next_due",
            "factors",
            "calculated_on",
            "snoozed_until",
            "updated_at",
        ]
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


def refresh(schedule: CareSchedule, today: date) -> CareSchedule:
    """Recalculate the schedule if it's out of date."""
    if schedule.calculated_on != today:
        recalculate(schedule, today)
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
        refresh(schedule, today)
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


# --- Due care ---------------------------------------------------------------------------------

# Plants that are still being looked after.


@dataclass(frozen=True)
class Task:
    """Care that's due: a schedule, and how many days until it's due (negative: overdue)."""

    schedule: CareSchedule
    due_on: date
    days_until: int


def due_tasks(household: Household, days_ahead: int = 7) -> list[Task]:
    """The household's care due within `days_ahead` days (and overdue care), soonest first.

    "Today" is each plant's own, in its site's time zone.
    """
    schedules = (
        CareSchedule.objects.filter(
            plant__household=household, plant__status__in=CARED_FOR, enabled=True
        )
        .select_related(
            "care_type",
            "plant__location__site",
            "plant__taxon__archetype",
            "plant__care_profile",
            "plant__cover_photo",
        )
        .order_by("plant_id", "care_type_id")
    )
    tasks = []
    todays: dict[int, date] = {}
    for schedule in schedules:
        plant = schedule.plant
        today = todays.setdefault(plant.pk, local_today(plant))
        refresh(schedule, today)
        due_on = schedule.due_on
        if due_on is None:
            continue
        days_until = (due_on - today).days
        if days_until <= days_ahead:
            tasks.append(Task(schedule, due_on, days_until))
    return sorted(
        tasks,
        key=lambda task: (
            task.days_until,
            task.schedule.plant.location.name if task.schedule.plant.location else "",
            task.schedule.plant.nickname.lower(),
            task.schedule.care_type_id,
        ),
    )


def unscheduled_plants(household: Household) -> QuerySet[Plant]:
    """The plants being looked after that have no care schedule."""
    return Plant.objects.filter(household=household, status__in=CARED_FOR, schedules__isnull=True)


MAX_SNOOZE_DAYS = 60


def snooze(schedule: CareSchedule, until: date | None) -> CareSchedule:
    """Put off due care until a day (or, with None, stop putting it off).

    Raises:
        CareError: If nothing is due, or the day isn't between tomorrow and two months ahead.
    """
    if until is not None:
        today = local_today(schedule.plant)
        if schedule.due_on is None:
            raise CareError("nothing_to_snooze", "This care isn't due, so it can't be put off.")
        if not today < until <= today + timedelta(days=MAX_SNOOZE_DAYS):
            raise CareError(
                "invalid_snooze",
                "Choose a day between tomorrow and two months from now.",
                "until",
            )
    schedule.snoozed_until = until
    schedule.save(update_fields=["snoozed_until", "updated_at"])
    return schedule


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
