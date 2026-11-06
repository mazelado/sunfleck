import io
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.utils import timezone

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.care import schedules
from sunfleck.care.models import CareType, ScheduleMode
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.models import Location
from sunfleck.places.tests.factories import LocationFactory, WindowFactory
from sunfleck.plants import services
from sunfleck.plants.models import Photo, Plant, PlantLight, Wish
from sunfleck.plants.tests.factories import PlantFactory, image_bytes
from sunfleck.taxonomy.models import CareArchetype, Taxon

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
def test_when_a_new_plant_was_last_cared_for_is_recorded_as_estimated_care(
    client_as: ClientAs, location: Location
) -> None:
    gardener = client_as(Role.GARDENER)

    response = send(
        gardener,
        "POST",
        "/api/v1/plants",
        {
            "nickname": "Monty",
            "location_id": location.pk,
            "last_watered_days_ago": 3,
            "last_fertilized_days_ago": 14,
        },
    )

    plant = Plant.objects.get(pk=response.json()["id"])
    events = {event.care_type.key: event for event in plant.care_events.all()}
    assert set(events) == {"water", "fertilize"}
    assert all(event.estimated for event in events.values())
    assert (timezone.now() - events["water"].performed_at).days == 3
    assert (timezone.now() - events["fertilize"].performed_at).days == 14
    assert events["water"].performed_by is not None
    timeline = gardener.get(f"/api/v1/plants/{plant.pk}/timeline").json()
    care = [item["care_event"] for item in timeline["items"] if item["kind"] == "care"]
    assert len(care) == 2
    assert all(event["estimated"] for event in care)


@pytest.mark.django_db
def test_nothing_is_recorded_when_its_last_care_isnt_known(
    client_as: ClientAs, location: Location
) -> None:
    response = send(client_as(Role.GARDENER), "POST", "/api/v1/plants", {"nickname": "Fern"})

    assert response.status_code == 201
    assert not Plant.objects.get(pk=response.json()["id"]).care_events.exists()


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
def test_crop_a_photo_and_show_all_of_it_again(client_as: ClientAs, plant: Plant) -> None:
    client = client_as(Role.GARDENER)
    photo = _photo(plant)
    old_thumbnail = photo.thumbnail.name
    before = client.get(f"/api/v1/plants/{plant.pk}").json()["cover_photo"]
    assert before["crop"] is None

    crop = {"x": 0.25, "y": 0.1, "width": 0.5, "height": 0.5}
    cropped = send(client, "PUT", f"/api/v1/photos/{photo.pk}/crop", {"crop": crop})

    assert cropped.status_code == 200
    assert cropped.json()["crop"] == crop
    # A new thumbnail, at a new address, as browsers keep thumbnails for good.
    assert cropped.json()["thumbnail_url"] != before["thumbnail_url"]
    assert client.get(cropped.json()["thumbnail_url"]).status_code == 200
    assert old_thumbnail
    assert not photo.thumbnail.storage.exists(old_thumbnail)
    listed = client.get("/api/v1/plants").json()["items"][0]
    assert listed["cover_thumbnail_url"] == cropped.json()["thumbnail_url"]

    whole = send(client, "PUT", f"/api/v1/photos/{photo.pk}/crop", {"crop": None})
    assert whole.json()["crop"] is None


