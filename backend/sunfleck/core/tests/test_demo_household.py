from pathlib import Path

import pytest
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


def test_it_only_runs_on_an_empty_database(tmp_path: Path) -> None:
    call_command("demo_household", photos=PHOTOS)

    with pytest.raises(Exception, match="already been set up"):
        call_command("demo_household", photos=PHOTOS)
    with pytest.raises(CommandError):
        call_command("demo_household", photos=tmp_path / "missing")
