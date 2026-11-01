"""Plant identification for Sunfleck by Pl@ntNet (https://plantnet.org), a built-in plugin.

Identifies a plant from photos when adding it, through the Pl@ntNet API. It needs a free API
key from https://my.plantnet.org, which allows 500 identifications a day.
"""

from pydantic import BaseModel, Field, SecretStr
from sunfleck.plugins import PluginInfo


class Settings(BaseModel):
    api_key: SecretStr = Field(
        default=SecretStr(""),
        title="API key",
        description="Free at my.plantnet.org (500 identifications a day).",
    )


plugin = PluginInfo(
    id="identify_plantnet",
    name="Plant identification (Pl@ntNet)",
    version="0.1.0",
    api_version="1",
    description=(
        "Identify a plant from a photo when adding it. Needs a free API key from "
        "my.plantnet.org. Identification by Pl@ntNet."
    ),
    hooks="sunfleck_identify_plantnet.hooks",
    settings_schema=Settings,
    sends_data_to=(
        "my-api.plantnet.org: the photos you choose to identify (without where they were "
        "taken), your language, and the API key; only when you ask for an identification (testing "
        "the plugin sends a blank image)",
    ),
)
