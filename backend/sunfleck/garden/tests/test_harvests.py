import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.garden.models import Harvest
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

NOW = datetime(2027, 8, 20, 12, tzinfo=UTC)


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


@pytest.fixture
def tomato(household: Household) -> Plant:
    return PlantFactory.create(household=household, nickname="Tomato", location=None)


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


def test_harvests_are_logged_and_added_up_for_the_year(client_as: ClientAs, tomato: Plant) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{tomato.pk}/harvests"

    logged = send(client, "POST", url, {"harvested_on": "2027-08-18", "amount": 450, "unit": "g"})
    send(client, "POST", url, {"harvested_on": "2027-08-19", "amount": 1.2, "unit": "kg"})
    send(client, "POST", url, {"harvested_on": "2027-08-20", "amount": 12, "unit": "pieces"})
    send(client, "POST", url, {"harvested_on": "2027-08-20", "notes": "A handful"})
    # Last year's don't count for this year.
    send(client, "POST", url, {"harvested_on": "2026-09-01", "amount": 2, "unit": "kg"})
    found = client.get(url).json()

    assert logged.status_code == 201
    assert logged.json() | {"id": 0} == {
        "id": 0,
        "harvested_on": "2027-08-18",
        "amount": 450.0,
        "unit": "g",
        "notes": "",
        "logged_by": tomato.household.memberships.get().user.get_full_name(),
    }
    assert found["items"][0]["harvested_on"] == "2027-08-20"  # the latest first
    assert found["this_year"] == {"year": 2027, "grams": 1650.0, "pieces": 12.0, "bunches": None}


def test_a_harvest_needs_a_unit_with_its_amount_and_cant_be_in_the_future(
    client_as: ClientAs, tomato: Plant
) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{tomato.pk}/harvests"

    no_unit = send(client, "POST", url, {"harvested_on": "2027-08-18", "amount": 3})
    tomorrow = send(client, "POST", url, {"harvested_on": "2027-08-21"})

    assert no_unit.json()["error"]["details"] == {"field": "unit"}
    assert tomorrow.json()["error"]["code"] == "harvest_in_future"
    assert not Harvest.objects.exists()


def test_viewers_see_harvests_and_only_gardeners_change_them(
    client_as: ClientAs, tomato: Plant
) -> None:
    harvest = Harvest.objects.create(plant=tomato, harvested_on=date(2027, 8, 1))
    other = Harvest.objects.create(
        plant=PlantFactory.create(household=HouseholdFactory.create()),
        harvested_on=date(2027, 8, 1),
    )
    viewer = client_as(Role.VIEWER)
    url = f"/api/v1/plants/{tomato.pk}/harvests"

    assert len(viewer.get(url).json()["items"]) == 1
    assert send(viewer, "POST", url, {"harvested_on": "2027-08-18"}).status_code == 403
    assert send(viewer, "DELETE", f"/api/v1/harvests/{harvest.pk}").status_code == 403
    gardener = client_as(Role.GARDENER)
    assert send(gardener, "DELETE", f"/api/v1/harvests/{other.pk}").status_code == 404
    assert send(gardener, "DELETE", f"/api/v1/harvests/{harvest.pk}").status_code == 204
    assert gardener.get("/api/v1/plants/999999/harvests").status_code == 404
