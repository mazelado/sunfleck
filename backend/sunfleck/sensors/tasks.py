"""Background jobs for sensors (run by the worker, see settings.HUEY)."""

import logging

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.sensors.services import collect_readings

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute="*/15"), name="sensors.read_sensors")
def read_sensors() -> None:
    """Every 15 minutes: read the sensors chosen for plants, keep the latest readings, and add
    them to the day's summaries."""
    collected = collect_readings()
    if collected.sensors:
        logger.info(
            "Read %d plant sensors, %d daily summaries updated", collected.sensors, collected.days
        )
