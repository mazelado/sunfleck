"""Predicting when a plant next needs watering or fertilizing, and explaining why.

Watering starts from the care profile's interval for the current season, then each factor
(light, temperature, pot, the plant being dormant, and feedback about the soil) multiplies it.
Every factor is reported, so the app can explain the result in plain words. A watering
prediction also says roughly how much water to give (see `water_amount`).
"""

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from sunfleck.prediction.light import GrowLight, Window, indoor_dli, outdoor_dli, seasonal_sun
from sunfleck.prediction.seasons import (
    Season,
    local_months,
    next_month_start,
    season_of,
)

# However the factors combine, watering stays between half and twice the profile's interval.
MIN_MULTIPLIER = 0.5
MAX_MULTIPLIER = 2.0
MAX_INTERVAL_DAYS = 180

# Factors smaller than this aren't worth mentioning, or applying.
NEGLIGIBLE = 0.02

# Feedback: how far one "too dry" or "still wet" moves the interval, and how many of the most
# recent answers count.
FEEDBACK_STEP = {"too_dry": 0.9, "just_right": 1.0, "still_wet": 1.125}
FEEDBACK_MEMORY = 10
FEEDBACK_LIMITS = (0.6, 1.6)

# The pot an interval in the care dataset assumes: a 15 cm plastic pot.
TYPICAL_POT_CM = 15
# A pot without a known height is taken to be as tall as it is wide, and its base this much
# narrower than its top: the shape of most standard pots.
POT_BASE_RATIO = 0.8

# How much water to give, as a share of the pot's volume: enough to wet the soil that dried
# since the last watering, and a little more to drain out of the bottom. The more of the soil
# a profile lets dry, the more it takes. These are rough, and the app says so.
WATER_SHARE = {
    "keep_moist": 0.15,
    "top_quarter": 0.2,
    "top_third": 0.2,
    "top_half": 0.25,
    "mostly": 0.3,
    "completely": 0.3,
}
# In the ground: about 25 mm (an inch) of water a week, in fewer, deeper waterings when the
# interval is longer. 1 mm is 1 litre per square metre.
GROUND_MM_PER_WEEK = 25
GROUND_MM_LIMITS = (10, 40)
POT_MATERIAL = {
    "terracotta": 0.85,
    "fabric": 0.8,
    "wood": 0.95,
    "in_ground": 1.3,
}

DORMANT = 1.5


@dataclass(frozen=True)
class Profile:
    """The parts of a care profile the engine uses."""

    watering_days: Mapping[Season, int | None]
    dli_ideal: float
    temperature_ideal_min: float
    temperature_ideal_max: float
    fertilize_days: int | None
    fertilize_pause_north: frozenset[int] = frozenset()
    # How much of the soil may dry between waterings (the dataset's `let_dry`), and whether
    # the plant grows in soil at all: air plants are soaked or misted, so no amount applies.
    let_dry: str | None = None
    in_soil: bool = True

    @classmethod
    def from_dataset(cls, profile: Mapping[str, Any]) -> "Profile":
        """Read a profile as written in the care dataset (data/care/archetypes)."""
        fertilizing = profile["fertilizing"]
        return cls(
            watering_days={
                Season(season): days
                for season, days in profile["watering"]["interval_days"].items()
            },
            dli_ideal=profile["light"]["dli_ideal"],
            temperature_ideal_min=profile["temperature_c"]["ideal_min"],
            temperature_ideal_max=profile["temperature_c"]["ideal_max"],
            fertilize_days=fertilizing["interval_days"] if fertilizing else None,
            fertilize_pause_north=frozenset(
                fertilizing["pause_months_north"] if fertilizing else ()
            ),
            let_dry=profile["watering"].get("let_dry"),
            in_soil=profile.get("key") != "air_plant",
        )


