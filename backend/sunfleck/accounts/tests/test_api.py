import json
from collections.abc import Callable
from typing import Any

import pytest
from django.core import mail
from django.test import Client
from pytest_django.fixtures import Settings

from sunfleck.accounts import services
from sunfleck.accounts.models import Household, Invitation, Membership, Role, User
from sunfleck.accounts.tests.factories import (
    DEFAULT_PASSWORD,
    HouseholdFactory,
    MembershipFactory,
    UserFactory,
)

STRONG_PASSWORD = "a long and unusual passphrase"
ClientAs = Callable[[Role], Client]


def post(client: Client, url: str, data: dict[str, Any] | None = None) -> Any:
    return client.post(url, json.dumps(data or {}), content_type="application/json")


def patch(client: Client, url: str, data: dict[str, Any]) -> Any:
    return client.patch(url, json.dumps(data), content_type="application/json")


def csrf_client() -> Client:
    """A client that, like a browser, must send the CSRF token with every change."""
    client = Client(enforce_csrf_checks=True)
    client.get("/")  # the frontend page sets the CSRF cookie
    return client


def csrf_post(client: Client, url: str, data: dict[str, Any]) -> Any:
    token = client.cookies["csrftoken"].value
    return client.post(
        url, json.dumps(data), content_type="application/json", headers={"X-CSRFToken": token}
    )


# --- Setup ------------------------------------------------------------------------------------

SETUP_DATA = {
    "email": "ada@example.com",
    "password": STRONG_PASSWORD,
    "display_name": "Ada",
    "household_name": "Fern Gully",
}


@pytest.mark.django_db
def test_setup_creates_the_first_admin_and_signs_in() -> None:
    client = csrf_client()
    assert client.get("/api/v1/setup").json() == {"needs_setup": True}

    response = csrf_post(client, "/api/v1/setup", SETUP_DATA)

    assert response.status_code == 201
    assert response.json()["role"] == "admin"
    assert response.json()["household"]["name"] == "Fern Gully"
    assert client.get("/api/v1/me").json()["email"] == "ada@example.com"
    assert client.get("/api/v1/setup").json() == {"needs_setup": False}


@pytest.mark.django_db
def test_setup_status_sets_the_csrf_cookie_needed_to_complete_setup() -> None:
    # During development Vite serves the page, so this API call is where the cookie comes from.
    client = Client(enforce_csrf_checks=True)
    client.get("/api/v1/setup")

    response = csrf_post(client, "/api/v1/setup", SETUP_DATA)

    assert response.status_code == 201


@pytest.mark.django_db
def test_setup_requires_the_csrf_token() -> None:
    client = csrf_client()

    response = post(client, "/api/v1/setup", SETUP_DATA)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"
    assert services.needs_setup()


@pytest.mark.django_db
def test_setup_is_refused_once_done() -> None:
    UserFactory.create()

    response = post(Client(), "/api/v1/setup", SETUP_DATA)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "setup_already_completed"


