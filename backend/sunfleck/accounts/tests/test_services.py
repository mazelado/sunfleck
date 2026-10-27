from collections.abc import Callable
from datetime import timedelta

import pytest
import time_machine
from allauth.account.models import EmailAddress
from django.core.exceptions import ValidationError
from django.test import RequestFactory
from django.utils import timezone

from sunfleck.accounts import services
from sunfleck.accounts.models import Household, Invitation, Membership, Role, User
from sunfleck.accounts.tests.factories import DEFAULT_PASSWORD, UserFactory

STRONG_PASSWORD = "a long and unusual passphrase"


def _setup(**overrides: str) -> User:
    fields = {
        "email": "Admin@Example.com",
        "password": STRONG_PASSWORD,
        "display_name": " Ada ",
        "household_name": " Fern Gully ",
        **overrides,
    }
    return services.complete_setup(**fields)


# --- Setup ------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_needs_setup_until_the_first_account_exists() -> None:
    assert services.needs_setup()

    _setup()

    assert not services.needs_setup()


@pytest.mark.django_db
def test_setup_creates_an_admin_with_a_household() -> None:
    user = _setup()

    membership = user.memberships.get()
    assert user.email == "admin@example.com"
    assert user.display_name == "Ada"
    assert user.is_superuser
    assert user.check_password(STRONG_PASSWORD)
    assert membership.role == Role.ADMIN
    assert membership.household.name == "Fern Gully"
    assert EmailAddress.objects.filter(user=user, verified=True, primary=True).exists()


@pytest.mark.django_db
def test_setup_can_only_happen_once() -> None:
    _setup()

    with pytest.raises(services.SetupAlreadyCompletedError):
        _setup(email="second@example.com")


@pytest.mark.django_db
def test_setup_rejects_weak_passwords() -> None:
    with pytest.raises(ValidationError):
        _setup(password="password")

    assert services.needs_setup()


# --- Invitations ------------------------------------------------------------------------------


@pytest.fixture
def admin(member_of: Callable[[Role], Membership]) -> Membership:
    return member_of(Role.ADMIN)


@pytest.mark.django_db
def test_invitation_stores_only_a_hash_of_its_token(admin: Membership) -> None:
    invitation, token = services.create_invitation(
        household=admin.household, email=" New@Example.com", role=Role.VIEWER, invited_by=admin.user
    )

    assert invitation.email == "new@example.com"
    assert token not in invitation.token_hash
    assert services.get_pending_invitation(token) == invitation


@pytest.mark.django_db
def test_new_invitation_revokes_earlier_ones_for_the_same_email(admin: Membership) -> None:
    first, first_token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )
    services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.ADMIN, invited_by=admin.user
    )

    first.refresh_from_db()
    assert first.revoked_at is not None
    with pytest.raises(services.InvitationInvalidError):
        services.get_pending_invitation(first_token)


@pytest.mark.django_db
def test_cannot_invite_an_existing_account(admin: Membership) -> None:
    UserFactory.create(email="taken@example.com")

    with pytest.raises(services.EmailInUseError):
        services.create_invitation(
            household=admin.household,
            email="Taken@example.com",
            role=Role.VIEWER,
            invited_by=admin.user,
        )


@pytest.mark.django_db
def test_invitations_expire_after_seven_days(admin: Membership) -> None:
    _, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )

    with time_machine.travel(timezone.now() + timedelta(days=6, hours=23)):
        services.get_pending_invitation(token)
    with (
        time_machine.travel(timezone.now() + timedelta(days=7, minutes=1)),
        pytest.raises(services.InvitationInvalidError),
    ):
        services.get_pending_invitation(token)


@pytest.mark.django_db
def test_unknown_and_revoked_invitations_are_invalid(admin: Membership) -> None:
    invitation, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )
    services.revoke_invitation(invitation)

    with pytest.raises(services.InvitationInvalidError):
        services.get_pending_invitation(token)
    with pytest.raises(services.InvitationInvalidError):
        services.get_pending_invitation("not-a-real-token")


@pytest.mark.django_db
def test_accepting_creates_a_member_with_the_invited_role(admin: Membership) -> None:
    _, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )

    user = services.accept_invitation(
        raw_token=token, display_name="Basil", password=STRONG_PASSWORD
    )

    membership = user.memberships.get()
    assert user.email == "new@example.com"
    assert not user.is_staff
    assert membership.household == admin.household
    assert membership.role == Role.VIEWER
    assert Invitation.objects.get().accepted_at is not None


@pytest.mark.django_db
def test_an_invitation_can_only_be_accepted_once(admin: Membership) -> None:
    _, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )
    services.accept_invitation(raw_token=token, display_name="Basil", password=STRONG_PASSWORD)

    with pytest.raises(services.InvitationInvalidError):
        services.accept_invitation(raw_token=token, display_name="Eve", password=STRONG_PASSWORD)


@pytest.mark.django_db
def test_accepting_fails_if_the_email_was_taken_meanwhile(admin: Membership) -> None:
    _, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )
    UserFactory.create(email="new@example.com")

    with pytest.raises(services.EmailInUseError):
        services.accept_invitation(raw_token=token, display_name="B", password=STRONG_PASSWORD)


@pytest.mark.django_db
def test_accepting_rejects_weak_passwords(admin: Membership) -> None:
    _, token = services.create_invitation(
        household=admin.household, email="new@example.com", role=Role.VIEWER, invited_by=admin.user
    )

    with pytest.raises(ValidationError):
        services.accept_invitation(raw_token=token, display_name="Basil", password="12345678")

    assert services.get_pending_invitation(token)


# --- Roles and members ------------------------------------------------------------------------


@pytest.mark.django_db
def test_admin_can_change_roles(admin: Membership, member_of: Callable[[Role], Membership]) -> None:
    viewer = member_of(Role.VIEWER)

    services.change_role(viewer, Role.ADMIN)
    services.change_role(admin, Role.GARDENER)

    viewer.refresh_from_db()
    admin.refresh_from_db()
    assert viewer.role == Role.ADMIN
    assert admin.role == Role.GARDENER


@pytest.mark.django_db
def test_the_last_admin_cannot_be_demoted_or_removed(admin: Membership) -> None:
    with pytest.raises(services.LastAdminError):
        services.change_role(admin, Role.VIEWER)
    with pytest.raises(services.LastAdminError):
        services.remove_member(admin)


@pytest.mark.django_db
def test_removing_a_member_deletes_their_account(
    admin: Membership, member_of: Callable[[Role], Membership]
) -> None:
    gardener = member_of(Role.GARDENER)

    services.remove_member(gardener)

    assert not User.objects.filter(pk=gardener.user.pk).exists()
    assert Household.objects.filter(pk=admin.household.pk).exists()


@pytest.mark.django_db
def test_password_reset_url_points_to_the_frontend(admin: Membership) -> None:
    request = RequestFactory().get("/")

    url = services.password_reset_url(request, admin.user)

    assert url.startswith("http://testserver/reset-password/")
    assert admin.user.check_password(DEFAULT_PASSWORD)
