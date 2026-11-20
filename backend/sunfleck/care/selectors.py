"""Read queries for care data."""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

from django.db.models import OuterRef, Q, Subquery

from sunfleck.care.models import CareEvent, CareSchedule, ScheduleAdjustment
from sunfleck.plants.models import Photo, Plant
from sunfleck.plants.time import plant_zone

TimelineKind = Literal["care", "photo"]
# Items are ordered newest first by (time, kind, id); at the same moment, care comes first.
KIND_RANK: dict[TimelineKind, int] = {"photo": 0, "care": 1}


@dataclass(frozen=True)
class TimelineItem:
    at: datetime
    kind: TimelineKind
    pk: int
    care_event: CareEvent | None = None
    photo: Photo | None = None

    @property
    def cursor(self) -> str:
        """Where the next page starts: just after this item."""
        return f"{self.at.isoformat()}~{self.kind}~{self.pk}"

    def sort_key(self) -> tuple[datetime, int, int]:
        return (self.at, KIND_RANK[self.kind], self.pk)


@dataclass(frozen=True)
class Cursor:
    at: datetime
    kind: TimelineKind
    pk: int


def parse_cursor(value: str) -> Cursor:
    """Read a cursor returned by `plant_timeline`.

    Raises:
        ValueError: If `value` isn't one.
    """
    at, kind, pk = value.split("~")
    if kind not in KIND_RANK:
        raise ValueError(f"Unknown kind: {kind}")
    parsed = datetime.fromisoformat(at)
    if parsed.tzinfo is None:
        raise ValueError("Cursor time has no time zone")
    return Cursor(parsed, kind, int(pk))


def _older_than(cursor: Cursor | None, kind: TimelineKind, time_field: str) -> Q:
    """Items of `kind` that come after `cursor` in the timeline's order."""
    if cursor is None:
        return Q()
    rank, cursor_rank = KIND_RANK[kind], KIND_RANK[cursor.kind]
    if rank < cursor_rank:
        return Q(**{f"{time_field}__lte": cursor.at})
    if rank > cursor_rank:
        return Q(**{f"{time_field}__lt": cursor.at})
    return Q(**{f"{time_field}__lt": cursor.at}) | Q(**{time_field: cursor.at, "pk__lt": cursor.pk})


def plant_timeline(
    plant: Plant, before: Cursor | None = None, limit: int = 30
) -> tuple[list[TimelineItem], str | None]:
    """The plant's care events and photos, newest first, and the cursor for the next page
    (None on the last page)."""
    events = (
        plant.care_events.select_related("care_type", "performed_by")
        .filter(_older_than(before, "care", "performed_at"))
        .order_by("-performed_at", "-id")[: limit + 1]
    )
    photos = plant.photos.filter(_older_than(before, "photo", "taken_at")).order_by(
        "-taken_at", "-id"
    )[: limit + 1]
    items = [
        TimelineItem(event.performed_at, "care", event.pk, care_event=event) for event in events
    ]
    items += [TimelineItem(photo.taken_at, "photo", photo.pk, photo=photo) for photo in photos]
    items.sort(key=TimelineItem.sort_key, reverse=True)
    page = items[:limit]
    return page, (page[-1].cursor if len(items) > limit else None)


@dataclass(frozen=True)
class HistoryEntry:
    """Care given for a schedule, next to what was predicted when it was given."""

    event: CareEvent
    done_on: date
    # The prediction in force just before the care was done: whether there was one, when it
    # said the care was due (None while resting), and how many days apart it said.
    predicted: bool
    predicted_due: date | None
    predicted_interval_days: int | None

    @property
    def days_from_due(self) -> int | None:
        """Days after the predicted due date (negative: before it); None without one."""
        if self.predicted_due is None:
            return None
        return (self.done_on - self.predicted_due).days


def schedule_history(schedule: CareSchedule, limit: int = 20) -> list[HistoryEntry]:
    """The care given for this schedule, newest first, each with the prediction in force just
    before it was done.

    The prediction is the latest one made before the care was done, so care logged late, or
    imported, is still compared with what Sunfleck said at the time. Any kind of watering
    counts for a watering schedule, as for predictions. Care estimated when the plant was added
    is left out: no one did it on a day to compare.
    """
    care_type = schedule.care_type
    same_care = (
        Q(care_type__counts_as_watering=True)
        if care_type.counts_as_watering
        else Q(care_type=care_type)
    )
    before = ScheduleAdjustment.objects.filter(
        schedule=schedule, calculated_at__lt=OuterRef("performed_at")
    ).order_by("-calculated_at", "-pk")
    events = (
        CareEvent.objects.filter(same_care, plant_id=schedule.plant_id, estimated=False)
        .select_related("care_type", "performed_by")
        .annotate(
            prediction_id=Subquery(before.values("pk")[:1]),
            predicted_due=Subquery(before.values("next_due")[:1]),
            predicted_interval_days=Subquery(before.values("interval_days")[:1]),
        )
        .order_by("-performed_at", "-pk")[:limit]
    )
    zone = plant_zone(schedule.plant)
    return [
        HistoryEntry(
            event=event,
            done_on=event.performed_at.astimezone(zone).date(),
            predicted=event.prediction_id is not None,
            predicted_due=event.predicted_due,
            predicted_interval_days=event.predicted_interval_days,
        )
        for event in events
    ]
