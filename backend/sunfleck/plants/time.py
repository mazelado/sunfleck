"""What day and time it is where a plant grows: at its site (see sunfleck.places.time)."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from sunfleck.places.time import site_today, site_zone
from sunfleck.plants.models import Plant


def plant_zone(plant: Plant) -> ZoneInfo:
    """The time zone of the plant's site, which decides what "today" is for it."""
    return site_zone(plant.location.site if plant.location else None)


def plant_today(plant: Plant) -> date:
    """Today where the plant grows."""
    return site_today(plant.location.site if plant.location else None)


def plant_local(plant: Plant, when: datetime) -> datetime:
    """`when` with a time zone: one without is local time at the plant's site (as people,
    and cameras, write it)."""
    if timezone.is_aware(when):
        return when
    return when.replace(tzinfo=plant_zone(plant))
