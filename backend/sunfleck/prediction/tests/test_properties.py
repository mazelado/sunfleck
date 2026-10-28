"""Rules that must hold for any plant, place, and day (property-based tests with Hypothesis)."""

from datetime import date, timedelta

from django.conf import settings
from hypothesis import given
from hypothesis import strategies as st

from sunfleck.prediction.engine import (
    MAX_MULTIPLIER,
    MIN_MULTIPLIER,
    Conditions,
    History,
    Profile,
    _days,
    predict_fertilizing,
    predict_watering,
)
from sunfleck.prediction.light import GrowLight, Window
from sunfleck.prediction.seasons import local_months, season_of
from sunfleck.taxonomy.dataset import load_dataset

PROFILES = [
    Profile.from_dataset(profile)
    for profile in load_dataset(settings.CARE_DATA_DIR).archetypes.values()
]
DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
FEEDBACK = ["too_dry", "just_right", "still_wet"]

days = st.dates(min_value=date(2000, 1, 1), max_value=date(2100, 12, 31))
latitudes = st.none() | st.floats(min_value=-66, max_value=66)
temperatures = st.none() | st.floats(min_value=-10, max_value=45)


@st.composite
def conditions(draw: st.DrawFn) -> Conditions:
    return Conditions(
        indoor=draw(st.none() | st.booleans()),
        latitude=draw(latitudes),
        windows=tuple(
            draw(
                st.lists(
                    st.builds(
                        Window,
                        st.sampled_from(DIRECTIONS),
                        st.none() | st.integers(0, 2000),
                    ),
                    max_size=4,
                )
            )
        ),
        grow_lights=tuple(draw(st.lists(st.builds(GrowLight, st.floats(0, 60)), max_size=3))),
        exposure=draw(st.none() | st.sampled_from(["full_sun", "part_shade", "shade"])),
        temperature_min_c=draw(temperatures),
        temperature_max_c=draw(temperatures),
        pot_diameter_cm=draw(st.none() | st.integers(1, 500)),
        pot_material=draw(
            st.none() | st.sampled_from(["plastic", "terracotta", "fabric", "wood", "in_ground"])
        ),
        dormant=draw(st.booleans()),
    )


@st.composite
def histories(draw: st.DrawFn, today: date) -> History:
    started_on = draw(st.dates(today - timedelta(days=3650), today))
    last_done = draw(st.none() | st.dates(started_on, today))
    return History(last_done, started_on, draw(st.lists(st.sampled_from(FEEDBACK))))


@given(
    profile=st.sampled_from(PROFILES),
    conditions=conditions(),
    today=days,
    data=st.data(),
)
def test_watering_stays_within_half_and_twice_the_seasons_interval(
    profile: Profile, conditions: Conditions, today: date, data: st.DataObject
) -> None:
    history = data.draw(histories(today))

    prediction = predict_watering(profile, conditions, history, today)

    base = profile.watering_days[season_of(today, conditions.latitude)]
    if base is None:
        assert prediction.interval_days is None
    else:
        assert prediction.interval_days is not None
        assert _days(base * MIN_MULTIPLIER) <= prediction.interval_days
        assert prediction.interval_days <= _days(base * MAX_MULTIPLIER)
        # It's due after the last watering (or the start), never before.
        assert prediction.next_due is not None
        assert prediction.next_due > (history.last_done or history.started_on)


@given(
    profile=st.sampled_from(PROFILES),
    conditions=conditions(),
    today=days,
    data=st.data(),
    extra=st.floats(min_value=0.1, max_value=30),
)
def test_more_light_never_means_watering_less_often(
    profile: Profile, conditions: Conditions, today: date, data: st.DataObject, extra: float
) -> None:
    history = data.draw(histories(today))
    # Light that's already known: unknown light counts as typical, so a dim lamp would be less.
    indoor = Conditions(
        **{**conditions.__dict__, "indoor": True, "windows": (*conditions.windows, Window("N"))}
    )
    brighter = Conditions(
        **{**indoor.__dict__, "grow_lights": (*indoor.grow_lights, GrowLight(extra))}
    )

    before = predict_watering(profile, indoor, history, today).interval_days
    after = predict_watering(profile, brighter, history, today).interval_days

    assert before is None or after is not None
    if before is not None and after is not None:
        assert after <= before


@given(
    profile=st.sampled_from(PROFILES),
    conditions=conditions(),
    today=days,
    data=st.data(),
)
def test_too_dry_never_lengthens_and_still_wet_never_shortens(
    profile: Profile, conditions: Conditions, today: date, data: st.DataObject
) -> None:
    history = data.draw(histories(today))

    def interval(feedback: list[str]) -> int | None:
        changed = History(history.last_done, history.started_on, feedback)
        return predict_watering(profile, conditions, changed, today).interval_days

    now = interval(list(history.feedback))
    drier = interval([*history.feedback, "too_dry"])
    wetter = interval([*history.feedback, "still_wet"])

    if now is not None:
        assert drier is not None
        assert wetter is not None
        assert drier <= now <= wetter


@given(
    profile=st.sampled_from(PROFILES),
    conditions=conditions(),
    today=days,
    data=st.data(),
)
def test_fertilizing_is_never_due_in_a_pause_month(
    profile: Profile, conditions: Conditions, today: date, data: st.DataObject
) -> None:
    history = data.draw(histories(today))

    prediction = predict_fertilizing(profile, conditions, history, today)

    if prediction.next_due is not None:
        # Due on a day that isn't paused; and if overdue, today isn't paused either.
        paused = local_months(profile.fertilize_pause_north, conditions.latitude)
        assert max(prediction.next_due, today).month not in paused


@given(day=days, latitude=st.floats(min_value=0.1, max_value=66))
def test_the_southern_hemisphere_mirrors_the_northern(day: date, latitude: float) -> None:
    half_a_year_on = date(day.year + (day.month + 5) // 12, (day.month + 5) % 12 + 1, 1)

    assert season_of(day, -latitude) == season_of(half_a_year_on, latitude)
