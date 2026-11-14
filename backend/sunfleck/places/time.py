"""What day and time it is at a site. Each site has its own time zone, which decides what
"today" is there (see docs/STYLE_GUIDE.md); without a site, the server's (TIME_ZONE)."""

from datetime import date
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

from sunfleck.places.models import Site


def site_zone(site: Site | None) -> ZoneInfo:
    """The site's time zone, or the server's without a site."""
    return ZoneInfo(site.timezone if site else settings.TIME_ZONE)


def site_today(site: Site | None) -> date:
    """Today at the site."""
    return timezone.now().astimezone(site_zone(site)).date()
