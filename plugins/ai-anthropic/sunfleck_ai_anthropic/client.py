"""Calling Anthropic's Messages API with the official SDK.

The answer is asked for as JSON that matches the task's schema (structured outputs:
`output_config.format`); Sunfleck checks it against the schema again. A request a safety
classifier declines is retried on Anthropic's recommended fallback model
(`fallbacks: "default"`).

Every model is asked with `effort` and `fallbacks`, rather than only the models on a list,
which would be out of date with the next release. A model that doesn't take one of them
answers 400 naming it: the request is sent again without it, and the model is asked without
it from then on (until Sunfleck restarts).
"""

import base64
import json
import logging
from collections.abc import Mapping
from typing import Any

import anthropic
from sunfleck.plugins import AiAnswer, AiTask

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 120
# A ceiling, not what's used. On the current models thinking can't be turned off, and it
# counts towards it: a diagnosis from a photo can think more than a short answer needs.
MAX_TOKENS = 16_000
FALLBACK_BETA = "server-side-fallback-2026-07-01"
# The options a model refused (it answered 400 naming them), by model: it's asked without them.
OPTIONS = ("effort", "fallbacks")
_refused: dict[str, set[str]] = {}


def attribution(model: str) -> str:
    return f"Suggested by AI ({model})" if model else "Suggested by AI"


def new_client(api_key: str) -> anthropic.Anthropic:
    """The SDK's client. Replaced in tests, to answer without the network."""
    return anthropic.Anthropic(api_key=api_key, timeout=TIMEOUT_SECONDS, max_retries=2)


def request(task: AiTask, model: str, without: frozenset[str] = frozenset()) -> dict[str, Any]:
    """The request for `task`, without the options in `without` (which `model` refused)."""
    output_config: dict[str, Any] = {
        "format": {"type": "json_schema", "schema": _plain(task.schema)}
    }
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": task.instructions,
        "messages": [{"role": "user", "content": _content(task)}],
        "output_config": output_config,
    }
    if "effort" not in without:
        # Sunfleck's questions are short and well-defined: little thinking is needed, except
        # to make sense of a photo.
        output_config["effort"] = "medium" if task.images else "low"
    if "fallbacks" not in without:
        body["betas"] = [FALLBACK_BETA]
        body["fallbacks"] = "default"
    return body


def _refused_option(message: str) -> str | None:
    """The option a 400 says the model doesn't take, e.g. `"fallbacks" is not supported for
    this model.`, if it names one."""
    text = message.lower()
    if "not supported" not in text and "unsupported" not in text and "not allowed" not in text:
        return None
    return next((option for option in OPTIONS if option.rstrip("s") in text), None)


def complete(task: AiTask, api_key: str, model: str) -> AiAnswer:
    credit = attribution(model)
    api = new_client(api_key)
    try:
        while True:
            refused = _refused.setdefault(model, set())
            try:
                message = api.beta.messages.create(**request(task, model, frozenset(refused)))
                break
            except anthropic.BadRequestError as exc:
                option = _refused_option(str(exc.message))
                if option is None or option in refused:
                    raise
                logger.info("%s doesn't take %s: asking without it", model, option)
                refused.add(option)
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
        # "refusal" (declined, also by the fallback model), or "max_tokens" (thought and
        # answered for longer than MAX_TOKENS: the answer is cut off).
        logger.warning(
            "Claude stopped without an answer: %s after %s tokens",
            message.stop_reason,
            message.usage.output_tokens,
        )
        return AiAnswer(credit, problem="invalid_answer")
    text = next((block.text for block in message.content if block.type == "text"), None)
    data = _json_object(text)
    if data is None:
        return AiAnswer(credit, problem="invalid_answer")
    # The model that answered, which differs from the one set after a fallback.
    return AiAnswer(attribution(message.model), data=data)


def _content(task: AiTask) -> str | list[dict[str, Any]]:
    """The question, after its photos if it has any."""
    if not task.images:
        return task.prompt
    blocks: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": image.media_type,
                "data": base64.standard_b64encode(image.data).decode(),
            },
        }
        for image in task.images
    ]
    blocks.append({"type": "text", "text": task.prompt})
    return blocks


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
