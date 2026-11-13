"""Only one AI plugin is asked (security review 1.0, S5)."""

from collections.abc import Iterator

import pytest

from sunfleck.accounts.models import Household
from sunfleck.ai import services as ai
from sunfleck.plugins import AiAnswer, AiTask, PluginInfo, hookimpl
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry

pytestmark = pytest.mark.django_db

TASK = AiTask(
    name="note",
    instructions="Answer briefly.",
    prompt="PRIVATE NOTES about the plant",
    schema={"type": "object", "properties": {"answer": {"type": "string"}}},
)


class Model:
    """A fake AI plugin that records what it was asked, and answers or fails."""

    def __init__(self, name: str, *, fails: bool = False) -> None:
        self.name = name
        self.fails = fails
        self.prompts: list[str] = []

    @hookimpl
    def complete_json(self, task: AiTask) -> AiAnswer:
        self.prompts.append(task.prompt)
        if self.fails:
            raise ConnectionError("the service is down")
        return AiAnswer(self.name, data={"answer": "Water it."})


@pytest.fixture
def models(household: Household) -> Iterator[tuple[Model, Model]]:
    first, second = Model("First"), Model("Second")
    for plugin_id, hooks in (("first_ai", first), ("second_ai", second)):
        registry.add(PluginInfo(plugin_id, plugin_id, "1", "1"), hooks)
        plugin_services.update(household, plugin_id, True, {})
    yield first, second
    for plugin_id in ("first_ai", "second_ai"):
        registry.remove(plugin_id)


def test_only_the_first_ai_plugin_is_asked(
    household: Household, models: tuple[Model, Model]
) -> None:
    first, second = models

    answer = ai.ask(household, TASK)

    assert answer is not None
    assert answer.attribution == "First"
    assert first.prompts == ["PRIVATE NOTES about the plant"]
    assert second.prompts == []


def test_the_next_ai_plugin_is_asked_when_the_first_fails(
    household: Household, models: tuple[Model, Model]
) -> None:
    first, second = models
    first.fails = True

    answer = ai.ask(household, TASK)

    assert answer is not None
    assert answer.attribution == "Second"
    assert (len(first.prompts), len(second.prompts)) == (1, 1)
    # The failure is shown to the Admin, as for any plugin.
    assert plugin_services.states(household, ["first_ai"])["first_ai"].last_error
