"""Care API: care types, the care log, each plant's timeline of care and photos, and care
schedules with the suggested routine.

Everyone in the household can see care; Gardeners and Admins can log and change it.
"""

from datetime import date, datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.care import schedules, selectors, services
from sunfleck.care.models import (
    CareEvent,
    CareSchedule,
    CareType,
    Feedback,
    ScheduleMode,
    ScheduleOrigin,
)
from sunfleck.core.errors import ApiError
from sunfleck.places.models import Site
from sunfleck.plants.api import PhotoOut, PlantLocationOut, location_out, photo_out
from sunfleck.plants.models import Plant
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import SiteConditions

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


class FactorOut(Schema):
    code: str = Field(
        description="What the factor is, e.g. `season`, `light`, `pot_size`, `feedback`, "
        "`rest_season`, `fertilize_pause`, `fixed`; the app explains it in words."
    )
    multiplier: float = Field(description="How it changes the interval, e.g. 0.9 is 10% sooner.")
    details: dict[str, Any]


class PredictionFields(Schema):
    interval_days: int | None = Field(
        description="Days between care; none while it isn't needed (e.g. a resting season)."
    )
    next_due: date | None
    factors: list[FactorOut] = Field(description="Why: the factors behind the prediction.")


class ScheduleOut(PredictionFields):
    id: int
    plant_id: int
    care_type: CareTypeOut
    mode: ScheduleMode
    fixed_interval_days: int | None
    origin: ScheduleOrigin
    enabled: bool
    started_on: date
    snoozed_until: date | None
    due_on: date | None = Field(description="When it's due, after any snooze; none if paused.")


class SuggestionOut(PredictionFields):
    care_type: CareTypeOut
    mode: ScheduleMode
    fixed_interval_days: int | None
    recommended: bool = Field(description="Suggested for this plant, rather than just offered.")


class ScheduleChangeIn(Schema):
    mode: ScheduleMode
    fixed_interval_days: int | None = Field(
        default=None, ge=1, le=365, description="Fixed schedules: every how many days."
    )
    enabled: bool = True


class ScheduleIn(ScheduleChangeIn):
    care_type_id: int


class RoutineIn(Schema):
    items: list[ScheduleIn] = Field(min_length=1, max_length=20)


class SnoozeIn(Schema):
    until: date | None = Field(description="Put the care off until this day; null to stop.")


class BulkCareIn(CareEventIn):
    plant_ids: list[int] = Field(min_length=1, max_length=200)


class TaskPlantOut(Schema):
    id: int
    nickname: str
    cover_thumbnail_url: str | None
    location: PlantLocationOut | None


class TaskOut(Schema):
    schedule_id: int
    plant: TaskPlantOut
    care_type: CareTypeOut
    mode: ScheduleMode
    interval_days: int | None
    due_on: date = Field(description="When it's due, after any snooze.")
    days_until: int = Field(
        description="Days until it's due, in the plant's time zone: 0 today, negative overdue."
    )
    snoozed_until: date | None


class AlertOut(Schema):
    kind: str = Field(description="What to look out for, e.g. `frost`.")
    on: date
    details: dict[str, Any]


class SiteConditionsOut(Schema):
    site_id: int
    site_name: str
    today: date = Field(description="The day it is at the site, in its time zone.")
    plugin_id: str
    attribution: str = Field(description="Who the data comes from; show it with the data.")
    updated_at: datetime
    temperature_c: float | None
    today_min_c: float | None
    today_max_c: float | None
    precipitation_mm: float | None
    weather_code: int | None = Field(description="A WMO weather code.")
    alerts: list[AlertOut]


class TodayOut(Schema):
    sites: list[SiteConditionsOut] = Field(
        description="Conditions at the household's sites, from plugins (e.g. weather)."
    )
    tasks: list[TaskOut] = Field(description="Overdue care, then care due soonest.")
    unscheduled_plants: int = Field(description="Plants being looked after with no schedule.")


class TodayQuery(Schema):
    days_ahead: int = Field(default=7, ge=0, le=31)


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


def _factors_out(factors: list[dict[str, Any]]) -> list[FactorOut]:
    return [FactorOut(**factor) for factor in factors]


