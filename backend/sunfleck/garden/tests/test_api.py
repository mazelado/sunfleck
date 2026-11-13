import json
from collections.abc import Callable
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.garden.models import SeedPacket
from sunfleck.taxonomy.models import Taxon

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def test_a_gardener_adds_changes_and_deletes_seeds(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)
    tomato = Taxon.objects.get(scientific_name="Solanum lycopersicum")

    created = send(
        client,
        "POST",
        "/api/v1/seeds",
        {
            "name": "  Tomato ",
            "taxon_id": tomato.pk,
            "variety": "Gardener's Delight",
            "quantity": "about 20",
            "sow_by": 2028,
        },
    )
    seed = created.json()
    updated = send(
        client,
        "PUT",
        f"/api/v1/seeds/{seed['id']}",
        {"name": "Tomato", "taxon_id": tomato.pk, "quantity": "about 10", "notes": "From Ana"},
    )

    assert created.status_code == 201
    assert (seed["name"], seed["variety"], seed["sow_by"]) == ("Tomato", "Gardener's Delight", 2028)
    # With the species's crop timing, for the calendar.
    assert seed["species"]["scientific_name"] == "Solanum lycopersicum"
    assert seed["species"]["crop"]["steps"][0]["action"] == "sow_indoors"
    assert (updated.json()["quantity"], updated.json()["notes"]) == ("about 10", "From Ana")
    assert updated.json()["variety"] == ""
    assert [item["name"] for item in client.get("/api/v1/seeds").json()["items"]] == ["Tomato"]
    assert send(client, "DELETE", f"/api/v1/seeds/{seed['id']}").status_code == 204
    assert not SeedPacket.objects.exists()


def test_viewers_see_seeds_but_cant_change_them(client_as: ClientAs, household: Household) -> None:
    packet = SeedPacket.objects.create(household=household, name="Basil")
    client = client_as(Role.VIEWER)

    assert [item["name"] for item in client.get("/api/v1/seeds").json()["items"]] == ["Basil"]
    assert send(client, "POST", "/api/v1/seeds", {"name": "Dill"}).status_code == 403
    assert send(client, "PUT", f"/api/v1/seeds/{packet.pk}", {"name": "Dill"}).status_code == 403
    assert send(client, "DELETE", f"/api/v1/seeds/{packet.pk}").status_code == 403


def test_other_households_seeds_and_unknown_species_are_refused(client_as: ClientAs) -> None:
    other = SeedPacket.objects.create(household=HouseholdFactory.create(), name="Secret beans")
    client = client_as(Role.GARDENER)

    unknown = send(client, "POST", "/api/v1/seeds", {"name": "Mystery", "taxon_id": 999999})
    too_old = send(client, "POST", "/api/v1/seeds", {"name": "Old", "sow_by": 1990})

    assert client.get("/api/v1/seeds").json() == {"items": [], "count": 0}
    assert send(client, "PUT", f"/api/v1/seeds/{other.pk}", {"name": "Mine"}).status_code == 404
    assert unknown.json()["error"] == {
        "code": "species_not_found",
        "message": "This species isn't in the list.",
        "details": {"field": "taxon_id"},
    }
    assert too_old.json()["error"]["code"] == "validation_error"
