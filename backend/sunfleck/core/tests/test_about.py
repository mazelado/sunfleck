from collections.abc import Callable

import pytest
from django.test import Client

from sunfleck import __version__
from sunfleck.accounts.models import Role
from sunfleck.core.api import release_name
from sunfleck.taxonomy.models import CareDataset

ClientAs = Callable[[Role], Client]


@pytest.mark.django_db
def test_about_shows_the_version_and_where_the_source_is(client_as: ClientAs) -> None:
    CareDataset.objects.all().delete()
    CareDataset.objects.create(version="2026.10.0")

    data = client_as(Role.VIEWER).get("/api/v1/about").json()

    assert data["version"] == __version__
    assert data["release_name"] == release_name(__version__)
    assert data["care_dataset"] == "2026.10.0"
    assert data["source_url"].startswith("https://")
    assert data["release_notes_url"].endswith(f"/releases/tag/v{__version__}")


@pytest.mark.django_db
def test_about_needs_sign_in(client: Client) -> None:
    assert client.get("/api/v1/about").status_code == 401


@pytest.mark.parametrize(
    ("version", "name"),
    [("0.4.0", "Dahlia"), ("0.4.2", "Dahlia"), ("1.0.0", "Jasmine"), ("2.0.0", None)],
)
def test_release_name_comes_from_the_minor_version(version: str, name: str | None) -> None:
    assert release_name(version) == name
