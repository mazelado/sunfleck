import dataclasses
import json
from typing import Any

import anthropic
import httpx2
import pytest
from pydantic import SecretStr
from sunfleck.accounts.models import Household
from sunfleck.ai import services as ai
from sunfleck.plugins import AiAnswer, AiImage, AiTask, SettingsCheck
from sunfleck.plugins import services as plugin_services

from sunfleck_ai_anthropic import Settings, client, hooks

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


def message(
    text: str, *, model: str = "claude-sonnet-5-5", stop: str = "end_turn"
) -> dict[str, Any]:
    return {
        "id": "msg_1",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop,
        "stop_sequence": None,
        "usage": {"input_tokens": 20, "output_tokens": 8},
    }


def error(status: int, kind: str, text: str = "Nope") -> httpx2.Response:
    return httpx2.Response(status, json={"type": "error", "error": {"type": kind, "message": text}})


class FakeApi:
    """Stands in for api.anthropic.com: answers each request with the next of `responses`,
    through the SDK's own client, so its request and error handling are exercised too."""

    def __init__(self) -> None:
        self.responses: list[httpx2.Response | Exception] = []
        self.requests: list[httpx2.Request] = []

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def client(self, api_key: str) -> anthropic.Anthropic:
        return anthropic.Anthropic(
            api_key=api_key,
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(self.handle)),
        )

    def body(self, index: int = 0) -> dict[str, Any]:
        body: dict[str, Any] = json.loads(self.requests[index].content)
        return body


@pytest.fixture
def api(monkeypatch: pytest.MonkeyPatch) -> FakeApi:
    fake = FakeApi()
    monkeypatch.setattr(client, "new_client", fake.client)
    # Each test starts without remembered refusals.
    monkeypatch.setattr(client, "_refused", {})
    return fake


def test_it_asks_claude_for_json_in_the_tasks_shape(api: FakeApi) -> None:
    api.responses = [httpx2.Response(200, json=message('{"greeting": "Hello, Ada!"}'))]

    answer = client.complete(TASK, "sk-ant-test", "claude-sonnet-5-5")

    assert answer == AiAnswer(
        "Suggested by AI (claude-sonnet-5-5)", data={"greeting": "Hello, Ada!"}
    )
    [request] = api.requests
    assert request.url == "https://api.anthropic.com/v1/messages?beta=true"
    assert request.headers["authorization"] == "Bearer sk-ant-test"
    assert "server-side-fallback-2026-07-01" in request.headers["anthropic-beta"]
    assert api.body() == {
        "model": "claude-sonnet-5-5",
        "max_tokens": 16_000,
        "system": "Greet the gardener.",
        "messages": [{"role": "user", "content": "Say hello to Ada."}],
        "output_config": {
            "format": {"type": "json_schema", "schema": TASK.schema},
            "effort": "low",
        },
        "fallbacks": "default",
    }


def test_the_model_that_answered_is_credited(api: FakeApi) -> None:
    # A declined request answered by the fallback model.
    api.responses = [
        httpx2.Response(200, json=message('{"greeting": "Hi"}', model="claude-sonnet-5"))
    ]

    answer = client.complete(TASK, "sk-ant-test", "claude-sonnet-5-5")

    assert answer.attribution == "Suggested by AI (claude-sonnet-5)"


@pytest.mark.parametrize("model", ["claude-fable-5-2", "claude-haiku-5-5", "claude-next-6"])
def test_a_model_the_plugin_doesnt_know_still_gets_effort_and_fallbacks(
    api: FakeApi, model: str
) -> None:
    api.responses = [httpx2.Response(200, json=message('{"greeting": "Hi"}', model=model))]

    client.complete(TASK, "sk-ant-test", model)

    assert api.body()["output_config"]["effort"] == "low"
    assert api.body()["fallbacks"] == "default"


def test_a_model_that_refuses_fallbacks_is_asked_again_without_them(api: FakeApi) -> None:
    refused = error(400, "invalid_request_error", '"fallbacks" is not supported for this model.')
    api.responses = [
        refused,
        httpx2.Response(200, json=message('{"greeting": "Hi"}')),
        httpx2.Response(200, json=message('{"greeting": "Hi again"}')),
    ]

    first = client.complete(TASK, "sk-ant-test", "claude-fable-5")
    second = client.complete(TASK, "sk-ant-test", "claude-fable-5")

    assert (first.data, second.data) == ({"greeting": "Hi"}, {"greeting": "Hi again"})
    assert "fallbacks" in api.body(0)
    # Asked again without them, and from then on without them, with effort still.
    for index in (1, 2):
        assert "fallbacks" not in api.body(index)
        assert "anthropic-beta" not in api.requests[index].headers
        assert api.body(index)["output_config"]["effort"] == "low"


