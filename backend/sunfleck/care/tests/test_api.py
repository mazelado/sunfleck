import io
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.care import services
from sunfleck.care.models import CareEvent
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory, image_bytes

ClientAs = Callable[[Role], Client]
NOW = datetime(2026, 6, 1, 9, tzinfo=UTC)


def send(client: Client, method: str, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


@pytest.fixture
def plant(household: Household) -> Plant:
    return PlantFactory.create(household=household)


# --- Care types -------------------------------------------------------------------------------


@pytest.mark.django_db
def test_care_types_list_builtins_then_the_households_own(
    client_as: ClientAs, household: Household
) -> None:
    services.create_care_type(household, services.CareTypeData("Harvest", "scissors"))
    services.create_care_type(HouseholdFactory.create(), services.CareTypeData("Not ours"))

    types = client_as(Role.VIEWER).get("/api/v1/care-types").json()

    assert types[0] | {"id": 0} == {
        "id": 0,
        "key": "water",
        "name": "Water",
        "icon": "droplet",
        "is_builtin": True,
        "affects_prediction": True,
        "counts_as_watering": True,
    }
    assert [t["name"] for t in types if not t["is_builtin"]] == ["Harvest"]


@pytest.mark.django_db
def test_gardener_manages_custom_care_types(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)

    created = send(client, "POST", "/api/v1/care-types", {"name": "Harvest", "icon": "scissors"})
    url = f"/api/v1/care-types/{created.json()['id']}"
    renamed = send(client, "PUT", url, {"name": "Pick", "icon": "scissors"})
    deleted = send(client, "DELETE", url)

    assert created.status_code == 201
    assert created.json()["key"] is None
    assert renamed.json()["name"] == "Pick"
    assert deleted.status_code == 204


@pytest.mark.django_db
def test_care_type_errors(client_as: ClientAs) -> None:
    client = client_as(Role.GARDENER)
    water = builtin("water")

    duplicate = send(client, "POST", "/api/v1/care-types", {"name": "Water"})
    builtin_change = send(client, "PUT", f"/api/v1/care-types/{water.pk}", {"name": "Drink"})
    bad_icon = send(client, "POST", "/api/v1/care-types", {"name": "X", "icon": "<script>"})

    assert duplicate.json()["error"] == {
        "code": "care_type_exists",
        "message": "There's already a care type with this name.",
        "details": {"field": "name"},
    }
    assert builtin_change.json()["error"]["code"] == "builtin_care_type"
    assert bad_icon.status_code == 422


# --- The care log -----------------------------------------------------------------------------


@pytest.mark.django_db
@time_machine.travel(NOW, tick=False)
def test_gardener_logs_watering_with_feedback(client_as: ClientAs, plant: Plant) -> None:
    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/plants/{plant.pk}/care-events",
        {"care_type_id": builtin("water").pk, "feedback": "too_dry"},
    )

    assert response.status_code == 201
    event = response.json()
    assert event["care_type"]["key"] == "water"
    assert event["performed_at"] == "2026-06-01T09:00:00Z"
    assert event["performed_by"]["display_name"]
    assert (event["feedback"], event["skipped"], event["notes"]) == ("too_dry", False, "")


@pytest.mark.django_db
def test_viewer_sees_care_but_cannot_log_or_change_it(client_as: ClientAs, plant: Plant) -> None:
    event = CareEventFactory.create(plant=plant)
    client = client_as(Role.VIEWER)
    body = {"care_type_id": builtin("water").pk}

    assert client.get(f"/api/v1/plants/{plant.pk}/timeline").status_code == 200
    assert client.get("/api/v1/care-types").status_code == 200
    assert send(client, "POST", f"/api/v1/plants/{plant.pk}/care-events", body).status_code == 403
    assert send(client, "PUT", f"/api/v1/care-events/{event.pk}", body).status_code == 403
    assert send(client, "DELETE", f"/api/v1/care-events/{event.pk}").status_code == 403
    assert send(client, "POST", "/api/v1/care-types", {"name": "X"}).status_code == 403


