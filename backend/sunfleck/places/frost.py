"""A site's typical frost dates: the last frost in spring and the first in autumn.

They're entered by hand, or estimated by a plugin (the `frost_dates` hook) from past weather,
once per site, in the worker. Only the day and month count: they're stored in FROST_YEAR.
"""

import logging
from datetime import date

from sunfleck.places.models import FROST_YEAR, FrostSource, Site
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import FrostDates

logger = logging.getLogger(__name__)

HOOK = "frost_dates"
# Sites estimated in one run of the job, so a big install doesn't hit the weather service
# all at once; the rest follow in the next runs.
BATCH = 10


def frost_day(month: int, day: int) -> date:
    """A frost date (only its day and month count).

    Raises:
        ValueError: If there's no such day.
    """
    return date(FROST_YEAR, month, day)


def _day(value: date | None) -> date | None:
    return frost_day(value.month, value.day) if value else None


def set_frost_dates(site: Site, last_frost: date | None, first_frost: date | None) -> Site:
    """Enter the site's frost dates. Clearing both lets a plugin estimate them again."""
    site.last_frost, site.first_frost = _day(last_frost), _day(first_frost)
    site.frost_years = None
    entered = last_frost is not None or first_frost is not None
    site.frost_source = FrostSource.ENTERED if entered else ""
    site.save(update_fields=["last_frost", "first_frost", "frost_years", "frost_source"])
    return site


def estimate(site: Site) -> bool:
    """Ask the plugins that are on for an estimate of the site's frost dates, and keep the
    first. Whether one was found."""
    for answer in registry.call(HOOK, site.household, FrostDates, site=site):
        dates: FrostDates = answer.result
        site.last_frost, site.first_frost = _day(dates.last_frost), _day(dates.first_frost)
        site.frost_years = dates.years
        site.frost_source = FrostSource.ESTIMATED
        site.save(update_fields=["last_frost", "first_frost", "frost_years", "frost_source"])
        return True
    return False


def estimate_missing(batch: int = BATCH) -> int:
    """Estimate the frost dates of sites that have none yet; how many were found."""
    if not registry.implementers(HOOK):
        return 0
    sites = Site.objects.filter(frost_source="").select_related("household").order_by("pk")
    return sum(estimate(site) for site in sites[:batch])
