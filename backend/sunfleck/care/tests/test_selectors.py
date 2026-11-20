import io
from datetime import UTC, date, datetime, timedelta

import pytest

from sunfleck.care import selectors
from sunfleck.care.models import CareSchedule, CareType, ScheduleAdjustment
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Photo, Plant
from sunfleck.plants.tests.factories import PlantFactory, image_bytes

START = datetime(2026, 5, 1, 9, tzinfo=UTC)


def _photo(plant: Plant, at: datetime) -> Photo:
    data = image_bytes()
    return plant_services.add_photo(plant, io.BytesIO(data), len(data), taken_at=at)


def _all_pages(plant: Plant, limit: int) -> list[tuple[str, int]]:
    seen: list[tuple[str, int]] = []
    cursor = None
    while True:
        items, next_cursor = selectors.plant_timeline(plant, cursor, limit)
        seen += [(item.kind, item.pk) for item in items]
        if next_cursor is None:
            return seen
        cursor = selectors.parse_cursor(next_cursor)


@pytest.mark.django_db
def test_timeline_mixes_care_and_photos_newest_first() -> None:
    plant = PlantFactory.create()
    watered = CareEventFactory.create(plant=plant, performed_at=START)
    photo = _photo(plant, START + timedelta(days=1))
    fertilized = CareEventFactory.create(plant=plant, performed_at=START + timedelta(days=2))

    items, next_cursor = selectors.plant_timeline(plant)

    assert [(item.kind, item.pk) for item in items] == [
        ("care", fertilized.pk),
        ("photo", photo.pk),
        ("care", watered.pk),
    ]
    assert next_cursor is None


@pytest.mark.django_db
@pytest.mark.parametrize("limit", [1, 2, 3, 5])
def test_paging_neither_skips_nor_repeats_items_at_the_same_moment(limit: int) -> None:
    plant = PlantFactory.create()
    # Several items share timestamps, the hardest case for paging by time.
    events = [CareEventFactory.create(plant=plant, performed_at=START) for _ in range(3)]
    photos = [_photo(plant, START) for _ in range(2)]
    older = CareEventFactory.create(plant=plant, performed_at=START - timedelta(hours=1))

    seen = _all_pages(plant, limit)

    expected = [("care", e.pk) for e in reversed(events)] + [
        ("photo", p.pk) for p in reversed(photos)
    ]
    assert seen == [*expected, ("care", older.pk)]


@pytest.mark.parametrize("value", ["nonsense", "2026-05-01T09:00:00~note~1", "2026-05-01~care~1"])
def test_invalid_cursors_are_refused(value: str) -> None:
    with pytest.raises(ValueError, match=r".+"):
        selectors.parse_cursor(value)


# --- A schedule's history, next to what was predicted ------------------------------------------


def _day(day: int, hour: int = 12) -> datetime:
    return datetime(2026, 4, day, hour, tzinfo=UTC)


def _watering_schedule(plant: Plant) -> CareSchedule:
    """A watering schedule with no recorded predictions: the tests add their own."""
    return CareSchedule.objects.create(
        plant=plant, care_type=builtin("water"), started_on=date(2026, 4, 1)
    )


def _predicted(schedule: CareSchedule, at: datetime, due: date | None, days: int | None) -> None:
    ScheduleAdjustment.objects.create(
        schedule=schedule, calculated_at=at, next_due=due, interval_days=days
    )


def _history(schedule: CareSchedule, limit: int = 20) -> list[tuple[date, date | None, int | None]]:
    return [
        (entry.done_on, entry.predicted_due, entry.days_from_due)
        for entry in selectors.schedule_history(schedule, limit)
    ]


@pytest.mark.django_db
def test_care_is_compared_with_the_prediction_made_before_it() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    _predicted(schedule, _day(1), date(2026, 4, 8), 7)
    _predicted(schedule, _day(5), date(2026, 4, 9), 8)  # the weather changed
    CareEventFactory.create(plant=plant, performed_at=_day(3))  # early, before the change
    _predicted(schedule, _day(10, 13), date(2026, 4, 18), 8)  # made by logging the next one
    CareEventFactory.create(plant=plant, performed_at=_day(10))

    assert _history(schedule) == [
        (date(2026, 4, 10), date(2026, 4, 9), 1),
        (date(2026, 4, 3), date(2026, 4, 8), -5),
    ]


