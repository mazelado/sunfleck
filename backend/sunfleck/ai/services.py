"""Asking the household's AI plugin, and checking its answer.

The first enabled plugin that implements `complete_json` answers. Its answer is checked against
the task's JSON Schema here, whatever the plugin did, so a model that answers something else
can't put it into the household's data.
"""

from jsonschema import Draft202012Validator

from sunfleck.accounts.models import Household
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import AiAnswer, AiTask

HOOK = "complete_json"


def available(household: Household) -> bool:
    """Whether an AI plugin is on for the household."""
    implementers = registry.implementers(HOOK)
    if not implementers:
        return False
    return any(state.enabled for state in plugin_services.states(household, implementers).values())


def ask(household: Household, task: AiTask) -> AiAnswer | None:
    """The household's AI plugin's answer to `task`, or None if no AI plugin is on (or it
    failed: the error is recorded for the Admin, as for any plugin)."""
    for answer in registry.call(HOOK, household, AiAnswer, task=task):
        result: AiAnswer = answer.result
        if result.data is not None and not _matches(task, result):
            return AiAnswer(result.attribution, problem="invalid_answer")
        return result
    return None


def _matches(task: AiTask, answer: AiAnswer) -> bool:
    return Draft202012Validator(task.schema).is_valid(answer.data)
