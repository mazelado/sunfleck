import json
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.plugins import AiAnswer, AiTask, PluginInfo, hookimpl, services
from sunfleck.plugins.registry import registry
from sunfleck.taxonomy.models import Taxon

ClientAs = Callable[[Role], Client]
URL = "/api/v1/care-profile-suggestions"

pytestmark = pytest.mark.django_db


class Thinker:
    """A fake AI plugin that answers what it's told and remembers what it was asked."""

    def __init__(self) -> None:
        self.answer: AiAnswer = AiAnswer(
            "Suggested by AI (test)",
            data={
                "profile_key": "epiphytic_orchid",
                "confidence": "medium",
                "reason": "Hoyas grow on trees, like orchids, and like to dry out a little.",
            },
        )
        self.seen: list[AiTask] = []

    @hookimpl
    def complete_json(self, task: AiTask) -> AiAnswer:
        self.seen.append(task)
        return self.answer


@pytest.fixture
def thinker(household: Household) -> Iterator[Thinker]:
    hooks = Thinker()
    registry.add(PluginInfo("thinker", "Thinker", "1", "1"), hooks)
    services.update(household, "thinker", True, {})
    yield hooks
    registry.remove("thinker")


def ask(client: Client, **data: Any) -> Any:
    return client.post(URL, json.dumps(data), content_type="application/json")


def test_only_with_an_ai_plugin_on(client_as: ClientAs) -> None:
    gardener = client_as(Role.GARDENER)

    assert gardener.get(URL).json() == {"available": False}
    response = ask(gardener, name="Wax plant")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "suggestion_unavailable"


def test_the_ai_chooses_among_the_built_in_profiles(client_as: ClientAs, thinker: Thinker) -> None:
    gardener = client_as(Role.GARDENER)
    hoya = Taxon.objects.filter(scientific_name__startswith="Hoya").first()

    assert gardener.get(URL).json() == {"available": True}
    response = ask(gardener, name="Wax plant", taxon_id=hoya.pk if hoya else None, indoor=True)

    assert response.status_code == 200
    assert response.json() == {
        "profile": {"key": "epiphytic_orchid", "name": "Epiphytic orchid"},
        "confidence": "medium",
        "reason": "Hoyas grow on trees, like orchids, and like to dry out a little.",
        "attribution": "Suggested by AI (test)",
    }
    [task] = thinker.seen
    assert "The plant: Wax plant" in task.prompt
    assert "It grows indoors." in task.prompt
    assert "- tropical_aroid: Tropical aroid." in task.prompt
    # It can only answer with one of the profiles.
    keys = task.schema["properties"]["profile_key"]["enum"]
    assert "tropical_aroid" in keys
    assert len(keys) == 28


def test_answers_that_arent_a_profile_are_refused(client_as: ClientAs, thinker: Thinker) -> None:
    thinker.answer = AiAnswer(
        "Suggested by AI (test)",
        data={"profile_key": "made_up", "confidence": "high", "reason": "Trust me."},
    )

    response = ask(client_as(Role.GARDENER), name="Wax plant")

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_invalid_answer"


@pytest.mark.parametrize(
    ("problem", "status"),
    [("missing_settings", 502), ("invalid_api_key", 502), ("quota_exceeded", 429)],
)
def test_problems_are_reported(
    client_as: ClientAs, thinker: Thinker, problem: str, status: int
) -> None:
    thinker.answer = AiAnswer("Suggested by AI (test)", problem=problem)

    response = ask(client_as(Role.GARDENER), name="Wax plant")

    assert response.status_code == status
    assert response.json()["error"]["code"] == f"ai_{problem}"


def test_viewers_cant_ask(client_as: ClientAs, thinker: Thinker) -> None:
    assert ask(client_as(Role.VIEWER), name="Wax plant").status_code == 403
    assert thinker.seen == []
