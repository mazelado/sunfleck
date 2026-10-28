from datetime import datetime

import pytest
from huey.contrib.djhuey import HUEY

from sunfleck.care import tasks
from sunfleck.care.models import ScheduleMode
from sunfleck.care.schedules import ScheduleData, create_schedule
from sunfleck.care.tests.factories import builtin
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
