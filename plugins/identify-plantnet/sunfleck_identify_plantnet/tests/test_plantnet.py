import email.message
import email.parser
import json
import urllib.error
import urllib.parse
from collections.abc import Callable
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from sunfleck.accounts.models import Household, Role
from sunfleck.plants.tests.factories import image_bytes
from sunfleck.plugins import SettingsCheck, services

from sunfleck_identify_plantnet import Settings, hooks, plantnet

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db

# A Pl@ntNet answer, shortened from the API's documentation.
ANSWER = {
    "query": {"project": "all", "organs": ["auto"]},
    "language": "en",
    "bestMatch": "Monstera deliciosa Liebm.",
    "results": [
        {
            "score": 0.84,
            "species": {
                "scientificNameWithoutAuthor": "Monstera deliciosa",
                "scientificNameAuthorship": "Liebm.",
                "genus": {"scientificNameWithoutAuthor": "Monstera"},
                "family": {"scientificNameWithoutAuthor": "Araceae"},
                "commonNames": ["Swiss cheese plant", "Ceriman"],
                "scientificName": "Monstera deliciosa Liebm.",
            },
            "gbif": {"id": "2868241"},
        },
        {
            "score": 0.04,
            "species": {
                "scientificNameWithoutAuthor": "Rhaphidophora tetrasperma",
                "genus": {"scientificNameWithoutAuthor": "Rhaphidophora"},
                "family": {"scientificNameWithoutAuthor": "Araceae"},
                "commonNames": [],
            },
        },
    ],
    "remainingIdentificationRequests": 497,
}


class FakePlantNet:
    """Stands in for Pl@ntNet: answers `status` and `body`, and keeps each request."""

    def __init__(self) -> None:
        self.status = 200
        self.body: Any = ANSWER
        self.error: Exception | None = None
        self.requests: list[tuple[str, bytes, str]] = []

    def __call__(self, url: str, body: bytes, content_type: str) -> plantnet.Response:
        self.requests.append((url, body, content_type))
        if self.error:
            raise self.error
        raw = self.body if isinstance(self.body, bytes) else json.dumps(self.body).encode()
        return plantnet.Response(self.status, raw)

    def query(self) -> dict[str, list[str]]:
        return urllib.parse.parse_qs(urllib.parse.urlsplit(self.requests[-1][0]).query)

    def parts(self) -> list[tuple[str, bytes]]:
        """The multipart fields sent: (name, content)."""
        _, body, content_type = self.requests[-1]
        message = email.parser.BytesParser().parsebytes(
            b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + body
        )
        parts = []
        for part in message.get_payload():
            assert isinstance(part, email.message.Message)
            content = part.get_payload(decode=True)
            assert isinstance(content, bytes)
            parts.append((str(part.get_param("name", header="content-disposition")), content))
        return parts


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> FakePlantNet:
    fake = FakePlantNet()
    monkeypatch.setattr(plantnet, "post", fake)
    return fake


def turn_on(household: Household, api_key: str = "my-key") -> None:
    services.update(household, "identify_plantnet", True, {"api_key": api_key})


def identify(client: Client, photos: int = 1) -> Any:
    files = [
        SimpleUploadedFile(f"photo{i}.jpg", image_bytes(), "image/jpeg") for i in range(photos)
    ]
    return client.post("/api/v1/identify", {"photos": files})


def test_a_plant_is_identified_and_found_in_the_care_guide(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household)

    response = identify(client_as(Role.GARDENER))

    assert response.status_code == 200
    body = response.json()
    assert body["attribution"] == "Identified by Pl@ntNet"
    assert body["remaining"] == 497
    best, other = body["candidates"]
    assert best["scientific_name"] == "Monstera deliciosa"
    assert best["score"] == 0.84
    assert best["family"] == "Araceae"
    assert best["common_names"] == ["Swiss cheese plant", "Ceriman"]
    assert best["species"]["scientific_name"] == "Monstera deliciosa"
    assert other["scientific_name"] == "Rhaphidophora tetrasperma"


def test_it_sends_the_photos_key_and_language(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household)

    identify(client_as(Role.GARDENER), photos=2)

    url = service.requests[-1][0]
    assert url.startswith("https://my-api.plantnet.org/v2/identify/all?")
    query = service.query()
    assert query["api-key"] == ["my-key"]
    assert query["lang"] == ["en"]
    assert query["nb-results"] == ["5"]
    parts = service.parts()
    assert [name for name, _ in parts] == ["images", "organs", "images", "organs"]
    assert parts[0][1][:3] == b"\xff\xd8\xff"  # a JPEG
    assert parts[1][1] == b"auto"


def test_a_regional_language_is_sent_as_its_base_language(service: FakePlantNet) -> None:
    plantnet.identify([], "pt-BR", "my-key")

    assert service.query()["lang"] == ["pt"]