@pytest.mark.django_db
def test_setup_explains_weak_passwords() -> None:
    response = post(Client(), "/api/v1/setup", {**SETUP_DATA, "password": "password"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "weak_password"
    assert response.json()["error"]["details"]["password"]


@pytest.mark.django_db
def test_setup_validates_the_email_address() -> None:
    response = post(Client(), "/api/v1/setup", {**SETUP_DATA, "email": "not-an-email"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


# --- Signing in (django-allauth) --------------------------------------------------------------


@pytest.mark.django_db
def test_sign_in_with_email_and_password(member_of: Callable[[Role], Membership]) -> None:
    user = member_of(Role.GARDENER).user
    client = csrf_client()

    response = csrf_post(
        client,
        "/_allauth/browser/v1/auth/login",
        {"email": user.email.upper(), "password": DEFAULT_PASSWORD},
    )

    assert response.status_code == 200
    assert client.get("/api/v1/me").json()["email"] == user.email


@pytest.mark.django_db
def test_sign_in_fails_with_a_wrong_password(member_of: Callable[[Role], Membership]) -> None:
    user = member_of(Role.GARDENER).user
    client = csrf_client()

    response = csrf_post(
        client, "/_allauth/browser/v1/auth/login", {"email": user.email, "password": "wrong"}
    )

    assert response.status_code == 400
    assert client.get("/api/v1/me").status_code == 401


@pytest.mark.django_db
def test_nobody_can_sign_up_on_their_own() -> None:
    client = csrf_client()

    response = csrf_post(
        client,
        "/_allauth/browser/v1/auth/signup",
        {"email": "stranger@example.com", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 403
    assert not User.objects.exists()


@pytest.mark.django_db
def test_password_reset_link_lets_the_member_choose_a_new_password(client_as: ClientAs) -> None:
    admin_client = client_as(Role.ADMIN)
    gardener = MembershipFactory.create(household=Household.objects.get(), role=Role.GARDENER)
    link = post(
        admin_client, f"/api/v1/household/members/{gardener.pk}/password-reset-link"
    ).json()["url"]
    key = link.rsplit("/reset-password/", 1)[1]
    client = csrf_client()

    response = csrf_post(
        client,
        "/_allauth/browser/v1/auth/password/reset",
        {"key": key, "password": STRONG_PASSWORD},
    )

    assert response.status_code == 200
    gardener.user.refresh_from_db()
    assert gardener.user.check_password(STRONG_PASSWORD)


@pytest.mark.django_db
def test_forgot_password_emails_a_reset_link(member_of: Callable[[Role], Membership]) -> None:
    user = member_of(Role.GARDENER).user
    client = csrf_client()

    response = csrf_post(
        client, "/_allauth/browser/v1/auth/password/request", {"email": user.email}
    )

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert "/reset-password/" in mail.outbox[0].body


# --- Me ---------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_me_requires_signing_in() -> None:
    response = Client().get("/api/v1/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_me_shows_profile_household_and_role(client_as: ClientAs) -> None:
    data = client_as(Role.VIEWER).get("/api/v1/me").json()

    assert data["role"] == "viewer"
    assert data["household"]["name"] == "Green House"
    assert data["unit_system"] == "metric"


@pytest.mark.django_db
def test_update_me_changes_only_the_given_fields(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    response = patch(client, "/api/v1/me", {"display_name": " Basil ", "unit_system": "imperial"})

    assert response.status_code == 200
    assert response.json()["display_name"] == "Basil"
    assert response.json()["unit_system"] == "imperial"
    assert response.json()["locale"] == "en"


@pytest.mark.django_db
def test_update_me_rejects_unknown_languages(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)

    assert patch(client, "/api/v1/me", {"locale": "de"}).json()["locale"] == "de"
    assert patch(client, "/api/v1/me", {"locale": "klingon"}).status_code == 422


@pytest.mark.django_db
def test_signed_in_changes_require_the_csrf_token(
    member_of: Callable[[Role], Membership],
) -> None:
    client = csrf_client()
    client.force_login(member_of(Role.ADMIN).user)

    without_token = patch(client, "/api/v1/household", {"name": "Hijacked"})
    token = client.cookies["csrftoken"].value
    with_token = client.patch(
        "/api/v1/household",
        json.dumps({"name": "Jungle"}),
        content_type="application/json",
        headers={"X-CSRFToken": token},
    )

    assert without_token.status_code == 403
    assert with_token.status_code == 200
    assert Household.objects.get().name == "Jungle"


@pytest.mark.django_db
def test_update_me_rejects_unknown_unit_systems(client_as: ClientAs) -> None:
    response = patch(client_as(Role.VIEWER), "/api/v1/me", {"unit_system": "cubits"})

    assert response.status_code == 422


@pytest.mark.django_db
def test_user_without_household_gets_a_clear_error() -> None:
    client = Client()
    client.force_login(UserFactory.create())

    response = client.get("/api/v1/household")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "no_household"
    assert client.get("/api/v1/me").json()["household"] is None


# --- Household and members --------------------------------------------------------------------


@pytest.mark.django_db
def test_any_member_can_see_the_household_and_members(client_as: ClientAs) -> None:
    client = client_as(Role.VIEWER)
    client_as(Role.ADMIN)

    assert client.get("/api/v1/household").json()["name"] == "Green House"
    members = client.get("/api/v1/household/members").json()
    assert [m["role"] for m in members] == ["viewer", "admin"]


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.GARDENER])
def test_only_admins_can_rename_the_household(client_as: ClientAs, role: Role) -> None:
    response = patch(client_as(role), "/api/v1/household", {"name": "Jungle"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


@pytest.mark.django_db
def test_admin_can_rename_the_household(client_as: ClientAs) -> None:
    response = patch(client_as(Role.ADMIN), "/api/v1/household", {"name": " Jungle "})

    assert response.json()["name"] == "Jungle"


@pytest.mark.django_db
def test_admin_can_change_a_members_role(
    client_as: ClientAs, member_of: Callable[[Role], Membership]
) -> None:
    client = client_as(Role.ADMIN)
    viewer = member_of(Role.VIEWER)

    response = patch(client, f"/api/v1/household/members/{viewer.pk}", {"role": "gardener"})

    assert response.status_code == 200
    assert response.json()["role"] == "gardener"


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.GARDENER])
def test_non_admins_cannot_manage_members(
    client_as: ClientAs, member_of: Callable[[Role], Membership], role: Role
) -> None:
    client = client_as(role)
    other = member_of(Role.VIEWER)

    assert (
        patch(client, f"/api/v1/household/members/{other.pk}", {"role": "admin"}).status_code == 403
    )
    assert client.delete(f"/api/v1/household/members/{other.pk}").status_code == 403
    url = f"/api/v1/household/members/{other.pk}/password-reset-link"
    assert post(client, url).status_code == 403


@pytest.mark.django_db
def test_the_last_admin_cannot_demote_themselves(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    me = Membership.objects.get()

    response = patch(client, f"/api/v1/household/members/{me.pk}", {"role": "viewer"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "last_admin"


@pytest.mark.django_db
def test_admin_can_remove_a_member(
    client_as: ClientAs, member_of: Callable[[Role], Membership]
) -> None:
    client = client_as(Role.ADMIN)
    gardener = member_of(Role.GARDENER)

    response = client.delete(f"/api/v1/household/members/{gardener.pk}")

    assert response.status_code == 204
    assert not User.objects.filter(pk=gardener.user.pk).exists()


@pytest.mark.django_db
def test_admins_cannot_touch_other_households(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    stranger = MembershipFactory.create(household=HouseholdFactory.create(name="Elsewhere"))

    response = patch(client, f"/api/v1/household/members/{stranger.pk}", {"role": "viewer"})

    assert response.status_code == 404
    assert client.delete(f"/api/v1/household/members/{stranger.pk}").status_code == 404


# --- Invitations ------------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_invites_someone_and_gets_a_link(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)

    response = post(
        client, "/api/v1/household/invitations", {"email": "new@example.com", "role": "viewer"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["url"].startswith("http://testserver/invite/")
    assert data["email_sent"] is False  # no email server is configured in tests
    assert len(mail.outbox) == 1
    assert data["url"] in mail.outbox[0].body
    assert [i["email"] for i in client.get("/api/v1/household/invitations").json()] == [
        "new@example.com"
    ]


@pytest.mark.django_db
def test_email_sent_is_reported_when_an_email_server_is_configured(
    client_as: ClientAs, settings: Settings
) -> None:
    settings.SUNFLECK_EMAIL_CONFIGURED = True

    response = post(client_as(Role.ADMIN), "/api/v1/household/invitations", {"email": "n@x.org"})

    assert response.json()["email_sent"] is True


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.GARDENER])
def test_only_admins_can_invite(client_as: ClientAs, role: Role) -> None:
    client = client_as(role)

    response = post(client, "/api/v1/household/invitations", {"email": "new@example.com"})

    assert response.status_code == 403
    assert client.get("/api/v1/household/invitations").status_code == 403
    assert not Invitation.objects.exists()


@pytest.mark.django_db
def test_inviting_an_existing_account_is_refused(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    UserFactory.create(email="taken@example.com")

    response = post(client, "/api/v1/household/invitations", {"email": "taken@example.com"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_in_use"


@pytest.mark.django_db
def test_admin_can_revoke_an_invitation(client_as: ClientAs) -> None:
    client = client_as(Role.ADMIN)
    invitation_id = post(
        client, "/api/v1/household/invitations", {"email": "new@example.com"}
    ).json()["id"]

    assert client.delete(f"/api/v1/household/invitations/{invitation_id}").status_code == 204
    assert client.get("/api/v1/household/invitations").json() == []
    assert client.delete("/api/v1/household/invitations/999").status_code == 404


@pytest.mark.django_db
def test_invited_person_previews_and_accepts_the_invitation(client_as: ClientAs) -> None:
    admin_client = client_as(Role.ADMIN)
    url = post(
        admin_client,
        "/api/v1/household/invitations",
        {"email": "new@example.com", "role": "viewer"},
    ).json()["url"]
    token = url.rsplit("/invite/", 1)[1]
    client = csrf_client()

    preview = client.get(f"/api/v1/invitations/{token}").json()
    response = csrf_post(
        client,
        f"/api/v1/invitations/{token}/accept",
        {"display_name": "Basil", "password": STRONG_PASSWORD},
    )

    assert preview["household_name"] == "Green House"
    assert preview["email"] == "new@example.com"
    assert response.status_code == 201
    assert response.json()["role"] == "viewer"
    assert client.get("/api/v1/me").json()["email"] == "new@example.com"


@pytest.mark.django_db
def test_invalid_invitation_links_are_not_found() -> None:
    client = Client()

    assert client.get("/api/v1/invitations/nope").status_code == 404
    response = post(
        client,
        "/api/v1/invitations/nope/accept",
        {"display_name": "B", "password": STRONG_PASSWORD},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "invitation_invalid"


@pytest.mark.django_db
def test_accepting_requires_the_csrf_token() -> None:
    household = HouseholdFactory.create()
    inviter = MembershipFactory.create(household=household, role=Role.ADMIN).user
    _, token = services.create_invitation(
        household=household, email="new@example.com", role=Role.VIEWER, invited_by=inviter
    )

    response = post(
        csrf_client(),
        f"/api/v1/invitations/{token}/accept",
        {"display_name": "Basil", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 403
    assert not User.objects.filter(email="new@example.com").exists()
