from datetime import UTC, datetime
from pathlib import Path

import pytest
import time_machine
from django.core.management import CommandError, call_command

from sunfleck.accounts.models import User
from sunfleck.care.models import CareSchedule
from sunfleck.plants.models import Plant

PHOTOS = Path(__file__).resolve().parents[4] / "docs" / "screenshots" / "photos"

pytestmark = pytest.mark.django_db


def test_the_demo_household_has_plants_with_photos_and_schedules() -> None:
    call_command("demo_household", photos=PHOTOS)

    assert User.objects.get().email == "ada@example.com"
    plants = Plant.objects.all()
    assert plants.count() == 5
    assert all(plant.cover_photo_id for plant in plants)
    assert CareSchedule.objects.filter(next_due__isnull=False).count() == 10


@pytest.mark.parametrize("month", [1, 4, 7, 10])
def test_the_same_plants_need_water_in_every_season(month: int) -> None:
    # The browser tests (frontend/e2e/effort.e2e.ts) rely on it, whatever the date.
    with time_machine.travel(datetime(2026, month, 15, 10, tzinfo=UTC), tick=False):
        call_command("demo_household", photos=PHOTOS)
        today = datetime(2026, month, 15).date()

        due = {
            schedule.plant.nickname: (schedule.next_due - today).days
            for schedule in CareSchedule.objects.filter(care_type__key="water")
            if schedule.next_due is not None
        }

    assert {name for name, days in due.items() if days <= 0} == {
        "Golden pothos",
        "Dragon tree",
        "Avocado seedling",
    }
    assert 1 <= due["Aloe"] <= 7  # coming up this week
    assert due["Flaming Katy"] > 7


def test_it_only_runs_on_an_empty_database(tmp_path: Path) -> None:
    call_command("demo_household", photos=PHOTOS)

    with pytest.raises(Exception, match="already been set up"):
        call_command("demo_household", photos=PHOTOS)
    with pytest.raises(CommandError):
        call_command("demo_household", photos=tmp_path / "missing")
