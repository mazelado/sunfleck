import io
import json
import zipfile
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, time
from typing import Any

import pytest
import time_machine
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client

from sunfleck.accounts.models import Household, Membership, Role
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory, UserFactory
from sunfleck.care import schedules
from sunfleck.care import services as care_services
from sunfleck.care.models import CareEvent, CareSchedule, Feedback, ScheduleMode
from sunfleck.care.tests.factories import builtin
from sunfleck.dataio import exporter, importer, schema
from sunfleck.notifications import services as notification_services
from sunfleck.places.models import LightSource, Location, LocationKind, Site
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Photo, Plant, PlantLight
from sunfleck.plants.tests.factories import image_bytes
from sunfleck.plugins import services as plugin_services
from sunfleck.taxonomy.models import CareArchetype, Taxon

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(datetime(2026, 5, 10, 10, tzinfo=UTC), tick=False):
        yield


@pytest.fixture
def ada(member_of: Callable[[Role], Membership]) -> Membership:
    membership = member_of(Role.ADMIN)
    membership.user.email = "ada@example.com"
    membership.user.save()
    return membership


@pytest.fixture
def filled(household: Household, ada: Membership) -> Household:
    """A household with one of everything."""
    household.name = "Fern Gully"
    household.save()
    site = Site.objects.create(
        household=household,
        name="Home",
        latitude=52.37,
        longitude=4.89,
        timezone="Europe/Amsterdam",
    )
    room = Location.objects.create(
        site=site, name="Living room", kind=LocationKind.INDOOR, humidity="medium"
    )
    Location.objects.create(site=site, name="Garden", kind=LocationKind.OUTDOOR, exposure="shade")
    window = LightSource.objects.create(location=room, kind="window", name="Bay", direction="S")
    LightSource.objects.create(
        location=room,
        kind="grow_light",
        name="Shelf",
        ppfd=200,
        on_time=time(7),
        off_time=time(19),
    )
    harvest = care_services.create_care_type(
        household, care_services.CareTypeData("Bottom water", "droplet", counts_as_watering=False)
    )
    monty = Plant.objects.create(
        household=household,
        location=room,
        nickname="Monty",
        taxon=Taxon.objects.get(scientific_name="Monstera deliciosa"),
        container_diameter_cm=17,
        container_material="terracotta",
        acquired_on=date(2025, 3, 1),
        notes="From the market",
    )
    PlantLight.objects.create(plant=monty, light_source=window, distance_cm=80)
    plant_services.add_photo(monty, io.BytesIO(image_bytes()), 1000, caption="New leaf")
    plant_services.add_photo(monty, io.BytesIO(image_bytes(color="red")), 1000)
    Plant.objects.create(
        household=household,
        nickname="Mystery",
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
        status="dormant",
    )
    care_services.log_care(
        monty,
        care_services.CareEventData(
            builtin("water").pk,
            performed_at=datetime(2026, 5, 1, 9, tzinfo=UTC),
            feedback=Feedback.TOO_DRY,
            notes="Very dry",
        ),
        ada.user,
    )
    care_services.log_care(
        monty,
        care_services.CareEventData(harvest.pk, performed_at=datetime(2026, 5, 2, 9, tzinfo=UTC)),
        None,
    )
    schedules.create_schedule(
        monty, schedules.ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )
    schedules.create_schedule(
        monty, schedules.ScheduleData(harvest.pk, ScheduleMode.FIXED, fixed_interval_days=14)
    )
    plugin_services.update(household, "weather_openmeteo", True, {"frost_c": 3})
    plugin_services.update(household, "identify_plantnet", True, {"api_key": "secret-key"})
    notification_services.add_channel(ada.user, "Phone", "ntfy://ntfy.sh/secret-topic")
    return household


def export_bytes(household: Household) -> bytes:
    out = io.BytesIO()
    exporter.write(household, out)
    return out.getvalue()


def comparable(household: Household) -> dict[str, Any]:
    """The household's export, without what differs between households (ids, times)."""
    data = json.loads(exporter.build(household).model_dump_json())
    data.pop("exported_at")
    # Members are the target household's own; they're checked separately.
    data.pop("members")
    for plant in data["plants"]:
        for photo in plant["photos"]:
            photo.pop("image")
            photo.pop("thumbnail")
    # Refs are ids: renumber them in order of appearance, separately for each kind of object.
    numbers: dict[str, dict[int, int]] = {}
    kinds = {
        "location": "locations",
        "light_source": "light_sources",
        "cover_photo": "photos",
        "performed_by": "members",
    }

    def number(kind: str, value: int) -> int:
        seen = numbers.setdefault(kind, {})
        return seen.setdefault(value, len(seen))

    def renumber(value: Any, kind: str = "") -> Any:
        if isinstance(value, list):
            return [renumber(item, kind) for item in value]
        if not isinstance(value, dict):
            return value
        result = {}
        for key, item in value.items():
            if key == "ref" and isinstance(item, int):
                result[key] = number(kind, item)
            elif key in kinds and isinstance(item, int):
                result[key] = number(kinds[key], item)
            elif key == "care_type":
                result[key] = renumber(item, "care_types")
            else:
                result[key] = renumber(item, key)
        return result

    return renumber(data)  # type: ignore[no-any-return]


