import json
from collections.abc import Callable
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.places.models import LightSource, Location, Site
from sunfleck.places.tests.factories import LocationFactory, SiteFactory, WindowFactory

ClientAs = Callable[[Role], Client]

SITE = {"name": "Home", "latitude": 52.37, "longitude": 4.89, "timezone": "Europe/Amsterdam"}
GROW_LIGHT = {"kind": "grow_light", "ppfd": 200, "on_time": "07:00", "off_time": "19:00"}


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


@pytest.fixture
def site(household: Household) -> Site:
    return SiteFactory.create(household=household)


@pytest.fixture
def location(site: Site) -> Location:
    return LocationFactory.create(site=site)


# --- Sites ------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_gardener_creates_a_site(client_as: ClientAs) -> None:
    response = send(client_as(Role.GARDENER), "POST", "/api/v1/sites", SITE)

    assert response.status_code == 201
    assert response.json() | {"id": 0} == {**SITE, "id": 0, "locations": []}
    assert Site.objects.get().household == Household.objects.get()


@pytest.mark.django_db
def test_viewer_sees_sites_but_cannot_change_them(client_as: ClientAs, location: Location) -> None:
    client = client_as(Role.VIEWER)
    site_id = location.site_id

    listed = client.get("/api/v1/sites").json()

    assert [loc["name"] for loc in listed[0]["locations"]] == ["Living room"]
    assert send(client, "POST", "/api/v1/sites", SITE).status_code == 403
    assert send(client, "PUT", f"/api/v1/sites/{site_id}", SITE).status_code == 403
    assert send(client, "DELETE", f"/api/v1/sites/{site_id}").status_code == 403
    location_url = f"/api/v1/sites/{site_id}/locations"
    assert send(client, "POST", location_url, {"name": "X", "kind": "indoor"}).status_code == 403
    assert send(client, "DELETE", f"/api/v1/locations/{location.pk}").status_code == 403
    light_url = f"/api/v1/locations/{location.pk}/light-sources"
    assert send(client, "POST", light_url, GROW_LIGHT).status_code == 403


@pytest.mark.django_db
def test_update_and_delete_a_site(client_as: ClientAs, location: Location) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/sites/{location.site_id}"

    updated = send(client, "PUT", url, {**SITE, "name": "Cottage", "timezone": "Europe/London"})
    deleted = send(client, "DELETE", url)

    assert updated.json()["name"] == "Cottage"
    assert updated.json()["timezone"] == "Europe/London"
    assert deleted.status_code == 204
    assert not Location.objects.exists()


