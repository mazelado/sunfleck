"""Suggesting the closest built-in care profile for a plant, with an AI plugin.

For plants whose species has no care profile (or isn't known), the AI chooses among the
built-in profiles and says why. It can only choose one of them: the care itself always comes
from the reviewed dataset, and the person decides whether to use the suggestion.
"""

from dataclasses import dataclass

from sunfleck.accounts.models import Household
from sunfleck.ai import services as ai
from sunfleck.plugins.types import AiTask
from sunfleck.taxonomy.models import FALLBACK_LANGUAGE, CareArchetype, Taxon, translated

CONFIDENCES = ("high", "medium", "low")

INSTRUCTIONS = """You help a plant care app choose a care profile for a plant.
Each care profile describes typical care for a group of plants with similar needs. Choose the
one whose watering, light, humidity and temperature needs best match the plant. Think about
how the plant grows in the wild (for example epiphyte, succulent, rainforest understory, bog,
Mediterranean shrub). If the plant is unknown to you, or several profiles fit equally, say so
with low confidence rather than guessing. Give the reason in one or two short sentences,
written for someone who isn't a gardener, in the language with code "{language}"."""


class SuggestError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Suggestion:
    profile: CareArchetype
    confidence: str
    reason: str
    attribution: str


def available(household: Household) -> bool:
    return ai.available(household)


def suggest(
    household: Household,
    name: str,
    taxon: Taxon | None,
    indoor: bool | None,
    language: str,
) -> Suggestion:
    """The built-in care profile an AI thinks fits the plant best.

    Raises:
        SuggestError: If no AI plugin is on (`suggestion_unavailable`), or it reported a
            problem (`ai_` and its code, e.g. `ai_invalid_api_key`).
    """
    profiles = list(CareArchetype.objects.order_by("key"))
    task = AiTask(
        name="care_profile",
        instructions=INSTRUCTIONS.format(language=language),
        prompt=_prompt(name, taxon, indoor, profiles),
        schema={
            "type": "object",
            "properties": {
                "profile_key": {"type": "string", "enum": [p.key for p in profiles]},
                "confidence": {"type": "string", "enum": list(CONFIDENCES)},
                "reason": {"type": "string", "maxLength": 400},
            },
            "required": ["profile_key", "confidence", "reason"],
            "additionalProperties": False,
        },
    )
    answer = ai.ask(household, task)
    if answer is None:
        raise SuggestError("suggestion_unavailable", "No AI plugin is turned on.")
    if answer.problem or answer.data is None:
        # Codes of their own (ai_…), as the app explains each code in words.
        code = f"ai_{answer.problem or 'invalid_answer'}"
        raise SuggestError(code, f"The AI couldn't suggest a care profile ({code}).")
    profile = next(p for p in profiles if p.key == answer.data["profile_key"])
    return Suggestion(
        profile=profile,
        confidence=str(answer.data["confidence"]),
        reason=str(answer.data["reason"]).strip(),
        attribution=answer.attribution,
    )


def _prompt(
    name: str, taxon: Taxon | None, indoor: bool | None, profiles: list[CareArchetype]
) -> str:
    lines = [f"The plant: {name.strip()}"]
    if taxon is not None:
        lines.append(f"Scientific name: {taxon.scientific_name} (family {taxon.family})")
    if indoor is not None:
        lines.append("It grows indoors." if indoor else "It grows outdoors.")
    lines += ["", "The care profiles to choose from:"]
    for profile in profiles:
        description = translated(profile.profile["description"], FALLBACK_LANGUAGE)
        examples = ", ".join(profile.profile.get("examples", [])[:8])
        lines.append(
            f"- {profile.key}: {translated(profile.name, FALLBACK_LANGUAGE)}. {description} "
            f"Examples: {examples}."
        )
    return "\n".join(lines)
