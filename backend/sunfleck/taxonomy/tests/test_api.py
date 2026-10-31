import json
from collections.abc import Callable
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.taxonomy.models import Taxon

ClientAs = Callable[[Role], Client]


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def _taxon(name: str) -> Taxon:
    return Taxon.objects.get(scientific_name=name)


@pytest.mark.django_db
def test_search_species(client_as: ClientAs) -> None:
    results = client_as(Role.VIEWER).get("/api/v1/species", {"q": "swiss cheese plant"}).json()

    assert results[0] | {"id": 0} == {
        "id": 0,
        "scientific_name": "Monstera deliciosa",
        "rank": "species",
        "family": "Araceae",
        "common_name": "Swiss cheese plant",
        "common_names": ["Swiss cheese plant", "split-leaf philodendron"],
        "synonyms": [],
        "note": None,
        "care_profile": {"key": "tropical_aroid", "name": "Tropical aroid"},
        "toxicity": {
            "cats": True,
            "dogs": True,
            "sources": [
                "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/swiss-cheese-plant"
            ],
            "note": "Insoluble calcium oxalates",
        },
        "matched_name": "Swiss cheese plant",
    }


@pytest.mark.django_db
def test_reference_data_needs_signing_in() -> None:
    client = Client()

    assert client.get("/api/v1/species", {"q": "monstera"}).status_code == 401
    assert client.get("/api/v1/care-profiles").status_code == 401


@pytest.mark.django_db
def test_get_species_with_its_note(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    sansevieria = client.get(f"/api/v1/species/{_taxon('Sansevieria').pk}").json()
    missing = client.get("/api/v1/species/999999")

    assert sansevieria["note"].startswith("Now included in Dracaena")
    assert missing.status_code == 404


@pytest.mark.django_db
def test_names_fall_back_to_english(client_as: ClientAs, household: Household) -> None:
    client = client_as(Role.VIEWER)
    user = household.memberships.get().user
    user.locale = "de"
    user.save()

    result = client.get("/api/v1/species", {"q": "monstera deliciosa"}).json()[0]

    assert result["common_name"] == "Swiss cheese plant"


@pytest.mark.django_db
def test_list_and_read_care_profiles(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    profiles = client.get("/api/v1/care-profiles").json()
    aroid = client.get("/api/v1/care-profiles/tropical_aroid").json()
    missing = client.get("/api/v1/care-profiles/jungle")

    names = [profile["name"] for profile in profiles]
    assert names == sorted(names, key=str.lower)
    assert next(p for p in profiles if p["key"] == "succulent")["genus_count"] >= 20
    assert aroid["watering"] == {
        "interval_days": {"spring": 7, "summer": 6, "autumn": 9, "winter": 12},
        "let_dry": "top_third",
    }
    assert aroid["light"]["outdoor_exposure"] == []
    assert aroid["fertilizing"] == {"interval_days": 30, "pause_months_north": [11, 12, 1, 2]}
    assert "Monstera" in aroid["genera"]
    assert aroid["status"] == "draft"
    assert missing.status_code == 404


@pytest.mark.django_db
def test_carnivores_are_never_fertilized(client_as: ClientAs) -> None:
    profile = client_as(Role.VIEWER).get("/api/v1/care-profiles/bog_carnivore").json()

    assert profile["fertilizing"] is None
    assert profile["dormancy_months_north"] == [11, 12, 1, 2]


# --- Species and care profiles of plants ------------------------------------------------------


@pytest.mark.django_db
def test_known_toxicity_is_shown_with_its_source(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)
    monstera = _taxon("Monstera deliciosa")
    monstera.toxicity = {
        "cats": "toxic",
        "sources": ["https://example.org/toxic-plants/monstera"],
        "note": {"en": "Insoluble calcium oxalates"},
    }
    monstera.save()
    expected = {
        "cats": True,
        "dogs": False,
        "sources": ["https://example.org/toxic-plants/monstera"],
        "note": "Insoluble calcium oxalates",
    }

    species = client.get(f"/api/v1/species/{monstera.pk}").json()
    plant = send(client, "POST", "/api/v1/plants", {"nickname": "Monty", "taxon_id": monstera.pk})

    assert species["toxicity"] == expected
    assert plant.json()["species"]["toxicity"] == expected
    # Not known: no flag at all, rather than "safe".
    assert client.get(f"/api/v1/species/{_taxon('Lithops').pk}").json()["toxicity"] is None


@pytest.mark.django_db
def test_plant_gets_its_species_care_profile(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)

    plant = send(
        client,
        "POST",
        "/api/v1/plants",
        {"nickname": "Monty", "taxon_id": _taxon("Monstera deliciosa").pk},
    ).json()

    assert plant["species"] == {
        "id": _taxon("Monstera deliciosa").pk,
        "scientific_name": "Monstera deliciosa",
        "common_name": "Swiss cheese plant",
        "toxicity": {
            "cats": True,
            "dogs": True,
            "sources": [
                "https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/swiss-cheese-plant"
            ],
            "note": "Insoluble calcium oxalates",
        },
    }
    assert plant["care_profile"] == {
        "key": "tropical_aroid",
        "name": "Tropical aroid",
        "chosen": False,
    }


@pytest.mark.django_db
def test_a_chosen_care_profile_wins(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)

    plant = send(
        client,
        "POST",
        "/api/v1/plants",
        {
            "nickname": "Mystery succulent",
            "taxon_id": _taxon("Monstera").pk,
            "care_profile_key": "succulent",
        },
    ).json()
    unknown = send(client, "POST", "/api/v1/plants", {"nickname": "Spiky"}).json()

    assert plant["care_profile"] == {"key": "succulent", "name": "Succulent", "chosen": True}
    assert unknown["care_profile"] is None


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("body", "field"),
    [({"taxon_id": 999999}, "taxon_id"), ({"care_profile_key": "jungle"}, "care_profile_key")],
)
def test_unknown_species_or_profile_names_the_field(
    client_as: ClientAs, body: dict[str, Any], field: str
) -> None:
    response = send(client_as(Role.GARDENER), "POST", "/api/v1/plants", {"nickname": "X", **body})

    assert response.status_code == 422
    assert response.json()["error"]["details"] == {"field": field}


@pytest.mark.django_db
def test_plants_can_be_found_by_species_names(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)
    send(
        client,
        "POST",
        "/api/v1/plants",
        {"nickname": "Monty", "taxon_id": _taxon("Monstera deliciosa").pk},
    )
    send(
        client, "POST", "/api/v1/plants", {"nickname": "Spike", "taxon_id": _taxon("Aloe vera").pk}
    )

    found = client.get("/api/v1/plants", {"q": "Cheese"}).json()["items"]

    assert [plant["nickname"] for plant in found] == ["Monty"]
    assert found[0]["species"]["common_name"] == "Swiss cheese plant"