@pytest.mark.django_db
def test_care_with_no_prediction_before_it_has_nothing_to_compare() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    CareEventFactory.create(plant=plant, performed_at=_day(2))
    _predicted(schedule, _day(2, 13), date(2026, 4, 9), 7)

    (entry,) = selectors.schedule_history(schedule)

    assert (entry.predicted, entry.predicted_due, entry.days_from_due) == (False, None, None)


@pytest.mark.django_db
def test_care_while_resting_had_a_prediction_but_no_due_date() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    _predicted(schedule, _day(1), None, None)
    CareEventFactory.create(plant=plant, performed_at=_day(3))

    (entry,) = selectors.schedule_history(schedule)

    assert (entry.predicted, entry.predicted_due, entry.days_from_due) == (True, None, None)


@pytest.mark.django_db
def test_history_has_every_kind_of_watering_but_not_estimated_or_other_care() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    soak = CareType.objects.create(household=plant.household, name="Soak", counts_as_watering=True)
    CareEventFactory.create(plant=plant, performed_at=_day(1), estimated=True)
    CareEventFactory.create(plant=plant, performed_at=_day(2), care_type=builtin("fertilize"))
    watered = CareEventFactory.create(plant=plant, performed_at=_day(3))
    soaked = CareEventFactory.create(plant=plant, performed_at=_day(4), care_type=soak)
    skipped = CareEventFactory.create(plant=plant, performed_at=_day(5), skipped=True)

    entries = selectors.schedule_history(schedule)

    assert [entry.event for entry in entries] == [skipped, soaked, watered]


@pytest.mark.django_db
def test_history_is_newest_first_up_to_the_limit() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    for day in (1, 3, 5, 7):
        CareEventFactory.create(plant=plant, performed_at=_day(day))

    assert [done for done, _, _ in _history(schedule, limit=2)] == [
        date(2026, 4, 7),
        date(2026, 4, 5),
    ]


@pytest.mark.django_db
def test_the_day_care_was_done_is_the_day_where_the_plant_grows() -> None:
    plant = PlantFactory.create(location=LocationFactory.create())  # in Amsterdam
    schedule = _watering_schedule(plant)
    _predicted(schedule, _day(1), date(2026, 4, 4), 3)
    CareEventFactory.create(plant=plant, performed_at=_day(3, 23))  # 01:00 on the 4th there

    assert _history(schedule) == [(date(2026, 4, 4), date(2026, 4, 4), 0)]


# --- How often the soil was just right ----------------------------------------------------------

TODAY = date(2026, 6, 30)


def _answer(plant: Plant, on: date, feedback: str, **fields: object) -> None:
    CareEventFactory.create(
        plant=plant,
        performed_at=datetime.combine(on, datetime.min.time(), tzinfo=UTC) + timedelta(hours=12),
        feedback=feedback,
        **fields,
    )


def _counts(counts: selectors.SoilCounts) -> tuple[date, date, int, int, int]:
    return (counts.since, counts.until, counts.too_dry, counts.just_right, counts.still_wet)


@pytest.mark.django_db
def test_the_soil_summary_counts_answers_in_the_last_90_days_and_the_90_before() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    _answer(plant, TODAY, "just_right")
    _answer(plant, TODAY - timedelta(days=89), "too_dry")  # the first day of the last 90
    _answer(plant, TODAY - timedelta(days=90), "still_wet")  # the last day of the 90 before
    _answer(plant, TODAY - timedelta(days=179), "just_right")
    _answer(plant, TODAY - timedelta(days=180), "too_dry")  # too long ago
    CareEventFactory.create(plant=plant, performed_at=_day(20))  # no answer

    recent, earlier = selectors.soil_summary(schedule, TODAY)

    assert _counts(recent) == (date(2026, 4, 2), TODAY, 1, 1, 0)
    assert _counts(earlier) == (date(2026, 1, 2), date(2026, 4, 1), 0, 1, 1)
    assert (recent.answers, earlier.answers) == (2, 2)


@pytest.mark.django_db
def test_the_soil_summary_counts_skipped_waterings_but_not_estimated_or_other_care() -> None:
    plant = PlantFactory.create()
    schedule = _watering_schedule(plant)
    _answer(plant, TODAY, "still_wet", skipped=True)  # checked, and it didn't need water
    _answer(plant, TODAY, "too_dry", estimated=True)
    _answer(plant, TODAY, "too_dry", care_type=builtin("fertilize"))

    recent, _ = selectors.soil_summary(schedule, TODAY)

    assert (recent.too_dry, recent.just_right, recent.still_wet) == (0, 0, 1)
