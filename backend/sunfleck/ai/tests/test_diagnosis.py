import io
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from PIL import Image

from sunfleck.accounts.models import Household, Role
from sunfleck.care.models import Feedback
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.tests.factories import LocationFactory, WindowFactory
from sunfleck.plants.models import Plant, PlantLight
from sunfleck.plants.tests.factories import PlantFactory, image_bytes
from sunfleck.plugins import AiAnswer, AiTask, PluginInfo, hookimpl, services
from sunfleck.plugins.registry import registry
from sunfleck.taxonomy.models import Taxon

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

ANSWER = {
    "summary": "Overwatering: the lower leaves are yellow and soft.",
    "causes": [
        {
            "cause": "Too much water",
            "likelihood": "likely",
            "signs": "Soft yellow lower leaves; watered three times in a week.",
        },
        {"cause": "Root rot", "likelihood": "possible", "signs": "Dark patches at the base."},
    ],
    "next_steps": ["Let the top third of the soil dry before watering.", "Check the roots."],
    "urgent": False,
    "photo_clear": True,
}


class Doctor:
    """A fake AI plugin that answers what it's told and remembers what it was asked."""

    def __init__(self) -> None:
        self.answer = AiAnswer("Suggested by AI (test)", data=ANSWER)
        self.seen: list[AiTask] = []

    @hookimpl
    def complete_json(self, task: AiTask) -> AiAnswer:
        self.seen.append(task)
        return self.answer


@pytest.fixture
def doctor(household: Household) -> Iterator[Doctor]:
    hooks = Doctor()
    registry.add(PluginInfo("doctor", "Doctor", "1", "1"), hooks)
    services.update(household, "doctor", True, {})
    yield hooks
    registry.remove("doctor")


@pytest.fixture
def plant(household: Household) -> Plant:
    room = LocationFactory.create(site__household=household, name="Kitchen", kind="indoor")
    monstera = PlantFactory.create(
        household=household,
        nickname="Monty",
        location=room,
        taxon=Taxon.objects.get(scientific_name="Monstera deliciosa"),
        container_diameter_cm=17,
    )
    window = WindowFactory.create(location=room, direction="E")
    PlantLight.objects.create(plant=monstera, light_source=window, distance_cm=80)
    CareEventFactory.create(
        plant=monstera,
        care_type=builtin("water"),
        performed_at=datetime(2026, 5, 1, 9, tzinfo=UTC),
        feedback=Feedback.STILL_WET,
        notes="Lower leaves yellowing",
    )
    return monstera


def photo(size: tuple[int, int] = (3000, 2000), *, data: bytes | None = None) -> SimpleUploadedFile:
    return SimpleUploadedFile("leaf.jpg", data or image_bytes(*size), content_type="image/jpeg")


def diagnose(client: Client, plant: Plant, **fields: Any) -> Any:
    return client.post(f"/api/v1/plants/{plant.pk}/diagnosis", {"file": photo(), **fields})


def test_it_says_what_might_be_wrong_from_a_photo(
    client_as: ClientAs, doctor: Doctor, plant: Plant
) -> None:
    response = diagnose(client_as(Role.GARDENER), plant, description="Yellow lower leaves")

    assert response.status_code == 200
    assert response.json() == {**ANSWER, "attribution": "Suggested by AI (test)", "photo": None}
    [task] = doctor.seen
    # The photo: one JPEG, at most 1568 px, without its metadata.
    [image] = task.images
    assert image.media_type == "image/jpeg"
    sent = Image.open(io.BytesIO(image.data))
    assert (sent.format, max(sent.size)) == ("JPEG", 1568)
    assert not sent.getexif()
    # The plant's context, and the person's words.
    assert "The plant: Monty" in task.prompt
    assert "Species: Monstera deliciosa" in task.prompt
    assert "Where: indoors (Kitchen)" in task.prompt
    assert "Light: a window facing E, 80 cm away" in task.prompt
    assert "Pot: 17 cm wide" in task.prompt
    assert '2026-05-01: Water (soil was still wet; notes: "Lower leaves yellowing")' in task.prompt
    assert task.prompt.endswith("What they say: Yellow lower leaves")
    assert "likely" in str(task.schema)
    # The photo isn't kept unless asked.
    assert plant.photos.count() == 0


def test_the_photo_can_be_kept_on_the_plant(
    client_as: ClientAs, doctor: Doctor, plant: Plant
) -> None:
    response = diagnose(
        client_as(Role.GARDENER), plant, description="Brown spots", keep_photo="true"
    )

    kept = response.json()["photo"]
    assert kept["caption"] == "Brown spots"
    assert plant.photos.get().caption == "Brown spots"


def test_only_with_an_ai_plugin_on(client_as: ClientAs, plant: Plant) -> None:
    response = diagnose(client_as(Role.GARDENER), plant)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "diagnosis_unavailable"


@pytest.mark.parametrize(
    ("answer", "status", "code"),
    [
        (AiAnswer("AI", problem="unsupported"), 502, "ai_unsupported"),
        (AiAnswer("AI", problem="quota_exceeded"), 429, "ai_quota_exceeded"),
        (AiAnswer("AI", problem="invalid_api_key"), 502, "ai_invalid_api_key"),
        # Sunfleck checks the answer's shape, whatever the plugin did.
        (AiAnswer("AI", data={"summary": "Fine"}), 502, "ai_invalid_answer"),
    ],
)
def test_ai_problems_are_reported(
    client_as: ClientAs, doctor: Doctor, plant: Plant, answer: AiAnswer, status: int, code: str
) -> None:
    doctor.answer = answer

    response = diagnose(client_as(Role.GARDENER), plant, keep_photo="true")

    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    # Nothing is kept when there's no diagnosis.
    assert plant.photos.count() == 0


def test_it_needs_a_photo_and_a_gardener(client_as: ClientAs, doctor: Doctor, plant: Plant) -> None:
    gardener = client_as(Role.GARDENER)
    url = f"/api/v1/plants/{plant.pk}/diagnosis"

    not_a_photo = gardener.post(url, {"file": photo(data=b"not an image")})
    assert (not_a_photo.status_code, not_a_photo.json()["error"]["code"]) == (
        422,
        "invalid_image",
    )
    assert client_as(Role.VIEWER).post(url, {"file": photo()}).status_code == 403
    assert doctor.seen == []
