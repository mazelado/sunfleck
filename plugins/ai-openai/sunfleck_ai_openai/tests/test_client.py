import json
from typing import Any

import pytest
from sunfleck.accounts.models import Household
from sunfleck.ai import services as ai
from sunfleck.plugins import AiAnswer, AiTask, SettingsCheck
from sunfleck.plugins import services as plugin_services

from sunfleck_ai_openai import Settings, client, hooks

TASK = AiTask(
    name="greeting",
    instructions="Greet the gardener.",
    prompt="Say hello to Ada.",
    schema={
        "type": "object",
        "properties": {"greeting": {"type": "string"}},
        "required": ["greeting"],
        "additionalProperties": False,
    },
)


def completion(content: str) -> bytes:
    return json.dumps(
        {"choices": [{"message": {"role": "assistant", "content": content}}]}
    ).encode()


class FakeServer:
    """Stands in for the API: answers each request with the next of `responses`."""

    def __init__(self, *responses: client.Response | Exception) -> None:
        self.responses = list(responses)
        self.requests: list[tuple[str, dict[str, Any], str]] = []

    def __call__(self, url: str, body: dict[str, Any], api_key: str) -> client.Response:
        self.requests.append((url, body, api_key))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@pytest.fixture
def server(monkeypatch: pytest.MonkeyPatch) -> FakeServer:
    fake = FakeServer()
    monkeypatch.setattr(client, "post", fake)
    return fake


def ok(content: str) -> client.Response:
    return client.Response(200, completion(content))


def test_it_asks_for_json_in_the_tasks_shape(server: FakeServer) -> None:
    server.responses = [ok('{"greeting": "Hello, Ada!"}')]

    answer = client.complete(TASK, "https://api.openai.com/v1/", "sk-test", "gpt-4.1-mini")

    assert answer == AiAnswer("Suggested by AI (gpt-4.1-mini)", data={"greeting": "Hello, Ada!"})
    [(url, body, key)] = server.requests
    assert url == "https://api.openai.com/v1/chat/completions"
    assert key == "sk-test"
    assert body["model"] == "gpt-4.1-mini"
    assert body["messages"] == [
        {"role": "system", "content": "Greet the gardener."},
        {"role": "user", "content": "Say hello to Ada."},
    ]
    assert body["response_format"] == {
        "type": "json_schema",
        "json_schema": {"name": "greeting", "schema": TASK.schema, "strict": True},
    }


def test_servers_without_structured_output_are_asked_for_plain_json(server: FakeServer) -> None:
    server.responses = [
        client.Response(400, b'{"error": "unknown response_format type json_schema"}'),
        ok('```json\n{"greeting": "Hi"}\n```'),
    ]

    answer = client.complete(TASK, "http://ollama:11434/v1", "", "qwen2.5:7b")

    assert answer.data == {"greeting": "Hi"}
    second = server.requests[1][1]
    assert second["response_format"] == {"type": "json_object"}
    assert '"greeting"' in second["messages"][0]["content"]  # the schema, in the instructions


@pytest.mark.parametrize(
    ("response", "problem"),
    [
        (client.Response(401, b"{}"), "invalid_api_key"),
        (client.Response(404, b'{"error": "model not found"}'), "missing_settings"),
        (client.Response(429, b"{}"), "quota_exceeded"),
        (client.Response(503, b"{}"), "unavailable"),
        (OSError("Connection refused"), "unavailable"),
        (ok("Sorry, I can't help with that."), "invalid_answer"),
        (ok("[1, 2, 3]"), "invalid_answer"),
        (client.Response(200, b"{}"), "invalid_answer"),
    ],
)
def test_problems_are_reported(
    server: FakeServer, response: client.Response | Exception, problem: str
) -> None:
    server.responses = [response]

    assert client.complete(TASK, "https://api.openai.com/v1", "sk", "m").problem == problem


# --- Through Sunfleck -------------------------------------------------------------------------


def turn_on(household: Household, **settings: Any) -> None:
    plugin_services.update(household, "ai_openai", True, settings)


@pytest.mark.django_db
def test_sunfleck_asks_it_once_turned_on(server: FakeServer, household: Household) -> None:
    assert not ai.available(household)
    assert ai.ask(household, TASK) is None

    turn_on(household, base_url="http://ollama:11434/v1", model="llama3.1")
    server.responses = [ok('{"greeting": "Hello"}')]

    assert ai.available(household)
    answer = ai.ask(household, TASK)
    assert answer is not None
    assert answer.data == {"greeting": "Hello"}


@pytest.mark.django_db
def test_it_needs_a_model(server: FakeServer, household: Household) -> None:
    turn_on(household)

    answer = ai.ask(household, TASK)

    assert answer is not None
    assert answer.problem == "missing_settings"
    assert server.requests == []


@pytest.mark.django_db
def test_answers_of_the_wrong_shape_are_refused(server: FakeServer, household: Household) -> None:
    turn_on(household, model="gpt-4.1-mini", api_key="sk-test")
    server.responses = [ok('{"greeting": 42}')]

    answer = ai.ask(household, TASK)

    assert answer == AiAnswer("Suggested by AI (gpt-4.1-mini)", problem="invalid_answer")


# --- Testing the settings ---------------------------------------------------------------------


def settings(**values: Any) -> Settings:
    return Settings.model_validate(
        {"base_url": "http://ollama:11434/v1", "model": "llama3.1", **values}
    )


def test_testing_asks_the_model_a_tiny_question(server: FakeServer) -> None:
    server.responses = [ok('{"ok": true}')]

    found = hooks.check_settings(settings())

    assert found == SettingsCheck(details="llama3.1 answered, at http://ollama:11434/v1.")
    [(url, body, _)] = server.requests
    assert url == "http://ollama:11434/v1/chat/completions"
    assert body["model"] == "llama3.1"


@pytest.mark.parametrize(
    ("response", "problem", "says"),
    [
        (client.Response(404, b"model not found"), "missing_settings", "no model called"),
        (client.Response(401, b"bad key"), "invalid_api_key", "refused the API key"),
        (OSError("connection refused"), "unavailable", "not localhost"),
        (ok('{"ok": false}'), "invalid_answer", "not as asked"),
        (ok("I'm sorry, I can't do that."), "invalid_answer", "not with JSON"),
    ],
)
def test_testing_says_what_went_wrong(
    server: FakeServer, response: client.Response | Exception, problem: str, says: str
) -> None:
    server.responses = [response]

    found = hooks.check_settings(settings())

    assert found.problem == problem
    assert says in found.details


def test_testing_without_a_model_asks_for_one(server: FakeServer) -> None:
    found = hooks.check_settings(settings(model=" "))

    assert found.problem == "missing_settings"
    assert server.requests == []
