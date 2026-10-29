from datetime import date

import pytest
from django.conf import settings

from sunfleck.prediction.engine import (
    Adjustment,
    Conditions,
    Factor,
    History,
    Prediction,
    Profile,
    pot_volume_l,
    predict_fertilizing,
    predict_fixed,
    predict_watering,
)
from sunfleck.prediction.light import GrowLight, Window
from sunfleck.prediction.seasons import Season
from sunfleck.taxonomy.dataset import load_dataset

LONDON = 51.5
SYDNEY = -33.9

AROID = Profile(
    watering_days={Season.SPRING: 7, Season.SUMMER: 6, Season.AUTUMN: 9, Season.WINTER: 12},
    dli_ideal=10,
    temperature_ideal_min=18,
    temperature_ideal_max=27,
    fertilize_days=30,
    fertilize_pause_north=frozenset({11, 12, 1, 2}),
    let_dry="top_third",
)
BULB = Profile(
    watering_days={Season.SPRING: 7, Season.SUMMER: None, Season.AUTUMN: 21, Season.WINTER: None},
    dli_ideal=25,
    temperature_ideal_min=5,
    temperature_ideal_max=20,
    fertilize_days=30,
)
CARNIVORE = Profile(
    watering_days=dict.fromkeys(Season, 2),
    dli_ideal=25,
    temperature_ideal_min=18,
    temperature_ideal_max=32,
    fertilize_days=None,
)

SPRING_DAY = date(2026, 4, 15)
LIVING_ROOM = Conditions(indoor=True, latitude=LONDON)
WATERED = History(last_done=date(2026, 4, 13), started_on=date(2026, 1, 1))


def codes(prediction: Prediction) -> list[str]:
    return [factor.code for factor in prediction.factors]


def factor(prediction: Prediction, code: str) -> Factor:
    return next(factor for factor in prediction.factors if factor.code == code)


# --- Watering ---------------------------------------------------------------------------------


def test_the_baseline_is_the_profiles_interval_for_the_season() -> None:
    prediction = predict_watering(AROID, Conditions(), WATERED, SPRING_DAY)

    assert prediction.interval_days == 7
    assert prediction.next_due == date(2026, 4, 20)
    assert prediction.factors[0] == Factor("season", details={"season": "spring", "days": 7})
    assert codes(prediction) == ["season", "no_location", "no_pot_size"]


def test_seasons_follow_the_hemisphere() -> None:
    january = date(2026, 1, 10)
    history = History(last_done=january, started_on=january)

    london = predict_watering(AROID, Conditions(latitude=LONDON), history, january)
    sydney = predict_watering(AROID, Conditions(latitude=SYDNEY), history, january)

    assert london.interval_days == 12  # winter
    assert sydney.interval_days == 6  # summer


def test_until_watering_is_logged_it_counts_from_when_the_routine_started() -> None:
    history = History(last_done=None, started_on=date(2026, 4, 10))

    prediction = predict_watering(AROID, Conditions(), history, SPRING_DAY)

    assert prediction.next_due == date(2026, 4, 17)
    assert factor(prediction, "not_logged").details == {"since": "2026-04-10"}


@pytest.mark.parametrize(
    ("conditions", "interval", "multiplier"),
    [
        # A south window half a metre away gives about the ideal light: no change.
        (Conditions(indoor=True, latitude=LONDON, windows=(Window("S", 50),)), 7, None),
        # Twice the ideal light: waters sooner.
        (Conditions(indoor=True, latitude=LONDON, grow_lights=(GrowLight(20),)), 6, 0.84),
        # A north window two metres away is dim: waters later, by at most a quarter.
        (Conditions(indoor=True, latitude=LONDON, windows=(Window("N", 200),)), 9, 1.25),
        # Outdoors in full sun: much brighter, but waters at most a fifth sooner.
        (Conditions(indoor=False, latitude=LONDON, exposure="full_sun"), 6, 0.8),
    ],
)
def test_light(conditions: Conditions, interval: int, multiplier: float | None) -> None:
    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert prediction.interval_days == interval
    if multiplier is None:
        assert "light" not in codes(prediction)
    else:
        assert factor(prediction, "light").multiplier == pytest.approx(multiplier, abs=0.01)


def test_light_is_explained_with_the_estimate_and_what_the_profile_expects() -> None:
    conditions = Conditions(indoor=True, latitude=LONDON, grow_lights=(GrowLight(20),))

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert factor(prediction, "light").details == {"dli": 20, "expected": 10}


