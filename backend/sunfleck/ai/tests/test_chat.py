import json
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.ai import chat
from sunfleck.ai.models import Conversation, Message
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import AiAnswer, AiTask, PluginInfo, hookimpl, services
from sunfleck.plugins.registry import registry

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


class Gardener:
    """A fake AI plugin that answers in turn and remembers what it was asked."""

    def __init__(self) -> None:
        self.answers: list[AiAnswer] = []
        self.seen: list[AiTask] = []

    def say(self, *texts: str) -> None:
        self.answers = [AiAnswer("Suggested by AI (test)", data={"answer": t}) for t in texts]

    @hookimpl
    def complete_json(self, task: AiTask) -> AiAnswer:
        self.seen.append(task)
        return self.answers.pop(0)


@pytest.fixture
def ai(household: Household) -> Iterator[Gardener]:
    hooks = Gardener()
    registry.add(PluginInfo("gardener", "Gardener", "1", "1"), hooks)
    services.update(household, "gardener", True, {})
    yield hooks
    registry.remove("gardener")


@pytest.fixture
def plant(household: Household) -> Plant:
    room = LocationFactory.create(site__household=household, name="Kitchen", kind="indoor")
    return PlantFactory.create(household=household, nickname="Monty", location=room)


def post(client: Client, url: str, **data: Any) -> Any:
    return client.post(url, json.dumps(data), content_type="application/json")


def test_asking_starts_a_conversation_kept_on_the_plant(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    gardener = client_as(Role.GARDENER)
    ai.say("Every week or so in summer, when the top few cm are dry.")

    response = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question=" How often? ")

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "How often?"
    assert body["plant_id"] == plant.pk
    assert body["can_continue"] is True
    question, answer = body["messages"]
    assert question["role"] == "question"
    assert question["text"] == "How often?"
    assert question["asked_by"] == body["started_by"]
    assert question["asked_by"] is not None
    assert answer == {
        "id": answer["id"],
        "role": "answer",
        "text": "Every week or so in summer, when the top few cm are dry.",
        "asked_by": None,
        "attribution": "Suggested by AI (test)",
        "created_at": answer["created_at"],
    }
    [task] = ai.seen
    assert "The plant: Monty" in task.prompt
    assert "Where: indoors (Kitchen)" in task.prompt
    assert task.prompt.endswith("The question: How often?")
    assert "conversation so far" not in task.prompt
    assert '"en"' in task.instructions


def test_follow_up_questions_send_the_conversation_so_far(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    gardener = client_as(Role.GARDENER)
    ai.say("Weekly.", "Yes, a little less in winter.")
    started = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="How often?")
    conversation_id = started.json()["id"]

    response = post(
        gardener, f"/api/v1/conversations/{conversation_id}/messages", question="Even in winter?"
    )

    assert response.status_code == 200
    texts = [message["text"] for message in response.json()["messages"]]
    assert texts == ["How often?", "Weekly.", "Even in winter?", "Yes, a little less in winter."]
    prompt = ai.seen[1].prompt
    assert "The conversation so far:\nQuestion: How often?\nYour answer: Weekly." in prompt
    assert prompt.endswith("The question: Even in winter?")


def test_the_household_can_read_them_the_latest_first(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    gardener = client_as(Role.GARDENER)
    ai.say("Weekly.", "Bright, indirect light.", "Yes.")
    first = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="How often?")
    post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="Where should it go?")
    post(gardener, f"/api/v1/conversations/{first.json()['id']}/messages", question="Really?")
    viewer = client_as(Role.VIEWER)

    listed = viewer.get(f"/api/v1/plants/{plant.pk}/conversations").json()

    assert [(c["title"], c["questions"]) for c in listed] == [
        ("How often?", 2),
        ("Where should it go?", 1),
    ]
    one = viewer.get(f"/api/v1/conversations/{first.json()['id']}")
    assert one.status_code == 200
    assert len(one.json()["messages"]) == 4