def new_household() -> Household:
    household = HouseholdFactory.create(name="New")
    user = UserFactory.create(email="boss@example.com")
    MembershipFactory.create(household=household, user=user, role=Role.ADMIN)
    return household


def moved(member: Membership, to: Household) -> None:
    """As if the member had signed up on the new server, where the export is imported: the
    same email, in the new household (one database can't have both)."""
    Membership.objects.filter(pk=member.pk).update(household=to)


def test_an_export_imports_into_a_new_household_unchanged(
    filled: Household, ada: Membership
) -> None:
    target = new_household()
    data = export_bytes(filled)
    before = comparable(filled)
    moved(ada, target)

    summary = importer.import_into(target, io.BytesIO(data))

    target.refresh_from_db()
    assert target.name == "Fern Gully"
    assert comparable(target) == before
    assert (summary.sites, summary.plants, summary.photos, summary.care_events) == (1, 2, 2, 2)
    # Care is credited to the member with the same email.
    event = CareEvent.objects.get(plant__household=target, feedback=Feedback.TOO_DRY)
    assert event.performed_by == ada.user
    assert summary.members_to_invite == []
    assert summary.plugins_needing_keys == ["Plant identification (Pl@ntNet)"]
    monty = Plant.objects.get(household=target, nickname="Monty")
    assert monty.cover_photo is not None
    assert monty.cover_photo.caption == "New leaf"
    with monty.cover_photo.image.open("rb") as copy:
        original = Photo.objects.get(plant__household=filled, caption="New leaf")
        with original.image.open("rb") as source:
            assert copy.read() == source.read()


def test_imported_schedules_are_predicted_from_the_imported_care(filled: Household) -> None:
    target = new_household()
    importer.import_into(target, io.BytesIO(export_bytes(filled)))

    water = CareSchedule.objects.get(plant__household=target, care_type__key="water")
    original = CareSchedule.objects.get(plant__household=filled, care_type__key="water")
    assert water.calculated_on is None
    today = date(2026, 5, 10)
    assert schedules.refresh(water, today).next_due == schedules.refresh(original, today).next_due


def test_secrets_and_passwords_are_left_out(filled: Household) -> None:
    data = export_bytes(filled)

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        text = archive.read(schema.DATA_FILE).decode()
        names = archive.namelist()
    assert "secret-key" not in text
    assert "secret-topic" not in text
    assert "password" not in text
    assert "ntfy" not in text
    assert len([name for name in names if name.startswith("photos/")]) == 4
    exported = json.loads(text)
    assert exported["format"] == "sunfleck-export"
    assert exported["format_version"] == 1
    plantnet = next(p for p in exported["plugins"] if p["id"] == "identify_plantnet")
    assert plantnet["settings"] == {}


def test_members_without_an_account_are_listed_to_invite(
    filled: Household, ada: Membership, member_of: Callable[[Role], Membership]
) -> None:
    gardener = member_of(Role.GARDENER)
    target = new_household()

    summary = importer.import_into(target, io.BytesIO(export_bytes(filled)))

    assert summary.members_to_invite == [ada.user.email, gardener.user.email]
    event = CareEvent.objects.get(plant__household=target, feedback=Feedback.TOO_DRY)
    assert event.performed_by is None


def test_unknown_species_and_care_profiles_are_left_unset(filled: Household) -> None:
    data = export_bytes(filled)
    Taxon.objects.filter(scientific_name="Monstera deliciosa").delete()
    CareArchetype.objects.filter(key="tropical_aroid").delete()
    target = new_household()

    summary = importer.import_into(target, io.BytesIO(data))

    assert summary.unknown_species == ["Monstera deliciosa"]
    assert summary.unknown_care_profiles == ["tropical_aroid"]
    assert Plant.objects.get(household=target, nickname="Monty").taxon is None


def test_only_an_empty_household_can_import(filled: Household) -> None:
    with pytest.raises(importer.DataImportError) as error:
        importer.import_into(filled, io.BytesIO(export_bytes(filled)))

    assert error.value.code == "household_not_empty"


def rewrite(data: bytes, change: Callable[[dict[str, Any]], None], drop: str = "") -> bytes:
    """The export with its data changed (and a file left out)."""
    source = zipfile.ZipFile(io.BytesIO(data))
    exported = json.loads(source.read(schema.DATA_FILE))
    change(exported)
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(schema.DATA_FILE, json.dumps(exported))
        for name in source.namelist():
            if name not in (schema.DATA_FILE, drop):
                archive.writestr(name, source.read(name))
    return out.getvalue()


def first_plant(exported: dict[str, Any]) -> dict[str, Any]:
    return next(p for p in exported["plants"] if p["nickname"] == "Monty")


