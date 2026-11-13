"""Sweeps over the whole API that guard Sunfleck's two promises (code review 1.0, Q11):

- nobody reaches another household: every path that takes an id, called by an Admin with
  another household's ids, answers 404 and changes nothing there;
- nobody acts above their role: every change, asked by a Viewer, is refused with 403, except
  the few that are a person's own (their profile, their notifications).

The endpoints are read from the API itself, so an endpoint added later is swept too. It needs
an example body below if it takes one (or the sweep fails, saying so), and if it takes an id of
a new kind, a way to make one in `make_household`.
"""

import io
import json
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.utils import timezone

from sunfleck.accounts import services as accounts
from sunfleck.accounts.models import Household, Invitation, Membership, Role
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory
from sunfleck.ai.models import Conversation
from sunfleck.care import schedules
from sunfleck.care.models import CareEvent, CareType, ScheduleMode
from sunfleck.care.schedules import ScheduleData
from sunfleck.care.tests.factories import builtin
from sunfleck.config.api import api
from sunfleck.core.crypto import encrypt
from sunfleck.dataio import exporter
from sunfleck.garden.models import Harvest, SeedPacket
from sunfleck.notifications.models import NotificationChannel
from sunfleck.places.models import LightSource, Location, Site
from sunfleck.plants import services as plants
from sunfleck.plants.models import Plant, Wish
from sunfleck.plants.tests.factories import image_bytes

pytestmark = pytest.mark.django_db

# Path parameters that aren't a household's: the shared care data, plugins (whose settings
# are found through the signed-in member's household), and invitation tokens (public).
SHARED = {"key", "taxon_id", "plugin_id", "token"}

# Changes any member may make, being their own: their profile and their notifications.
A_PERSONS_OWN = {
    ("PATCH", "/api/v1/me"),
    ("POST", "/api/v1/me/avatar"),
    ("DELETE", "/api/v1/me/avatar"),
    ("POST", "/api/v1/notifications/calendar"),
    ("DELETE", "/api/v1/notifications/calendar"),
    ("POST", "/api/v1/notifications/channels"),
    ("PUT", "/api/v1/notifications/channels/{channel_id}"),
    ("DELETE", "/api/v1/notifications/channels/{channel_id}"),
    ("POST", "/api/v1/notifications/channels/{channel_id}/test"),
    ("PUT", "/api/v1/notifications/preferences"),
    ("POST", "/api/v1/notifications/push/devices"),
}

FILE = "file"  # a multipart body with a photo


def photo() -> SimpleUploadedFile:
    return SimpleUploadedFile("leaf.jpg", image_bytes(64, 48), content_type="image/jpeg")


