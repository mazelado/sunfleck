"""Learning from how the person actually waters.

When the last few waterings were all clearly further apart (or closer together) than the
schedule says, the plant's page suggests matching the schedule to that routine. It's only
ever a suggestion: nothing changes until it's accepted, and it can be undone.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from itertools import pairwise
from statistics import median

from sunfleck.care.models import CareEvent, CareSchedule, Feedback, ScheduleMode
from sunfleck.care.schedules import local_today, plant_zone, recalculate
from sunfleck.prediction.engine import MAX_MULTIPLIER, MIN_MULTIPLIER

# How many gaps between waterings it takes to see a routine, and only recent ones count
# (the season changes the schedule).
GAPS = 3
RECENT_DAYS = 90
# Each gap must be at least this many times longer than the schedule (or its inverse,
# shorter) to be a different routine rather than a busy week.
DIFFERENT = 1.25
# A turned-down suggestion isn't offered again for this long.
DISMISSED_FOR = timedelta(days=30)


@dataclass(frozen=True)
class RoutineSuggestion:
    schedule_days: int
    your_days: int


def routine_suggestion(
    schedule: CareSchedule, today: date | None = None
) -> RoutineSuggestion | None:
    """A suggestion to match the schedule to the person's routine, if there's one to make."""
    today = today or local_today(schedule.plant)
    interval = schedule.interval_days
    if (
        not schedule.enabled
        or schedule.mode != ScheduleMode.PREDICTED
        or not schedule.care_type.counts_as_watering
        or not interval
    ):
        return None
    if schedule.routine_dismissed_on and today < schedule.routine_dismissed_on + DISMISSED_FOR:
        return None
    zone = plant_zone(schedule.plant)
    events = list(
        CareEvent.objects.filter(
            plant=schedule.plant,
            care_type__counts_as_watering=True,
            skipped=False,
            # A remembered "a few days ago" says nothing about the routine.
            estimated=False,
        ).order_by("-performed_at")[: GAPS + 1]
    )
    if len(events) < GAPS + 1:
        return None
    days = [event.performed_at.astimezone(zone).date() for event in events]
    if days[-1] < today - timedelta(days=RECENT_DAYS):
        return None
    gaps = [(later - earlier).days for later, earlier in pairwise(days)]
    less_often = all(gap >= interval * DIFFERENT for gap in gaps)
    more_often = all(gap * DIFFERENT <= interval for gap in gaps)
    if not (less_often or more_often):
        return None
    # The soil said otherwise: watering less often left it too dry, or more often still wet.
    disagreeing = Feedback.TOO_DRY if less_often else Feedback.STILL_WET
    if any(event.feedback == disagreeing for event in events[:GAPS]):
        return None
    return RoutineSuggestion(interval, round(median(gaps)))


def accept_routine(schedule: CareSchedule, today: date | None = None) -> CareSchedule:
    """Match the schedule to the routine it suggests (if it still suggests one)."""
    today = today or local_today(schedule.plant)
    suggestion = routine_suggestion(schedule, today)
    if suggestion is None:
        return schedule
    multiplier = schedule.routine_multiplier * suggestion.your_days / suggestion.schedule_days
    schedule.routine_multiplier = round(min(max(multiplier, MIN_MULTIPLIER), MAX_MULTIPLIER), 3)
    schedule.routine_set_on = today
    schedule.routine_dismissed_on = None
    schedule.calculated_on = None
    schedule.save(
        update_fields=[
            "routine_multiplier",
            "routine_set_on",
            "routine_dismissed_on",
            "calculated_on",
        ]
    )
    return recalculate(schedule, today)


def dismiss_routine(schedule: CareSchedule, today: date | None = None) -> CareSchedule:
    schedule.routine_dismissed_on = today or local_today(schedule.plant)
    schedule.save(update_fields=["routine_dismissed_on"])
    return schedule


def reset_routine(schedule: CareSchedule, today: date | None = None) -> CareSchedule:
    """Go back to Sunfleck's own prediction."""
    schedule.routine_multiplier = 1.0
    schedule.routine_set_on = None
    schedule.calculated_on = None
    schedule.save(update_fields=["routine_multiplier", "routine_set_on", "calculated_on"])
    return recalculate(schedule, today)
