"""AI for Sunfleck through Anthropic's Claude API, a built-in plugin.

Sunfleck only asks when you ask it to, e.g. to suggest a care profile for a plant.
"""

from pydantic import BaseModel, Field, SecretStr
from sunfleck.plugins import PluginInfo

DEFAULT_MODEL = "claude-sonnet-5-5"


class Settings(BaseModel):
    api_key: SecretStr = Field(
        default=SecretStr(""),
        title="API key",
        description="From console.anthropic.com, under API keys. Requests are billed to it.",
    )
    model: str = Field(
        default=DEFAULT_MODEL,
        title="Model",
        description=(
            "claude-sonnet-5-5 by default. claude-haiku-5-5 costs less and is quicker; "
            "claude-opus-5-5 is the most capable, and costs more."
        ),
    )


plugin = PluginInfo(
    id="ai_anthropic",
    name="AI (Claude)",
    version="0.1.0",
    api_version="1",
    description=(
        "Suggestions from Anthropic's Claude models, with your own API key. Only used when you ask."
    ),
    hooks="sunfleck_ai_anthropic.hooks",
    settings_schema=Settings,
    sends_data_to=(
        "api.anthropic.com: what Sunfleck asks, such as a plant's species and where it grows "
        "when suggesting a care profile, or a photo of a plant with its care and recent "
        "history when asking what's wrong with it or asking a question about it, and the API "
        "key; only when you ask, or test the plugin",
    ),
)
