from datetime import time

import pytest

from sunfleck.places.light import grow_light_dli, hours_on


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
