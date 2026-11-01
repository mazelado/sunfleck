"""The plugin's hooks: answering Sunfleck's questions through the chat completions API."""

from sunfleck.plugins import AiAnswer, AiTask, SettingsCheck, hookimpl

from sunfleck_ai_openai import Settings, client

# The smallest question that still checks the address, the model, the key and JSON answers.
CHECK = AiTask(
    name="check",
    instructions="Answer only with JSON.",
    prompt='Answer {"ok": true}.',
    schema={
        "type": "object",
        "properties": {"ok": {"type": "boolean"}},
        "required": ["ok"],
        "additionalProperties": False,
    },
)


@hookimpl
def complete_json(task: AiTask, settings: Settings) -> AiAnswer:
    model = settings.model.strip()
    if not model or not settings.base_url.strip():
        return AiAnswer(client.attribution(model), problem="missing_settings")
    return client.complete(
        task, settings.base_url.strip(), settings.api_key.get_secret_value().strip(), model
    )


@hookimpl
def check_settings(settings: Settings) -> SettingsCheck:
    model = settings.model.strip()
    base_url = settings.base_url.strip()
    if not model or not base_url:
        return SettingsCheck("missing_settings", "Set the server address and the model.")
    answer = complete_json(CHECK, settings)
    if answer.problem is not None:
        return SettingsCheck(answer.problem, _problem_details(answer.problem, base_url, model))
    if answer.data is None or answer.data.get("ok") is not True:
        return SettingsCheck(
            "invalid_answer", f"{model} answered, but not as asked. Try another model."
        )
    return SettingsCheck(details=f"{model} answered, at {base_url}.")


def _problem_details(problem: str, base_url: str, model: str) -> str:
    return {
        "missing_settings": (
            f"{base_url} has no model called {model}, or isn't the server's address (it "
            "usually ends in /v1)."
        ),
        "invalid_api_key": "The server refused the API key.",
        "quota_exceeded": "The server says the account's quota or rate limit is used up.",
        "unavailable": (
            f"{base_url} couldn't be reached, or answered with an error. With Docker, use the "
            "address of the computer running the model, not localhost."
        ),
        "invalid_answer": f"{model} answered, but not with JSON. Try another model.",
    }.get(problem, "")
