"""Care API: care types, the care log, and each plant's timeline of care and photos.

Everyone in the household can see care; Gardeners and Admins can log and change it.
"""

from datetime import datetime
from typing import Literal

from django.http import HttpRequest
from ninja import Query, Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.care import selectors, services
from sunfleck.care.models import CareEvent, CareType, Feedback
from sunfleck.core.errors import ApiError
from sunfleck.plants.api import PhotoOut, photo_out
from sunfleck.plants.models import Plant

router = Router(tags=["care"], auth=django_auth)

# --- Schemas ----------------------------------------------------------------------------------


class CareTypeOut(Schema):
    id: int
    key: str | None = Field(description="Built-in types only, e.g. `water`; used to translate.")
    name: str
    icon: str
    is_builtin: bool
    affects_prediction: bool
    counts_as_watering: bool


class CareTypeIn(Schema):
    name: str = Field(min_length=1, max_length=50)
    icon: str = Field(default="sparkles", min_length=1, max_length=32, pattern=r"^[a-z0-9-]+$")
    counts_as_watering: bool = Field(
        default=False, description="It's a kind of watering, e.g. bottom watering."
    )


class PersonOut(Schema):
    id: int
    display_name: str


class CareEventOut(Schema):
    id: int
    plant_id: int
    care_type: CareTypeOut
    performed_at: datetime
    performed_by: PersonOut | None
    notes: str
    feedback: Feedback | None
    skipped: bool


class CareEventIn(Schema):
    care_type_id: int
    performed_at: datetime | None = Field(default=None, description="Leave out for now.")
    notes: str = Field(default="", max_length=2000)
    feedback: Feedback | None = Field(
        default=None,
        description="Care types that count as watering only: how the soil was beforehand.",
    )
    skipped: bool = Field(
        default=False, description="Checked, but decided not to (e.g. the soil was still wet)."
    )


class TimelineItemOut(Schema):
    kind: Literal["care", "photo"]
    at: datetime
    care_event: CareEventOut | None
    photo: PhotoOut | None


class TimelinePage(Schema):
    items: list[TimelineItemOut]
    next_cursor: str | None = Field(description="Pass as `before` to get the next page.")


class TimelineQuery(Schema):
    before: str | None = Field(default=None, max_length=100)
    limit: int = Field(default=30, ge=1, le=100)


# --- Conversions ------------------------------------------------------------------------------


def _care_type_out(care_type: CareType) -> CareTypeOut:
    return CareTypeOut(
        id=care_type.pk,
        key=care_type.key or None,
        name=care_type.name,
        icon=care_type.icon,
        is_builtin=care_type.is_builtin,
        affects_prediction=care_type.affects_prediction,
        counts_as_watering=care_type.counts_as_watering,
    )


def _person_out(user: User | None) -> PersonOut | None:
    if user is None:
        return None
    return PersonOut(id=user.pk, display_name=user.display_name or user.email)


def _event_out(event: CareEvent) -> CareEventOut:
    return CareEventOut(
        id=event.pk,
        plant_id=event.plant_id,
        care_type=_care_type_out(event.care_type),
        performed_at=event.performed_at,
        performed_by=_person_out(event.performed_by),
        notes=event.notes,
        feedback=Feedback(event.feedback) if event.feedback else None,
        skipped=event.skipped,
    )


