"""Light calculations. Plain Python, so the prediction engine can reuse them.

DLI (daily light integral) is the total amount of plant-usable light a spot receives in a day,
in mol/m²/day. Rough guide: low-light plants ~3-6, most houseplants ~6-12, succulents and
vegetables 15+.
"""

from datetime import time

SECONDS_PER_HOUR = 3600
MICROMOL_PER_MOL = 1_000_000


def hours_on(on_time: time, off_time: time) -> float:
    """Return how many hours a light is on per day. Schedules may run past midnight."""
    on_minutes = on_time.hour * 60 + on_time.minute
    off_minutes = off_time.hour * 60 + off_time.minute
    minutes = (off_minutes - on_minutes) % (24 * 60)
    return minutes / 60


def grow_light_dli(ppfd: float, on_time: time, off_time: time) -> float:
    """Return the DLI (mol/m²/day) a grow light provides: PPFD * hours * 0.0036."""
    return ppfd * hours_on(on_time, off_time) * SECONDS_PER_HOUR / MICROMOL_PER_MOL