def test_winter_light_isnt_counted_twice() -> None:
    # The winter interval already allows for darker days: a window that's ideal in spring is
    # still ideal in winter, but a grow light (just as bright all year) counts for more.
    window = Conditions(indoor=True, latitude=LONDON, windows=(Window("S", 50),))
    lamp = Conditions(indoor=True, latitude=LONDON, grow_lights=(GrowLight(10),))
    winter_day = date(2026, 1, 15)
    history = History(winter_day, winter_day)

    by_window = predict_watering(AROID, window, history, winter_day)
    under_lamp = predict_watering(AROID, lamp, history, winter_day)

    assert by_window.interval_days == 12
    assert "light" not in codes(by_window)
    assert under_lamp.interval_days == 10
    assert factor(under_lamp, "light").details == {"dli": 10, "expected": 4.8}


def test_unknown_light_is_mentioned_so_people_can_add_it() -> None:
    indoor = predict_watering(AROID, LIVING_ROOM, WATERED, SPRING_DAY)
    outdoor = predict_watering(AROID, Conditions(indoor=False), WATERED, SPRING_DAY)

    assert factor(indoor, "no_light_info").details == {"indoor": True}
    assert factor(outdoor, "no_light_info").details == {"indoor": False}


def test_a_warm_room_dries_soil_faster() -> None:
    conditions = Conditions(indoor=True, temperature_min_c=24, temperature_max_c=28)

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert prediction.interval_days == 6
    temperature = factor(prediction, "temperature")
    assert temperature.multiplier == pytest.approx(0.9125)
    assert temperature.details == {"temperature_c": 26, "ideal_min_c": 18, "ideal_max_c": 27}


def test_one_known_temperature_is_enough() -> None:
    conditions = Conditions(indoor=True, temperature_min_c=14.5)

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert factor(prediction, "temperature").multiplier == pytest.approx(1.2)


def test_outdoor_temperatures_are_left_to_the_weather() -> None:
    conditions = Conditions(indoor=False, temperature_min_c=30)

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert "temperature" not in codes(prediction)


def test_a_small_terracotta_pot_dries_out_faster() -> None:
    conditions = Conditions(pot_diameter_cm=8, pot_material="terracotta")

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert prediction.interval_days == 5
    assert factor(prediction, "pot_size").details == {"diameter_cm": 8}
    assert factor(prediction, "pot_material").multiplier == 0.85


def test_a_typical_pot_changes_nothing() -> None:
    conditions = Conditions(pot_diameter_cm=15, pot_material="plastic")

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert "pot_size" not in codes(prediction)
    assert "pot_material" not in codes(prediction)


def test_in_the_ground_the_pot_size_doesnt_matter() -> None:
    conditions = Conditions(pot_diameter_cm=8, pot_material="in_ground")

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert "pot_size" not in codes(prediction)
    assert prediction.interval_days == 9


def test_a_pots_volume_assumes_a_standard_shape_unless_its_height_is_known() -> None:
    assert pot_volume_l(15) == pytest.approx(2.16, abs=0.01)
    assert pot_volume_l(15, 7) == pytest.approx(1.01, abs=0.01)
    assert pot_volume_l(15, 30) == pytest.approx(2 * pot_volume_l(15))


def test_a_shallow_pot_dries_out_faster_than_a_standard_one_of_the_same_width() -> None:
    standard = predict_watering(AROID, Conditions(pot_diameter_cm=30), WATERED, SPRING_DAY)
    shallow = predict_watering(
        AROID, Conditions(pot_diameter_cm=30, pot_height_cm=10), WATERED, SPRING_DAY
    )

    assert factor(shallow, "pot_size").details == {"diameter_cm": 30, "height_cm": 10}
    assert factor(shallow, "pot_size").multiplier < factor(standard, "pot_size").multiplier


def test_watering_says_how_much_water_a_pot_needs() -> None:
    conditions = Conditions(indoor=True, pot_diameter_cm=15)
    thirsty = Profile(**{**vars(AROID), "let_dry": "keep_moist"})
    dry = Profile(**{**vars(AROID), "let_dry": "completely"})

    amount = factor(predict_watering(thirsty, conditions, WATERED, SPRING_DAY), "water_amount")
    more = factor(predict_watering(dry, conditions, WATERED, SPRING_DAY), "water_amount")

    assert amount.multiplier == 1.0
    assert amount.details == {"litres": 0.32, "pot_litres": 2.2, "height_known": False}
    assert more.details["litres"] == 0.65