@pytest.mark.django_db
def test_other_households_care_is_invisible(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    stranger = CareEventFactory.create(plant__household=HouseholdFactory.create())
    theirs = services.create_care_type(stranger.plant.household, services.CareTypeData("Theirs"))
    body = {"care_type_id": builtin("water").pk}

    assert client.get(f"/api/v1/plants/{stranger.plant_id}/timeline").status_code == 404
    assert (
        send(client, "POST", f"/api/v1/plants/{stranger.plant_id}/care-events", body).status_code
        == 404
    )
    assert send(client, "PUT", f"/api/v1/care-events/{stranger.pk}", body).status_code == 404
    assert send(client, "DELETE", f"/api/v1/care-events/{stranger.pk}").status_code == 404
    assert send(client, "DELETE", f"/api/v1/care-types/{theirs.pk}").status_code == 404
    assert CareEvent.objects.filter(pk=stranger.pk).exists()


@pytest.mark.django_db
def test_logging_another_households_care_type_names_the_field(
    client_as: ClientAs, plant: Plant
) -> None:
    theirs = services.create_care_type(HouseholdFactory.create(), services.CareTypeData("Theirs"))

    response = send(
        client_as(Role.GARDENER),
        "POST",
        f"/api/v1/plants/{plant.pk}/care-events",
        {"care_type_id": theirs.pk},
    )

    assert response.status_code == 422
    assert response.json()["error"]["details"] == {"field": "care_type_id"}


@pytest.mark.django_db
def test_correct_and_delete_logged_care(client_as: ClientAs, plant: Plant) -> None:
    event = CareEventFactory.create(plant=plant)
    client = client_as(Role.GARDENER)
    url = f"/api/v1/care-events/{event.pk}"

    updated = send(
        client,
        "PUT",
        url,
        {
            "care_type_id": builtin("mist").pk,
            "performed_at": "2026-04-30T18:00:00+02:00",
            "notes": "Morning",
        },
    )

    assert updated.json()["care_type"]["key"] == "mist"
    assert updated.json()["performed_at"] == "2026-04-30T16:00:00Z"
    assert send(client, "DELETE", url).status_code == 204
    assert not CareEvent.objects.exists()


# --- Timeline ---------------------------------------------------------------------------------


@pytest.mark.django_db
def test_timeline_pages_through_care_and_photos(client_as: ClientAs, plant: Plant) -> None:
    start = datetime(2026, 5, 1, 9, tzinfo=UTC)
    for day in range(3):
        CareEventFactory.create(plant=plant, performed_at=start + timedelta(days=day))
    data = image_bytes()
    plant_services.add_photo(
        plant, io.BytesIO(data), len(data), taken_at=start + timedelta(hours=12)
    )
    client = client_as(Role.VIEWER)
    url = f"/api/v1/plants/{plant.pk}/timeline"

    first = client.get(f"{url}?limit=2").json()
    second = client.get(url, {"limit": 2, "before": first["next_cursor"]}).json()

    assert [item["kind"] for item in first["items"]] == ["care", "care"]
    assert [item["kind"] for item in second["items"]] == ["photo", "care"]
    assert second["items"][0]["photo"]["thumbnail_url"].endswith("/thumbnail")
    assert second["next_cursor"] is None


@pytest.mark.django_db
def test_timeline_refuses_invalid_cursors(client_as: ClientAs, plant: Plant) -> None:
    response = client_as(Role.VIEWER).get(
        f"/api/v1/plants/{plant.pk}/timeline", {"before": "garbage"}
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_cursor"


@pytest.mark.django_db
def test_timeline_uses_a_fixed_number_of_queries(
    client_as: ClientAs, plant: Plant, django_assert_max_num_queries: Any
) -> None:
    client = client_as(Role.VIEWER)
    for _ in range(5):
        CareEventFactory.create(plant=plant)

    with django_assert_max_num_queries(6):
        response = client.get(f"/api/v1/plants/{plant.pk}/timeline")

    assert len(response.json()["items"]) == 5


# --- Plants show when they were last watered --------------------------------------------------


@pytest.mark.django_db
def test_plants_show_when_they_were_last_watered(client_as: ClientAs, plant: Plant) -> None:
    water = builtin("water")
    CareEventFactory.create(
        plant=plant, care_type=water, performed_at=datetime(2026, 5, 1, tzinfo=UTC)
    )
    CareEventFactory.create(
        plant=plant, care_type=water, performed_at=datetime(2026, 5, 3, tzinfo=UTC)
    )
    # Neither a skipped watering nor other care counts.
    CareEventFactory.create(
        plant=plant, care_type=water, performed_at=datetime(2026, 5, 5, tzinfo=UTC), skipped=True
    )
    CareEventFactory.create(
        plant=plant, care_type=builtin("mist"), performed_at=datetime(2026, 5, 6, tzinfo=UTC)
    )
    PlantFactory.create(household=plant.household, nickname="Zz never watered")
    client = client_as(Role.VIEWER)

    listed = client.get("/api/v1/plants").json()["items"]
    detail = client.get(f"/api/v1/plants/{plant.pk}").json()

    assert [p["last_watered_at"] for p in listed] == ["2026-05-03T00:00:00Z", None]
    assert detail["last_watered_at"] == "2026-05-03T00:00:00Z"


@pytest.mark.django_db
def test_custom_watering_types_count_as_watering(client_as: ClientAs, plant: Plant) -> None:
    client = client_as(Role.GARDENER)
    bottom = send(
        client,
        "POST",
        "/api/v1/care-types",
        {"name": "Bottom water", "icon": "droplet", "counts_as_watering": True},
    ).json()

    logged = send(
        client,
        "POST",
        f"/api/v1/plants/{plant.pk}/care-events",
        {"care_type_id": bottom["id"], "feedback": "still_wet"},
    )

    assert bottom["counts_as_watering"] is True
    assert logged.json()["feedback"] == "still_wet"
    detail = client.get(f"/api/v1/plants/{plant.pk}").json()
    assert detail["last_watered_at"] == logged.json()["performed_at"]
