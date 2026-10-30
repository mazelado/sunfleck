"""AI for Sunfleck through any OpenAI-compatible chat completions API, a built-in plugin.

That's OpenAI itself, and models you run yourself with Ollama or LM Studio (nothing leaves
your network then), or other services that offer the same API. Sunfleck only asks when you
ask it to, e.g. to suggest a care profile for a plant.
"""

from pydantic import BaseModel, Field, SecretStr
from sunfleck.plugins import PluginInfo


class Settings(BaseModel):
    base_url: str = Field(
        default="https://api.openai.com/v1",
        title="Server address",
        description=(
            "OpenAI: https://api.openai.com/v1. Ollama: http://<computer>:11434/v1. "
            "LM Studio: http://<computer>:1234/v1."
        ),
    )
    model: str = Field(
        default="",
        title="Model",
        description="e.g. gpt-4.1-mini on OpenAI, or the name of a model you pulled in Ollama.",
    )
    api_key: SecretStr = Field(
        default=SecretStr(""),
        title="API key",
        description="Needed for OpenAI and most hosted services. Leave empty for Ollama.",
    )


plugin = PluginInfo(
    id="ai_openai",
    name="AI (OpenAI-compatible)",
    version="0.1.0",
    api_version="1",
    description=(
        "Suggestions from an AI model, through OpenAI or any service with the same API, "
        "including models you run yourself with Ollama or LM Studio. Only used when you ask."
    ),
    hooks="sunfleck_ai_openai.hooks",
    settings_schema=Settings,
    sends_data_to=(
        "The server you set (OpenAI by default): what Sunfleck asks, such as a plant's "
        "species and where it grows when suggesting a care profile, and the API key; only "
        "when you ask for a suggestion",
    ),
)
