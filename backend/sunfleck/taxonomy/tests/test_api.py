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


# Monstera deliciosa's entry in the dataset: harmful if eaten (low), and its sap to skin.
MONSTERA_HARM = {
    "if_eaten": "low",
    "skin": True,
    "sources": [
        "https://plants.ces.ncsu.edu/plants/monstera-deliciosa/",
        "https://www.rhs.org.uk/prevention-protection/potentially-harmful-garden-plants",
    ],
    "note": "Calcium oxalate crystals",
}


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
                "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/swiss-cheese-plant"
            ],
            "note": "Insoluble calcium oxalates",
        },
        "harmful_to_people": MONSTERA_HARM,
        "crop": None,
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
def test_crops_say_when_to_sow_plant_out_and_harvest(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    tomato = client.get(f"/api/v1/species/{_taxon('Solanum lycopersicum').pk}").json()
    monstera = client.get(f"/api/v1/species/{_taxon('Monstera deliciosa').pk}").json()

    assert tomato["crop"] == {
        "steps": [
            {"action": "sow_indoors", "after": "last_frost", "weeks": [-8, -6]},
            {"action": "plant_out", "after": "last_frost", "weeks": [1, 3]},
        ],
        "harvest_days": [60, 85],
        "note": None,
    }
    assert monstera["crop"] is None


def _speaking(client_as: ClientAs, household: Household, locale: str) -> Client:
    client = client_as(Role.VIEWER)
    user = household.memberships.get().user
    user.locale = locale
    user.save()
    return client


@pytest.mark.django_db
def test_common_names_in_spanish(client_as: ClientAs, household: Household) -> None:
    client = _speaking(client_as, household, "es")

    monstera = client.get("/api/v1/species", {"q": "monstera deliciosa"}).json()[0]
    # Spanish names are searchable, and English ones still are.
    avocado = client.get("/api/v1/species", {"q": "aguacate"}).json()[0]
    by_english = client.get("/api/v1/species", {"q": "swiss cheese plant"}).json()[0]

    assert monstera["common_name"] == "costilla de Adán"
    assert monstera["common_names"] == ["costilla de Adán", "cerimán", "mano de tigre"]
    assert avocado["scientific_name"] == "Persea americana"
    assert by_english["scientific_name"] == "Monstera deliciosa"


@pytest.mark.django_db
def test_no_english_names_in_another_language(client_as: ClientAs, household: Household) -> None:
    client = _speaking(client_as, household, "de")

    result = client.get("/api/v1/species", {"q": "monstera deliciosa"}).json()[0]

    # Shown by its scientific name, rather than "Swiss cheese plant" in German text; the care
    # profile's text still falls back to English, until it's translated.
    assert (result["common_name"], result["common_names"]) == (None, [])
    assert result["harmful_to_people"]["note"] == "Calcium oxalate crystals"
    assert result["care_profile"]["name"] == "Tropical aroid"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("name", "if_eaten", "skin"),
    [
        ("Dieffenbachia seguine", "high", True),  # its own, from NC State
        ("Agave", None, True),  # skin only, from the RHS
        ("Solanum tuberosum", "high", False),  # a crop where a part people might eat is harmful
        ("Lactuca sativa", None, True),  # a crop: only what touching it does
    ],
)
def test_harm_to_people(client_as: ClientAs, name: str, if_eaten: str | None, skin: bool) -> None:
    result = client_as(Role.VIEWER).get(f"/api/v1/species/{_taxon(name).pk}").json()

    harm = result["harmful_to_people"]
    assert (harm["if_eaten"], harm["skin"]) == (if_eaten, skin)
    assert harm["sources"]


@pytest.mark.django_db
def test_harm_to_people_is_unknown_without_a_source(client_as: ClientAs) -> None:
    # NC State rates spinach low, but that's about eating a lot of it: not recorded (food crops
    # and herbs), so unknown, never "safe". Lithops: no source says anything.
    client = client_as(Role.VIEWER)

    for name in ("Spinacia oleracea", "Lithops"):
        assert client.get(f"/api/v1/species/{_taxon(name).pk}").json()["harmful_to_people"] is None


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
        "let_dry": "top_half",
    }
    assert aroid["light"]["outdoor_exposure"] == []
    assert aroid["fertilizing"] == {"interval_days": 30, "pause_months_north": [11, 12, 1, 2]}
    assert "Monstera" in aroid["genera"]
    assert aroid["status"] == "reviewed"
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
                "https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/swiss-cheese-plant"
            ],
            "note": "Insoluble calcium oxalates",
        },
        "harmful_to_people": MONSTERA_HARM,
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
