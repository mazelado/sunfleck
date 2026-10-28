"""The daily digest and the evening reminder: what needs care today, in a few lines.

3 plants need care today
Living room: Water Monty (2 days overdue), Mist Fern
Garden: Water Rose
Frost likely tonight at Home (low of -1°C).
Open Sunfleck: https://plants.example.com/
"""

from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import formats, timezone, translation
from django.utils.translation import gettext, ngettext

from sunfleck.accounts.models import Household, UnitSystem, User
from sunfleck.care.schedules import Task, due_tasks
from sunfleck.notifications.models import NotificationKind
from sunfleck.places.models import Site
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import Alert, SiteConditions


@dataclass(frozen=True)
class Message:
    title: str
    body: str


def compose(user: User, household: Household, kind: NotificationKind) -> Message | None:
    """The person's digest or reminder, or None if there's nothing to tell them."""
    with translation.override(user.locale or settings.LANGUAGE_CODE):
        tasks = due_tasks(household, days_ahead=0)
        frost = _frost_lines(user, household) if kind == NotificationKind.DIGEST else []
        if not tasks and not frost:
            return None
        lines = [*_task_lines(tasks), *frost]
        if settings.PUBLIC_URL:
            lines.append(gettext("Open Sunfleck: %(url)s/") % {"url": settings.PUBLIC_URL})
        return Message(_title(tasks, kind), "\n".join(lines))


def _title(tasks: list[Task], kind: NotificationKind) -> str:
    plants = len({task.schedule.plant_id for task in tasks})
    if not plants:
        return gettext("Frost warning")
    if kind == NotificationKind.REMINDER:
        return ngettext(
            "Still to do today: %(count)d plant",
            "Still to do today: %(count)d plants",
            plants,
        ) % {"count": plants}
    return ngettext(
        "%(count)d plant needs care today", "%(count)d plants need care today", plants
    ) % {"count": plants}


def _task_lines(tasks: list[Task]) -> list[str]:
    by_location: dict[str, list[str]] = {}
    for task in tasks:
        plant = task.schedule.plant
        where = plant.location.name if plant.location else gettext("No location")
        item = f"{task.schedule.care_type.name} {plant.nickname}"
        if task.days_until < 0:
            overdue = -task.days_until
            item += " (%s)" % (
                ngettext("%(days)d day overdue", "%(days)d days overdue", overdue)
                % {"days": overdue}
            )
        by_location.setdefault(where, []).append(item)
    return [f"{where}: {', '.join(items)}" for where, items in by_location.items()]


def _frost_lines(user: User, household: Household) -> list[str]:
    lines = []
    for site in Site.objects.filter(household=household).order_by("name"):
        today = timezone.now().astimezone(ZoneInfo(site.timezone)).date()
        for answer in registry.call("site_conditions", household, SiteConditions, site=site):
            for alert in answer.result.alerts:
                if alert.kind == "frost":
                    lines.append(_frost_line(user, site, alert, today))
    return lines


def _frost_line(user: User, site: Site, alert: Alert, today: date) -> str:
    if alert.on <= today:
        when = gettext("tonight")
    elif alert.on == today + timedelta(days=1):
        when = gettext("tomorrow night")
    else:
        when = gettext("on %(day)s night") % {"day": formats.date_format(alert.on, "l")}
    return gettext("Frost likely %(when)s at %(site)s (low of %(low)s).") % {
        "when": when,
        "site": site.name,
        "low": _temperature(user, float(alert.details["min_c"])),
    }


def _temperature(user: User, celsius: float) -> str:
    if user.unit_system == UnitSystem.IMPERIAL:
        return f"{round(celsius * 1.8 + 32)}°F"
    return f"{round(celsius, 1):g}°C"