def _schedule_out(schedule: CareSchedule) -> ScheduleOut:
    return ScheduleOut(
        id=schedule.pk,
        plant_id=schedule.plant_id,
        care_type=_care_type_out(schedule.care_type),
        mode=ScheduleMode(schedule.mode),
        fixed_interval_days=schedule.fixed_interval_days,
        origin=ScheduleOrigin(schedule.origin),
        enabled=schedule.enabled,
        started_on=schedule.started_on,
        snoozed_until=schedule.snoozed_until,
        due_on=schedule.due_on,
        interval_days=schedule.interval_days,
        next_due=schedule.next_due,
        factors=_factors_out(schedule.factors),
    )


def _task_out(task: schedules.Task) -> TaskOut:
    schedule = task.schedule
    plant = schedule.plant
    return TaskOut(
        schedule_id=schedule.pk,
        plant=TaskPlantOut(
            id=plant.pk,
            nickname=plant.nickname,
            cover_thumbnail_url=(
                photo_out(plant.cover_photo).thumbnail_url if plant.cover_photo else None
            ),
            location=location_out(plant),
        ),
        care_type=_care_type_out(schedule.care_type),
        mode=ScheduleMode(schedule.mode),
        interval_days=schedule.interval_days,
        due_on=task.due_on,
        days_until=task.days_until,
        snoozed_until=schedule.snoozed_until,
    )


def _conditions_out(site: Site, plugin_id: str, conditions: SiteConditions) -> SiteConditionsOut:
    return SiteConditionsOut(
        site_id=site.pk,
        site_name=site.name,
        today=timezone.now().astimezone(ZoneInfo(site.timezone)).date(),
        plugin_id=plugin_id,
        attribution=conditions.attribution,
        updated_at=conditions.updated_at,
        temperature_c=conditions.temperature_c,
        today_min_c=conditions.today_min_c,
        today_max_c=conditions.today_max_c,
        precipitation_mm=conditions.precipitation_mm,
        weather_code=conditions.weather_code,
        alerts=[
            AlertOut(kind=alert.kind, on=alert.on, details=dict(alert.details))
            for alert in conditions.alerts
        ],
    )


def _suggestion_out(suggestion: schedules.Suggestion) -> SuggestionOut:
    prediction = suggestion.prediction
    return SuggestionOut(
        care_type=_care_type_out(suggestion.care_type),
        mode=suggestion.mode,
        fixed_interval_days=suggestion.fixed_interval_days,
        recommended=suggestion.recommended,
        interval_days=prediction.interval_days,
        next_due=prediction.next_due,
        factors=_factors_out(schedules.factors_json(prediction.factors)),
    )


