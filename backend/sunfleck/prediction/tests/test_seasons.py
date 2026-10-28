from datetime import date

import pytest

from sunfleck.prediction.light import Window, seasonal_sun, window_dli
from sunfleck.prediction.seasons import (
    Season,
    first_of_next_month,
    local_months,
    next_month_start,
    season_of,
)

LONDON = 51.5
SYDNEY = -33.9


@pytest.mark.parametrize(
    ("day", "latitude", "season"),
    [
        (date(2026, 1, 15), LONDON, Season.WINTER),
        (date(2026, 4, 15), LONDON, Season.SPRING),
        (date(2026, 7, 15), LONDON, Season.SUMMER),
        (date(2026, 10, 15), LONDON, Season.AUTUMN),
        (date(2026, 12, 1), LONDON, Season.WINTER),
        (date(2026, 1, 15), SYDNEY, Season.SUMMER),
        (date(2026, 4, 15), SYDNEY, Season.AUTUMN),
        (date(2026, 7, 15), SYDNEY, Season.WINTER),
        (date(2026, 10, 15), SYDNEY, Season.SPRING),
        (date(2026, 7, 15), None, Season.SUMMER),  # unknown places count as northern
    ],
)
def test_season_of(day: date, latitude: float | None, season: Season) -> None:
    assert season_of(day, latitude) == season


def test_months_shift_by_six_in_the_southern_hemisphere() -> None:
    assert local_months([11, 12, 1, 2], LONDON) == {11, 12, 1, 2}
    assert local_months([11, 12, 1, 2], SYDNEY) == {5, 6, 7, 8}


def test_first_of_next_month_crosses_new_year() -> None:
    assert first_of_next_month(date(2026, 12, 31)) == date(2027, 1, 1)
    assert first_of_next_month(date(2026, 2, 14)) == date(2026, 3, 1)


def test_next_month_start() -> None:
    assert next_month_start(date(2026, 11, 20), lambda day: day.month == 3) == date(2027, 3, 1)
    assert next_month_start(date(2026, 11, 20), lambda day: False) is None


def test_summers_are_brighter_and_winters_darker_further_from_the_equator() -> None:
    assert seasonal_sun(Season.SPRING, LONDON) == 1
    assert seasonal_sun(Season.SUMMER, LONDON) > seasonal_sun(Season.SUMMER, 10)
    assert seasonal_sun(Season.WINTER, LONDON) < seasonal_sun(Season.WINTER, 10)
    assert seasonal_sun(Season.WINTER, 0) == 1


def test_the_sunny_side_depends_on_the_hemisphere() -> None:
    south = Window("S", distance_cm=0)
    north = Window("N", distance_cm=0)

    assert window_dli(south, Season.SPRING, LONDON) > window_dli(north, Season.SPRING, LONDON)
    assert window_dli(north, Season.SPRING, SYDNEY) > window_dli(south, Season.SPRING, SYDNEY)


def test_light_falls_off_away_from_a_window() -> None:
    at_glass = window_dli(Window("S", 0), Season.SPRING, LONDON)

    assert window_dli(Window("S", 90), Season.SPRING, LONDON) == pytest.approx(
        at_glass / 2.718, 0.01
    )
    # An unknown distance counts as about a metre.
    assert window_dli(Window("S"), Season.SPRING, LONDON) == window_dli(
        Window("S", 100), Season.SPRING, LONDON
    )
