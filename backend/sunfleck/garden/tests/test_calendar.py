import json
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.garden import calendar
from sunfleck.garden.models import SeedPacket
from sunfleck.places.models import FrostSource, Site
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.models import Plant
from sunfleck.taxonomy.models import Taxon

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

TOMATO = {
    "steps": [
        {"action": "sow_indoors", "after": "last_frost", "weeks": [-8, -6]},
        {"action": "plant_out", "after": "last_frost", "weeks": [1, 3]},
    ],
    "harvest_days": [60, 85],
}
GARLIC = {
    "steps": [{"action": "plant_out", "after": "first_frost", "weeks": [-6, -2]}],
    "harvest_days": [240, 270],
}


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


@pytest.fixture
def site(household: Household) -> Site:
    return SiteFactory.create(
        household=household,
        timezone="Europe/Amsterdam",
        last_frost=date(2000, 4, 15),
        first_frost=date(2000, 10, 25),
        frost_source=FrostSource.ESTIMATED,
    )


def test_steps_become_dates_from_the_frost_dates(site: Site) -> None:
    assert calendar.windows(TOMATO, site, 2027) == [
        ("sow_indoors", date(2027, 2, 18), date(2027, 3, 4)),
        ("plant_out", date(2027, 4, 22), date(2027, 5, 6)),
        # 60 to 85 days after planting out.
        ("harvest", date(2027, 6, 21), date(2027, 7, 30)),
    ]


def test_nothing_is_timed_without_the_frost_date_a_step_needs(site: Site) -> None:
    site.first_frost = None

    assert calendar.windows(GARLIC, site, 2027) == []
    assert calendar.windows(TOMATO, site, 2027) != []


def test_a_frost_on_29_february_falls_on_the_28th_in_other_years(site: Site) -> None:
    site.last_frost = date(2000, 2, 29)

    assert calendar.windows(TOMATO, site, 2027)[1][1] == date(2027, 3, 7)


def test_where_it_doesnt_freeze_the_calendar_says_so(site: Site) -> None:
    site.last_frost = site.first_frost = None

    assert calendar.frost_state(site) == "none"
    site.frost_source = ""
    assert calendar.frost_state(site) == "unknown"


def test_the_calendar_lists_what_is_still_to_come_this_season_and_next(
    site: Site, household: Household
) -> None:
    SeedPacket.objects.create(
        household=household,
        name="Tomato",
        taxon=Taxon.objects.get(scientific_name="Solanum lycopersicum"),
    )
    garlic = SeedPacket.objects.create(household=household, name="Garlic")
    garlic.taxon = Taxon(crop=GARLIC)  # not saved: just its timing
    SeedPacket.objects.create(household=household, name="Mystery seeds")  # no species

    # In June 2027: tomatoes are planted out; their harvest is to come, and next year's sowing.
    entries = [
        (entry.seed.name, entry.action, entry.starts_on)
        for entry in calendar.calendar(site, date(2027, 6, 1))
        if entry.seed.name == "Tomato"
    ]

    assert entries == [
        ("Tomato", "harvest", date(2027, 6, 21)),
        ("Tomato", "sow_indoors", date(2028, 2, 19)),  # 2028 is a leap year
        ("Tomato", "plant_out", date(2028, 4, 22)),
    ]


def test_the_calendar_api_gives_the_dates_at_the_site(client_as: ClientAs, site: Site) -> None:
    SeedPacket.objects.create(
        household=site.household,
        name="Tomato",
        variety="Gardener's Delight",
        taxon=Taxon.objects.get(scientific_name="Solanum lycopersicum"),
    )

    # Signed in then (a session from today would have expired).
    with time_machine.travel(datetime(2027, 2, 20, 12, tzinfo=UTC), tick=False):
        found = client_as(Role.VIEWER).get("/api/v1/calendar").json()

    assert (found["site_name"], found["frost"], found["today"]) == (
        site.name,
        "known",
        "2027-02-20",
    )
    assert found["entries"][0] == {
        "seed_id": SeedPacket.objects.get().pk,
        "name": "Tomato 'Gardener's Delight'",
        "action": "sow_indoors",
        "starts_on": "2027-02-18",
        "ends_on": "2027-03-04",
    }


def test_the_calendar_needs_a_place(client_as: ClientAs) -> None:
    other = SiteFactory.create(household=HouseholdFactory.create())
    client = client_as(Role.VIEWER)

    assert client.get("/api/v1/calendar").json()["error"]["code"] == "site_not_found"
    assert client.get("/api/v1/calendar", {"site_id": other.pk}).status_code == 404


def test_sown_seeds_become_a_plant(client_as: ClientAs, site: Site) -> None:
    packet = SeedPacket.objects.create(
        household=site.household,
        name="Tomato",
        variety="Gardener's Delight",
        taxon=Taxon.objects.get(scientific_name="Solanum lycopersicum"),
    )
    windowsill = LocationFactory.create(site=site)
    elsewhere = LocationFactory.create(site=SiteFactory.create(household=HouseholdFactory.create()))
    url = f"/api/v1/seeds/{packet.pk}/sown"

    with time_machine.travel(datetime(2027, 2, 20, 12, tzinfo=UTC), tick=False):
        sown = send(client_as(Role.GARDENER), "POST", url, {"location_id": windowsill.pk})
    not_ours = send(client_as(Role.GARDENER), "POST", url, {"location_id": elsewhere.pk})

    assert sown.status_code == 201
    plant = Plant.objects.get(pk=sown.json()["plant_id"])
    assert (plant.nickname, plant.taxon, plant.location) == (
        "Tomato 'Gardener's Delight'",
        packet.taxon,
        windowsill,
    )
    assert plant.acquired_on == date(2027, 2, 20)
    assert not_ours.json()["error"]["code"] == "location_not_found"
    assert send(client_as(Role.VIEWER), "POST", url, {}).status_code == 403