# An example of a valid body for each endpoint that takes one, with `{name}` for ids: the
# sweeps must reach the permission check, which runs after the body is read.
BODIES: dict[tuple[str, str], Any] = {
    ("POST", "/api/v1/care-events/bulk"): {
        "care_type_id": "{water_id}",
        "plant_ids": ["{plant_id}"],
    },
    ("PUT", "/api/v1/care-events/{event_id}"): {"care_type_id": "{water_id}"},
    ("POST", "/api/v1/care-profile-suggestions"): {"name": "Monstera", "indoor": True},
    ("PUT", "/api/v1/care-schedules/{schedule_id}"): {"mode": "fixed", "fixed_interval_days": 7},
    ("PUT", "/api/v1/care-schedules/{schedule_id}/snooze"): {"until": None},
    ("POST", "/api/v1/care-types"): {"name": "Bottom water"},
    ("PUT", "/api/v1/care-types/{care_type_id}"): {"name": "Bottom water"},
    ("POST", "/api/v1/conversations/{conversation_id}/messages"): {"question": "Why?"},
    ("PATCH", "/api/v1/household"): {"name": "Renamed"},
    ("POST", "/api/v1/household/invitations"): {"email": "new@example.com", "role": "viewer"},
    ("PATCH", "/api/v1/household/members/{member_id}"): {"role": "viewer"},
    ("POST", "/api/v1/identify"): {"photos": FILE},
    ("POST", "/api/v1/import"): {"file": FILE},
    ("PUT", "/api/v1/light-sources/{light_id}"): {"kind": "window", "direction": "E"},
    ("PUT", "/api/v1/locations/{location_id}"): {"name": "Hall", "kind": "indoor"},
    ("POST", "/api/v1/locations/{location_id}/light-sources"): {"kind": "window", "direction": "S"},
    ("PATCH", "/api/v1/me"): {},
    ("POST", "/api/v1/me/avatar"): {"file": FILE},
    ("POST", "/api/v1/notifications/channels"): {"label": "Phone", "url": "ntfy://ntfy.sh/x"},
    ("PUT", "/api/v1/notifications/channels/{channel_id}"): {"label": "Phone", "enabled": True},
    ("PUT", "/api/v1/notifications/preferences"): {
        "digest_time": "08:00",
        "reminder_time": None,
        "timezone": "Europe/Amsterdam",
    },
    ("POST", "/api/v1/notifications/push/devices"): {
        "label": "Phone",
        "subscription": {
            "endpoint": "https://fcm.googleapis.com/fcm/send/x",
            "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ", "auth": "tBHI"},
        },
    },
    ("PUT", "/api/v1/photos/{photo_id}"): {"caption": "Leaf"},
    ("PUT", "/api/v1/photos/{photo_id}/crop"): {"crop": None},
    ("POST", "/api/v1/plants"): {"nickname": "Fern"},
    ("POST", "/api/v1/plants/move"): {"location_id": "{location_id}", "plant_ids": ["{plant_id}"]},
    ("PUT", "/api/v1/plants/{plant_id}"): {"nickname": "Fern"},
    ("POST", "/api/v1/plants/{plant_id}/care-events"): {"care_type_id": "{water_id}"},
    ("POST", "/api/v1/plants/{plant_id}/conversations"): {"question": "How often?"},
    ("PUT", "/api/v1/plants/{plant_id}/cover"): {"photo_id": "{photo_id}"},
    ("POST", "/api/v1/plants/{plant_id}/diagnosis"): {"file": FILE},
    ("POST", "/api/v1/plants/{plant_id}/harvests"): {"harvested_on": "2026-04-01"},
    ("POST", "/api/v1/plants/{plant_id}/photos"): {"file": FILE},
    ("POST", "/api/v1/plants/{plant_id}/propagate"): {"method": "cutting"},
    ("POST", "/api/v1/plants/{plant_id}/routine"): {
        "items": [{"care_type_id": "{water_id}", "mode": "fixed", "fixed_interval_days": 7}]
    },
    ("POST", "/api/v1/plants/{plant_id}/schedules"): {
        "care_type_id": "{fertilize_id}",
        "mode": "fixed",
        "fixed_interval_days": 30,
    },
    ("PUT", "/api/v1/plugins/{plugin_id}"): {"enabled": False, "settings": {}},
    ("POST", "/api/v1/plugins/{plugin_id}/check"): {"settings": {}},
    ("POST", "/api/v1/seeds"): {"name": "Basil"},
    ("PUT", "/api/v1/seeds/{seed_id}"): {"name": "Basil"},
    ("POST", "/api/v1/seeds/{seed_id}/sown"): {},
    ("POST", "/api/v1/sites"): {
        "name": "Allotment",
        "latitude": 52.0,
        "longitude": 4.0,
        "timezone": "Europe/Amsterdam",
    },
    ("PUT", "/api/v1/sites/{site_id}"): {
        "name": "Home",
        "latitude": 52.0,
        "longitude": 4.0,
        "timezone": "Europe/Amsterdam",
    },
    ("PUT", "/api/v1/sites/{site_id}/frost-dates"): {"last_frost": "04-20", "first_frost": None},
    ("POST", "/api/v1/sites/{site_id}/locations"): {"name": "Hall", "kind": "indoor"},
    ("POST", "/api/v1/wishlist"): {"name": "Anthurium"},
    ("PUT", "/api/v1/wishlist/{wish_id}"): {"name": "Anthurium"},
}

# Paths without a session: setup and accepting an invitation. They're tested on their own.
PUBLIC = {"/api/v1/health", "/api/v1/setup", "/api/v1/invitations/{token}"}
PUBLIC_PREFIXES = ("/api/v1/invitations/{token}",)


