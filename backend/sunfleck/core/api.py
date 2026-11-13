"""Core API endpoints."""

from django.conf import settings
from django.db import DatabaseError, connection
from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck import __version__
from sunfleck.taxonomy.loader import loaded_version

router = Router(tags=["core"])


class HealthOut(Schema):
    status: str
    version: str
    database: str


def _shows_version(request: HttpRequest) -> bool:
    """Whether to say which version runs: to members, and to checks from the server itself
    (Docker's health check), but not to strangers, to whom it says which known problems
    apply. A request through a proxy on the same machine comes from it too, so it counts as
    from the server only without X-Forwarded-For."""
    if request.user.is_authenticated:
        return True
    local = request.META.get("REMOTE_ADDR") in ("127.0.0.1", "::1")
    return local and "HTTP_X_FORWARDED_FOR" not in request.META


@router.get("/health", response={200: HealthOut, 503: HealthOut}, auth=None)
def health(request: HttpRequest) -> Status[HealthOut]:
    """Report whether the app is running and can reach its database.

    Used by Docker health checks and uptime monitors, so it needs no sign-in. `version` is
    empty unless signed in, or asked from the server itself.
    """
    version = __version__ if _shows_version(request) else ""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return Status(503, HealthOut(status="error", version=version, database="unreachable"))
    return Status(200, HealthOut(status="ok", version=version, database="ok"))


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
    public_url: str | None = Field(
        description="The address set as SUNFLECK_PUBLIC_URL, for links used away from the "
        "browser (e.g. QR labels), if it's set."
    )


@router.get("/about", response=AboutOut, auth=django_auth)
def about(request: HttpRequest) -> AboutOut:
    """Which version of Sunfleck and its care data are running, and where the source is."""
    return AboutOut(
        version=__version__,
        release_name=release_name(__version__),
        care_dataset=loaded_version(),
        source_url=SOURCE_URL,
        release_notes_url=f"{SOURCE_URL}/releases/tag/v{__version__}",
        public_url=settings.PUBLIC_URL or None,
    )
