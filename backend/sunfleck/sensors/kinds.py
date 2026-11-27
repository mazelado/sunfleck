"""The kinds of sensor reading Sunfleck knows, and their units.

A kind is a plain string everywhere (plugin hooks, models, the HTTP API), never a fixed list
of choices, so that a kind added later is an addition rather than a change.
"""

# Units: soil moisture and humidity in % (0-100), illuminance in lx, temperature in °C.
SOIL_MOISTURE = "soil_moisture"
ILLUMINANCE = "illuminance"
TEMPERATURE = "temperature"
HUMIDITY = "humidity"

KINDS: tuple[str, ...] = (SOIL_MOISTURE, ILLUMINANCE, TEMPERATURE, HUMIDITY)