@dataclass(frozen=True)
class Endpoint:
    method: str
    path: str

    @property
    def params(self) -> list[str]:
        return re.findall(r"{(\w+)}", self.path)

    @property
    def public(self) -> bool:
        return self.path in PUBLIC or self.path.startswith(PUBLIC_PREFIXES)


def endpoints() -> list[Endpoint]:
    paths = api.get_openapi_schema()["paths"]
    return [
        Endpoint(method.upper(), path)
        for path, operations in sorted(paths.items())
        for method in operations
    ]


@dataclass
class World:
    """A household with one of everything, and its members."""

    household: Household
    admin: Membership
    viewer: Membership
    ids: dict[str, int]


def make_household(name: str) -> World:
    household = HouseholdFactory.create(name=name)
    admin = MembershipFactory.create(household=household, role=Role.ADMIN)
    viewer = MembershipFactory.create(household=household, role=Role.VIEWER)
    site = Site.objects.create(
        household=household, name="Home", latitude=52, longitude=4, timezone="Europe/Amsterdam"
    )
    location = Location.objects.create(site=site, name="Kitchen", kind="indoor")
    light = LightSource.objects.create(location=location, kind="window", direction="E")
    plant = Plant.objects.create(household=household, nickname="Monty", location=location)
    added = plants.add_photo(plant, io.BytesIO(image_bytes(64, 48)), 1000, "")
    event = CareEvent.objects.create(
        plant=plant, care_type=builtin("water"), performed_at=timezone.now()
    )
    schedule = schedules.create_schedule(
        plant, ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 14)
    )
    care_type = CareType.objects.create(household=household, name="Mist twice")
    harvest = Harvest.objects.create(plant=plant, harvested_on=date(2026, 4, 1))
    seed = SeedPacket.objects.create(household=household, name="Tomato")
    wish = Wish.objects.create(household=household, name="Hoya")
    conversation = Conversation.objects.create(
        plant=plant, title="Yellow leaves?", updated_at=timezone.now()
    )
    invitation, _ = accounts.create_invitation(
        household=household,
        email=f"invited@{name}.example",
        role=Role.VIEWER,
        invited_by=admin.user,
    )
    channel = NotificationChannel.objects.create(
        user=viewer.user, label="Phone", url_encrypted=encrypt("ntfy://ntfy.sh/x"), service="ntfy"
    )
    ids = {
        "site_id": site.pk,
        "location_id": location.pk,
        "light_id": light.pk,
        "plant_id": plant.pk,
        "photo_id": added.pk,
        "event_id": event.pk,
        "schedule_id": schedule.pk,
        "care_type_id": care_type.pk,
        "harvest_id": harvest.pk,
        "seed_id": seed.pk,
        "wish_id": wish.pk,
        "conversation_id": conversation.pk,
        "invitation_id": invitation.pk,
        "member_id": viewer.pk,
        "user_id": viewer.user.pk,
        "channel_id": channel.pk,
        # Built-in care types, the same for everyone, for bodies that name one.
        "water_id": builtin("water").pk,
        "fertilize_id": builtin("fertilize").pk,
    }
    return World(household, admin, viewer, ids)


def fill(value: Any, ids: dict[str, int]) -> Any:
    """The example with `{name}` replaced by that id."""
    if isinstance(value, str) and re.fullmatch(r"{\w+}", value):
        return ids[value[1:-1]]
    if isinstance(value, dict):
        return {key: fill(item, ids) for key, item in value.items()}
    if isinstance(value, list):
        return [fill(item, ids) for item in value]
    return value


def call(client: Client, endpoint: Endpoint, ids: dict[str, int]) -> Any:
    url = endpoint.path.format(**{param: ids.get(param, 1) for param in endpoint.params})
    body = fill(BODIES.get((endpoint.method, endpoint.path)), ids)
    if body is not None and FILE in body.values():
        form = {key: photo() if value == FILE else value for key, value in body.items()}
        return client.generic(endpoint.method, url, **_multipart(client, form))
    if endpoint.method in ("GET", "DELETE") and body is None:
        return client.generic(endpoint.method, url)
    return client.generic(
        endpoint.method, url, json.dumps(body or {}), content_type="application/json"
    )


