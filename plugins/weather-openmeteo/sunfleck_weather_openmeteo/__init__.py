"""Weather for Sunfleck from Open-Meteo (https://open-meteo.com), a built-in plugin.

Shows each site's weather on the Today page, warns about frost, and puts outdoor watering off
after rain (or when rain is coming), and adjusts it for the outdoor temperature.
"""

from pydantic import BaseModel, Field
from sunfleck.plugins import PluginInfo


class Settings(BaseModel):
    frost_c: float = Field(
        default=2.0,
        ge=-10,
        le=10,
        title="Frost warning below (°C)",
        description="Warn when the night's low is forecast at or below this.",
    )
    rain_mm: float = Field(
        default=5.0,
        ge=1,
        le=50,
        title="Rain that waters outdoor plants (mm)",
        description="Put outdoor watering off for two days after this much rain.",
    )
    wait_for_rain: bool = Field(
        default=True,
        title="Wait for forecast rain",
        description="Put outdoor watering off when that much rain is forecast for tomorrow.",
    )


plugin = PluginInfo(
    id="weather_openmeteo",
    name="Weather (Open-Meteo)",
    version="0.1.0",
    api_version="1",
    description=(
        "Each site's weather on the Today page, frost warnings, and outdoor watering that "
        "follows the rain and the temperature. Weather data by Open-Meteo.com (CC BY 4.0)."
    ),
    django_app="sunfleck_weather_openmeteo",
    hooks="sunfleck_weather_openmeteo.hooks",
    settings_schema=Settings,
    sends_data_to=(
        "api.open-meteo.com: each site's location, rounded to about 1 km, every few hours",
    ),
)