def _care_error(exc: services.CareError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


# --- Lookups (always within the user's household) ---------------------------------------------


def _get_plant(household: Household, plant_id: int) -> Plant:
    plant = Plant.objects.filter(pk=plant_id, household=household).first()
    if plant is None:
        raise ApiError(404, "plant_not_found", "This plant doesn't exist.")
    return plant


def _get_care_type(household: Household, care_type_id: int) -> CareType:
    care_type = services.care_types_for(household).filter(pk=care_type_id).first()
    if care_type is None:
        raise ApiError(404, "care_type_not_found", "This care type doesn't exist.")
    return care_type


def _get_event(household: Household, event_id: int) -> CareEvent:
    event = (
        CareEvent.objects.select_related("care_type", "performed_by", "plant__household")
        .filter(pk=event_id, plant__household=household)
        .first()
    )
    if event is None:
        raise ApiError(404, "care_event_not_found", "This care event doesn't exist.")
    return event


# --- Care types -------------------------------------------------------------------------------


@router.get("/care-types", response=list[CareTypeOut])
def list_care_types(request: HttpRequest) -> list[CareTypeOut]:
    """The built-in care types, then the household's own. A short, fixed-size list."""
    household = require_role(request, Role.VIEWER).household
    return [_care_type_out(care_type) for care_type in services.care_types_for(household)]


@router.post("/care-types", response={201: CareTypeOut})
def create_care_type(request: HttpRequest, data: CareTypeIn) -> Status[CareTypeOut]:
    household = require_role(request, Role.GARDENER).household
    try:
        care_type = services.create_care_type(household, services.CareTypeData(**data.model_dump()))
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(201, _care_type_out(care_type))


@router.put("/care-types/{care_type_id}", response=CareTypeOut)
def update_care_type(request: HttpRequest, care_type_id: int, data: CareTypeIn) -> CareTypeOut:
    household = require_role(request, Role.GARDENER).household
    care_type = _get_care_type(household, care_type_id)
    try:
        services.update_care_type(care_type, services.CareTypeData(**data.model_dump()))
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return _care_type_out(care_type)


@router.delete("/care-types/{care_type_id}", response={204: None})
def delete_care_type(request: HttpRequest, care_type_id: int) -> Status[None]:
    """Delete a household's own care type. Types that have been used can't be deleted."""
    household = require_role(request, Role.GARDENER).household
    try:
        services.delete_care_type(_get_care_type(household, care_type_id))
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(204, None)


# --- The care log -----------------------------------------------------------------------------


@router.post("/plants/{plant_id}/care-events", response={201: CareEventOut})
def log_care(request: HttpRequest, plant_id: int, data: CareEventIn) -> Status[CareEventOut]:
    """Log care given to a plant: by default just now, by the signed-in person."""
    membership = require_role(request, Role.GARDENER)
    plant = _get_plant(membership.household, plant_id)
    try:
        event = services.log_care(
            plant, services.CareEventData(**data.model_dump()), membership.user
        )
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(201, _event_out(event))


@router.put("/care-events/{event_id}", response=CareEventOut)
def update_care_event(request: HttpRequest, event_id: int, data: CareEventIn) -> CareEventOut:
    household = require_role(request, Role.GARDENER).household
    event = _get_event(household, event_id)
    try:
        services.update_care_event(event, services.CareEventData(**data.model_dump()))
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return _event_out(event)


@router.delete("/care-events/{event_id}", response={204: None})
def delete_care_event(request: HttpRequest, event_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_event(household, event_id).delete()
    return Status(204, None)


@router.get("/plants/{plant_id}/timeline", response=TimelinePage)
def plant_timeline(request: HttpRequest, plant_id: int, page: Query[TimelineQuery]) -> TimelinePage:
    """The plant's care and photos, newest first, a page at a time."""
    household = require_role(request, Role.VIEWER).household
    plant = _get_plant(household, plant_id)
    try:
        before = selectors.parse_cursor(page.before) if page.before else None
    except ValueError as exc:
        raise ApiError(422, "invalid_cursor", "This page link is invalid.") from exc
    items, next_cursor = selectors.plant_timeline(plant, before, page.limit)
    return TimelinePage(
        items=[
            TimelineItemOut(
                kind=item.kind,
                at=item.at,
                care_event=_event_out(item.care_event) if item.care_event else None,
                photo=photo_out(item.photo) if item.photo else None,
            )
            for item in items
        ],
        next_cursor=next_cursor,
    )
