import io
from datetime import UTC, datetime, timedelta

import pytest

from sunfleck.care import selectors
from sunfleck.care.tests.factories import CareEventFactory
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
