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


# A grow light's brightness (PPFD) is measured at some distance below it: 30 cm unless its maker
# says otherwise (the brightness presets are typical figures at about 30 cm).
DEFAULT_PPFD_DISTANCE_CM = 30
# How fast it falls off further away, as PPFD x (measured / actual distance) ** PPFD_FALLOFF.
# A small bulb far away falls off with the square of the distance (2.0); an LED panel or bar
# spreads its light, so close up it falls off more slowly. Spider Farmer's own table for its
# SF1000 panel gives 928, 756 and 557 umol/m2/s at the centre at 12, 14 and 18 inches
# (30, 36 and 46 cm): 1.26 to 1.33. One maker's figures, so an estimate.
PPFD_FALLOFF = 1.3
# Held within these, so a light touching a plant or across the room gives a sensible figure.
MIN_DISTANCE_CM = 5
MAX_DISTANCE_CM = 300
MAX_GAIN = 3.0  # at most 3x the measured brightness, closer than it was measured


def ppfd_at(ppfd: float, measured_at_cm: int, distance_cm: int | None) -> float:
    """A grow light's PPFD at `distance_cm` from it, from its PPFD at `measured_at_cm`. Without
    a distance, the plant is taken to be where it was measured."""
    if distance_cm is None:
        return ppfd
    distance = min(max(distance_cm, MIN_DISTANCE_CM), MAX_DISTANCE_CM)
    gain: float = (measured_at_cm / distance) ** PPFD_FALLOFF
    return ppfd * min(gain, MAX_GAIN)
