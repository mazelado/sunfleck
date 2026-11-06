"""Background jobs for places (run by the worker, see settings.HUEY)."""

import logging

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.places.frost import estimate_missing

logger = logging.getLogger(__name__)


@db_periodic_task(crontab(minute="41"), name="places.estimate_frost_dates")
def estimate_frost_dates() -> None:
    """Every hour: estimate the frost dates of new sites, and of sites that moved, with a
    plugin that can (e.g. from past weather)."""
    count = estimate_missing()
    if count:
        logger.info("Estimated the frost dates of %d sites", count)