def test_in_the_ground_watering_is_a_depth_of_water() -> None:
    in_ground = Conditions(indoor=False, pot_diameter_cm=8, pot_material="in_ground")
    bed = Conditions(indoor=False)

    prediction = predict_watering(AROID, in_ground, WATERED, SPRING_DAY)

    # Every 9 days: 25 mm a week comes to about 30 mm each time.
    assert factor(prediction, "water_amount").details == {"depth_mm": 30, "in_ground": True}
    assert factor(
        predict_watering(CARNIVORE, bed, WATERED, SPRING_DAY), "water_amount"
    ).details == {
        "depth_mm": 10,
        "in_ground": False,
    }


def test_indoors_without_a_pot_size_it_asks_for_one() -> None:
    prediction = predict_watering(AROID, LIVING_ROOM, WATERED, SPRING_DAY)

    assert "no_pot_size" in codes(prediction)
    assert "water_amount" not in codes(prediction)


def test_air_plants_get_no_amount() -> None:
    air_plant = Profile(**{**vars(AROID), "in_soil": False})

    prediction = predict_watering(air_plant, LIVING_ROOM, WATERED, SPRING_DAY)

    assert not {"water_amount", "no_pot_size"} & set(codes(prediction))


def test_feedback_moves_the_interval_a_little_at_a_time() -> None:
    history = History(WATERED.last_done, WATERED.started_on, ["still_wet"] * 3)

    prediction = predict_watering(AROID, Conditions(), history, SPRING_DAY)

    assert prediction.interval_days == 10
    assert factor(prediction, "feedback").details == {
        "too_dry": 0,
        "just_right": 0,
        "still_wet": 3,
    }


def test_feedback_has_limits_and_a_memory() -> None:
    old_wet = ["still_wet"] * 5
    history = History(WATERED.last_done, WATERED.started_on, [*old_wet, *["too_dry"] * 10])

    prediction = predict_watering(AROID, Conditions(), history, SPRING_DAY)

    # Only the last ten answers count, and they shorten the interval by at most 40%.
    assert factor(prediction, "feedback").multiplier == pytest.approx(0.6)
    assert prediction.interval_days == 4


def test_just_right_feedback_keeps_what_was_learned() -> None:
    history = History(WATERED.last_done, WATERED.started_on, ["still_wet", "just_right"])

    prediction = predict_watering(AROID, Conditions(), history, SPRING_DAY)

    assert factor(prediction, "feedback").multiplier == pytest.approx(1.125)


def test_a_dormant_plant_needs_less_water() -> None:
    prediction = predict_watering(AROID, Conditions(dormant=True), WATERED, SPRING_DAY)

    assert prediction.interval_days == 11  # 10.5, rounded up
    assert "dormant" in codes(prediction)


def test_factors_together_stay_within_limits() -> None:
    conditions = Conditions(
        indoor=True,
        latitude=LONDON,
        windows=(Window("N", 300),),
        pot_material="in_ground",
        dormant=True,
    )

    prediction = predict_watering(AROID, conditions, WATERED, SPRING_DAY)

    assert prediction.interval_days == 14  # twice the spring interval
    assert factor(prediction, "limit").details == {"min_days": 4, "max_days": 14}


def test_no_watering_in_a_resting_season() -> None:
    prediction = predict_watering(BULB, Conditions(latitude=LONDON), WATERED, date(2026, 7, 10))

    assert prediction.interval_days is None
    assert prediction.next_due == date(2026, 9, 1)
    assert prediction.factors == (
        Factor("rest_season", details={"season": "summer", "resumes_on": "2026-09-01"}),
    )


def test_a_resting_season_can_last_over_new_year() -> None:
    prediction = predict_watering(BULB, Conditions(latitude=LONDON), WATERED, date(2026, 12, 10))

    assert prediction.next_due == date(2027, 3, 1)


def test_watering_due_in_a_resting_season_waits_for_it_to_end() -> None:
    history = History(last_done=date(2026, 5, 28), started_on=date(2026, 3, 1))

    prediction = predict_watering(BULB, Conditions(latitude=LONDON), history, date(2026, 5, 29))

    assert prediction.interval_days == 7
    assert prediction.next_due == date(2026, 9, 1)
    assert factor(prediction, "rest_season_ahead").details == {"resumes_on": "2026-09-01"}


def test_a_profile_that_never_needs_water_has_no_due_date() -> None:
    desert = Profile(dict.fromkeys(Season), 30, 18, 30, None)

    prediction = predict_watering(desert, Conditions(), WATERED, SPRING_DAY)

    assert prediction.interval_days is None
    assert prediction.next_due is None


