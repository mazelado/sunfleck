from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import time_machine
from huey.contrib.djhuey import HUEY

from sunfleck.care import tasks
from sunfleck.care.models import ScheduleMode
from sunfleck.care.schedules import ScheduleData, create_schedule, out_of_date
from sunfleck.care.tests.factories import builtin
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.tests.factories import PlantFactory


def utc(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """A time in UTC, as Huey's schedules take it (without a time zone)."""
    return datetime(year, month, day, hour, minute)  # noqa: DTZ001


def test_schedules_are_recalculated_every_night() -> None:
    due = [task.name for task in HUEY.read_periodic(utc(2026, 4, 15, 2, 23))]

    assert "care.recalculate_schedules" in due


@pytest.mark.django_db
def test_the_nightly_job_recalculates_every_schedule(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO")
    plant = PlantFactory.create()
    schedule = create_schedule(plant, ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 7))
    schedule.calculated_on = None
    schedule.save()

    tasks.recalculate_schedules.call_local()

    schedule.refresh_from_db()
    assert schedule.calculated_on is not None
    assert "Recalculated 1 care schedules" in caplog.text


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("zone", "before_midnight", "after_midnight"),
    [
        # UTC-8: its 14 November begins at 08:00 UTC.
        (
            "America/Los_Angeles",
            datetime(2026, 11, 14, 7, 23, tzinfo=UTC),
            datetime(2026, 11, 14, 8, 23, tzinfo=UTC),
        ),
        # UTC+10: its 15 November begins at 14:00 UTC on the 14th.
        (
            "Australia/Brisbane",
            datetime(2026, 11, 14, 13, 23, tzinfo=UTC),
            datetime(2026, 11, 14, 14, 23, tzinfo=UTC),
        ),
    ],
)
def test_schedules_are_recalculated_when_a_sites_day_begins(
    zone: str, before_midnight: datetime, after_midnight: datetime
) -> None:
    with time_machine.travel(before_midnight - timedelta(hours=10), tick=False):
        site = SiteFactory.create(timezone=zone)
        plant = PlantFactory.create(
            household=site.household, location=LocationFactory.create(site=site)
        )
        schedule = create_schedule(plant, ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 7))
        # A plant at another site (Amsterdam), whose day begins at another time.
        create_schedule(
            PlantFactory.create(household=site.household, location=LocationFactory.create()),
            ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 7),
        )
    with time_machine.travel(before_midnight, tick=False):
        tasks.recalculate_schedules.call_local()
        schedule.refresh_from_db()
        calculated_on = schedule.calculated_on

    with time_machine.travel(after_midnight, tick=False):
        assert set(out_of_date()) == {schedule}
        tasks.recalculate_schedules.call_local()
        schedule.refresh_from_db()

    assert calculated_on == before_midnight.astimezone(ZoneInfo(zone)).date()
    assert schedule.calculated_on == after_midnight.astimezone(ZoneInfo(zone)).date()
    assert schedule.calculated_on == calculated_on + timedelta(days=1)
    with time_machine.travel(after_midnight, tick=False):
        assert not out_of_date().exists()


def test_the_job_runs_every_hour() -> None:
    due = [task.name for task in HUEY.read_periodic(utc(2026, 4, 15, 14, 23))]

    assert "care.recalculate_schedules" in due
