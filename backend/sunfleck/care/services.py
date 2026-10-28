"""Business rules for care types and the care log.

API endpoints call these functions; they never change care data directly.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from sunfleck.accounts.models import Household, User
from sunfleck.care.models import CareEvent, CareType, Feedback
from sunfleck.plants.models import Plant
from sunfleck.plugins.registry import registry

# Phones' and servers' clocks differ a little; allow for it before calling a time "future".
CLOCK_TOLERANCE = timedelta(minutes=5)


class CareError(Exception):
    """A care rule was broken. `code` is stable and shown to API clients; `field` names the
    form field at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


def care_types_for(household: Household) -> QuerySet[CareType]:
    """The built-in care types, then the household's own."""
    return CareType.objects.filter(Q(household__isnull=True) | Q(household=household))


# --- Care types -------------------------------------------------------------------------------


@dataclass(frozen=True)
class CareTypeData:
    name: str
    icon: str = "sparkles"
    counts_as_watering: bool = False


def _apply_care_type(care_type: CareType, household: Household, data: CareTypeData) -> None:
    name = data.name.strip()
    taken = care_types_for(household).filter(name__iexact=name)
    if care_type.pk:
        taken = taken.exclude(pk=care_type.pk)
    if taken.exists():
        raise CareError("care_type_exists", "There's already a care type with this name.", "name")
    care_type.name = name
    care_type.icon = data.icon
    care_type.counts_as_watering = data.counts_as_watering
    care_type.save()


def create_care_type(household: Household, data: CareTypeData) -> CareType:
    """Add a household's own care type, e.g. "Bottom water" or "Harvest".

    Raises:
        CareError: If one with the same name exists, built-in or not.
    """
    care_type = CareType(household=household)
    _apply_care_type(care_type, household, data)
    return care_type


def update_care_type(care_type: CareType, data: CareTypeData) -> CareType:
    """Rename a household's own care type or change its icon.

    Raises:
        CareError: If it's built-in, or the new name is taken.
    """
    household = _require_custom(care_type)
    _apply_care_type(care_type, household, data)
    return care_type


def delete_care_type(care_type: CareType) -> None:
    """Delete a household's own care type that hasn't been used.

    Raises:
        CareError: If it's built-in, or care of this type has been logged.
    """
    _require_custom(care_type)
    if care_type.events.exists():
        raise CareError(
            "care_type_in_use", "Care of this type has been logged, so it can't be deleted."
        )
    care_type.delete()


def _require_custom(care_type: CareType) -> Household:
    """Return the household that owns a custom care type; built-in ones can't be changed."""
    if care_type.household is None:
        raise CareError("builtin_care_type", "Built-in care types can't be changed.")
    return care_type.household


# --- The care log -----------------------------------------------------------------------------


@dataclass(frozen=True)
class CareEventData:
    care_type_id: int
    performed_at: datetime | None = None
    notes: str = ""
    feedback: Feedback | None = None
    skipped: bool = False


def _aware(plant: Plant, when: datetime) -> datetime:
    """A time without a time zone is local time at the plant's site."""
    if timezone.is_aware(when):
        return when
    zone = plant.location.site.timezone if plant.location else settings.TIME_ZONE
    return when.replace(tzinfo=ZoneInfo(zone))


def _apply_event(event: CareEvent, household: Household, data: CareEventData) -> None:
    care_type = care_types_for(household).filter(pk=data.care_type_id).first()
    if care_type is None:
        raise CareError("care_type_not_found", "This care type doesn't exist.", "care_type_id")
    performed_at = _aware(event.plant, data.performed_at) if data.performed_at else timezone.now()
    if performed_at > timezone.now() + CLOCK_TOLERANCE:
        raise CareError("care_in_future", "Care can't be logged in the future.", "performed_at")
    if data.feedback and not care_type.counts_as_watering:
        raise CareError(
            "feedback_only_for_watering", "Soil feedback is only for watering.", "feedback"
        )
    event.care_type = care_type
    event.performed_at = performed_at.astimezone(UTC)
    event.notes = data.notes.strip()
    event.feedback = data.feedback or ""
    event.skipped = data.skipped
    event.save()


def log_care(plant: Plant, data: CareEventData, user: User | None) -> CareEvent:
    """Record care given to a plant, by default just now.

    Raises:
        CareError: If the care type isn't one of the household's, the time is in the future,
            or soil feedback is given for anything but watering.
    """
    event = CareEvent(plant=plant, performed_by=user)
    _apply_event(event, plant.household, data)
    registry.call("on_care_event_logged", plant.household, event=event)
    return event


@transaction.atomic
def log_care_for_plants(
    household: Household, plant_ids: list[int], data: CareEventData, user: User | None
) -> list[CareEvent]:
    """Record the same care for several plants at once (e.g. watering a whole room), all or
    none.

    Raises:
        CareError: If a plant isn't the household's, or as for `log_care`.
    """
    plants = Plant.objects.filter(household=household, pk__in=plant_ids).select_related(
        "location__site"
    )
    by_id = {plant.pk: plant for plant in plants}
    if set(plant_ids) - set(by_id):
        raise CareError("plant_not_found", "Some of these plants don't exist.", "plant_ids")
    return [log_care(by_id[plant_id], data, user) for plant_id in dict.fromkeys(plant_ids)]


def update_care_event(event: CareEvent, data: CareEventData) -> CareEvent:
    """Correct a logged event (type, time, notes, feedback, skipped).

    Raises:
        CareError: As for `log_care`.
    """
    _apply_event(event, event.plant.household, data)
    return event
