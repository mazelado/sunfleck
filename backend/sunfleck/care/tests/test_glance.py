from datetime import date

import pytest

from sunfleck.accounts.models import Household
from sunfleck.care.glance import CareLevel, LightLevel, care_level, glance
from sunfleck.care.models import CareSchedule, ScheduleMode
from sunfleck.care.schedules import ScheduleData, create_schedule
from sunfleck.care.tests.factories import builtin
from sunfleck.places.models import LocationKind
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.taxonomy.models import CareArchetype

TODAY = date(2026, 4, 15)


def schedule(next_due: date | None, interval: int | None, **fields: object) -> CareSchedule:
    return CareSchedule(next_due=next_due, interval_days=interval, **fields)


def test_the_level_runs_down_from_full_to_due() -> None:
    assert care_level(schedule(date(2026, 4, 25), 10), TODAY) == CareLevel(1.0, 10)
    assert care_level(schedule(date(2026, 4, 19), 8), TODAY) == CareLevel(0.5, 4)
    assert care_level(schedule(TODAY, 8), TODAY) == CareLevel(0.0, 0)


def test_overdue_care_stays_empty_and_counts_the_days() -> None:
    assert care_level(schedule(date(2026, 4, 12), 7), TODAY) == CareLevel(0.0, -3)


def test_a_snooze_puts_the_due_date_off() -> None:
    snoozed = schedule(date(2026, 4, 12), 7, snoozed_until=date(2026, 4, 18))

    assert care_level(snoozed, TODAY) == CareLevel(0.43, 3)


def test_resting_care_says_when_it_starts_again() -> None:
    assert care_level(schedule(date(2026, 6, 1), None), TODAY) == CareLevel(
        None, None, resting_until=date(2026, 6, 1)
    )
    assert care_level(schedule(None, None), TODAY) is None


@pytest.mark.django_db
def test_a_plant_at_a_glance(household: Household) -> None:
    garden = LocationFactory.create(
        site=SiteFactory.create(household=household, latitude=52.37),
        kind=LocationKind.OUTDOOR,
        exposure="full_sun",
    )
    rose = PlantFactory.create(
        household=household,
        location=garden,
        care_profile=CareArchetype.objects.get(key="temperate_shrub"),
    )
    create_schedule(rose, ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED))
    create_schedule(rose, ScheduleData(builtin("fertilize").pk, ScheduleMode.PREDICTED))
    create_schedule(rose, ScheduleData(builtin("prune").pk, ScheduleMode.FIXED, 30))

    seen = glance(rose, TODAY)

    assert seen.water is not None
    assert seen.water.level is not None
    assert seen.fertilizer is not None
    assert isinstance(seen.light, LightLevel)
    assert seen.light.dli > 0
    assert seen.light.ideal > 0


@pytest.mark.django_db
def test_unknown_parts_are_left_out(household: Household) -> None:
    unplaced = PlantFactory.create(household=household)
    water = create_schedule(unplaced, ScheduleData(builtin("water").pk, ScheduleMode.FIXED, 7))
    water.enabled = False
    water.save()

    assert glance(unplaced, TODAY).water is None
    assert glance(unplaced, TODAY).fertilizer is None
    assert glance(unplaced, TODAY).light is None  # no location, no care profile
