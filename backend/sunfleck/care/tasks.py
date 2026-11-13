"""Background jobs for care (run by the worker, see settings.HUEY)."""

import logging

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.care.schedules import recalculate_out_of_date

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute="23"), name="care.recalculate_schedules")
def recalculate_schedules() -> None:
    """Every hour: bring up to date the schedules whose site has begun a new day, so due dates
    follow the seasons even for plants nobody has looked at (reminders are worked out from
    them), and the day's first look at Today doesn't have to recalculate them.

    Each site has its own "today", so a fixed time of night would be the evening before in
    some time zones and late morning in others. Hourly, each schedule is recalculated within
    the hour after its site's midnight; the rest of the time this finds nothing to do."""
    count = recalculate_out_of_date()
    if count:
        logger.info("Recalculated %d care schedules", count)