@pytest.mark.django_db
def test_site_errors_name_the_field(client_as: ClientAs) -> None:
    response = send(
        client_as(Role.GARDENER), "POST", "/api/v1/sites", {**SITE, "timezone": "Nowhere/Land"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_timezone"
    assert response.json()["error"]["details"] == {"field": "timezone"}


@pytest.mark.django_db
def test_other_households_places_are_invisible(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    stranger_window = WindowFactory.create(
        location__site__household=HouseholdFactory.create(name="Elsewhere")
    )
    location = stranger_window.location

    assert client.get("/api/v1/sites").json() == []
    assert client.get(f"/api/v1/sites/{location.site_id}").status_code == 404
    assert client.get(f"/api/v1/locations/{location.pk}").status_code == 404
    assert send(client, "PUT", f"/api/v1/sites/{location.site_id}", SITE).status_code == 404
    assert send(client, "DELETE", f"/api/v1/locations/{location.pk}").status_code == 404
    url = f"/api/v1/light-sources/{stranger_window.pk}"
    assert send(client, "PUT", url, GROW_LIGHT).status_code == 404
    assert send(client, "DELETE", url).status_code == 404
    assert LightSource.objects.filter(pk=stranger_window.pk).exists()


@pytest.mark.django_db
def test_listing_sites_uses_a_fixed_number_of_queries(
    client_as: ClientAs, site: Site, django_assert_max_num_queries: Any
) -> None:
    client = client_as(Role.VIEWER)
    for name in ["Kitchen", "Bedroom", "Office"]:
        WindowFactory.create(location__site=site, location__name=name)

    with django_assert_max_num_queries(6):
        response = client.get("/api/v1/sites")

    assert len(response.json()[0]["locations"]) == 3


# --- Locations --------------------------------------------------------------------------------


@pytest.mark.django_db
def test_gardener_adds_an_indoor_location(client_as: ClientAs, site: Site) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/sites/{site.pk}/locations",
        {
            "name": "Bathroom",
            "kind": "indoor",
            "temperature_min_c": 18,
            "temperature_max_c": 26,
            "humidity": "high",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert (data["name"], data["humidity"], data["exposure"]) == ("Bathroom", "high", None)
    assert data["site_id"] == site.pk


@pytest.mark.django_db
def test_location_validation_errors(client_as: ClientAs, site: Site) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/sites/{site.pk}/locations"

    reversed_range = send(
        client,
        "POST",
        url,
        {"name": "Hall", "kind": "indoor", "temperature_min_c": 30, "temperature_max_c": 10},
    )
    too_hot = send(client, "POST", url, {"name": "Hall", "kind": "indoor", "temperature_max_c": 99})

    assert reversed_range.json()["error"]["code"] == "temperature_order"
    assert too_hot.json()["error"]["code"] == "validation_error"


@pytest.mark.django_db
def test_update_and_delete_a_location(client_as: ClientAs, location: Location) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/locations/{location.pk}"

    updated = send(client, "PUT", url, {"name": "Patio", "kind": "outdoor", "exposure": "shade"})

    assert updated.json()["kind"] == "outdoor"
    assert updated.json()["exposure"] == "shade"
    assert client.get(url).json()["name"] == "Patio"
    assert send(client, "DELETE", url).status_code == 204
    assert client.get(url).status_code == 404


@pytest.mark.django_db
def test_location_with_windows_cannot_become_outdoor(client_as: ClientAs) -> None:
    window = WindowFactory.create(location__site__household=Household.objects.first())
    client = client_as(Role.GARDENER)

    response = send(
        client, "PUT", f"/api/v1/locations/{window.location_id}", {"name": "X", "kind": "outdoor"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_has_light_sources"


# --- Light sources ----------------------------------------------------------------------------


@pytest.mark.django_db
def test_grow_light_reports_hours_and_daily_light(client_as: ClientAs, location: Location) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/locations/{location.pk}/light-sources",
        {**GROW_LIGHT, "name": "Shelf light"},
    )

    assert response.status_code == 201
    data = response.json()
    assert (data["on_time"], data["off_time"]) == ("07:00:00", "19:00:00")
    assert (data["hours_per_day"], data["dli"]) == (12, 8.6)
    assert data["direction"] is None


@pytest.mark.django_db
def test_window_has_no_daily_light_figure(client_as: ClientAs, location: Location) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/locations/{location.pk}/light-sources",
        {"kind": "window", "direction": "E", "distance_cm": 80},
    )

    data = response.json()
    assert (data["direction"], data["distance_cm"]) == ("E", 80)
    assert (data["hours_per_day"], data["dli"]) == (None, None)


@pytest.mark.django_db
def test_light_source_errors_name_the_field(client_as: ClientAs, location: Location) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/locations/{location.pk}/light-sources",
        {"kind": "window"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"] == {"field": "direction"}


@pytest.mark.django_db
def test_outdoor_locations_have_no_light_sources(client_as: ClientAs, site: Site) -> None:
    balcony = LocationFactory.create(site=site, kind="outdoor")

    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/locations/{balcony.pk}/light-sources",
        {"kind": "window", "direction": "S"},
    )

    assert response.json()["error"]["code"] == "outdoor_location"


@pytest.mark.django_db
def test_update_and_delete_a_light_source(client_as: ClientAs, location: Location) -> None:
    window = WindowFactory.create(location=location)
    client = client_as(Role.GARDENER)
    url = f"/api/v1/light-sources/{window.pk}"

    updated = send(client, "PUT", url, {**GROW_LIGHT, "enabled": False})

    assert updated.json()["kind"] == "grow_light"
    assert updated.json()["enabled"] is False
    assert send(client, "DELETE", url).status_code == 204
    assert not LightSource.objects.exists()
