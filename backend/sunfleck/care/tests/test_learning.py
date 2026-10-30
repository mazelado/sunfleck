import json
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.care import learning, schedules
from sunfleck.care.learning import RoutineSuggestion, routine_suggestion
from sunfleck.care.models import CareSchedule, Feedback, ScheduleMode
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.taxonomy.models import CareArchetype

ClientAs = Callable[[Role], Client]
pytestmark = pytest.mark.django_db
# In spring, tropical aroids are watered about every 7 days (with nothing else known).
TODAY = date(2026, 4, 30)


@pytest.fixture
def water(household: Household) -> CareSchedule:
    plant = PlantFactory.create(
        household=household, care_profile=CareArchetype.objects.get(key="tropical_aroid")
    )
    schedule = schedules.create_schedule(
        plant, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )
    return schedules.recalculate(schedule, TODAY)


def watered(schedule: CareSchedule, *days_ago: int, feedback: str = "") -> None:
    for ago in days_ago:
        day = TODAY - timedelta(days=ago)
        CareEventFactory.create(
            plant=schedule.plant,
            performed_at=datetime(day.year, day.month, day.day, 9, tzinfo=UTC),
            feedback=feedback,
        )
    schedules.recalculate(schedule, TODAY)


def test_watering_less_often_than_the_schedule_is_noticed(water: CareSchedule) -> None:
    assert water.interval_days == 7
    watered(water, 1, 11, 21, 31)

    assert routine_suggestion(water, TODAY) == RoutineSuggestion(7, 10)


def test_watering_more_often_is_noticed_too(water: CareSchedule) -> None:
    watered(water, 1, 5, 9, 13)

    assert routine_suggestion(water, TODAY) == RoutineSuggestion(7, 4)


def test_one_late_watering_is_just_a_busy_week(water: CareSchedule) -> None:
    watered(water, 1, 11, 18, 25)

    assert routine_suggestion(water, TODAY) is None


def test_it_takes_three_gaps(water: CareSchedule) -> None:
    watered(water, 1, 11, 21)

    assert routine_suggestion(water, TODAY) is None


def test_old_waterings_dont_count(water: CareSchedule) -> None:
    watered(water, 70, 80, 90, 100)

    assert routine_suggestion(water, TODAY) is None


def test_no_suggestion_when_the_soil_disagrees(water: CareSchedule) -> None:
    # Waters less often, but the soil was too dry: the schedule was right.
    watered(water, 11, 21, 31)
    watered(water, 1, feedback=Feedback.TOO_DRY)

    assert routine_suggestion(water, TODAY) is None


def test_waterings_estimated_when_the_plant_was_added_dont_count(water: CareSchedule) -> None:
    watered(water, 1, 11, 21)
    day = TODAY - timedelta(days=31)
    CareEventFactory.create(
        plant=water.plant,
        performed_at=datetime(day.year, day.month, day.day, 9, tzinfo=UTC),
        estimated=True,
    )

    assert routine_suggestion(water, TODAY) is None


def test_only_predicted_watering_learns(water: CareSchedule) -> None:
    watered(water, 1, 11, 21, 31)
    water.mode = ScheduleMode.FIXED
    water.fixed_interval_days = 7

    assert routine_suggestion(water, TODAY) is None


def test_accepting_matches_the_schedule_and_can_be_undone(water: CareSchedule) -> None:
    watered(water, 1, 11, 21, 31)

    learning.accept_routine(water, TODAY)

    assert water.interval_days == 10
    assert water.routine_multiplier == pytest.approx(10 / 7, abs=0.001)
    routine = next(f for f in water.factors if f["code"] == "your_routine")
    assert routine["details"] == {"since": TODAY.isoformat()}
    assert routine_suggestion(water, TODAY) is None  # it matches now

    learning.reset_routine(water, TODAY)

    assert water.interval_days == 7
    assert all(f["code"] != "your_routine" for f in water.factors)


def test_a_dismissed_suggestion_comes_back_after_a_month(water: CareSchedule) -> None:
    watered(water, 1, 11, 21, 31)

    learning.dismiss_routine(water, TODAY)

    assert routine_suggestion(water, TODAY + timedelta(days=29)) is None
    # (The same waterings are still recent enough a month later.)
    assert routine_suggestion(water, TODAY + timedelta(days=30)) is not None


@time_machine.travel(datetime(2026, 4, 30, 12, tzinfo=UTC), tick=False)
def test_the_routine_endpoints(client_as: ClientAs, water: CareSchedule) -> None:
    watered(water, 1, 11, 21, 31)
    gardener = client_as(Role.GARDENER)
    url = f"/api/v1/care-schedules/{water.pk}/routine"

    listed = gardener.get(f"/api/v1/plants/{water.plant_id}/schedules").json()
    assert listed[0]["routine_suggestion"] == {"schedule_days": 7, "your_days": 10}
    assert client_as(Role.VIEWER).post(url).status_code == 403

    accepted = gardener.post(url).json()
    assert accepted["interval_days"] == 10
    assert accepted["routine_since"] is not None
    assert accepted["routine_suggestion"] is None

    reset = gardener.delete(url).json()
    assert reset["interval_days"] == 7
    assert reset["routine_since"] is None

    dismissed = gardener.post(f"{url}/dismiss", json.dumps({}), content_type="application/json")
    assert dismissed.json()["routine_suggestion"] is None
