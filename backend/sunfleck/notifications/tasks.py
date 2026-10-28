"""Background jobs for notifications (run by the worker)."""

import logging

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.notifications.services import send_due

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute="*/15"), name="notifications.send_due")
def send_due_notifications() -> None:
    """Every 15 minutes: send the digests and reminders whose time has come."""
    sent = send_due()
    if sent:
        logger.info("Sent %d notifications", sent)
