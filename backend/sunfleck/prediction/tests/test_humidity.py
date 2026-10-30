import pytest

from sunfleck.prediction.humidity import indoor_humidity, vapour_pressure_hpa


def test_vapour_pressure_matches_reference_values() -> None:
    assert vapour_pressure_hpa(0) == pytest.approx(6.11, abs=0.01)
    assert vapour_pressure_hpa(20) == pytest.approx(23.37, abs=0.05)


def test_winter_air_heated_indoors_is_dry() -> None:
    # 0 °C and 80 % outdoors is a dew point of about -3 °C; heated to 21 °C, about 20 %.
    assert indoor_humidity(-3.0, 0.0, 21.0) == pytest.approx(19.9, abs=0.5)


def test_no_estimate_without_heating() -> None:
    assert indoor_humidity(12.0, 19.0, 21.0) is None
    assert indoor_humidity(5.0, 17.9, 21.0) == pytest.approx(35.1, abs=0.5)


def test_estimates_stay_within_believable_limits() -> None:
    assert indoor_humidity(-30.0, -25.0, 22.0) == 15.0
    assert indoor_humidity(17.0, 17.0, 21.0) == 77.9
    assert indoor_humidity(20.0, 10.0, 21.0) == 80.0