@dataclass(frozen=True)
class Conditions:
    """Where and how a plant grows. Anything unknown is None or empty."""

    indoor: bool | None = None  # None: the plant has no location
    latitude: float | None = None
    windows: tuple[Window, ...] = ()
    grow_lights: tuple[GrowLight, ...] = ()
    exposure: str | None = None  # outdoor: full_sun, part_shade, shade
    temperature_min_c: float | None = None
    temperature_max_c: float | None = None
    pot_diameter_cm: int | None = None
    pot_height_cm: int | None = None
    pot_material: str | None = None
    dormant: bool = False


@dataclass(frozen=True)
class Factor:
    """One reason for a prediction. `code` and `details` let the app explain it in words."""

    code: str
    multiplier: float = 1.0
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Adjustment:
    """A factor from outside the engine (e.g. a weather plugin): it multiplies the interval
    like the others, and can put the care off until a day (e.g. after heavy rain)."""

    factor: Factor
    not_before: date | None = None


@dataclass(frozen=True)
class Prediction:
    """When care is next due.

    `interval_days` is None when the care isn't needed now (a resting season, a pause in
    fertilizing, a dormant plant); `next_due` then says when it resumes, if known.
    """

    interval_days: int | None
    next_due: date | None
    factors: tuple[Factor, ...]


@dataclass(frozen=True)
class History:
    """What's known about past care of this kind."""

    last_done: date | None
    # When the plant's routine started, to count from when care hasn't been logged yet.
    started_on: date
    # Watering only: soil feedback, oldest first ("too_dry", "just_right", "still_wet").
    feedback: Sequence[str] = ()


# --- Watering ---------------------------------------------------------------------------------


def light_factor(profile: Profile, conditions: Conditions, season: Season) -> Factor:
    """More light than the profile expects dries the soil faster; less, slower.

    The profile's seasonal intervals already allow for shorter, darker winter days, so the
    spot is compared with the profile's ideal light as it would be in that season.
    """
    if conditions.indoor is None:
        return Factor("no_location")
    dli = (
        indoor_dli(conditions.windows, conditions.grow_lights, season, conditions.latitude)
        if conditions.indoor
        else outdoor_dli(conditions.exposure, season, conditions.latitude)
    )
    if dli is None:
        return Factor("no_light_info", details={"indoor": conditions.indoor})
    expected = profile.dli_ideal * seasonal_sun(season, conditions.latitude)
    multiplier = _clamp((max(dli, 0.5) / expected) ** -0.25, 0.8, 1.25)
    return Factor("light", multiplier, {"dli": round(dli, 1), "expected": round(expected, 1)})


def temperature_factor(profile: Profile, conditions: Conditions) -> Factor | None:
    """A room warmer than the profile's ideal dries the soil faster; a cooler one, slower.

    Outdoors, temperature comes from the weather (a plugin), not from here.
    """
    known = [
        value
        for value in (conditions.temperature_min_c, conditions.temperature_max_c)
        if value is not None
    ]
    if not conditions.indoor or not known:
        return None
    typical = sum(known) / len(known)
    ideal = (profile.temperature_ideal_min + profile.temperature_ideal_max) / 2
    multiplier = _clamp(1 - 0.025 * (typical - ideal), 0.8, 1.2)
    return Factor(
        "temperature",
        multiplier,
        {
            "temperature_c": round(typical, 1),
            "ideal_min_c": profile.temperature_ideal_min,
            "ideal_max_c": profile.temperature_ideal_max,
        },
    )


def pot_volume_l(diameter_cm: float, height_cm: float | None = None) -> float:
    """The volume of a pot in litres: a slightly tapered cylinder (a frustum), as tall as it
    is wide unless its height is known."""
    height = height_cm or diameter_cm
    top = diameter_cm
    base = diameter_cm * POT_BASE_RATIO
    return math.pi * height / 12 * (top**2 + top * base + base**2) / 1000


