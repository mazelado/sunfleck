"""The plugin's hooks: answering Sunfleck's questions through Claude."""

from sunfleck.plugins import AiAnswer, AiTask, SettingsCheck, hookimpl

from sunfleck_ai_anthropic import Settings, client

# The smallest question that still checks the key, the model and JSON answers.
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
    api_key = settings.api_key.get_secret_value().strip()
    if not model or not api_key:
        return AiAnswer(client.attribution(model), problem="missing_settings")
    return client.complete(task, api_key, model)


@hookimpl
def check_settings(settings: Settings) -> SettingsCheck:
    model = settings.model.strip()
    if not model or not settings.api_key.get_secret_value().strip():
        return SettingsCheck("missing_settings", "Set the API key and the model.")
    answer = complete_json(CHECK, settings)
    if answer.problem is not None:
        return SettingsCheck(answer.problem, _problem_details(answer.problem, model))
    if answer.data is None or answer.data.get("ok") is not True:
        return SettingsCheck(
            "invalid_answer", f"{model} answered, but not as asked. Try another model."
        )
    return SettingsCheck(details=f"{model} answered.")


def _problem_details(problem: str, model: str) -> str:
    return {
        "missing_settings": (
            f"There's no model called {model}. Model names look like claude-sonnet-5-5."
        ),
        "invalid_api_key": "Anthropic refused the API key.",
        "quota_exceeded": (
            "The account's rate limit is reached, or its credit balance is too low "
            "(console.anthropic.com, under Billing)."
        ),
        "unavailable": (
            "Anthropic's API couldn't be reached, or answered with an error. Check that "
            "Sunfleck can reach api.anthropic.com, and try again in a minute."
        ),
        "invalid_answer": f"{model} answered, but not as asked. Try again, or another model.",
    }.get(problem, "")
