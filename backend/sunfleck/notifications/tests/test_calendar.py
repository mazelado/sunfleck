from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime

import pytest
import time_machine
from django.test import Client, override_settings
from icalendar import Calendar

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.notifications.models import CalendarFeed
from sunfleck.notifications.tests.test_notifications import due
from sunfleck.places.models import Location
from sunfleck.places.tests.factories import LocationFactory

ClientAs = Callable[[Role], Client]
# 08:15 in Amsterdam (the factories' site), on April 15th.
NOW = datetime(2026, 4, 15, 6, 15, tzinfo=UTC)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


@pytest.fixture
def living_room(household: Household) -> Location:
    return LocationFactory.create(site__household=household, name="Living room")


def new_address(client: Client) -> str:
    response = client.post("/api/v1/notifications/calendar")
    assert response.status_code == 201
    url: str = response.json()["url"]
    return url


def read(url: str) -> Calendar:
    # Calendar apps don't sign in: the address is the key.
    response = Client().get(url)
    assert response.status_code == 200
    assert response["Content-Type"] == "text/calendar; charset=utf-8"
    return Calendar.from_ical(response.content)


def events(calendar: Calendar) -> list[tuple[date, str, str]]:
    return sorted(
        (event.decoded("dtstart"), str(event["summary"]), str(event.get("location", "")))
        for event in calendar.walk("VEVENT")
    )


@override_settings(PUBLIC_URL="https://plants.example.com")
def test_the_calendar_lists_two_weeks_of_care(client_as: ClientAs, living_room: Location) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 6))  # every 7 days: 2 days overdue
    due(living_room, "Fern", "mist", date(2026, 4, 10))  # due on the 17th
    client = client_as(Role.VIEWER)

    url = new_address(client)
    calendar = read(url)

    assert url.startswith("https://plants.example.com/api/v1/calendar/")
    assert url.endswith(".ics")
    assert str(calendar["x-wr-calname"]).startswith("Plant care · ")
    assert b"REFRESH-INTERVAL;VALUE=DURATION:PT6H" in calendar.to_ical()
    assert b"X-PUBLISHED-TTL:PT6H" in calendar.to_ical()
    assert events(calendar) == [
        (date(2026, 4, 15), "Rotate Monty (overdue)", "Living room"),
        (date(2026, 4, 17), "Mist Fern", "Living room"),
        (date(2026, 4, 22), "Rotate Monty", "Living room"),
        (date(2026, 4, 24), "Mist Fern", "Living room"),
        (date(2026, 4, 29), "Rotate Monty", "Living room"),
    ]
    [first, *_] = sorted(calendar.walk("VEVENT"), key=lambda event: event.decoded("dtstart"))
    assert first.decoded("dtend") == date(2026, 4, 16)
    assert str(first["url"]).startswith("https://plants.example.com/plants/")
    # The same care keeps the same identity when the calendar is read again.
    assert {str(e["uid"]) for e in read(url).walk("VEVENT")} == {
        str(e["uid"]) for e in calendar.walk("VEVENT")
    }


def test_the_address_is_shown_once_and_only_its_hash_is_kept(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)
    assert client.get("/api/v1/notifications/calendar").json()["active"] is False

    url = new_address(client)
    read(url)

    status = client.get("/api/v1/notifications/calendar").json()
    assert status["active"] is True
    assert status["last_read_at"] is not None
    assert url.split("/")[-1].removesuffix(".ics") not in str(status)
    token = url.split("/")[-1].removesuffix(".ics")
    assert CalendarFeed.objects.get().token_hash != token


def test_a_new_address_stops_the_old_one(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)
    old = new_address(client)

    new = new_address(client)

    assert new != old
    assert Client().get(old).status_code == 404
    read(new)


def test_stopping_the_calendar(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)
    url = new_address(client)

    assert client.delete("/api/v1/notifications/calendar").status_code == 204

    assert Client().get(url).status_code == 404
    assert client.get("/api/v1/notifications/calendar").json()["active"] is False


def test_unknown_addresses_and_strangers_get_nothing(client_as: ClientAs) -> None:
    assert Client().get("/api/v1/calendar/not-a-real-token.ics").status_code == 404
    assert Client().post("/api/v1/notifications/calendar").status_code in (401, 403)


def test_the_calendar_only_has_the_households_own_plants(
    client_as: ClientAs, living_room: Location
) -> None:
    elsewhere = LocationFactory.create(site__household=HouseholdFactory.create())
    due(elsewhere, "Stranger", "mist", date(2026, 4, 10))
    due(living_room, "Fern", "mist", date(2026, 4, 10))

    calendar = read(new_address(client_as(Role.VIEWER)))

    assert {summary for _, summary, _ in events(calendar)} == {"Mist Fern"}
