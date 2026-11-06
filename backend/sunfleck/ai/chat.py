"""Asking the household's AI plugin about a plant, in conversations kept on the plant.

Each question is sent with the plant's context as it is now (see context.py) and the latest
part of the conversation, so the AI can follow up on what was said. Questions and answers are
only saved once the AI has answered: if it can't, nothing changes and the person can try again.
"""

from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from sunfleck.accounts.models import User
from sunfleck.ai import services as ai
from sunfleck.ai.context import plant_context
from sunfleck.ai.models import Conversation, Message, MessageRole
from sunfleck.plants.models import Plant
from sunfleck.plugins.types import AiTask

MAX_QUESTION = 2000
MAX_ANSWER = 4000
# How much of the conversation the AI is shown with a new question.
SENT_MESSAGES = 20
# Questions per conversation; then a new one is started (and the AI given less to read).
MAX_QUESTIONS = 50
TITLE_LENGTH = 80

INSTRUCTIONS = """You help someone look after one particular plant, described below, with
its care history. Answer their question about it.
- Base your answer on what's known about this plant: its species, where it grows, its pot,
  its schedules and its recent care. Say when something you'd need to know isn't recorded.
- Be practical and brief: a few short paragraphs at most. Plain text only, no Markdown
  headings, bold or tables; a list may use lines starting with "- ".
- If you aren't sure, say so. If they describe a problem that a photo would help with,
  suggest "What's wrong?" on the plant's page, which looks at a photo.
- Keep to plants and their care. For anything about the safety of people or pets (e.g.
  something was eaten), say to contact a doctor, a vet or a poison control centre.
Answer in the language with code "{language}", whatever language the context is in."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"answer": {"type": "string", "maxLength": MAX_ANSWER}},
    "required": ["answer"],
    "additionalProperties": False,
}


class ChatError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def start(plant: Plant, question: str, user: User, language: str) -> Conversation:
    """A new conversation about the plant, with the question and the AI's answer.

    Raises:
        ChatError: `question_empty`, `chat_unavailable` (no AI plugin on), or `ai_` and the
            plugin's problem code.
    """
    question = _clean(question)
    answer, attribution = _ask(plant, [], question, language)
    now = timezone.now()
    with transaction.atomic():
        conversation = Conversation.objects.create(
            plant=plant, title=_title(question), started_by=user, updated_at=now
        )
        _save(conversation, question, user, answer, attribution, now)
    return conversation


def continue_(conversation: Conversation, question: str, user: User, language: str) -> None:
    """Ask a further question in the conversation, and save it with the AI's answer.

    Raises:
        ChatError: As `start`, and `conversation_too_long` after MAX_QUESTIONS questions.
    """
    question = _clean(question)
    asked = conversation.messages.filter(role=MessageRole.QUESTION).count()
    if asked >= MAX_QUESTIONS:
        raise ChatError(
            "conversation_too_long",
            "This conversation is as long as it can get. Start a new one.",
        )
    earlier = list(conversation.messages.order_by("-created_at", "-pk")[:SENT_MESSAGES])
    earlier.reverse()
    answer, attribution = _ask(conversation.plant, earlier, question, language)
    now = timezone.now()
    with transaction.atomic():
        _save(conversation, question, user, answer, attribution, now)
        conversation.updated_at = now
        conversation.save(update_fields=["updated_at"])


def _clean(question: str) -> str:
    question = question.strip()
    if not question:
        raise ChatError("question_empty", "Write a question first.")
    return question[:MAX_QUESTION]


def _title(question: str) -> str:
    line = " ".join(question.split())
    return line if len(line) <= TITLE_LENGTH else line[: TITLE_LENGTH - 1].rstrip() + "…"


def _ask(plant: Plant, earlier: list[Message], question: str, language: str) -> tuple[str, str]:
    prompt = plant_context(plant)
    if earlier:
        prompt += "\n\nThe conversation so far:"
        for message in earlier:
            who = "Question" if message.role == MessageRole.QUESTION else "Your answer"
            prompt += f"\n{who}: {message.text}"
    prompt += f"\n\nThe question: {question}"
    task = AiTask(
        name="plant_question",
        instructions=INSTRUCTIONS.format(language=language),
        prompt=prompt,
        schema=SCHEMA,
    )
    answer = ai.ask(plant.household, task)
    if answer is None:
        raise ChatError("chat_unavailable", "No AI plugin is turned on.")
    if answer.problem or answer.data is None:
        code = f"ai_{answer.problem or 'invalid_answer'}"
        raise ChatError(code, f"The AI couldn't answer ({code}).")
    text = str(answer.data["answer"]).strip()
    if not text:
        raise ChatError("ai_invalid_answer", "The AI didn't answer.")
    return text, answer.attribution


def _save(
    conversation: Conversation,
    question: str,
    user: User,
    answer: str,
    attribution: str,
    now: datetime,
) -> None:
    Message.objects.create(
        conversation=conversation,
        role=MessageRole.QUESTION,
        text=question,
        asked_by=user,
        created_at=now,
    )
    Message.objects.create(
        conversation=conversation,
        role=MessageRole.ANSWER,
        text=answer,
        attribution=attribution[:200],
        created_at=now,
    )
