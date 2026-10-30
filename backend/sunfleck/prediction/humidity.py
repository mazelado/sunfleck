"""Estimating indoor humidity from the outdoor weather.

Air that comes in from outside keeps its water vapour as it warms, so indoors the relative
humidity is roughly the outdoor vapour pressure (from the dew point) divided by what air can
hold at the room's temperature. Outdoors at 0 °C and 80 %, heated to 21 °C, that's about 20 %:
why winter air indoors is so dry.

It holds while the heating is on. In warm weather, air conditioning dries the air and
cooking, showers and people add moisture, so there's no estimate then.
"""

import math

# Only estimate when it's at least this much colder outside than in the room (heating).
HEATING_MARGIN_C = 3
# Estimates are kept within this range: rooms are rarely drier or damper than that.
LIMITS = (15.0, 80.0)


def vapour_pressure_hpa(temperature_c: float) -> float:
    """The saturation vapour pressure over water (the Magnus formula)."""
    return 6.112 * math.exp(17.62 * temperature_c / (243.12 + temperature_c))


def indoor_humidity(dew_point_c: float, outdoor_c: float, indoor_c: float) -> float | None:
    """The estimated relative humidity indoors, in %, or None outside the heating season.

    `dew_point_c` and `outdoor_c` are the day's average outdoors; `indoor_c` the room's
    usual temperature.
    """
    if outdoor_c > indoor_c - HEATING_MARGIN_C:
        return None
    percent = 100 * vapour_pressure_hpa(dew_point_c) / vapour_pressure_hpa(indoor_c)
    return round(min(max(percent, LIMITS[0]), LIMITS[1]), 1)
