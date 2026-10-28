import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, time
from typing import Any

import pytest
import time_machine
from django.test import Client, override_settings
from huey.contrib.djhuey import HUEY

from sunfleck.accounts.models import Household, Membership, Role, User
from sunfleck.care import schedules
from sunfleck.care.models import ScheduleMode
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.notifications import delivery, services, tasks
from sunfleck.notifications.digest import compose
from sunfleck.notifications.models import (
    NotificationChannel,
    NotificationKind,
    NotificationLog,
    NotificationStatus,
)
from sunfleck.places.models import Location, LocationKind
from sunfleck.places.tests.factories import LocationFactory
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.plugins import Alert, PluginInfo, SiteConditions, hookimpl
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry

ClientAs = Callable[[Role], Client]
# 08:15 in Amsterdam (the factories' site), on April 15th.
NOW = datetime(2026, 4, 15, 6, 15, tzinfo=UTC)
NTFY = "ntfy://ntfy.sh/sunfleck-plants"

pytestmark = pytest.mark.django_db


class FakeApprise:
    """Records what's sent instead of sending it; can be told to fail for some URLs."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []
        self.failing: set[str] = set()

    def __call__(self, url: str, title: str, body: str) -> None:
        if url in self.failing:
            raise delivery.DeliveryError("A Connection error occurred sending ntfy.")
        self.sent.append((url, title, body))


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


@pytest.fixture
def apprise(monkeypatch: pytest.MonkeyPatch) -> FakeApprise:
    fake = FakeApprise()
    monkeypatch.setattr(delivery, "send", fake)
    return fake


@pytest.fixture
def living_room(household: Household) -> Location:
    return LocationFactory.create(site__household=household)


@pytest.fixture
def ada(member_of: Callable[[Role], Membership], living_room: Location) -> User:
    return member_of(Role.GARDENER).user


def due(location: Location, nickname: str, key: str, last_done: date) -> None:
    """A plant whose care (every 7 days) was last done on `last_done`."""
    plant = PlantFactory.create(
        household=location.site.household, location=location, nickname=nickname
    )
    CareEventFactory.create(
        plant=plant,
        care_type=builtin(key),
        performed_at=datetime(last_done.year, last_done.month, last_done.day, 9, tzinfo=UTC),
    )
    schedules.create_schedule(plant, schedules.ScheduleData(builtin(key).pk, ScheduleMode.FIXED, 7))


# --- Preferences and channels -----------------------------------------------------------------


def test_preferences_start_with_the_households_time_zone(ada: User) -> None:
    preferences = services.preferences_for(ada)

    assert (preferences.digest_time, preferences.reminder_time, preferences.timezone) == (
        time(8, 0),
        None,
        "Europe/Amsterdam",
    )


def test_unknown_time_zones_are_refused(ada: User) -> None:
    with pytest.raises(services.NotificationError) as error:
        services.update_preferences(ada, services.PreferencesData(time(8), None, "Europe/Atlantis"))

    assert (error.value.code, error.value.field) == ("unknown_timezone", "timezone")


def test_channel_urls_are_checked_and_stored_encrypted(ada: User) -> None:
    channel = services.add_channel(ada, " Phone ", NTFY)

    assert (channel.label, channel.service) == ("Phone", "ntfy")
    assert "sunfleck-plants" not in channel.url_encrypted
    with pytest.raises(services.NotificationError) as error:
        services.add_channel(ada, "Pager", "pager://555-1234")
    assert (error.value.code, error.value.field) == ("unsupported_channel_url", "url")


# --- The digest -------------------------------------------------------------------------------


def test_the_digest_lists_care_by_location(
    ada: User, household: Household, living_room: Location
) -> None:
    garden = LocationFactory.create(site=living_room.site, name="Garden", kind=LocationKind.OUTDOOR)
    due(living_room, "Monty", "rotate", date(2026, 4, 6))  # 2 days overdue
    due(living_room, "Fern", "mist", date(2026, 4, 8))  # due today
    due(garden, "Rose", "pest_check", date(2026, 4, 8))
    due(garden, "Later", "rotate", date(2026, 4, 12))  # not yet

    message = compose(ada, household, NotificationKind.DIGEST)

    assert message is not None
    assert message.title == "3 plants need care today"
    assert message.body == (
        "Living room: Rotate Monty (2 days overdue), Mist Fern\nGarden: Check for pests Rose"
    )
    reminder = compose(ada, household, NotificationKind.REMINDER)
    assert reminder is not None
    assert reminder.title == "Still to do today: 3 plants"


def test_nothing_due_means_no_digest(ada: User, household: Household) -> None:
    assert compose(ada, household, NotificationKind.DIGEST) is None


class Frost:
    @hookimpl
    def site_conditions(self, site: Any) -> SiteConditions:
        return SiteConditions(
            attribution="Test weather",
            updated_at=NOW,
            alerts=(Alert("frost", date(2026, 4, 16), {"min_c": -1.5}),),
        )


@pytest.fixture
def frost(household: Household) -> Iterator[None]:
    registry.add(PluginInfo("frost", "Frost", "1", "1"), Frost())
    plugin_services.update(household, "frost", True, {})
    yield
    registry.remove("frost")


@override_settings(PUBLIC_URL="https://plants.example.com")
def test_the_digest_warns_about_frost_and_links_to_the_app(
    ada: User, household: Household, living_room: Location, frost: None
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))

    message = compose(ada, household, NotificationKind.DIGEST)
    ada.unit_system = "imperial"
    frost_only = compose(ada, household, NotificationKind.REMINDER)

    assert message is not None
    assert message.body.split("\n") == [
        "Living room: Rotate Monty",
        "Frost likely tomorrow night at Home (low of -1.5°C).",
        "Open Sunfleck: https://plants.example.com/",
    ]
    # Frost is in the morning digest only.
    assert frost_only is not None
    assert "Frost" not in frost_only.body


def test_a_frost_warning_alone_is_worth_a_digest(
    ada: User, household: Household, frost: None
) -> None:
    ada.unit_system = "imperial"

    message = compose(ada, household, NotificationKind.DIGEST)

    assert message is not None
    assert (message.title, message.body) == (
        "Frost warning",
        "Frost likely tomorrow night at Home (low of 29°F).",
    )


# --- Sending ----------------------------------------------------------------------------------


@pytest.fixture
def phone(ada: User) -> NotificationChannel:
    return services.add_channel(ada, "Phone", NTFY)


def at(hour: int, minute: int = 0) -> datetime:
    """A time on April 15th in Amsterdam (UTC+2)."""
    return datetime(2026, 4, 15, hour - 2, minute, tzinfo=UTC)


def test_the_digest_is_sent_once_at_its_time(
    apprise: FakeApprise, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))

    assert services.send_due(at(7, 59)) == 0
    assert services.send_due(at(8, 0)) == 1
    assert services.send_due(at(8, 15)) == 0

    assert apprise.sent == [(NTFY, "1 plant needs care today", "Living room: Rotate Monty")]
    phone.refresh_from_db()
    assert phone.last_sent_at == NOW
    log = NotificationLog.objects.get()
    assert (log.kind, log.local_date, log.status) == ("digest", date(2026, 4, 15), "sent")


def test_a_digest_missed_by_more_than_three_hours_isnt_sent(
    apprise: FakeApprise, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))

    assert services.send_due(at(11, 0)) == 0
    assert apprise.sent == []


def test_nothing_due_is_noted_but_not_sent(
    apprise: FakeApprise, phone: NotificationChannel
) -> None:
    services.send_due(at(8, 0))

    assert apprise.sent == []
    assert NotificationLog.objects.get().status == NotificationStatus.NOTHING_DUE


def test_a_failed_digest_is_tried_again(
    apprise: FakeApprise, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))
    apprise.failing.add(NTFY)

    assert services.send_due(at(8, 0)) == 0
    log = NotificationLog.objects.get()
    assert (log.status, log.detail) == ("failed", "A Connection error occurred sending ntfy.")
    phone.refresh_from_db()
    assert phone.last_error == "A Connection error occurred sending ntfy."

    apprise.failing.clear()
    assert services.send_due(at(8, 15)) == 1
    assert NotificationLog.objects.get().status == "sent"


def test_paused_channels_and_other_channels_failing(
    apprise: FakeApprise, ada: User, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))
    email = services.add_channel(ada, "Email", "mailto://ada:secret@example.com")
    paused = services.add_channel(ada, "Old phone", "ntfy://ntfy.sh/old")
    services.update_channel(paused, "Old phone", enabled=False)
    apprise.failing.add("mailto://ada:secret@example.com")

    assert services.send_due(at(8, 0)) == 1

    assert [url for url, *_ in apprise.sent] == [NTFY]
    email.refresh_from_db()
    assert email.last_error


def test_the_evening_reminder_lists_whats_still_due(
    apprise: FakeApprise, ada: User, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))
    due(living_room, "Fern", "mist", date(2026, 4, 8))
    services.update_preferences(
        ada, services.PreferencesData(time(8), time(19, 30), "Europe/Amsterdam")
    )
    services.send_due(at(8, 0))
    CareEventFactory.create(
        plant=ada.memberships.get().household.plants.get(nickname="Fern"),
        care_type=builtin("mist"),
        performed_at=at(12),
    )

    assert services.send_due(at(19, 29)) == 0
    assert services.send_due(at(19, 45)) == 1

    assert apprise.sent[-1][1:] == ("Still to do today: 1 plant", "Living room: Rotate Monty")


def test_digests_go_out_in_each_persons_time_zone(
    apprise: FakeApprise, ada: User, phone: NotificationChannel, living_room: Location
) -> None:
    due(living_room, "Monty", "rotate", date(2026, 4, 8))
    services.update_preferences(ada, services.PreferencesData(time(8), None, "America/Chicago"))

    assert services.send_due(at(8, 0)) == 0  # 01:00 in Chicago
    assert services.send_due(at(15, 0)) == 1  # 08:00 in Chicago


def test_the_worker_checks_every_15_minutes() -> None:
    assert tasks.send_due_notifications  # the worker imports every tasks.py

    def names(minute: int) -> list[str]:
        when = datetime(2026, 4, 15, 6, minute)  # noqa: DTZ001 - Huey uses naive UTC
        return [task.name for task in HUEY.read_periodic(when)]

    assert "notifications.send_due" in names(15)
    assert "notifications.send_due" not in names(16)


# --- API --------------------------------------------------------------------------------------


def send(client: Client, method: str, url: str, data: Any = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def test_people_set_up_their_own_notifications(
    client_as: ClientAs, apprise: FakeApprise, living_room: Location
) -> None:
    viewer = client_as(Role.VIEWER)

    added = send(viewer, "POST", "/api/v1/notifications/channels", {"label": "Phone", "url": NTFY})
    channel_id = added.json()["id"]
    tested = send(viewer, "POST", f"/api/v1/notifications/channels/{channel_id}/test")
    renamed = send(
        viewer,
        "PUT",
        f"/api/v1/notifications/channels/{channel_id}",
        {"label": "My phone", "enabled": False},
    )
    preferences = send(
        viewer,
        "PUT",
        "/api/v1/notifications/preferences",
        {"digest_time": "07:30", "reminder_time": "19:00", "timezone": "Europe/Amsterdam"},
    )
    everything = viewer.get("/api/v1/notifications").json()

    assert added.status_code == 201
    assert added.json() == {
        "id": channel_id,
        "label": "Phone",
        "service": "ntfy",
        "enabled": True,
        "last_sent_at": None,
        "last_error": None,
    }
    assert NTFY not in added.content.decode()  # the URL is never sent back
    assert tested.json()["last_sent_at"] == "2026-04-15T06:15:00Z"
    assert apprise.sent == [(NTFY, "Sunfleck test", "Notifications to Phone work.")]
    assert (renamed.json()["label"], renamed.json()["enabled"]) == ("My phone", False)
    assert preferences.json() == {
        "digest_time": "07:30:00",
        "reminder_time": "19:00:00",
        "timezone": "Europe/Amsterdam",
    }
    assert [c["label"] for c in everything["channels"]] == ["My phone"]
    assert everything["preferences"]["digest_time"] == "07:30:00"


def test_problems_are_explained(client_as: ClientAs, apprise: FakeApprise) -> None:
    client = client_as(Role.GARDENER)
    channel_id = send(
        client, "POST", "/api/v1/notifications/channels", {"label": "Phone", "url": NTFY}
    ).json()["id"]
    apprise.failing.add(NTFY)

    unsupported = send(
        client, "POST", "/api/v1/notifications/channels", {"label": "Pager", "url": "pager://1"}
    )
    failed = send(client, "POST", f"/api/v1/notifications/channels/{channel_id}/test")
    bad_zone = send(
        client,
        "PUT",
        "/api/v1/notifications/preferences",
        {"digest_time": "08:00", "reminder_time": None, "timezone": "Mars/Olympus"},
    )

    assert unsupported.json()["error"]["details"] == {"field": "url"}
    assert failed.status_code == 422
    assert failed.json()["error"] == {
        "code": "delivery_failed",
        "message": "A Connection error occurred sending ntfy.",
        "details": {},
    }
    assert bad_zone.json()["error"]["code"] == "unknown_timezone"


def test_other_peoples_channels_are_hidden(
    client_as: ClientAs, member_of: Callable[[Role], Membership]
) -> None:
    # Someone else in the same household: channels are each person's own.
    theirs = services.add_channel(member_of(Role.GARDENER).user, "Theirs", NTFY)
    me = client_as(Role.ADMIN)
    url = f"/api/v1/notifications/channels/{theirs.pk}"

    responses = [
        send(me, "PUT", url, {"label": "Mine now", "enabled": True}),
        send(me, "POST", f"{url}/test"),
        send(me, "DELETE", url),
    ]

    assert [r.status_code for r in responses] == [404] * 3
    assert me.get("/api/v1/notifications").json()["channels"] == []


def test_previewing_todays_digest(client_as: ClientAs, living_room: Location) -> None:
    client = client_as(Role.VIEWER)
    nothing = client.get("/api/v1/notifications/preview").json()
    due(living_room, "Monty", "rotate", date(2026, 4, 8))

    preview = client.get("/api/v1/notifications/preview").json()

    assert nothing == {"message": None}
    assert preview == {
        "message": {"title": "1 plant needs care today", "body": "Living room: Rotate Monty"}
    }


def test_a_channels_address_can_be_changed(client_as: ClientAs, apprise: FakeApprise) -> None:
    client = client_as(Role.GARDENER)
    channel_id = send(
        client, "POST", "/api/v1/notifications/channels", {"label": "Phone", "url": NTFY}
    ).json()["id"]
    apprise.failing.add(NTFY)
    send(client, "POST", f"/api/v1/notifications/channels/{channel_id}/test")
    url = f"/api/v1/notifications/channels/{channel_id}"
    email = "mailto://ada:secret@example.com"

    kept = send(client, "PUT", url, {"label": "Phone", "enabled": True, "url": ""})
    changed = send(client, "PUT", url, {"label": "Email", "enabled": True, "url": email})
    refused = send(client, "PUT", url, {"label": "Email", "enabled": True, "url": "pager://1"})
    tested = send(client, "POST", f"{url}/test")

    assert kept.json()["service"] == "ntfy"
    assert kept.json()["last_error"]  # still the same address
    assert changed.json()["service"] == "mailto"
    assert changed.json()["last_error"] is None  # a new address hasn't failed yet
    assert refused.json()["error"]["details"] == {"field": "url"}
    assert tested.status_code == 200
    assert apprise.sent[-1][0] == email