def pot_factors(conditions: Conditions) -> list[Factor]:
    """Small and porous pots dry out faster than large or sealed ones; the ground, slowest."""
    factors = []
    in_ground = conditions.pot_material == "in_ground"
    if conditions.pot_diameter_cm and not in_ground:
        # Compared by volume, so a known height counts too. Without one, this is the same as
        # comparing diameters: (d / 15) ** 0.35.
        volume = pot_volume_l(conditions.pot_diameter_cm, conditions.pot_height_cm)
        ratio = volume / pot_volume_l(TYPICAL_POT_CM)
        multiplier = _clamp(ratio ** (0.35 / 3), 0.8, 1.3)
        details: dict[str, Any] = {"diameter_cm": conditions.pot_diameter_cm}
        if conditions.pot_height_cm:
            details["height_cm"] = conditions.pot_height_cm
        factors.append(Factor("pot_size", multiplier, details))
    if conditions.pot_material in POT_MATERIAL:
        factors.append(
            Factor(
                "pot_material",
                POT_MATERIAL[conditions.pot_material],
                {"material": conditions.pot_material},
            )
        )
    return factors


def water_amount(profile: Profile, conditions: Conditions, interval_days: int) -> Factor | None:
    """Roughly how much water to give each time.

    In a pot, a share of its volume (see WATER_SHARE). In the ground (or outdoors with no pot
    size, which is most likely a bed), a depth of water, as rain is measured. Indoors without
    a pot size, a hint to add it. These factors don't change the interval (multiplier 1).
    """
    if not profile.in_soil:
        return None
    in_ground = conditions.pot_material == "in_ground"
    if conditions.pot_diameter_cm and not in_ground:
        volume = pot_volume_l(conditions.pot_diameter_cm, conditions.pot_height_cm)
        share = WATER_SHARE.get(profile.let_dry or "", WATER_SHARE["top_third"])
        return Factor(
            "water_amount",
            details={
                "litres": round(volume * share, 2),
                "pot_litres": round(volume, 1),
                "height_known": bool(conditions.pot_height_cm),
            },
        )
    if in_ground or conditions.indoor is False:
        depth = _clamp(GROUND_MM_PER_WEEK * interval_days / 7, *GROUND_MM_LIMITS)
        return Factor(
            "water_amount",
            details={"depth_mm": round(depth / 5) * 5, "in_ground": in_ground},
        )
    return Factor("no_pot_size")


def feedback_factor(feedback: Sequence[str]) -> Factor | None:
    """Learn from how the soil was at recent waterings.

    Each "still wet" lengthens the interval and each "too dry" shortens it, a little at a time
    (exponential smoothing), so one unusual week doesn't swing the schedule.
    """
    recent = [answer for answer in feedback if answer in FEEDBACK_STEP][-FEEDBACK_MEMORY:]
    if not recent:
        return None
    multiplier = 1.0
    for answer in recent:
        multiplier = _clamp(multiplier * FEEDBACK_STEP[answer], *FEEDBACK_LIMITS)
    return Factor(
        "feedback",
        multiplier,
        {
            "too_dry": recent.count("too_dry"),
            "just_right": recent.count("just_right"),
            "still_wet": recent.count("still_wet"),
        },
    )


