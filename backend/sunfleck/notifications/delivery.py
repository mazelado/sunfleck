"""Sending a message to an Apprise URL (https://github.com/caronc/apprise/wiki)."""

import logging

import apprise

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15
MAX_ERROR_LENGTH = 500


class DeliveryError(Exception):
    """The message couldn't be sent; the text says why."""


def is_supported(url: str) -> bool:
    """Whether Apprise understands the URL (it doesn't contact the service)."""
    return bool(apprise.Apprise().add(url))


def service_of(url: str) -> str:
    """The kind of service, from the URL's scheme: "ntfy", "tgram", "mailto", ..."""
    return url.split("://", 1)[0].lower()[:32]


def send(url: str, title: str, body: str) -> None:
    """Send a message.

    Raises:
        DeliveryError: If the URL isn't supported or the service didn't accept the message.
    """
    sender = apprise.Apprise()
    if not sender.add(url):
        raise DeliveryError("This address isn't one Apprise knows.")
    problems: list[str] = []
    result = sender.notify(
        title=title,
        body=body,
        timeout=TIMEOUT_SECONDS,
        log_level=logging.WARNING,
        log_callback=lambda entry, _plugin: problems.append(entry.message),
    )
    if not result:
        reason = " ".join(problems) or "The service didn't accept the message."
        raise DeliveryError(reason[:MAX_ERROR_LENGTH])