@pytest.mark.django_db
def test_crops_must_be_inside_the_photo(client_as: ClientAs, plant: Plant) -> None:
    photo = _photo(plant)

    response = send(
        client_as(Role.GARDENER),
        "PUT",
        f"/api/v1/photos/{photo.pk}/crop",
        {"crop": {"x": 0.8, "y": 0, "width": 0.5, "height": 1}},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_crop"


@pytest.mark.django_db
def test_viewers_cant_crop_photos(client_as: ClientAs, plant: Plant) -> None:
    photo = _photo(plant)

    response = send(
        client_as(Role.VIEWER), "PUT", f"/api/v1/photos/{photo.pk}/crop", {"crop": None}
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_cover_must_be_one_of_the_plants_photos(
    client_as: ClientAs, plant: Plant, household: Household
) -> None:
    other = _photo(PlantFactory.create(household=household))

    response = send(
        client_as(Role.GARDENER), "PUT", f"/api/v1/plants/{plant.pk}/cover", {"photo_id": other.pk}
    )

    assert response.json()["error"]["code"] == "photo_not_found"


@pytest.mark.django_db
def test_the_care_bars_move_as_soon_as_care_is_logged(client_as: ClientAs, plant: Plant) -> None:
    # Issue #136: logging care marks the schedules out of date, and the plant's page asks for
    # the plant again straight away. Its bars mustn't show the old due dates.
    long_ago = timezone.now() - timedelta(days=40)
    for key, days in [("water", 7), ("fertilize", 30)]:
        CareEventFactory.create(plant=plant, care_type=builtin(key), performed_at=long_ago)
        schedules.create_schedule(
            plant, schedules.ScheduleData(builtin(key).pk, ScheduleMode.FIXED, days)
        )
    client = client_as(Role.GARDENER)
    before = client.get(f"/api/v1/plants/{plant.pk}").json()["glance"]
    assert (before["water"]["level"], before["fertilizer"]["level"]) == (0.0, 0.0)

    for key in ["water", "fertilize"]:
        send(
            client,
            "POST",
            f"/api/v1/plants/{plant.pk}/care-events",
            {"care_type_id": builtin(key).pk},
        )
    after = client.get(f"/api/v1/plants/{plant.pk}").json()["glance"]

    assert (after["water"]["level"], after["water"]["due_in_days"]) == (1.0, 7)
    assert (after["fertilizer"]["level"], after["fertilizer"]["due_in_days"]) == (1.0, 30)
    # In the list too.
    [listed] = client.get("/api/v1/plants").json()["items"]
    assert listed["glance"]["water"]["level"] == 1.0


# --- Propagation ------------------------------------------------------------------------------


@pytest.mark.django_db
def test_cuttings_are_new_plants_grown_from_the_parent(
    client_as: ClientAs, household: Household, location: Location
) -> None:
    window = WindowFactory.create(location=location)
    aroid = CareArchetype.objects.get(key="tropical_aroid")
    parent = PlantFactory.create(
        household=household, nickname="Monty", location=location, care_profile=aroid
    )
    PlantLight.objects.create(plant=parent, light_source=window, distance_cm=50)
    client = client_as(Role.GARDENER)

    response = send(
        client, "POST", f"/api/v1/plants/{parent.pk}/propagate", {"method": "cutting", "count": 2}
    )

    assert response.status_code == 201
    added = response.json()
    assert [p["nickname"] for p in added] == ["Monty (cutting 1)", "Monty (cutting 2)"]
    assert {p["status"] for p in added} == {"propagating"}
    # Its care profile, location and lights; a routine to accept, as for any new plant.
    cutting = client.get(f"/api/v1/plants/{added[0]['id']}").json()
    assert cutting["care_profile"]["key"] == "tropical_aroid"
    assert cutting["location"]["id"] == location.pk
    assert [light["light_source"]["id"] for light in cutting["light_sources"]] == [window.pk]
    assert cutting["acquired_on"] == str(timezone.localdate())
    assert cutting["lineage"] == {
        "parent": {"id": parent.pk, "nickname": "Monty"},
        "propagation_method": "cutting",
        "offspring": [],
    }
    assert added[0]["needs_routine"] is True
    # The parent lists them, newest first.
    lineage = client.get(f"/api/v1/plants/{parent.pk}").json()["lineage"]
    assert lineage["parent"] is None
    assert [child["nickname"] for child in lineage["offspring"]] == [
        "Monty (cutting 2)",
        "Monty (cutting 1)",
    ]


@pytest.mark.django_db
def test_a_division_can_go_elsewhere_with_its_own_name(
    client_as: ClientAs, household: Household, location: Location
) -> None:
    parent = PlantFactory.create(household=household, nickname="Sansevieria", location=location)
    WindowFactory.create(location=location)
    elsewhere = LocationFactory.create(site=location.site)
    client = client_as(Role.GARDENER)

    response = send(
        client,
        "POST",
        f"/api/v1/plants/{parent.pk}/propagate",
        {
            "method": "division",
            "nickname": "Snake plant for Bea",
            "location_id": elsewhere.pk,
            "started_on": "2026-03-01",
        },
    )

    [division] = response.json()
    assert division["nickname"] == "Snake plant for Bea"
    plant = Plant.objects.get(pk=division["id"])
    # Another location: the parent's lights don't reach it.
    assert (plant.location, plant.light_links.count()) == (elsewhere, 0)
    assert (plant.propagation_method, str(plant.acquired_on)) == ("division", "2026-03-01")


@pytest.mark.django_db
def test_propagating_checks_where_and_how_many(
    client_as: ClientAs, household: Household, location: Location
) -> None:
    parent = PlantFactory.create(household=household, location=location)
    theirs = LocationFactory.create(site__household=HouseholdFactory.create())
    client = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{parent.pk}/propagate"

    response = send(client, "POST", url, {"method": "cutting", "location_id": theirs.pk})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "location_not_found"
    assert send(client, "POST", url, {"method": "cutting", "count": 51}).status_code == 422
    assert send(client, "POST", url, {"method": "grafting"}).status_code == 422
    assert send(client_as(Role.VIEWER), "POST", url, {"method": "cutting"}).status_code == 403
    other = PlantFactory.create(household=HouseholdFactory.create())
    assert (
        send(client, "POST", f"/api/v1/plants/{other.pk}/propagate", {"method": "seed"}).status_code
        == 404
    )
    assert parent.offspring.count() == 0


@pytest.mark.django_db
def test_deleting_the_parent_keeps_how_a_plant_was_grown(
    client_as: ClientAs, household: Household
) -> None:
    parent = PlantFactory.create(household=household)
    child = PlantFactory.create(household=household, parent=parent, propagation_method="offset")
    client = client_as(Role.GARDENER)

    send(client, "DELETE", f"/api/v1/plants/{parent.pk}")

    lineage = client.get(f"/api/v1/plants/{child.pk}").json()["lineage"]
    assert (lineage["parent"], lineage["propagation_method"]) == (None, "offset")


# --- The wishlist -----------------------------------------------------------------------------


@pytest.mark.django_db
def test_the_wishlist_lists_plants_wanted(client_as: ClientAs, household: Household) -> None:
    client = client_as(Role.GARDENER)
    monstera = Taxon.objects.get(scientific_name="Monstera deliciosa")

    added = send(
        client,
        "POST",
        "/api/v1/wishlist",
        {
            "name": " Variegated monstera ",
            "taxon_id": monstera.pk,
            "link": "https://plants.example.com/monstera",
            "notes": "Half-moon",
        },
    )
    send(client, "POST", "/api/v1/wishlist", {"name": "Anthurium"})

    assert added.status_code == 201
    wish = added.json()
    assert (wish["name"], wish["species"]["scientific_name"]) == (
        "Variegated monstera",
        "Monstera deliciosa",
    )
    listed = client_as(Role.VIEWER).get("/api/v1/wishlist").json()
    assert [item["name"] for item in listed] == ["Anthurium", "Variegated monstera"]

    changed = send(
        client, "PUT", f"/api/v1/wishlist/{wish['id']}", {"name": "Monstera", "notes": "Any"}
    )
    assert (changed.json()["name"], changed.json()["species"]) == ("Monstera", None)
    assert send(client, "DELETE", f"/api/v1/wishlist/{wish['id']}").status_code == 204
    assert [item["name"] for item in client.get("/api/v1/wishlist").json()] == ["Anthurium"]


@pytest.mark.django_db
def test_the_wishlist_checks_what_it_gets(client_as: ClientAs, household: Household) -> None:
    client = client_as(Role.GARDENER)

    assert send(client, "POST", "/api/v1/wishlist", {"name": ""}).status_code == 422
    not_a_link = {"name": "Hoya", "link": "javascript:alert(1)"}
    assert send(client, "POST", "/api/v1/wishlist", not_a_link).status_code == 422
    unknown = send(client, "POST", "/api/v1/wishlist", {"name": "Hoya", "taxon_id": 999_999})
    assert unknown.json()["error"]["code"] == "species_not_found"
    assert (
        send(client_as(Role.VIEWER), "POST", "/api/v1/wishlist", {"name": "Hoya"}).status_code
        == 403
    )
    theirs = Wish.objects.create(household=HouseholdFactory.create(), name="Theirs")
    assert send(client, "DELETE", f"/api/v1/wishlist/{theirs.pk}").status_code == 404


@pytest.mark.django_db
def test_a_plant_from_the_wishlist_comes_off_it(client_as: ClientAs, household: Household) -> None:
    wish = Wish.objects.create(household=household, name="Hoya")
    other = Wish.objects.create(household=household, name="Anthurium")
    theirs = Wish.objects.create(household=HouseholdFactory.create(), name="Hoya")

    response = send(
        client_as(Role.GARDENER),
        "POST",
        "/api/v1/plants",
        {"nickname": "Hoya", "from_wish_id": wish.pk},
    )

    assert response.status_code == 201
    assert list(Wish.objects.filter(household=household)) == [other]
    # Another household's wish isn't touched, even if asked.
    send(
        client_as(Role.GARDENER),
        "POST",
        "/api/v1/plants",
        {"nickname": "X", "from_wish_id": theirs.pk},
    )
    assert Wish.objects.filter(pk=theirs.pk).exists()
