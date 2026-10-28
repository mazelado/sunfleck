"""Background jobs for care (run by the worker, see settings.HUEY)."""

import logging

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.care.schedules import recalculate_all

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute="23", hour="2"), name="care.recalculate_schedules")
def recalculate_schedules() -> None:
    """Every night: bring every schedule up to date, so due dates follow the seasons even for
    plants nobody has looked at (reminders are worked out from them)."""
    count = recalculate_all()
    logger.info("Recalculated %d care schedules", count)