def test_an_older_model_that_refuses_both_is_asked_with_neither(api: FakeApi) -> None:
    api.responses = [
        error(400, "invalid_request_error", "output_config.effort: not supported for this model"),
        error(400, "invalid_request_error", "fallbacks: Extra inputs are not allowed"),
        httpx2.Response(200, json=message('{"greeting": "Hi"}')),
    ]

    answer = client.complete(TASK, "sk-ant-test", "claude-haiku-4-5")

    assert answer.data == {"greeting": "Hi"}
    assert "effort" not in api.body(2)["output_config"]
    assert "fallbacks" not in api.body(2)


def test_a_refusal_naming_nothing_it_can_drop_is_reported_once(api: FakeApi) -> None:
    api.responses = [error(400, "invalid_request_error", "messages: too long")]

    assert client.complete(TASK, "sk-ant-test", "claude-sonnet-5-5").problem == "unavailable"
    assert len(api.requests) == 1


@pytest.mark.parametrize(
    ("response", "problem"),
    [
        (error(401, "authentication_error"), "invalid_api_key"),
        (error(403, "permission_error"), "invalid_api_key"),
        (error(404, "not_found_error", "model: claude-nonsense"), "missing_settings"),
        (error(429, "rate_limit_error"), "quota_exceeded"),
        (
            error(
                400, "invalid_request_error", "Your credit balance is too low to access the API."
            ),
            "quota_exceeded",
        ),
        (error(400, "invalid_request_error", "Something else"), "unavailable"),
        (error(529, "overloaded_error"), "unavailable"),
        (error(500, "api_error"), "unavailable"),
        (httpx2.ConnectError("Name or service not known"), "unavailable"),
        (httpx2.Response(200, json=message("Hello, Ada!")), "invalid_answer"),
        (httpx2.Response(200, json=message('["a list"]')), "invalid_answer"),
        (
            httpx2.Response(200, json=message('{"greeting": "Hel', stop="max_tokens")),
            "invalid_answer",
        ),
        (httpx2.Response(200, json=message("", stop="refusal")), "invalid_answer"),
    ],
)
def test_problems_are_reported(
    api: FakeApi, response: httpx2.Response | Exception, problem: str
) -> None:
    api.responses = [response]

    assert client.complete(TASK, "sk-ant-test", "claude-sonnet-5-5").problem == problem


def turn_on(household: Household, **settings: Any) -> None:
    plugin_services.update(household, "ai_anthropic", True, settings)


@pytest.mark.django_db
def test_sunfleck_asks_it_once_turned_on(api: FakeApi, household: Household) -> None:
    assert not ai.available(household)
    api.responses = [httpx2.Response(200, json=message('{"greeting": "Hello, Ada!"}'))]

    turn_on(household, api_key="sk-ant-test")

    assert ai.available(household)
    answer = ai.ask(household, TASK)
    assert answer is not None
    assert answer.data == {"greeting": "Hello, Ada!"}
    # Claude Sonnet by default.
    assert api.body()["model"] == "claude-sonnet-5-5"


@pytest.mark.django_db
def test_it_needs_an_api_key(api: FakeApi, household: Household) -> None:
    turn_on(household)

    answer = ai.ask(household, TASK)

    assert answer is not None
    assert answer.problem == "missing_settings"
    assert api.requests == []


def test_testing_asks_claude_a_tiny_question(api: FakeApi) -> None:
    api.responses = [httpx2.Response(200, json=message('{"ok": true}'))]

    check = hooks.check_settings(Settings(api_key=SecretStr("sk-ant-test")))

    assert check == SettingsCheck(details="claude-sonnet-5-5 answered.")


@pytest.mark.parametrize(
    ("response", "problem", "says"),
    [
        (error(401, "authentication_error"), "invalid_api_key", "refused the API key"),
        (error(404, "not_found_error"), "missing_settings", "no model called claude-sonnet-5-5"),
        (error(429, "rate_limit_error"), "quota_exceeded", "credit balance"),
        (httpx2.ConnectError("down"), "unavailable", "api.anthropic.com"),
        (httpx2.Response(200, json=message('{"ok": false}')), "invalid_answer", "not as asked"),
    ],
)
def test_testing_says_what_went_wrong(
    api: FakeApi, response: httpx2.Response | Exception, problem: str, says: str
) -> None:
    api.responses = [response]

    check = hooks.check_settings(Settings(api_key=SecretStr("sk-ant-test")))

    assert check.problem == problem
    assert says in check.details


def test_testing_without_a_key_asks_for_one(api: FakeApi) -> None:
    check = hooks.check_settings(Settings())

    assert check.problem == "missing_settings"
    assert api.requests == []


def test_photos_go_before_the_question_with_more_thought(api: FakeApi) -> None:
    api.responses = [httpx2.Response(200, json=message('{"greeting": "Hi"}'))]
    task = dataclasses.replace(TASK, images=(AiImage("image/jpeg", b"\xff\xd8photo"),))

    client.complete(task, "sk-ant-test", "claude-sonnet-5-5")

    body = api.body()
    assert body["messages"] == [
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": "/9hwaG90bw==",
                    },
                },
                {"type": "text", "text": "Say hello to Ada."},
            ],
        }
    ]
    assert body["output_config"]["effort"] == "medium"
