"""Diagnosing a plant from a photo, with an AI plugin.

The person takes or picks a photo of the problem and may add a few words; only that photo
(resized, without metadata) and the plant's context are sent, and only when they ask. The
answer is suggestions: likely causes and next steps, which the app labels as such.
"""

from dataclasses import dataclass
from typing import IO, Any

from sunfleck.ai import services as ai
from sunfleck.ai.context import plant_context
from sunfleck.core import images
from sunfleck.plants.models import Plant
from sunfleck.plugins.types import AiImage, AiTask

LIKELIHOODS = ("likely", "possible")
MAX_DESCRIPTION = 1000

INSTRUCTIONS = """You help someone look after a plant. They took a photo of a problem with it,
and may have described it. Using the photo, their words and what's known about the plant and
its care, say what is most likely wrong and what to do.
- Give at most four causes, most likely first. For each, say what in the photo or the plant's
  history points to it. Only call a cause likely when the evidence is clear.
- Give up to six next steps, practical and in the order to do them: what to check first, then
  what to change. Prefer changes to care (watering, light, pot, humidity) over products. If
  you suggest a treatment, say to follow its label and to keep it away from children and pets.
- Set urgent when the plant could be lost within days without action (e.g. rot spreading, a
  fast pest outbreak).
- If the photo doesn't clearly show the plant or the problem, set photo_clear to false, say
  what photo would help, and keep the causes to what the rest suggests.
- Don't diagnose from the photo alone what the care log contradicts; mention it if it does.
Write for someone who isn't a gardener, plainly and briefly, in the language with code
"{language}"."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "maxLength": 500},
        "causes": {
            "type": "array",
            "maxItems": 4,
            "items": {
                "type": "object",
                "properties": {
                    "cause": {"type": "string", "maxLength": 150},
                    "likelihood": {"type": "string", "enum": list(LIKELIHOODS)},
                    "signs": {"type": "string", "maxLength": 400},
                },
                "required": ["cause", "likelihood", "signs"],
                "additionalProperties": False,
            },
        },
        "next_steps": {
            "type": "array",
            "maxItems": 6,
            "items": {"type": "string", "maxLength": 400},
        },
        "urgent": {"type": "boolean"},
        "photo_clear": {"type": "boolean"},
    },
    "required": ["summary", "causes", "next_steps", "urgent", "photo_clear"],
    "additionalProperties": False,
}


class DiagnosisError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Cause:
    cause: str
    likelihood: str
    signs: str


@dataclass(frozen=True)
class Diagnosis:
    summary: str
    causes: list[Cause]
    next_steps: list[str]
    urgent: bool
    photo_clear: bool
    attribution: str


def diagnose(plant: Plant, photo: IO[bytes], description: str, language: str) -> Diagnosis:
    """What an AI thinks is wrong with the plant in the photo, and what to do.

    Raises:
        DiagnosisError: If no AI plugin is on (`diagnosis_unavailable`), the photo isn't
            usable (its image error code), or the AI reported a problem (`ai_` and its code,
            e.g. `ai_unsupported` for a model that can't see photos).
    """
    try:
        jpeg = images.jpeg_for_ai(photo)
    except images.ImageError as exc:
        raise DiagnosisError(exc.code, str(exc)) from exc
    prompt = plant_context(plant)
    words = description.strip()[:MAX_DESCRIPTION]
    prompt += f"\n\nWhat they say: {words}" if words else "\n\nThey didn't describe it."
    task = AiTask(
        name="diagnosis",
        instructions=INSTRUCTIONS.format(language=language),
        prompt=prompt,
        schema=SCHEMA,
        images=(AiImage("image/jpeg", jpeg),),
    )
    answer = ai.ask(plant.household, task)
    if answer is None:
        raise DiagnosisError("diagnosis_unavailable", "No AI plugin is turned on.")
    if answer.problem or answer.data is None:
        code = f"ai_{answer.problem or 'invalid_answer'}"
        raise DiagnosisError(code, f"The AI couldn't diagnose the plant ({code}).")
    data = answer.data
    return Diagnosis(
        summary=str(data["summary"]).strip(),
        causes=[
            Cause(str(c["cause"]).strip(), str(c["likelihood"]), str(c["signs"]).strip())
            for c in data["causes"]
        ],
        next_steps=[str(step).strip() for step in data["next_steps"] if str(step).strip()],
        urgent=bool(data["urgent"]),
        photo_clear=bool(data["photo_clear"]),
        attribution=answer.attribution,
    )
