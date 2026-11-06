from datetime import time

import pytest

from sunfleck.places.light import grow_light_dli, hours_on, ppfd_at


@pytest.mark.parametrize(
    ("on", "off", "expected"),
    [
        (time(7), time(19), 12),
        (time(6, 30), time(22), 15.5),
        (time(20), time(8), 12),  # runs past midnight
        (time(0), time(23, 59), 23 + 59 / 60),
        (time(8), time(8), 0),
    ],
)
def test_hours_on(on: time, off: time, expected: float) -> None:
    assert hours_on(on, off) == pytest.approx(expected)


def test_grow_light_dli_is_ppfd_times_seconds_on() -> None:
    # 200 µmol/m²/s for 12 h: 200 * 43,200 s = 8,640,000 µmol = 8.64 mol
    assert grow_light_dli(200, time(7), time(19)) == pytest.approx(8.64)


def test_a_grow_light_is_as_bright_as_measured_at_its_distance() -> None:
    assert ppfd_at(200, 30, 30) == 200
    # Without a distance, the plant is where it was measured.
    assert ppfd_at(200, 30, None) == 200


def test_a_grow_light_falls_off_slower_than_the_square_of_the_distance() -> None:
    # Spider Farmer's SF1000 table: 928 at 12", 756 at 14" and 557 at 18" (30.5, 35.6 and
    # 45.7 cm); the inverse square would give 412 at 18".
    assert ppfd_at(928, 30, 35) == pytest.approx(756, rel=0.03)
    assert ppfd_at(928, 30, 45) == pytest.approx(557, rel=0.03)
    # Closer, brighter; the figure measured at 45 cm applies at 45 cm.
    assert ppfd_at(200, 30, 15) > 200
    assert ppfd_at(300, 45, 45) == 300


def test_very_close_or_far_lights_stay_sensible() -> None:
    # Touching the plant: at most 3x what was measured; across the room, held at 3 m.
    assert ppfd_at(200, 30, 0) == 600
    assert ppfd_at(200, 30, 1) == 600
    assert ppfd_at(200, 30, 5000) == ppfd_at(200, 30, 300)