def _multipart(client: Client, form: dict[str, Any]) -> dict[str, Any]:
    from django.test.client import MULTIPART_CONTENT, encode_multipart

    boundary = "SweepBoundary"
    return {
        "data": encode_multipart(boundary, form),
        "content_type": f"{MULTIPART_CONTENT}; boundary={boundary}",
    }


def snapshot(world: World) -> Any:
    """Everything of the household that a request could change."""
    household = Household.objects.get(pk=world.household.pk)
    return {
        "export": exporter.build(household).model_dump(mode="json", exclude={"exported_at"}),
        "members": list(household.memberships.values_list("pk", "role").order_by("pk")),
        "invitations": list(
            Invitation.objects.filter(household=household)
            .values_list("pk", "revoked_at")
            .order_by("pk")
        ),
        "channels": list(
            NotificationChannel.objects.filter(user__memberships__household=household)
            .values_list("pk", "label", "enabled", "last_sent_at")
            .order_by("pk")
        ),
    }


@pytest.fixture
def worlds() -> tuple[World, World]:
    return make_household("ours"), make_household("theirs")


def signed_in(membership: Membership) -> Client:
    client = Client()
    client.force_login(membership.user)
    return client


def test_no_path_reaches_another_households_data(worlds: tuple[World, World]) -> None:
    ours, theirs = worlds
    admin = signed_in(ours.admin)
    before = snapshot(theirs)
    leaks = []
    for endpoint in endpoints():
        params = [p for p in endpoint.params if p not in SHARED]
        if not params or endpoint.public:
            continue
        missing = [p for p in params if p not in theirs.ids]
        assert not missing, f"{endpoint}: make_household doesn't make a {missing} yet"
        # Their ids in the path; our own in the body, so only the path can leak.
        ids = {**ours.ids, **{p: theirs.ids[p] for p in params}}
        response = call(admin, endpoint, ids)
        if response.status_code != 404:
            leaks.append(f"{endpoint.method} {endpoint.path}: {response.status_code}")

    assert leaks == []
    assert snapshot(theirs) == before


@pytest.mark.parametrize(
    ("method", "path", "body_ids"),
    [
        ("POST", "/api/v1/care-events/bulk", ["plant_id"]),
        ("POST", "/api/v1/plants/move", ["plant_id"]),
        ("POST", "/api/v1/plants/move", ["location_id"]),
        ("PUT", "/api/v1/plants/{plant_id}/cover", ["photo_id"]),
    ],
)
def test_no_body_reaches_another_households_data(
    worlds: tuple[World, World], method: str, path: str, body_ids: list[str]
) -> None:
    ours, theirs = worlds
    before = snapshot(theirs)
    ids = {**ours.ids, **{name: theirs.ids[name] for name in body_ids}}

    response = call(signed_in(ours.admin), Endpoint(method, path), ids)

    assert response.status_code in (404, 422), response.content
    assert snapshot(theirs) == before


def test_viewers_cant_change_anything_but_their_own(worlds: tuple[World, World]) -> None:
    ours, _ = worlds
    viewer = signed_in(ours.viewer)
    before = snapshot(ours)
    allowed = []
    for endpoint in endpoints():
        key = (endpoint.method, endpoint.path)
        if endpoint.method == "GET" or endpoint.public or key in A_PERSONS_OWN:
            continue
        response = call(viewer, endpoint, ours.ids)
        if response.status_code == 422:
            pytest.fail(
                f"{key}: the example body in BODIES is missing or invalid: {response.content!r}"
            )
        if response.status_code != 403:
            allowed.append(f"{endpoint.method} {endpoint.path}: {response.status_code}")

    assert allowed == []
    assert snapshot(ours) == before


def test_every_body_has_an_example() -> None:
    schema = api.get_openapi_schema()["paths"]
    without = [
        (method.upper(), path)
        for path, operations in schema.items()
        for method, operation in operations.items()
        if "requestBody" in operation
        and (method.upper(), path) not in BODIES
        and not Endpoint(method.upper(), path).public
    ]

    assert without == [], "Add an example body to BODIES in test_isolation.py"
