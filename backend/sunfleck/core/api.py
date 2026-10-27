"""Core API endpoints."""

from django.db import DatabaseError, connection
from django.http import HttpRequest
from ninja import Router, Schema, Status

from sunfleck import __version__

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
