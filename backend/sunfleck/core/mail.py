"""Where emails go when no email server is set up (EMAIL_URL)."""

import logging
from collections.abc import Sequence

from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage

logger = logging.getLogger(__name__)


def masked(address: str) -> str:
    """An address with most of its name hidden, e.g. a…@example.com."""
    name, _, domain = address.rpartition("@")
    return f"{name[:1]}…@{domain}" if name else "…"


class UnsentEmailBackend(BaseEmailBackend):
    """Doesn't send emails, and doesn't write them anywhere: they hold links that sign
    people in (invitations, password resets), which mustn't reach the logs. Only says that
    one wasn't sent. Admins copy those links in the app instead."""

    def send_messages(self, email_messages: Sequence[EmailMessage]) -> int:
        for message in email_messages:
            logger.warning(
                "An email to %s wasn't sent: email isn't set up (EMAIL_URL).",
                ", ".join(masked(str(address)) for address in message.recipients()),
            )
        return len(email_messages)
