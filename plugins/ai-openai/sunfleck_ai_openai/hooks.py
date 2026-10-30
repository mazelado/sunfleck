"""The plugin's hooks: answering Sunfleck's questions through the chat completions API."""

from sunfleck.plugins import AiAnswer, AiTask, hookimpl

from sunfleck_ai_openai import Settings, client


@hookimpl
def complete_json(task: AiTask, settings: Settings) -> AiAnswer:
    model = settings.model.strip()
    if not model or not settings.base_url.strip():
        return AiAnswer(client.attribution(model), problem="missing_settings")
    return client.complete(
        task, settings.base_url.strip(), settings.api_key.get_secret_value().strip(), model
    )
