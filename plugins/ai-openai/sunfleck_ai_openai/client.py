"""Calling an OpenAI-compatible chat completions API (POST {base}/chat/completions).

The answer is asked for as JSON that matches the task's schema (`response_format` of type
`json_schema`). Servers that don't support that (older Ollama, some others) are asked again for
plain JSON, with the schema in the instructions. Sunfleck checks the answer against the schema
either way.
"""

import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from sunfleck.plugins import AiAnswer, AiTask

logger = logging.getLogger(__name__)

# Models you run yourself can be slow, especially the first time they're loaded.
TIMEOUT_SECONDS = 120


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes


def attribution(model: str) -> str:
    return f"Suggested by AI ({model})" if model else "Suggested by AI"


def post(url: str, body: dict[str, Any], api_key: str) -> Response:
    """Send a JSON POST request; return the status and body, for errors too. Replaced in
    tests."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(  # noqa: S310 - the server the Admin set
        url, data=json.dumps(body).encode(), method="POST", headers=headers
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as answer:  # noqa: S310
            return Response(answer.status, answer.read())
    except urllib.error.HTTPError as exc:
        return Response(exc.code, exc.read())


def complete(task: AiTask, base_url: str, api_key: str, model: str) -> AiAnswer:
    url = base_url.rstrip("/") + "/chat/completions"
    credit = attribution(model)
    request = _request(task, model, structured=True)
    try:
        response = post(url, request, api_key)
        if response.status == 400 and b"response_format" in response.body:
            # The server doesn't do structured output: ask for plain JSON instead.
            response = post(url, _request(task, model, structured=False), api_key)
    except (OSError, TimeoutError) as exc:
        logger.warning("The AI service couldn't be reached: %s", exc)
        return AiAnswer(credit, problem="unavailable")

    if response.status in (401, 403):
        return AiAnswer(credit, problem="invalid_api_key")
    if response.status == 404:
        # The address or the model doesn't exist there.
        return AiAnswer(credit, problem="missing_settings")
    if response.status == 429:
        return AiAnswer(credit, problem="quota_exceeded")
    if response.status != 200:
        logger.warning("The AI service answered HTTP %s: %r", response.status, response.body[:200])
        return AiAnswer(credit, problem="unavailable")
    data = _content(response.body)
    if data is None:
        return AiAnswer(credit, problem="invalid_answer")
    return AiAnswer(credit, data=data)


def _request(task: AiTask, model: str, *, structured: bool) -> dict[str, Any]:
    instructions = task.instructions
    if structured:
        response_format: dict[str, Any] = {
            "type": "json_schema",
            "json_schema": {"name": task.name, "schema": task.schema, "strict": True},
        }
    else:
        instructions += (
            "\n\nAnswer with only a JSON object that matches this JSON Schema:\n"
            + json.dumps(task.schema)
        )
        response_format = {"type": "json_object"}
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": instructions},
            {"role": "user", "content": task.prompt},
        ],
        "response_format": response_format,
        # Facts rather than creativity.
        "temperature": 0.2,
    }


def _content(body: bytes) -> dict[str, Any] | None:
    """The JSON object in the first choice's message, or None if there isn't one."""
    try:
        text = json.loads(body)["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        return None
    if not isinstance(text, str):
        return None
    text = text.strip()
    # Some models wrap JSON in a Markdown code block anyway.
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None
