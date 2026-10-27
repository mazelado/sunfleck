"""Read queries for care data."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from django.db.models import Q

from sunfleck.care.models import CareEvent
from sunfleck.plants.models import Photo, Plant

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
