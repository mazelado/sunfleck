"""Read queries for care data."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery

from sunfleck.care.models import CareEvent, CareSchedule, Feedback, ScheduleAdjustment
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


def _care_for(schedule: CareSchedule) -> QuerySet[CareEvent]:
    """The care given for a schedule: any kind of watering for a watering schedule, as for
    predictions. Care estimated when the plant was added is left out: no one did it on a day."""
    care_type = schedule.care_type
    same_care = (
        Q(care_type__counts_as_watering=True)
        if care_type.counts_as_watering
        else Q(care_type=care_type)
    )
    return CareEvent.objects.filter(same_care, plant_id=schedule.plant_id, estimated=False)


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
    before = ScheduleAdjustment.objects.filter(
        schedule=schedule, calculated_at__lt=OuterRef("performed_at")
    ).order_by("-calculated_at", "-pk")
    events = (
        _care_for(schedule)
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


# How far back the soil summary looks, and so how long each of its two periods is.
SOIL_PERIOD_DAYS = 90


@dataclass(frozen=True)
class SoilCounts:
    """How the soil was at the waterings from `since` to `until` (days at the plant)."""

    since: date
    until: date
    too_dry: int
    just_right: int
    still_wet: int

    @property
    def answers(self) -> int:
        return self.too_dry + self.just_right + self.still_wet


def soil_summary(schedule: CareSchedule, today: date) -> tuple[SoilCounts, SoilCounts]:
    """How often the soil was too dry, just right or still wet when watering, in the last
    `SOIL_PERIOD_DAYS` days and in the same length of time before: how well the watering
    predictions fit this plant, and whether that's getting better.

    It counts the "How was the soil?" answers, including from waterings skipped because the
    soil was still wet.
    """
    zone = plant_zone(schedule.plant)
    periods = []
    for back in (0, 1):
        until = today - timedelta(days=SOIL_PERIOD_DAYS * back)
        since = until - timedelta(days=SOIL_PERIOD_DAYS - 1)
        start = datetime.combine(since, time.min, tzinfo=zone)
        end = datetime.combine(until + timedelta(days=1), time.min, tzinfo=zone)
        counts = (
            _care_for(schedule)
            .filter(performed_at__gte=start, performed_at__lt=end)
            .aggregate(
                **{
                    answer: Count("pk", filter=Q(feedback=answer))
                    for answer in (Feedback.TOO_DRY, Feedback.JUST_RIGHT, Feedback.STILL_WET)
                }
            )
        )
        periods.append(
            SoilCounts(
                since,
                until,
                too_dry=counts[Feedback.TOO_DRY],
                just_right=counts[Feedback.JUST_RIGHT],
                still_wet=counts[Feedback.STILL_WET],
            )
        )
    recent, earlier = periods
    return recent, earlier
