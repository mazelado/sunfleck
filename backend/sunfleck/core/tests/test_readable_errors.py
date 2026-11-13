"""Inputs that ended in a 500 get an error the app can show (code review 1.0, Q5, Q7)."""

import io
import json
import zipfile
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest
import time_machine
from django.db.models import QuerySet
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.ai.context import plant_context
from sunfleck.care import schedules
from sunfleck.care.models import ScheduleMode
from sunfleck.care.schedules import ScheduleData
from sunfleck.care.services import CareError
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.dataio import exporter, importer, schema
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


@pytest.fixture
def plant(household: Household) -> Plant:
    return PlantFactory.create(
        household=household, location=LocationFactory.create(site__household=household)
    )


@pytest.mark.parametrize("when", ["0001-01-01T00:00:00+14:00", "1999-12-31T12:00:00"])
def test_care_before_2000_is_refused(client_as: ClientAs, plant: Plant, when: str) -> None:
    response = client_as(Role.GARDENER).post(
        f"/api/v1/plants/{plant.pk}/care-events",
        json.dumps({"care_type_id": builtin("water").pk, "performed_at": when}),
        content_type="application/json",
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "care_too_long_ago"
    assert not plant.care_events.exists()


def test_a_second_schedule_for_the_same_care_is_a_conflict_not_a_crash(
    plant: Plant, monkeypatch: pytest.MonkeyPatch
) -> None:
    data = ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 14)
    schedules.create_schedule(plant, data)
    # As if a second request had checked before the first one saved.
    monkeypatch.setattr(QuerySet, "exists", lambda self: False)

    with pytest.raises(CareError) as error:
        schedules.create_schedule(plant, data)

    assert error.value.code == "schedule_exists"
    assert plant.schedules.count() == 1


def test_an_export_with_an_overlong_household_name_is_invalid(household: Household) -> None:
    exported = io.BytesIO()
    exporter.write(household, exported)
    source = zipfile.ZipFile(io.BytesIO(exported.getvalue()))
    data = json.loads(source.read(schema.DATA_FILE))
    data["household"] = "x" * 5000
    changed = io.BytesIO()
    with zipfile.ZipFile(changed, "w") as archive:
        archive.writestr(schema.DATA_FILE, json.dumps(data))
    target = Household.objects.create(name="New")

    with pytest.raises(importer.DataImportError) as error:
        importer.import_into(target, io.BytesIO(changed.getvalue()))

    assert error.value.code == "invalid_export"
    target.refresh_from_db()
    assert target.name == "New"


def test_care_dates_in_the_context_are_the_sites_days(household: Household) -> None:
    room = LocationFactory.create(site__household=household, site__timezone="Australia/Sydney")
    plant = PlantFactory.create(household=household, location=room)
    # 08:30 on Monday 11 May in Sydney is still Sunday 10 May in UTC.
    now = datetime(2026, 5, 10, 22, 30, tzinfo=UTC)
    with time_machine.travel(now, tick=False):
        CareEventFactory.create(plant=plant, care_type=builtin("water"), performed_at=now)
        context = plant_context(plant)

    assert "Today is 2026-05-11" in context
    assert "2026-05-11: Water" in context
    assert "2026-05-10" not in context


def test_an_unexpected_error_is_answered_in_the_standard_shape(
    client_as: ClientAs, monkeypatch: pytest.MonkeyPatch
) -> None:
    def bug(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("a bug")

    monkeypatch.setattr(plant_services, "save_wish", bug)

    response = client_as(Role.GARDENER).post(
        "/api/v1/wishlist", json.dumps({"name": "Fern"}), content_type="application/json"
    )

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "unexpected"
    assert "a bug" not in response.content.decode()
