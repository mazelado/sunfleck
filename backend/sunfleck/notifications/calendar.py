"""A private iCal feed of the household's care, for calendar apps.

Each person can have one calendar address. Its token is random and shown once; only a hash is
stored. The feed lists the care due in the next couple of weeks, one all-day event per plant
and kind of care, repeating at the predicted interval.
"""

import hashlib
import secrets
from datetime import date, datetime, timedelta

from django.conf import settings
from django.utils import timezone, translation
from django.utils.translation import gettext
from icalendar import Calendar, Event

from sunfleck.accounts.models import User
from sunfleck.accounts.permissions import get_membership
from sunfleck.care.schedules import Task, due_tasks
from sunfleck.notifications.models import CalendarFeed

# How far ahead the feed looks. Calendar apps refresh it every few hours to once a day.
DAYS_AHEAD = 14
# Asked of calendar apps that honour it; Google Calendar keeps its own schedule.
REFRESH = timedelta(hours=6)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create(user: User) -> str:
    """Give the person a new calendar address, replacing any old one. Returns its token,
    which can't be shown again."""
    token = secrets.token_urlsafe(32)
    CalendarFeed.objects.update_or_create(user=user, defaults={"token_hash": _hash(token)})
    return token


def delete(user: User) -> None:
    CalendarFeed.objects.filter(user=user).delete()


def user_for(token: str) -> User | None:
    """The person whose calendar address this is, if any. Remembers when it was last read."""
    feed = CalendarFeed.objects.select_related("user").filter(token_hash=_hash(token)).first()
    if feed is None or not feed.user.is_active:
        return None
    CalendarFeed.objects.filter(pk=feed.pk).update(last_read_at=timezone.now())
    return feed.user


def feed(user: User) -> bytes:
    """The person's household's care as an iCalendar file."""
    membership = get_membership(user)
    calendar = Calendar()
    calendar.add("prodid", "-//Sunfleck//Care//EN")
    calendar.add("version", "2.0")
    with translation.override(user.locale or settings.LANGUAGE_CODE):
        name = gettext("Plant care")
        if membership is not None:
            name = f"{name} · {membership.household.name}"
        calendar.add("x-wr-calname", name)
        calendar.add("refresh-interval", REFRESH, parameters={"VALUE": "DURATION"})
        # Not a property icalendar knows, so it's written as a duration (PT6H) by hand.
        calendar.add("x-published-ttl", f"PT{REFRESH // timedelta(hours=1)}H")
        if membership is not None:
            stamp = timezone.now()
            for task in due_tasks(membership.household, days_ahead=DAYS_AHEAD):
                for index, day in enumerate(_days(task)):
                    overdue = index == 0 and task.days_until < 0
                    calendar.add_component(_event(task, day, stamp, overdue=overdue))
    ical: bytes = calendar.to_ical()
    return ical


def _days(task: Task) -> list[date]:
    """The days the care falls on in the feed's window: overdue care on the plant's today,
    then every predicted interval."""
    today = task.due_on - timedelta(days=task.days_until)
    day = max(task.due_on, today)
    last = today + timedelta(days=DAYS_AHEAD)
    interval = task.schedule.interval_days
    days = []
    while day <= last:
        days.append(day)
        if not interval:
            break
        day += timedelta(days=interval)
    return days


def _event(task: Task, day: date, stamp: datetime, *, overdue: bool) -> Event:
    schedule = task.schedule
    plant = schedule.plant
    event = Event()
    event.add("uid", f"sunfleck-schedule-{schedule.pk}-{day.isoformat()}")
    event.add("dtstamp", stamp)
    event.add("dtstart", day)
    event.add("dtend", day + timedelta(days=1))
    event.add("transp", "TRANSPARENT")
    summary = f"{schedule.care_type.name} {plant.nickname}"
    if overdue:
        summary += f" ({gettext('overdue')})"
    event.add("summary", summary)
    if plant.location is not None:
        event.add("location", plant.location.name)
    if settings.PUBLIC_URL:
        url = f"{settings.PUBLIC_URL}/plants/{plant.pk}"
        event.add("url", url)
        event.add("description", url)
    return event