# --- Fertilizing ------------------------------------------------------------------------------


def test_fertilizing_follows_the_profiles_interval() -> None:
    history = History(last_done=date(2026, 3, 1), started_on=date(2026, 1, 1))

    prediction = predict_fertilizing(AROID, Conditions(latitude=LONDON), history, SPRING_DAY)

    assert prediction.interval_days == 30
    assert prediction.next_due == date(2026, 3, 31)  # overdue
    assert codes(prediction) == ["fertilize_interval"]


def test_fertilizing_waits_out_the_pause_months() -> None:
    history = History(last_done=date(2026, 10, 15), started_on=date(2026, 1, 1))

    prediction = predict_fertilizing(
        AROID, Conditions(latitude=LONDON), history, date(2026, 10, 20)
    )

    assert prediction.next_due == date(2027, 3, 1)
    assert factor(prediction, "fertilize_pause").details == {
        "months": [1, 2, 11, 12],
        "resumes_on": "2027-03-01",
    }


def test_the_pause_months_shift_in_the_southern_hemisphere() -> None:
    history = History(last_done=date(2026, 4, 10), started_on=date(2026, 1, 1))

    prediction = predict_fertilizing(AROID, Conditions(latitude=SYDNEY), history, date(2026, 4, 20))

    assert prediction.next_due == date(2026, 9, 1)
    assert factor(prediction, "fertilize_pause").details["months"] == [5, 6, 7, 8]


def test_overdue_fertilizing_waits_if_the_pause_has_begun() -> None:
    history = History(last_done=date(2026, 9, 1), started_on=date(2026, 1, 1))

    prediction = predict_fertilizing(AROID, Conditions(latitude=LONDON), history, date(2026, 12, 5))

    assert prediction.next_due == date(2027, 3, 1)


def test_some_plants_are_never_fertilized() -> None:
    prediction = predict_fertilizing(CARNIVORE, Conditions(), WATERED, SPRING_DAY)

    assert prediction == Prediction(None, None, (Factor("never_fertilize"),))


def test_dormant_plants_arent_fertilized() -> None:
    prediction = predict_fertilizing(AROID, Conditions(dormant=True), WATERED, SPRING_DAY)

    assert prediction.next_due is None
    assert codes(prediction) == ["dormant_no_fertilizer"]


# --- The real dataset -------------------------------------------------------------------------


def test_every_care_profile_in_the_dataset_can_be_read() -> None:
    dataset = load_dataset(settings.CARE_DATA_DIR)

    profiles = {key: Profile.from_dataset(profile) for key, profile in dataset.archetypes.items()}

    assert profiles["tropical_aroid"] == AROID
    assert profiles["bog_carnivore"].fertilize_days is None
    assert not profiles["air_plant"].in_soil


# --- Fixed intervals --------------------------------------------------------------------------


def test_fixed_intervals_count_from_the_last_time() -> None:
    assert predict_fixed(14, WATERED) == Prediction(
        14, date(2026, 4, 27), (Factor("fixed", details={"days": 14}),)
    )


def test_fixed_intervals_count_from_the_start_until_logged() -> None:
    prediction = predict_fixed(14, History(None, date(2026, 4, 1)))

    assert prediction.next_due == date(2026, 4, 15)
    assert codes(prediction) == ["fixed", "not_logged"]


# --- Factors from plugins ---------------------------------------------------------------------


def test_plugin_factors_change_the_interval_within_the_limits() -> None:
    cool = Adjustment(Factor("weather_temperature", 1.2, {"temperature_c": 12}))
    prediction = predict_watering(AROID, Conditions(), WATERED, SPRING_DAY, [cool])

    assert prediction.interval_days == 8
    assert factor(prediction, "weather_temperature").details == {"temperature_c": 12}

    soaked = [Adjustment(Factor("very_cool", 3.0))]
    assert predict_watering(AROID, Conditions(), WATERED, SPRING_DAY, soaked).interval_days == 14


def test_plugins_can_put_watering_off() -> None:
    rain = Adjustment(Factor("rain", details={"mm": 12}), not_before=date(2026, 4, 25))
    drizzle = Adjustment(Factor("rain", details={"mm": 3}), not_before=date(2026, 4, 18))

    put_off = predict_watering(AROID, Conditions(), WATERED, SPRING_DAY, [drizzle, rain])
    already_later = predict_watering(AROID, Conditions(), WATERED, SPRING_DAY, [drizzle])

    assert put_off.next_due == date(2026, 4, 25)
    assert already_later.next_due == date(2026, 4, 20)  # due later than the 18th anyway