def test_nothing_is_saved_when_the_ai_cant_answer(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    ai.answers = [AiAnswer("Suggested by AI (test)", problem="quota_exceeded")]

    response = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question="Hi?"
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "ai_quota_exceeded"
    assert not Conversation.objects.exists()


@pytest.mark.parametrize(
    ("answer", "code", "status"),
    [
        (AiAnswer("AI", problem="unavailable"), "ai_unavailable", 502),
        (AiAnswer("AI", data={"answer": "   "}), "ai_invalid_answer", 502),
        (AiAnswer("AI", data={"reply": "Hi"}), "ai_invalid_answer", 502),
    ],
)
def test_problems_are_reported(
    client_as: ClientAs, ai: Gardener, plant: Plant, answer: AiAnswer, code: str, status: int
) -> None:
    ai.answers = [answer]

    response = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question="Hi?"
    )

    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_only_with_an_ai_plugin_on(client_as: ClientAs, plant: Plant) -> None:
    response = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question="Hi?"
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "chat_unavailable"


def test_blank_questions_are_refused(client_as: ClientAs, ai: Gardener, plant: Plant) -> None:
    response = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question="   "
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "question_empty"
    assert ai.seen == []


def test_long_conversations_must_start_again(
    client_as: ClientAs, ai: Gardener, plant: Plant, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(chat, "MAX_QUESTIONS", 2)
    gardener = client_as(Role.GARDENER)
    ai.say("One.", "Two.")
    started = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="1?")
    url = f"/api/v1/conversations/{started.json()['id']}/messages"
    assert post(gardener, url, question="2?").json()["can_continue"] is False

    response = post(gardener, url, question="3?")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "conversation_too_long"
    assert len(ai.seen) == 2


def test_only_the_latest_messages_are_sent(
    client_as: ClientAs, ai: Gardener, plant: Plant, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(chat, "SENT_MESSAGES", 2)
    gardener = client_as(Role.GARDENER)
    ai.say("A1.", "A2.", "A3.")
    started = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="Q1?")
    url = f"/api/v1/conversations/{started.json()['id']}/messages"
    post(gardener, url, question="Q2?")
    post(gardener, url, question="Q3?")

    prompt = ai.seen[2].prompt
    assert "Q1?" not in prompt
    assert "Question: Q2?\nYour answer: A2." in prompt


def test_long_first_questions_make_a_short_title(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    ai.say("Probably.")
    question = "Why are the leaves\nturning yellow " + "and curling " * 10

    body = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question=question
    ).json()

    assert len(body["title"]) == chat.TITLE_LENGTH
    assert body["title"].startswith("Why are the leaves turning yellow and curling")
    assert body["title"].endswith("…")


def test_viewers_can_read_but_not_ask_or_delete(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    ai.say("Weekly.")
    started = post(
        client_as(Role.GARDENER), f"/api/v1/plants/{plant.pk}/conversations", question="How?"
    )
    conversation_id = started.json()["id"]
    viewer = client_as(Role.VIEWER)

    assert post(viewer, f"/api/v1/plants/{plant.pk}/conversations", question="Hi").status_code == (
        403
    )
    url = f"/api/v1/conversations/{conversation_id}"
    assert post(viewer, f"{url}/messages", question="Hi").status_code == 403
    assert viewer.delete(url).status_code == 403
    assert len(ai.seen) == 1


def test_gardeners_can_delete_them(client_as: ClientAs, ai: Gardener, plant: Plant) -> None:
    ai.say("Weekly.")
    gardener = client_as(Role.GARDENER)
    started = post(gardener, f"/api/v1/plants/{plant.pk}/conversations", question="How?")
    url = f"/api/v1/conversations/{started.json()['id']}"

    assert gardener.delete(url).status_code == 204

    assert gardener.get(url).status_code == 404
    assert not Message.objects.exists()


def test_other_households_conversations_cant_be_seen(
    client_as: ClientAs, ai: Gardener, plant: Plant
) -> None:
    other = PlantFactory.create()
    conversation = Conversation.objects.create(
        plant=other, title="Secret", updated_at=other.created_at
    )
    gardener = client_as(Role.GARDENER)

    assert gardener.get(f"/api/v1/conversations/{conversation.pk}").status_code == 404
    assert gardener.get(f"/api/v1/plants/{other.pk}/conversations").status_code == 404
    response = post(gardener, f"/api/v1/conversations/{conversation.pk}/messages", question="Hi")
    assert response.status_code == 404
    assert ai.seen == []
