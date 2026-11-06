"""Calling Anthropic's Messages API with the official SDK.

The answer is asked for as JSON that matches the task's schema (structured outputs:
`output_config.format`); Sunfleck checks it against the schema again. On the current models,
a request a safety classifier declines is retried on Anthropic's recommended fallback model
(`fallbacks: "default"`).
"""

import json
import logging
from collections.abc import Mapping
from typing import Any

import anthropic
from sunfleck.plugins import AiAnswer, AiTask

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 120
# Enough for any of Sunfleck's JSON answers; it's a ceiling, not what's used.
MAX_TOKENS = 4096
FALLBACK_BETA = "server-side-fallback-2026-07-01"
# Models that take `effort` and `fallbacks: "default"`. Others (older ones someone sets) are
# asked without them, so they still work.
CURRENT_MODELS = frozenset(
    {"claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-fable-5"}
)
# Claude Haiku 5.5 takes `effort`, but has no server-side fallback.
EFFORT_MODELS = CURRENT_MODELS | {"claude-haiku-5-5"}


def attribution(model: str) -> str:
    return f"Suggested by AI ({model})" if model else "Suggested by AI"


def new_client(api_key: str) -> anthropic.Anthropic:
    """The SDK's client. Replaced in tests, to answer without the network."""
    return anthropic.Anthropic(api_key=api_key, timeout=TIMEOUT_SECONDS, max_retries=2)


def request(task: AiTask, model: str) -> dict[str, Any]:
    output_config: dict[str, Any] = {
        "format": {"type": "json_schema", "schema": _plain(task.schema)}
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": task.instructions,
        "messages": [{"role": "user", "content": task.prompt}],
        "output_config": output_config,
    }
    if model in EFFORT_MODELS:
        # Sunfleck's questions are short and well-defined: little thinking is needed.
        output_config["effort"] = "low"
    if model in CURRENT_MODELS:
        body["betas"] = [FALLBACK_BETA]
        body["fallbacks"] = "default"
    return body


def complete(task: AiTask, api_key: str, model: str) -> AiAnswer:
    credit = attribution(model)
    try:
        message = new_client(api_key).beta.messages.create(**request(task, model))
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError):
        return AiAnswer(credit, problem="invalid_api_key")
    except anthropic.NotFoundError:
        # No such model.
        return AiAnswer(credit, problem="missing_settings")
    except anthropic.RateLimitError:
        return AiAnswer(credit, problem="quota_exceeded")
    except anthropic.BadRequestError as exc:
        if "credit balance" in str(exc.message).lower():
            return AiAnswer(credit, problem="quota_exceeded")
        logger.warning("Claude refused the request: %s", exc.message)
        return AiAnswer(credit, problem="unavailable")
    except anthropic.APIStatusError as exc:
        # 5xx, and 529 when the API is overloaded (already retried).
        logger.warning("Claude answered HTTP %s", exc.status_code)
        return AiAnswer(credit, problem="unavailable")
    except anthropic.APIConnectionError as exc:  # also timeouts
        logger.warning("Claude couldn't be reached: %s", exc)
        return AiAnswer(credit, problem="unavailable")

    if message.stop_reason != "end_turn":
        # "refusal" (declined, also by the fallback model), or "max_tokens".
        logger.warning("Claude stopped without an answer: %s", message.stop_reason)
        return AiAnswer(credit, problem="invalid_answer")
    text = next((block.text for block in message.content if block.type == "text"), None)
    data = _json_object(text)
    if data is None:
        return AiAnswer(credit, problem="invalid_answer")
    # The model that answered, which differs from the one set after a fallback.
    return AiAnswer(attribution(message.model), data=data)


def _json_object(text: str | None) -> dict[str, Any] | None:
    if text is None:
        return None
    try:
        data = json.loads(text)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _plain(value: Any) -> Any:
    """A schema as plain dicts and lists (tasks may hold read-only mappings)."""
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_plain(item) for item in value]
    return value
