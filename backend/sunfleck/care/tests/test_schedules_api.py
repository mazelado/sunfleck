import json
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.care import schedules
from sunfleck.care.models import ScheduleMode
from sunfleck.care.tests.factories import builtin
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.taxonomy.models import CareArchetype

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


def send(client: Client, method: str, url: str, data: Any = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(datetime(2026, 4, 15, 10, tzinfo=UTC), tick=False):
        yield


@pytest.fixture
def monty(household: Household) -> Plant:
    return PlantFactory.create(
        household=household,
        location=LocationFactory.create(site__household=household),
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
    )


def test_the_suggested_routine(client_as: ClientAs, monty: Plant) -> None:
    suggestion = client_as(Role.VIEWER).get(f"/api/v1/plants/{monty.pk}/routine-suggestion")

    assert suggestion.status_code == 200
    water, fertilize, rotate, pests = suggestion.json()
    assert water | {"care_type": water["care_type"]["key"]} == {
        "care_type": "water",
        "mode": "predicted",
        "fixed_interval_days": None,
        "recommended": True,
        "interval_days": 7,
        "next_due": "2026-04-22",
        "factors": [
            {"code": "season", "multiplier": 1.0, "details": {"season": "spring", "days": 7}},
            {"code": "no_light_info", "multiplier": 1.0, "details": {"indoor": True}},
            {"code": "not_logged", "multiplier": 1.0, "details": {"since": "2026-04-15"}},
        ],
    }
    assert (fertilize["interval_days"], fertilize["next_due"]) == (30, "2026-05-15")
    assert (rotate["care_type"]["key"], rotate["mode"], rotate["recommended"]) == (
        "rotate",
        "fixed",
        False,
    )
    assert pests["fixed_interval_days"] == 30


def test_accepting_the_routine_then_listing_schedules(client_as: ClientAs, monty: Plant) -> None:
    gardener = client_as(Role.GARDENER)
    water, rotate = builtin("water").pk, builtin("rotate").pk

    added = send(
        gardener,
        "POST",
        f"/api/v1/plants/{monty.pk}/routine",
        {
            "items": [
                {"care_type_id": water, "mode": "predicted"},
                {"care_type_id": rotate, "mode": "fixed", "fixed_interval_days": 10},
            ]
        },
    )
    listed = client_as(Role.VIEWER).get(f"/api/v1/plants/{monty.pk}/schedules")

    assert added.status_code == 201
    assert listed.json() == added.json()
    first = listed.json()[0]
    assert first | {"id": 0, "care_type": first["care_type"]["key"]} == {
        "id": 0,
        "plant_id": monty.pk,
        "care_type": "water",
        "mode": "predicted",
        "fixed_interval_days": None,
        "origin": "suggested",
        "enabled": True,
        "started_on": "2026-04-15",
        "snoozed_until": None,
        "due_on": "2026-04-22",
        "interval_days": 7,
        "next_due": "2026-04-22",
        "factors": first["factors"],
    }
    assert [s["interval_days"] for s in listed.json()] == [7, 10]


def test_a_refused_schedule_names_the_field(client_as: ClientAs, monty: Plant) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/plants/{monty.pk}/routine",
        {"items": [{"care_type_id": builtin("rotate").pk, "mode": "predicted"}]},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "cannot_predict"
    assert response.json()["error"]["details"] == {"field": "mode"}


def test_gardeners_add_change_and_delete_schedules(client_as: ClientAs, monty: Plant) -> None:
    gardener = client_as(Role.GARDENER)

    created = send(
        gardener,
        "POST",
        f"/api/v1/plants/{monty.pk}/schedules",
        {"care_type_id": builtin("mist").pk, "mode": "fixed", "fixed_interval_days": 3},
    )
    url = f"/api/v1/care-schedules/{created.json()['id']}"
    changed = send(gardener, "PUT", url, {"mode": "fixed", "fixed_interval_days": 5})
    paused = send(
        gardener, "PUT", url, {"mode": "fixed", "fixed_interval_days": 5, "enabled": False}
    )
    deleted = send(gardener, "DELETE", url)

    assert created.status_code == 201
    assert (created.json()["origin"], created.json()["next_due"]) == ("manual", "2026-04-18")
    assert changed.json()["next_due"] == "2026-04-20"
    assert (paused.json()["enabled"], paused.json()["next_due"]) == (False, None)
    assert deleted.status_code == 204
    assert not monty.schedules.exists()


def test_changing_a_schedule_is_checked_too(client_as: ClientAs, monty: Plant) -> None:
    schedule = schedules.create_schedule(
        monty, schedules.ScheduleData(builtin("mist").pk, ScheduleMode.FIXED, 3)
    )

    response = send(
        client_as(Role.GARDENER),
        "PUT",
        f"/api/v1/care-schedules/{schedule.pk}",
        {"mode": "predicted"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "cannot_predict"


def test_viewers_cant_change_schedules(client_as: ClientAs, monty: Plant) -> None:
    viewer = client_as(Role.VIEWER)
    schedule = schedules.create_schedule(
        monty, schedules.ScheduleData(builtin("mist").pk, ScheduleMode.FIXED, 3)
    )
    item = {"care_type_id": builtin("water").pk, "mode": "predicted"}

    responses = [
        send(viewer, "POST", f"/api/v1/plants/{monty.pk}/routine", {"items": [item]}),
        send(viewer, "POST", f"/api/v1/plants/{monty.pk}/schedules", item),
        send(viewer, "PUT", f"/api/v1/care-schedules/{schedule.pk}", {"mode": "fixed"}),
        send(viewer, "DELETE", f"/api/v1/care-schedules/{schedule.pk}"),
    ]

    assert [response.status_code for response in responses] == [403] * 4


def test_other_households_plants_and_schedules_are_hidden(client_as: ClientAs) -> None:
    theirs = PlantFactory.create()
    schedule = schedules.create_schedule(
        theirs, schedules.ScheduleData(builtin("mist").pk, ScheduleMode.FIXED, 3)
    )
    gardener = client_as(Role.GARDENER)

    responses = [
        gardener.get(f"/api/v1/plants/{theirs.pk}/schedules"),
        gardener.get(f"/api/v1/plants/{theirs.pk}/routine-suggestion"),
        send(gardener, "PUT", f"/api/v1/care-schedules/{schedule.pk}", {"mode": "fixed"}),
        send(gardener, "DELETE", f"/api/v1/care-schedules/{schedule.pk}"),
    ]

    assert [response.status_code for response in responses] == [404] * 4
    assert [response.json()["error"]["code"] for response in responses] == [
        "plant_not_found",
        "plant_not_found",
        "schedule_not_found",
        "schedule_not_found",
    ]
