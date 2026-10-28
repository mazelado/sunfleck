import io
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from PIL import ExifTags, Image

from sunfleck.accounts.models import Household, Role
from sunfleck.plants.tests.factories import image_bytes
from sunfleck.plugins import (
    Candidate,
    Identification,
    PhotoToIdentify,
    PluginInfo,
    hookimpl,
    services,
)
from sunfleck.plugins.models import PluginSetting
from sunfleck.plugins.registry import registry

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

GPS = {ExifTags.GPS.GPSLatitudeRef: "N", ExifTags.GPS.GPSLatitude: (52.0, 22.0, 13.0)}
EXIF: dict[int, Any] = {ExifTags.Base.Make: "PhoneCo", ExifTags.IFD.GPSInfo: GPS}


class Identifier:
    """A fake identification plugin that answers what it's told and remembers what it saw."""

    def __init__(self) -> None:
        self.answer: Identification | Exception = Identification(
            attribution="Identified by Test",
            candidates=(
                Candidate("Quercus robur", 0.02, "Quercus", "Fagaceae", ("English oak",)),
                Candidate("Monstera deliciosa", 0.81, "Monstera", "Araceae", ("Cheese plant",)),
                Candidate("Philodendron scandens", 0.1, "Philodendron", "Araceae"),
                Candidate("Monstera obliqua", 0.05, "Monstera", "Araceae"),
            ),
            remaining=499,
        )
        self.seen: list[tuple[list[PhotoToIdentify], str]] = []

    @hookimpl
    def identify_plant(self, photos: list[PhotoToIdentify], language: str) -> Identification:
        self.seen.append((photos, language))
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


@pytest.fixture
def identifier(household: Household) -> Iterator[Identifier]:
    hooks = Identifier()
    registry.add(PluginInfo("leafy", "Leafy", "1", "1"), hooks)
    services.update(household, "leafy", True, {})
    yield hooks
    registry.remove("leafy")


def upload(client: Client, *photos: bytes) -> Any:
    files = [
        SimpleUploadedFile(f"photo{index}.jpg", photo, "image/jpeg")
        for index, photo in enumerate(photos)
    ]
    return client.post("/api/v1/identify", {"photos": files})


def test_candidates_are_found_in_the_care_guide(
    client_as: ClientAs, identifier: Identifier
) -> None:
    response = upload(client_as(Role.GARDENER), image_bytes())

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"] == "Identified by Test"
    assert body["remaining"] == 499
    found = [
        (c["scientific_name"], c["species"] and c["species"]["scientific_name"], c["exact"])
        for c in body["candidates"]
    ]
    assert found == [
        ("Monstera deliciosa", "Monstera deliciosa", True),
        # By its older name.
        ("Philodendron scandens", "Philodendron hederaceum", True),
        # Only its genus is in the guide.
        ("Monstera obliqua", "Monstera", False),
        ("Quercus robur", None, False),
    ]
    first = body["candidates"][0]
    assert first["score"] == 0.81
    assert first["common_names"] == ["Cheese plant"]
    assert first["species"]["care_profile"]["key"] == "tropical_aroid"


def test_photos_are_sent_as_small_jpegs_without_metadata(
    client_as: ClientAs, identifier: Identifier
) -> None:
    photo = image_bytes(3000, 2000, exif=EXIF)
    assert Image.open(io.BytesIO(photo)).getexif()
    upload(client_as(Role.GARDENER), photo, image_bytes(image_format="PNG"))

    [(photos, language)] = identifier.seen
    assert language == "en"
    assert len(photos) == 2
    sent = Image.open(io.BytesIO(photos[0].jpeg))
    assert sent.format == "JPEG"
    assert sent.size == (1280, 853)
    assert not sent.getexif()


def test_without_an_identification_plugin(client_as: ClientAs) -> None:
    gardener = client_as(Role.GARDENER)

    assert gardener.get("/api/v1/identify").json() == {"available": False}
    response = upload(gardener, image_bytes())
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "identification_unavailable"


def test_it_says_whether_plants_can_be_identified(
    client_as: ClientAs, identifier: Identifier
) -> None:
    assert client_as(Role.VIEWER).get("/api/v1/identify").json() == {"available": True}


@pytest.mark.parametrize(
    ("problem", "status"),
    [("quota_exceeded", 429), ("invalid_api_key", 502), ("missing_api_key", 502)],
)
def test_problems_are_explained(
    client_as: ClientAs, identifier: Identifier, problem: str, status: int
) -> None:
    identifier.answer = Identification("Identified by Test", problem=problem)

    response = upload(client_as(Role.GARDENER), image_bytes())

    assert response.status_code == status
    assert response.json()["error"]["code"] == problem


def test_a_failing_plugin_is_reported_to_admins(
    client_as: ClientAs, identifier: Identifier, household: Household
) -> None:
    identifier.answer = RuntimeError("the leaf scanner is broken")

    response = upload(client_as(Role.GARDENER), image_bytes())

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "identification_failed"
    setting = PluginSetting.objects.get(household=household, plugin_id="leafy")
    assert "the leaf scanner is broken" in setting.last_error


def test_no_match_is_an_empty_list(client_as: ClientAs, identifier: Identifier) -> None:
    identifier.answer = Identification("Identified by Test")

    response = upload(client_as(Role.GARDENER), image_bytes())

    assert response.json()["candidates"] == []


def test_photos_are_checked(client_as: ClientAs, identifier: Identifier) -> None:
    gardener = client_as(Role.GARDENER)

    not_an_image = upload(gardener, b"hello")
    too_many = upload(gardener, *[image_bytes()] * 6)
    none = gardener.post("/api/v1/identify", {})

    assert not_an_image.json()["error"]["code"] == "invalid_image"
    assert too_many.json()["error"]["code"] == "too_many_photos"
    assert none.status_code == 422
    assert identifier.seen == []


def test_viewers_cant_identify(client_as: ClientAs, identifier: Identifier) -> None:
    assert upload(client_as(Role.VIEWER), image_bytes()).status_code == 403
