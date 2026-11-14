"""Conversations about a plant with the household's AI plugin ("Ask about this plant").

Everyone in the household can read them; Gardeners and Admins can ask, continue and delete
them. Asking sends the plant's context and the conversation so far to the AI plugin, only
when someone asks.
"""

from datetime import datetime

from django.db.models import Count, Q
from django.http import HttpRequest
from ninja import Query, Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.ai import chat
from sunfleck.ai.models import Conversation, Message, MessageRole
from sunfleck.core import limits
from sunfleck.core.errors import ApiError
from sunfleck.core.pagination import ListQuery, paginate
from sunfleck.plants.selectors import get_plant
from sunfleck.taxonomy.api import language

router = Router(tags=["ai"], auth=django_auth)


class QuestionIn(Schema):
    question: str = Field(min_length=1, max_length=chat.MAX_QUESTION)


class ConversationSummaryOut(Schema):
    id: int
    title: str = Field(description="The first question, shortened.")
    started_by: str | None
    questions: int = Field(description="How many questions were asked in it.")
    created_at: datetime
    updated_at: datetime = Field(description="When the latest question was answered.")


class ChatMessageOut(Schema):
    id: int
    role: MessageRole
    text: str
    asked_by: str | None = Field(description="Who asked (questions only).")
    attribution: str = Field(description="Which AI answered (answers only), to show with it.")
    created_at: datetime


class ConversationOut(Schema):
    id: int
    plant_id: int
    title: str
    started_by: str | None
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessageOut] = Field(
        description="Oldest first: each question, then its answer."
    )
    can_continue: bool = Field(description="False once it's as long as a conversation can get.")


def _name(user: User | None) -> str | None:
    return user.get_full_name() if user else None


def _conversation_out(conversation: Conversation) -> ConversationOut:
    messages = list(conversation.messages.select_related("asked_by"))
    asked = sum(1 for message in messages if message.role == MessageRole.QUESTION)
    return ConversationOut(
        id=conversation.pk,
        plant_id=conversation.plant_id,
        title=conversation.title,
        started_by=_name(conversation.started_by),
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[_message_out(message) for message in messages],
        can_continue=asked < chat.MAX_QUESTIONS,
    )


def _message_out(message: Message) -> ChatMessageOut:
    return ChatMessageOut(
        id=message.pk,
        role=MessageRole(message.role),
        text=message.text,
        asked_by=_name(message.asked_by),
        attribution=message.attribution,
        created_at=message.created_at,
    )


def _get_conversation(household: Household, conversation_id: int) -> Conversation:
    conversation = (
        Conversation.objects.select_related("plant", "started_by")
        .filter(pk=conversation_id, plant__household=household)
        .first()
    )
    if conversation is None:
        raise ApiError(404, "conversation_not_found", "This conversation doesn't exist.")
    return conversation


ERROR_STATUS = {
    "chat_unavailable": 404,
    "ai_quota_exceeded": 429,
}


def _chat_error(exc: chat.ChatError) -> ApiError:
    status = ERROR_STATUS.get(exc.code, 502 if exc.code.startswith("ai_") else 422)
    details = {"field": "question"} if exc.code == "question_empty" else None
    return ApiError(status, exc.code, str(exc), details)


class ConversationPage(Schema):
    items: list[ConversationSummaryOut]
    count: int = Field(description="How many conversations there are, across all pages.")


@router.get("/plants/{plant_id}/conversations", response=ConversationPage)
def list_conversations(
    request: HttpRequest, plant_id: int, query: Query[ListQuery]
) -> ConversationPage:
    """The plant's conversations, the latest first."""
    household = require_role(request, Role.VIEWER).household
    plant = get_plant(household, plant_id)
    conversations, count = paginate(
        plant.conversations.select_related("started_by").annotate(
            questions=Count("messages", filter=Q(messages__role=MessageRole.QUESTION))
        ),
        query,
    )
    items = [
        ConversationSummaryOut(
            id=conversation.pk,
            title=conversation.title,
            started_by=_name(conversation.started_by),
            questions=getattr(conversation, "questions", 0),  # annotated above
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
        )
        for conversation in conversations
    ]
    return ConversationPage(items=items, count=count)


@router.post("/plants/{plant_id}/conversations", response={201: ConversationOut})
def start_conversation(
    request: HttpRequest, plant_id: int, data: QuestionIn
) -> Status[ConversationOut]:
    """Ask the household's AI plugin about the plant, in a new conversation. Sends the
    question and the plant's species, conditions, schedules and recent care. Nothing is saved
    if the AI can't answer."""
    membership = require_role(request, Role.GARDENER)
    plant = get_plant(membership.household, plant_id)
    limits.per_member(request, "ai", limits.AI_PER_MINUTE)
    try:
        conversation = chat.start(plant, data.question, membership.user, language(request))
    except chat.ChatError as exc:
        raise _chat_error(exc) from exc
    return Status(201, _conversation_out(conversation))


@router.get("/conversations/{conversation_id}", response=ConversationOut)
def get_conversation(request: HttpRequest, conversation_id: int) -> ConversationOut:
    household = require_role(request, Role.VIEWER).household
    return _conversation_out(_get_conversation(household, conversation_id))


@router.post("/conversations/{conversation_id}/messages", response=ConversationOut)
def ask_again(request: HttpRequest, conversation_id: int, data: QuestionIn) -> ConversationOut:
    """Ask a further question in the conversation. Sends the latest part of the conversation
    too, so the AI can follow on. Nothing is saved if the AI can't answer."""
    membership = require_role(request, Role.GARDENER)
    conversation = _get_conversation(membership.household, conversation_id)
    limits.per_member(request, "ai", limits.AI_PER_MINUTE)
    try:
        chat.continue_(conversation, data.question, membership.user, language(request))
    except chat.ChatError as exc:
        raise _chat_error(exc) from exc
    return _conversation_out(conversation)


@router.delete("/conversations/{conversation_id}", response={204: None})
def delete_conversation(request: HttpRequest, conversation_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_conversation(household, conversation_id).delete()
    return Status(204, None)
