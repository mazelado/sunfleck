"""Core API endpoints."""

from django.db import DatabaseError, connection
from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth

from sunfleck import __version__
from sunfleck.taxonomy.loader import loaded_version

router = Router(tags=["core"])


class HealthOut(Schema):
    status: str
    version: str
    database: str


@router.get("/health", response={200: HealthOut, 503: HealthOut}, auth=None)
def health(request: HttpRequest) -> Status[HealthOut]:
    """Report whether the app is running and can reach its database.

    Used by Docker health checks and uptime monitors, so it needs no sign-in.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return Status(503, HealthOut(status="error", version=__version__, database="unreachable"))
    return Status(200, HealthOut(status="ok", version=__version__, database="ok"))


# Where to get this version's source code, as the AGPL asks. Change it in a modified version.
SOURCE_URL = "https://github.com/mazelado/sunfleck"

# Each minor version's plant name, in alphabetical order (see docs/roadmap.md).
RELEASE_NAMES = {
    "0.1": "Azalea",
    "0.2": "Bougainvillea",
    "0.3": "Camellia",
    "0.4": "Dahlia",
    "0.5": "Echinacea",
    "0.6": "Fuchsia",
    "0.7": "Gardenia",
    "0.8": "Hibiscus",
    "0.9": "Iris",
    "1.0": "Jasmine",
}


def release_name(version: str) -> str | None:
    """The plant name of `version`'s minor version, e.g. "Dahlia" for 0.4.1."""
    return RELEASE_NAMES.get(".".join(version.split(".")[:2]))


class AboutOut(Schema):
    version: str
    release_name: str | None
    # The version of the care dataset in use, e.g. 2026.10.0.
    care_dataset: str | None
    source_url: str
    release_notes_url: str


@router.get("/about", response=AboutOut, auth=django_auth)
def about(request: HttpRequest) -> AboutOut:
    """Which version of Sunfleck and its care data are running, and where the source is."""
    return AboutOut(
        version=__version__,
        release_name=release_name(__version__),
        care_dataset=loaded_version(),
        source_url=SOURCE_URL,
        release_notes_url=f"{SOURCE_URL}/releases/tag/v{__version__}",
    )