def test_no_plant_found_is_an_empty_list(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household)
    service.status = 404
    service.body = {"statusCode": 404, "error": "Not Found", "message": "Species not found"}

    response = identify(client_as(Role.GARDENER))

    assert response.status_code == 200
    assert response.json()["candidates"] == []


@pytest.mark.parametrize(
    ("status", "problem", "http_status"),
    [
        (401, "invalid_api_key", 502),
        (403, "invalid_api_key", 502),
        (429, "quota_exceeded", 429),
        (500, "unavailable", 502),
        (503, "unavailable", 502),
    ],
)
def test_problems_are_explained(
    client_as: ClientAs,
    household: Household,
    service: FakePlantNet,
    status: int,
    problem: str,
    http_status: int,
) -> None:
    turn_on(household)
    service.status = status
    service.body = {"message": "nope"}

    response = identify(client_as(Role.GARDENER))

    assert response.status_code == http_status
    assert response.json()["error"]["code"] == problem


def test_pl_ntnet_being_unreachable(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household)
    service.error = urllib.error.URLError("no route to host")

    response = identify(client_as(Role.GARDENER))

    assert response.json()["error"]["code"] == "unavailable"


def test_without_an_api_key_it_asks_for_one(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household, api_key="")

    response = identify(client_as(Role.GARDENER))

    assert response.json()["error"]["code"] == "missing_api_key"
    assert service.requests == []


@pytest.mark.parametrize("body", [b"not json", {"results": [{"score": 1}]}, {"nothing": []}])
def test_unexpected_answers_are_reported_to_admins(
    client_as: ClientAs, household: Household, service: FakePlantNet, body: Any
) -> None:
    turn_on(household)
    service.body = body

    response = identify(client_as(Role.GARDENER))

    assert response.json()["error"]["code"] == "identification_failed"
    state = services.states(household, ["identify_plantnet"])["identify_plantnet"]
    assert "Unexpected answer" in state.last_error
    assert "my-key" not in state.last_error


def test_a_refused_request_is_reported_without_the_key(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    turn_on(household)
    service.status = 413
    service.body = {"message": "Payload too large"}

    response = identify(client_as(Role.GARDENER))

    assert response.json()["error"]["code"] == "identification_failed"
    state = services.states(household, ["identify_plantnet"])["identify_plantnet"]
    assert "HTTP 413" in state.last_error
    assert "my-key" not in state.last_error


def test_nothing_is_sent_until_turned_on(
    client_as: ClientAs, household: Household, service: FakePlantNet
) -> None:
    response = identify(client_as(Role.GARDENER))

    assert response.json()["error"]["code"] == "identification_unavailable"
    assert service.requests == []


def test_the_api_key_is_kept_secret(client_as: ClientAs, household: Household) -> None:
    turn_on(household, api_key="very-secret-key")

    plugins = client_as(Role.ADMIN).get("/api/v1/plugins").json()["plugins"]

    [ours] = [p for p in plugins if p["id"] == "identify_plantnet"]
    assert ours["secrets_set"] == ["api_key"]
    assert "very-secret-key" not in json.dumps(plugins)


# --- Testing the API key ----------------------------------------------------------------------


def key(value: str) -> Settings:
    return Settings.model_validate({"api_key": value})


def test_testing_sends_a_blank_image_with_the_key(service: FakePlantNet) -> None:
    # A valid key, and no plant in the image: Pl@ntNet's "species not found".
    service.status = 404
    service.body = {"message": "Species not found"}

    found = hooks.check_settings(key("my-key"))

    assert found == SettingsCheck(details="Pl@ntNet accepted the API key.")
    assert service.query()["api-key"] == ["my-key"]
    assert service.parts()[0] == ("images", plantnet.BLANK_JPEG)


def test_testing_says_how_many_identifications_are_left(service: FakePlantNet) -> None:
    service.body = {**ANSWER, "remainingIdentificationRequests": 487}

    found = hooks.check_settings(key("my-key"))

    assert found.details == "Pl@ntNet accepted the API key. 487 identifications left today."


@pytest.mark.parametrize(
    ("status", "problem"),
    [
        (401, "invalid_api_key"),
        (429, "quota_exceeded"),
        (503, "unavailable"),
        (400, "invalid_answer"),
    ],
)
def test_testing_says_what_went_wrong(service: FakePlantNet, status: int, problem: str) -> None:
    service.status = status
    service.body = {"message": "Something"}

    found = hooks.check_settings(key("my-key"))

    assert found.problem == problem
    assert found.details
    assert "my-key" not in found.details


def test_testing_without_a_key_asks_for_one(service: FakePlantNet) -> None:
    found = hooks.check_settings(key(" "))

    assert found.problem == "missing_settings"
    assert service.requests == []