@pytest.mark.parametrize(
    ("change", "expected"),
    [
        (lambda e: first_plant(e).update(status="flying"), "plant 'Monty'"),
        (lambda e: e["sites"][0].update(timezone="Mars/Olympus"), "unknown time zone"),
        (lambda e: first_plant(e).update(location=999), "unknown location"),
        (
            lambda e: first_plant(e)["care_events"][0]["care_type"].update(key="dance"),
            "unknown care type",
        ),
        (lambda e: e["plants"][0].pop("nickname"), "plants.0.nickname"),
        (
            lambda e: first_plant(e)["schedules"][1].update(fixed_interval_days=0),
            "schedule of 'Monty'",
        ),
    ],
)
def test_invalid_exports_import_nothing(
    filled: Household, change: Callable[[dict[str, Any]], None], expected: str
) -> None:
    target = new_household()
    data = rewrite(export_bytes(filled), change)

    with pytest.raises(importer.DataImportError) as error:
        importer.import_into(target, io.BytesIO(data))

    assert error.value.code == "invalid_export"
    assert expected in str(error.value)
    assert importer.is_empty(target)
    assert not Photo.objects.filter(plant__household=target).exists()


def test_a_missing_photo_imports_nothing_and_leaves_no_files(filled: Household) -> None:
    target = new_household()
    original = export_bytes(filled)
    last_photo = zipfile.ZipFile(io.BytesIO(original)).namelist()[-1]
    saved: list[str] = []
    real_save = importer._Importer.save_file

    def save_file(self: Any, file_field: Any, name: str, content: bytes) -> None:
        real_save(self, file_field, name, content)
        saved.append(file_field.name)

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(importer._Importer, "save_file", save_file)
        with pytest.raises(importer.DataImportError) as error:
            importer.import_into(target, io.BytesIO(rewrite(original, lambda e: None, last_photo)))

    assert "is missing" in str(error.value)
    assert saved  # some photos were saved before the missing one...
    storage = Photo._meta.get_field("image").storage
    assert not any(storage.exists(name) for name in saved)  # ...and removed again


def test_files_that_arent_exports_are_refused(household: Household) -> None:
    target = new_household()
    newer = io.BytesIO()
    with zipfile.ZipFile(newer, "w") as archive:
        archive.writestr(
            schema.DATA_FILE,
            json.dumps(
                {
                    "format": "sunfleck-export",
                    "format_version": 99,
                    "app_version": "9.0",
                    "exported_at": "2030-01-01T00:00:00Z",
                    "care_dataset": None,
                    "household": "Future",
                }
            ),
        )

    for content, code in [
        (b"not a zip", "not_an_export"),
        (newer.getvalue(), "export_too_new"),
    ]:
        with pytest.raises(importer.DataImportError) as error:
            importer.import_into(target, io.BytesIO(content))
        assert error.value.code == code


# --- API and commands -------------------------------------------------------------------------


def test_admins_download_an_export(filled: Household, ada: Membership) -> None:
    client = Client()
    client.force_login(ada.user)

    response = client.get("/api/v1/export")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/zip"
    assert 'filename="sunfleck-export-2026-05-10.zip"' in response["Content-Disposition"]
    content = b"".join(response.streaming_content)  # type: ignore[attr-defined]
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert json.loads(archive.read(schema.DATA_FILE))["household"] == "Fern Gully"


def test_admins_import_an_export(filled: Household) -> None:
    target = new_household()
    client = Client()
    client.force_login(target.memberships.get().user)
    upload = SimpleUploadedFile("export.zip", export_bytes(filled), "application/zip")

    before = client.get("/api/v1/import").json()
    response = client.post("/api/v1/import", {"file": upload})
    after = client.get("/api/v1/import").json()

    assert before == {"allowed": True}
    assert response.status_code == 200
    assert response.json()["plants"] == 2
    assert response.json()["plugins_needing_keys"] == ["Plant identification (Pl@ntNet)"]
    assert after == {"allowed": False}
    again = client.post(
        "/api/v1/import",
        {"file": SimpleUploadedFile("export.zip", export_bytes(filled), "application/zip")},
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "household_not_empty"


def test_only_admins_export_and_import(client_as: ClientAs) -> None:
    gardener = client_as(Role.GARDENER)

    assert gardener.get("/api/v1/export").status_code == 403
    assert gardener.get("/api/v1/import").status_code == 403
    assert gardener.post("/api/v1/import", {}).status_code in (403, 422)


def test_the_commands_export_and_import(
    filled: Household, ada: Membership, tmp_path: Any, capsys: pytest.CaptureFixture[str]
) -> None:
    path = tmp_path / "export.zip"
    target = new_household()

    call_command("export_household", str(path), household=filled.pk)
    before = comparable(filled)
    moved(ada, target)
    call_command("import_household", str(path), household=target.pk)

    output = capsys.readouterr().out
    assert "Exported Fern Gully: 2 plants, 2 photos" in output
    assert "Imported 1 sites, 2 plants, 2 photos and 2 care events" in output
    assert "Enter the API keys again for: Plant identification (Pl@ntNet)" in output
    target.refresh_from_db()
    assert comparable(target) == before
