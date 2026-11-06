"""Conversations about a plant with the household's AI plugin, kept on the plant.

Everyone in the household can read them; Gardeners and Admins can ask, continue and delete
them.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import User
from sunfleck.plants.models import Plant


class Conversation(models.Model):
    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="conversations")
    # The first question, shortened, to tell conversations apart.
    title = models.CharField(_("title"), max_length=200)
    started_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # When the latest question was answered.
    updated_at = models.DateTimeField()

    class Meta:
        verbose_name = _("conversation")
        verbose_name_plural = _("conversations")
        ordering = ["-updated_at", "-pk"]

    def __str__(self) -> str:
        return f"{self.plant} · {self.title}"


class MessageRole(models.TextChoices):
    QUESTION = "question", _("question")
    ANSWER = "answer", _("answer")


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(_("role"), max_length=16, choices=MessageRole.choices)
    text = models.TextField(_("text"))
    # Who asked (questions only).
    asked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # Which AI answered (answers only), e.g. "Suggested by AI (claude-sonnet-5-5)".
    attribution = models.CharField(_("attribution"), max_length=200, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        ordering = ["created_at", "pk"]

    def __str__(self) -> str:
        return f"{self.role}: {self.text[:50]}"
