"""Sensors from Home Assistant, a built-in plugin.

Plants' soil moisture, and the light, temperature and humidity around them, from the sensors a
household already has in Home Assistant (e.g. a Mi Flora or a Zigbee soil sensor), read
through Home Assistant's REST API.
"""

from urllib.parse import urlsplit

from pydantic import BaseModel, Field, SecretStr, field_validator
from sunfleck.plugins import PluginInfo


class Settings(BaseModel):
    base_url: str = Field(
        default="",
        title="Server address",
        description=(
            "The address you open Home Assistant at, e.g. http://homeassistant.local:8123. "
            "With Docker, not localhost: that's Sunfleck's own container."
        ),
    )
    token: SecretStr = Field(
        default=SecretStr(""),
        title="Access token",
        description=(
            "A long-lived access token. In Home Assistant: your profile (bottom left) → "
            "Security → Long-lived access tokens → Create token. "
            "After changing the server address, enter it again."
        ),
        # Only ever sent to the server it was saved with.
        json_schema_extra={"bound_to": ["base_url"]},
    )

    @field_validator("base_url")
    @classmethod
    def _http(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value:
            return value
        url = urlsplit(value)
        if url.scheme not in ("http", "https") or not url.hostname:
            raise ValueError(
                "Enter an http:// or https:// address, such as http://homeassistant.local:8123."
            )
        return value


plugin = PluginInfo(
    id="homeassistant",
    name="Home Assistant",
    version="0.1.0",
    api_version="1",
    description=(
        "Soil moisture, light, temperature and humidity for your plants, from the sensors "
        "you have in Home Assistant."
    ),
    hooks="sunfleck_homeassistant.hooks",
    settings_schema=Settings,
    sends_data_to=(
        "The Home Assistant server you set: the access token, and the ids of the sensors "
        "being read (e.g. sensor.monstera_soil_moisture), every 15 minutes while a plant "
        "uses one of its sensors, and when someone chooses a sensor or tests the plugin. "
        "Nothing about your plants or household",
    ),
)