def _care_error(exc: services.CareError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


# --- Lookups (always within the user's household) ---------------------------------------------


def _get_plant(household: Household, plant_id: int) -> Plant:
    plant = Plant.objects.filter(pk=plant_id, household=household).first()
    if plant is None:
        raise ApiError(404, "plant_not_found", "This plant doesn't exist.")
    return plant


def _get_plant_for_schedules(household: Household, plant_id: int) -> Plant:
    """The plant, with what its predictions need."""
    plant = (
        Plant.objects.select_related("location__site", "taxon__archetype", "care_profile")
        .filter(pk=plant_id, household=household)
        .first()
    )
    if plant is None:
        raise ApiError(404, "plant_not_found", "This plant doesn't exist.")
    return plant


def _get_schedule(household: Household, schedule_id: int) -> CareSchedule:
    schedule = (
        CareSchedule.objects.select_related(
            "care_type",
            "plant__household",
            "plant__location__site",
            "plant__taxon__archetype",
            "plant__care_profile",
        )
        .filter(pk=schedule_id, plant__household=household)
        .first()
    )
    if schedule is None:
        raise ApiError(404, "schedule_not_found", "This schedule doesn't exist.")
    return schedule


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


@router.post("/care-events/bulk", response={201: list[CareEventOut]})
def log_care_for_plants(request: HttpRequest, data: BulkCareIn) -> Status[list[CareEventOut]]:
    """Log the same care for several plants at once, e.g. watering a whole room; all or none."""
    membership = require_role(request, Role.GARDENER)
    fields = data.model_dump(exclude={"plant_ids"})
    try:
        events = services.log_care_for_plants(
            membership.household,
            data.plant_ids,
            services.CareEventData(**fields),
            membership.user,
        )
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(201, [_event_out(event) for event in events])


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


# --- Schedules and the suggested routine ------------------------------------------------------


@router.get("/plants/{plant_id}/schedules", response=list[ScheduleOut])
def list_schedules(request: HttpRequest, plant_id: int) -> list[ScheduleOut]:
    """The plant's care schedules, each with when it's next due and why."""
    household = require_role(request, Role.VIEWER).household
    plant = _get_plant_for_schedules(household, plant_id)
    return [_schedule_out(schedule) for schedule in schedules.schedules_for(plant)]


@router.get("/plants/{plant_id}/routine-suggestion", response=list[SuggestionOut])
def suggest_routine(request: HttpRequest, plant_id: int) -> list[SuggestionOut]:
    """Schedules we'd suggest for care the plant has no schedule for yet: watering and
    fertilizing predicted from its care profile, and a few reminders every few weeks."""
    household = require_role(request, Role.VIEWER).household
    plant = _get_plant_for_schedules(household, plant_id)
    return [_suggestion_out(suggestion) for suggestion in schedules.suggest_routine(plant)]


@router.post("/plants/{plant_id}/routine", response={201: list[ScheduleOut]})
def accept_routine(
    request: HttpRequest, plant_id: int, data: RoutineIn
) -> Status[list[ScheduleOut]]:
    """Add the chosen schedules from the suggested routine, all or none."""
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant_for_schedules(household, plant_id)
    try:
        added = schedules.accept_routine(
            plant, [schedules.ScheduleData(**item.model_dump()) for item in data.items]
        )
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(201, [_schedule_out(schedule) for schedule in added])


@router.post("/plants/{plant_id}/schedules", response={201: ScheduleOut})
def create_schedule(request: HttpRequest, plant_id: int, data: ScheduleIn) -> Status[ScheduleOut]:
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant_for_schedules(household, plant_id)
    try:
        schedule = schedules.create_schedule(plant, schedules.ScheduleData(**data.model_dump()))
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return Status(201, _schedule_out(schedule))


@router.put("/care-schedules/{schedule_id}", response=ScheduleOut)
def update_schedule(request: HttpRequest, schedule_id: int, data: ScheduleChangeIn) -> ScheduleOut:
    """Change a schedule's mode, interval, or whether it's in use."""
    household = require_role(request, Role.GARDENER).household
    schedule = _get_schedule(household, schedule_id)
    try:
        schedules.update_schedule(
            schedule,
            schedules.ScheduleData(care_type_id=schedule.care_type_id, **data.model_dump()),
        )
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return _schedule_out(schedule)


@router.delete("/care-schedules/{schedule_id}", response={204: None})
def delete_schedule(request: HttpRequest, schedule_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    schedules.delete_schedule(_get_schedule(household, schedule_id))
    return Status(204, None)


@router.put("/care-schedules/{schedule_id}/snooze", response=ScheduleOut)
def snooze_schedule(request: HttpRequest, schedule_id: int, data: SnoozeIn) -> ScheduleOut:
    """Put off due care until a day (up to two months ahead), or stop putting it off."""
    household = require_role(request, Role.GARDENER).household
    schedule = _get_schedule(household, schedule_id)
    try:
        schedules.snooze(schedule, data.until)
    except services.CareError as exc:
        raise _care_error(exc) from exc
    return _schedule_out(schedule)


# --- Today ------------------------------------------------------------------------------------


@router.get("/today", response=TodayOut)
def today(request: HttpRequest, query: Query[TodayQuery]) -> TodayOut:
    """The household's overdue care and care due in the next few days, soonest first."""
    household = require_role(request, Role.VIEWER).household
    # Conditions first: new weather can change today's predictions.
    sites = [
        _conditions_out(site, answer.plugin_id, answer.result)
        for site in Site.objects.filter(household=household)
        for answer in registry.call("site_conditions", household, SiteConditions, site=site)
    ]
    return TodayOut(
        sites=sites,
        tasks=[_task_out(task) for task in schedules.due_tasks(household, query.days_ahead)],
        unscheduled_plants=schedules.unscheduled_plants(household),
    )
