import io
import json
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.care import schedules
from sunfleck.care.models import CareType, ScheduleMode
from sunfleck.care.tests.factories import builtin
from sunfleck.places.models import Location
from sunfleck.places.tests.factories import LocationFactory, WindowFactory
from sunfleck.plants import services
from sunfleck.plants.models import Photo, Plant, PlantLight
from sunfleck.plants.tests.factories import PlantFactory, image_bytes
from sunfleck.taxonomy.models import CareArchetype

ClientAs = Callable[[Role], Client]


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def upload(client: Client, plant_id: int, data: bytes | None = None, **fields: str) -> Any:
    file = SimpleUploadedFile("leaf.jpg", data or image_bytes(), content_type="image/jpeg")
    return client.post(f"/api/v1/plants/{plant_id}/photos", {"file": file, **fields})


@pytest.fixture
def location(household: Household) -> Location:
    return LocationFactory.create(site__household=household)


@pytest.fixture
def plant(household: Household, location: Location) -> Plant:
    return PlantFactory.create(household=household, location=location)


def _photo(plant: Plant) -> Photo:
    data = image_bytes()
    return services.add_photo(plant, io.BytesIO(data), len(data))


# --- Plants -----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_gardener_adds_a_plant_with_its_light(client_as: ClientAs, location: Location) -> None:
    window = WindowFactory.create(location=location, direction="E")

    response = send(
        client_as(Role.GARDENER),
        "POST",
        "/api/v1/plants",
        {
            "nickname": "Monty",
            "location_id": location.pk,
            "container_diameter_cm": 17,
            "container_height_cm": 15,
            "container_material": "terracotta",
            "soil_type": "aroid_mix",
            "acquired_on": "2026-04-01",
            "light_sources": [{"light_source_id": window.pk, "distance_cm": 150}],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["location"] == {
        "id": location.pk,
        "name": "Living room",
        "kind": "indoor",
        "site_id": location.site_id,
        "site_name": "Home",
    }
    assert (data["container_diameter_cm"], data["container_height_cm"]) == (17, 15)
    assert (data["container_material"], data["soil_type"]) == ("terracotta", "aroid_mix")
    [light] = data["light_sources"]
    assert (light["light_source"]["direction"], light["distance_cm"]) == ("E", 150)
    assert data["cover_photo"] is None


@pytest.mark.django_db
def test_gardener_moves_plants_into_a_location(
    client_as: ClientAs, household: Household, plant: Plant, location: Location
) -> None:
    window = WindowFactory.create(location=location, direction="S")
    PlantLight.objects.create(plant=plant, light_source=window, distance_cm=50)
    homeless = PlantFactory.create(household=household, location=None, nickname="Fern")
    kitchen = LocationFactory.create(site=location.site, name="Kitchen")
    already_there = PlantFactory.create(household=household, location=kitchen, nickname="Basil")
    client = client_as(Role.GARDENER)

    response = send(
        client,
        "POST",
        "/api/v1/plants/move",
        {"location_id": kitchen.pk, "plant_ids": [plant.pk, homeless.pk, already_there.pk]},
    )

    assert response.status_code == 200
    # Only the plants that moved are returned.
    assert sorted(p["nickname"] for p in response.json()) == ["Fern", plant.nickname]
    plant.refresh_from_db()
    homeless.refresh_from_db()
    assert (plant.location, homeless.location) == (kitchen, kitchen)
    # The old location's window no longer reaches it.
    assert not plant.light_links.exists()


@pytest.mark.django_db
def test_moving_plants_is_for_gardeners_and_within_the_household(
    client_as: ClientAs, plant: Plant, location: Location
) -> None:
    other = PlantFactory.create(household=HouseholdFactory.create())
    move = {"location_id": location.pk, "plant_ids": [plant.pk]}

    viewer = send(client_as(Role.VIEWER), "POST", "/api/v1/plants/move", move)
    foreign = send(
        client_as(Role.GARDENER),
        "POST",
        "/api/v1/plants/move",
        {"location_id": location.pk, "plant_ids": [plant.pk, other.pk]},
    )

    assert viewer.status_code == 403
    assert foreign.status_code == 422
    assert foreign.json()["error"]["code"] == "plant_not_found"
    other.refresh_from_db()
    assert other.location != location


@pytest.mark.django_db
def test_viewer_sees_plants_but_cannot_change_them(client_as: ClientAs, plant: Plant) -> None:
    photo = _photo(plant)
    client = client_as(Role.VIEWER)

    assert client.get("/api/v1/plants").json()["count"] == 1
    assert client.get(f"/api/v1/plants/{plant.pk}").status_code == 200
    assert client.get(f"/api/v1/plants/{plant.pk}/photos").json()["count"] == 1
    assert client.get(f"/api/v1/photos/{photo.pk}/thumbnail").status_code == 200
    assert send(client, "POST", "/api/v1/plants", {"nickname": "X"}).status_code == 403
    assert send(client, "PUT", f"/api/v1/plants/{plant.pk}", {"nickname": "X"}).status_code == 403
    assert send(client, "DELETE", f"/api/v1/plants/{plant.pk}").status_code == 403
    assert upload(client, plant.pk).status_code == 403
    cover = {"photo_id": photo.pk}
    assert send(client, "PUT", f"/api/v1/plants/{plant.pk}/cover", cover).status_code == 403
    assert send(client, "PUT", f"/api/v1/photos/{photo.pk}", {}).status_code == 403
    assert send(client, "DELETE", f"/api/v1/photos/{photo.pk}").status_code == 403


@pytest.mark.django_db
def test_signed_out_visitors_see_nothing(plant: Plant) -> None:
    photo = _photo(plant)
    client = Client()

    assert client.get("/api/v1/plants").status_code == 401
    assert client.get(f"/api/v1/photos/{photo.pk}/image").status_code == 401


@pytest.mark.django_db
def test_other_households_plants_are_invisible(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    stranger = PlantFactory.create(household=HouseholdFactory.create(name="Elsewhere"))
    photo = _photo(stranger)

    assert client.get("/api/v1/plants").json() == {"items": [], "count": 0}
    assert client.get(f"/api/v1/plants/{stranger.pk}").status_code == 404
    assert client.get(f"/api/v1/photos/{photo.pk}/image").status_code == 404
    assert (
        send(client, "PUT", f"/api/v1/plants/{stranger.pk}", {"nickname": "X"}).status_code == 404
    )
    assert upload(client, stranger.pk).status_code == 404
    assert send(client, "DELETE", f"/api/v1/photos/{photo.pk}").status_code == 404
    assert Photo.objects.filter(pk=photo.pk).exists()


@pytest.mark.django_db
def test_plant_errors_name_the_field(client_as: ClientAs) -> None:
    elsewhere = LocationFactory.create(site__household=HouseholdFactory.create())

    response = send(
        client_as(Role.GARDENER),
        "POST",
        "/api/v1/plants",
        {"nickname": "Monty", "location_id": elsewhere.pk},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_not_found"
    assert response.json()["error"]["details"] == {"field": "location_id"}


@pytest.mark.django_db
def test_list_is_paged_searchable_and_filterable(
    client_as: ClientAs, household: Household, location: Location
) -> None:
    client = client_as(Role.VIEWER)
    for name in ["Basil", "Calathea", "Monstera", "Mint"]:
        PlantFactory.create(household=household, nickname=name, location=location)
    PlantFactory.create(household=household, nickname="Old fern", status="deceased")

    first_page = client.get("/api/v1/plants?limit=2").json()
    second_page = client.get("/api/v1/plants?limit=2&offset=2").json()
    searched = client.get("/api/v1/plants?q=m").json()
    in_location = client.get(f"/api/v1/plants?location_id={location.pk}").json()
    deceased = client.get("/api/v1/plants?status=deceased").json()

    assert [p["nickname"] for p in first_page["items"]] == ["Basil", "Calathea"]
    assert first_page["count"] == 5
    assert [p["nickname"] for p in second_page["items"]] == ["Mint", "Monstera"]
    assert [p["nickname"] for p in searched["items"]] == ["Mint", "Monstera"]
    assert in_location["count"] == 4
    assert [p["nickname"] for p in deceased["items"]] == ["Old fern"]


@pytest.mark.django_db
def test_plants_without_a_care_schedule_are_marked_and_filterable(
    client_as: ClientAs, household: Household
) -> None:
    rotate = CareType.objects.get(household=None, key="rotate")
    scheduled = PlantFactory.create(household=household, nickname="Basil")
    schedules.create_schedule(scheduled, schedules.ScheduleData(rotate.pk, ScheduleMode.FIXED, 7))
    PlantFactory.create(household=household, nickname="Fern")
    PlantFactory.create(household=household, nickname="Old fern", status="deceased")
    client = client_as(Role.VIEWER)

    listed = client.get("/api/v1/plants").json()["items"]
    needing = client.get("/api/v1/plants?needs_routine=true").json()["items"]
    not_needing = client.get("/api/v1/plants?needs_routine=false").json()["items"]

    assert {p["nickname"]: p["needs_routine"] for p in listed} == {
        "Basil": False,
        "Fern": True,
        "Old fern": False,  # not looked after any more
    }
    assert [p["nickname"] for p in needing] == ["Fern"]
    assert [p["nickname"] for p in not_needing] == ["Basil", "Old fern"]


@pytest.mark.django_db
def test_listing_plants_uses_a_fixed_number_of_queries(
    client_as: ClientAs,
    household: Household,
    location: Location,
    django_assert_max_num_queries: Any,
) -> None:
    client = client_as(Role.VIEWER)
    window = WindowFactory.create(location=location)
    aroid = CareArchetype.objects.get(key="tropical_aroid")
    for name in ["Basil", "Calathea", "Monstera"]:
        plant = PlantFactory.create(
            household=household, nickname=name, location=location, care_profile=aroid
        )
        _photo(plant)
        PlantLight.objects.create(plant=plant, light_source=window, distance_cm=50)
        schedules.create_schedule(
            plant, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
        )

    # The plants, their count, and for all of them at once: schedules, care types, lights and
    # light sources (for the care bars), and the session.
    with django_assert_max_num_queries(7):
        response = client.get("/api/v1/plants")

    assert all(p["cover_thumbnail_url"] for p in response.json()["items"])
    assert all(p["glance"]["water"] and p["glance"]["light"] for p in response.json()["items"])


@pytest.mark.django_db
def test_update_and_delete_a_plant(client_as: ClientAs, plant: Plant) -> None:
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{plant.pk}"

    updated = send(client, "PUT", url, {"nickname": "Monstera", "status": "dormant"})

    assert updated.json()["nickname"] == "Monstera"
    assert updated.json()["status"] == "dormant"
    assert updated.json()["location"] is None  # not sent, so the plant has no location now
    assert send(client, "DELETE", url).status_code == 204
    assert client.get(url).status_code == 404


# --- Photos -----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_gardener_uploads_a_photo_and_views_it(client_as: ClientAs, plant: Plant) -> None:
    client = client_as(Role.GARDENER)

    response = upload(client, plant.pk, image_bytes(3000, 2000), caption="New leaf!")

    assert response.status_code == 201
    photo = response.json()
    assert (photo["width"], photo["height"], photo["caption"]) == (2048, 1365, "New leaf!")
    image = client.get(photo["image_url"])
    assert image["Content-Type"] == "image/webp"
    assert image["Cache-Control"] == "private, max-age=31536000, immutable"
    assert image.getvalue()[:4] == b"RIFF"
    detail = client.get(f"/api/v1/plants/{plant.pk}").json()
    assert detail["cover_photo"]["id"] == photo["id"]
    listed = client.get("/api/v1/plants").json()["items"][0]
    assert listed["cover_thumbnail_url"] == photo["thumbnail_url"]


@pytest.mark.django_db
def test_upload_accepts_the_date_taken(client_as: ClientAs, plant: Plant) -> None:
    response = upload(client_as(Role.GARDENER), plant.pk, taken_at="2026-05-01T12:00:00+02:00")

    taken_at = datetime.fromisoformat(response.json()["taken_at"])
    assert taken_at == datetime(2026, 5, 1, 10, tzinfo=UTC)


@pytest.mark.django_db
def test_upload_errors_name_the_field(client_as: ClientAs, plant: Plant) -> None:
    response = upload(client_as(Role.GARDENER), plant.pk, b"%PDF-1.7 not a photo")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_image"
    assert response.json()["error"]["details"] == {"field": "file"}


@pytest.mark.django_db
def test_choose_caption_and_delete_photos(client_as: ClientAs, plant: Plant) -> None:
    client = client_as(Role.GARDENER)
    first, second = _photo(plant), _photo(plant)

    cover = send(client, "PUT", f"/api/v1/plants/{plant.pk}/cover", {"photo_id": second.pk})
    captioned = send(client, "PUT", f"/api/v1/photos/{second.pk}", {"caption": "Repotted"})
    deleted = send(client, "DELETE", f"/api/v1/photos/{first.pk}")

    assert cover.json()["cover_photo"]["id"] == second.pk
    assert captioned.json()["caption"] == "Repotted"
    assert deleted.status_code == 204
    assert [p["id"] for p in client.get(f"/api/v1/plants/{plant.pk}/photos").json()["items"]] == [
        second.pk
    ]


@pytest.mark.django_db
def test_cover_must_be_one_of_the_plants_photos(
    client_as: ClientAs, plant: Plant, household: Household
) -> None:
    other = _photo(PlantFactory.create(household=household))

    response = send(
        client_as(Role.GARDENER), "PUT", f"/api/v1/plants/{plant.pk}/cover", {"photo_id": other.pk}
    )

    assert response.json()["error"]["code"] == "photo_not_found"
