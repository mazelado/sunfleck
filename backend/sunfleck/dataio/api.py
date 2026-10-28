"""Export and import API: Admins download their household's data, or load it into a new one.

The export is a ZIP file (see sunfleck/dataio/schema.py). Large households can use the
`export_household` and `import_household` commands instead, which aren't limited by web
request times.
"""

import tempfile

from django.http import FileResponse, HttpRequest
from django.utils import timezone
from ninja import File, Router, Schema
from ninja.files import UploadedFile
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.dataio import exporter, importer

router = Router(tags=["export and import"], auth=django_auth)


class ImportStatusOut(Schema):
    allowed: bool = Field(
        description="Whether an export can be imported: only into a household without places, "
        "plants or care types of its own yet."
    )


class ImportSummaryOut(Schema):
    sites: int
    plants: int
    photos: int
    care_events: int
    members_to_invite: list[str] = Field(
        description="Emails of exported members without an account here, to invite again."
    )
    unknown_species: list[str] = Field(description="Not in this server's care guide; left unset.")
    unknown_care_profiles: list[str]
    plugins_needing_keys: list[str] = Field(
        description="Plugins turned on whose API keys weren't exported, to enter again."
    )
    plugins_not_installed: list[str]


@router.get("/export", response={200: None})
def export(request: HttpRequest) -> FileResponse:
    """Download the household's data as a ZIP file: places, plants, photos, care history and
    settings. Passwords and secrets (notification addresses, API keys) aren't included."""
    household = require_role(request, Role.ADMIN).household
    out = tempfile.TemporaryFile()  # noqa: SIM115 - FileResponse closes it
    exporter.write(household, out)
    out.seek(0)
    filename = f"sunfleck-export-{timezone.localdate():%Y-%m-%d}.zip"
    return FileResponse(out, as_attachment=True, filename=filename, content_type="application/zip")


@router.get("/import", response=ImportStatusOut)
def import_status(request: HttpRequest) -> ImportStatusOut:
    household = require_role(request, Role.ADMIN).household
    return ImportStatusOut(allowed=importer.is_empty(household))


@router.post("/import", response=ImportSummaryOut)
def import_export(request: HttpRequest, file: File[UploadedFile]) -> ImportSummaryOut:
    """Import an export into this household, which must have no places, plants or care types
    of its own yet. Nothing is imported if anything in the file is wrong."""
    household = require_role(request, Role.ADMIN).household
    try:
        summary = importer.import_into(household, file)
    except importer.DataImportError as exc:
        status = 409 if exc.code == "household_not_empty" else 422
        raise ApiError(status, exc.code, str(exc)) from exc
    return ImportSummaryOut(**summary.__dict__)