def predict_watering(
    profile: Profile,
    conditions: Conditions,
    history: History,
    today: date,
    extra: Sequence[Adjustment] = (),
) -> Prediction:
    """When a plant next needs watering, and why. `extra` adds factors from plugins."""
    latitude = conditions.latitude
    season = season_of(today, latitude)
    base = profile.watering_days[season]

    def watered_in(day: date) -> bool:
        return profile.watering_days[season_of(day, latitude)] is not None

    if base is None:
        resumes = next_month_start(today, watered_in)
        return Prediction(
            None,
            resumes,
            (Factor("rest_season", details={"season": season, "resumes_on": _iso(resumes)}),),
        )

    factors = [Factor("season", details={"season": season, "days": base})]
    adjustments = [
        light_factor(profile, conditions, season),
        temperature_factor(profile, conditions),
        *pot_factors(conditions),
        Factor("dormant", DORMANT) if conditions.dormant else None,
        feedback_factor(history.feedback),
    ]
    factors += [
        factor
        for factor in adjustments
        if factor is not None
        and (abs(factor.multiplier - 1) >= NEGLIGIBLE or factor.code.startswith("no_"))
    ]
    factors += [adjustment.factor for adjustment in extra]
    multiplier = math.prod(factor.multiplier for factor in factors)
    if not MIN_MULTIPLIER <= multiplier <= MAX_MULTIPLIER:
        multiplier = _clamp(multiplier, MIN_MULTIPLIER, MAX_MULTIPLIER)
        factors.append(
            Factor(
                "limit",
                details={
                    "min_days": _days(base * MIN_MULTIPLIER),
                    "max_days": _days(base * MAX_MULTIPLIER),
                },
            )
        )
    interval = _days(base * multiplier)
    amount = water_amount(profile, conditions, interval)
    if amount:
        factors.append(amount)

    due, counted_from_start = _due(history, interval)
    if counted_from_start:
        factors.append(Factor("not_logged", details={"since": history.started_on.isoformat()}))
    # If it falls in a resting season, wait for that season to end.
    if not watered_in(max(due, today)):
        resumes = next_month_start(max(due, today), watered_in)
        factors.append(Factor("rest_season_ahead", details={"resumes_on": _iso(resumes)}))
        due = resumes if resumes else due
    # Put off by a plugin, e.g. until the soil has had time to dry after rain.
    not_before = max((a.not_before for a in extra if a.not_before), default=None)
    if not_before and not_before > due:
        due = not_before
    return Prediction(interval, due, tuple(factors))


# --- Fertilizing ------------------------------------------------------------------------------


def predict_fertilizing(
    profile: Profile, conditions: Conditions, history: History, today: date
) -> Prediction:
    """When a plant next needs fertilizing: at the profile's interval, except in its pause
    months (shifted for the southern hemisphere) and while it's dormant."""
    if profile.fertilize_days is None:
        return Prediction(None, None, (Factor("never_fertilize"),))
    if conditions.dormant:
        return Prediction(None, None, (Factor("dormant_no_fertilizer"),))
    interval = profile.fertilize_days
    paused = local_months(profile.fertilize_pause_north, conditions.latitude)

    def fed_in(day: date) -> bool:
        return day.month not in paused

    factors = [Factor("fertilize_interval", details={"days": interval})]
    due, counted_from_start = _due(history, interval)
    if counted_from_start:
        factors.append(Factor("not_logged", details={"since": history.started_on.isoformat()}))
    if not fed_in(max(due, today)):
        resumes = next_month_start(max(due, today), fed_in)
        factors.append(
            Factor(
                "fertilize_pause",
                details={"months": sorted(paused), "resumes_on": _iso(resumes)},
            )
        )
        due = resumes if resumes else due
    return Prediction(interval, due, tuple(factors))


# --- Fixed intervals --------------------------------------------------------------------------


def predict_fixed(interval_days: int, history: History) -> Prediction:
    """Care every so many days, as the person chose."""
    factors = [Factor("fixed", details={"days": interval_days})]
    due, counted_from_start = _due(history, interval_days)
    if counted_from_start:
        factors.append(Factor("not_logged", details={"since": history.started_on.isoformat()}))
    return Prediction(interval_days, due, tuple(factors))


# --- Helpers ----------------------------------------------------------------------------------


def _due(history: History, interval: int) -> tuple[date, bool]:
    """The next due date, and whether it's counted from when the routine started."""
    if history.last_done is None:
        return history.started_on + timedelta(days=interval), True
    return history.last_done + timedelta(days=interval), False


def _iso(day: date | None) -> str | None:
    return day.isoformat() if day else None


def _days(value: float) -> int:
    """Whole days, rounding halves up (Python's round() would round 10.5 down to 10)."""
    return min(max(math.floor(value + 0.5), 1), MAX_INTERVAL_DAYS)


def _clamp(value: float, low: float, high: float) -> float:
    return min(max(value, low), high)
