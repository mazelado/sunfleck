"""Seasons and months, for both hemispheres.

Seasons are meteorological (whole months: spring is March to May in the north). The care
dataset gives months for the northern hemisphere; in the southern hemisphere they shift by six.
"""

from collections.abc import Callable, Iterable
from datetime import date
from enum import StrEnum


class Season(StrEnum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"


_NORTHERN_SEASONS = {
    12: Season.WINTER,
    1: Season.WINTER,
    2: Season.WINTER,
    3: Season.SPRING,
    4: Season.SPRING,
    5: Season.SPRING,
    6: Season.SUMMER,
    7: Season.SUMMER,
    8: Season.SUMMER,
    9: Season.AUTUMN,
    10: Season.AUTUMN,
    11: Season.AUTUMN,
}


def is_southern(latitude: float | None) -> bool:
    """Whether a latitude is in the southern hemisphere. Unknown places count as northern."""
    return latitude is not None and latitude < 0


def northern_month(month: int, latitude: float | None) -> int:
    """The northern-hemisphere month with the same season as `month` at `latitude`."""
    return (month + 5) % 12 + 1 if is_southern(latitude) else month


def local_months(northern_months: Iterable[int], latitude: float | None) -> frozenset[int]:
    """Months given for the northern hemisphere, as months at `latitude`."""
    # Shifting by six is its own inverse.
    return frozenset(northern_month(month, latitude) for month in northern_months)


def season_of(day: date, latitude: float | None) -> Season:
    return _NORTHERN_SEASONS[northern_month(day.month, latitude)]


def first_of_next_month(day: date) -> date:
    return date(day.year + day.month // 12, day.month % 12 + 1, 1)


def next_month_start(after: date, wanted: Callable[[date], bool]) -> date | None:
    """The first day of the first month after `after`'s month for which `wanted` is true.

    Checks a year ahead, so returns None if no month is wanted.
    """
    day = after
    for _ in range(12):
        day = first_of_next_month(day)
        if wanted(day):
            return day
    return None
