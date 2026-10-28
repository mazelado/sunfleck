"""Business operations for accounts, households, and invitations.

API endpoints call these functions; they never change account data directly.
"""

import hashlib
import secrets
from datetime import datetime, timedelta

from allauth.account import app_settings as allauth_settings
from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress
from allauth.account.utils import user_pk_to_url_str
from allauth.core import context as allauth_context
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone, translation

from sunfleck.accounts.models import (
    Household,
    Invitation,
    Membership,
    Role,
    User,
    normalize_email,
)

INVITATION_LIFETIME = timedelta(days=7)


class AccountsError(Exception):
    """Base class for account rule violations. `code` is stable and shown to API clients."""

    code = "accounts_error"


class SetupAlreadyCompletedError(AccountsError):
    code = "setup_already_completed"


class EmailInUseError(AccountsError):
    code = "email_in_use"


class InvitationInvalidError(AccountsError):
    code = "invitation_invalid"


class LastAdminError(AccountsError):
    code = "last_admin"


def needs_setup() -> bool:
    """Return whether the instance is brand new: nobody has an account yet."""
    return not User.objects.exists()


def _create_user(*, email: str, password: str, display_name: str, is_superuser: bool) -> User:
    """Create a user whose email address counts as verified (they were set up or invited).

    Their language is the one they're using: their browser's, if Sunfleck has it."""
    user = User(
        email=normalize_email(email),
        display_name=display_name.strip(),
        locale=translation.get_supported_language_variant(translation.get_language()),
    )
    user.is_staff = user.is_superuser = is_superuser
    validate_password(password, user)
    user.set_password(password)
    user.save()
    EmailAddress.objects.create(user=user, email=user.email, primary=True, verified=True)
    return user


@transaction.atomic
def complete_setup(*, email: str, password: str, display_name: str, household_name: str) -> User:
    """Create the first account, as Admin of a new household.

    The first account can also use the Django admin site.

    Raises:
        SetupAlreadyCompletedError: If any account exists already.
        django.core.exceptions.ValidationError: If the password is too weak.
    """
    # Setup happens once, by one person, so a full table lock isn't worth it. (On SQLite,
    # transactions are serialized anyway.)
    if User.objects.exists():
        raise SetupAlreadyCompletedError("Sunfleck has already been set up.")
    user = _create_user(
        email=email, password=password, display_name=display_name, is_superuser=True
    )
    household = Household.objects.create(name=household_name.strip())
    Membership.objects.create(user=user, household=household, role=Role.ADMIN)
    return user


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


@transaction.atomic
def create_invitation(
    *, household: Household, email: str, role: Role, invited_by: User
) -> tuple[Invitation, str]:
    """Invite `email` to join `household` with `role`.

    Returns the invitation and its secret token, which is needed for the invitation link and
    can't be recovered later. Earlier pending invitations for the same address are revoked.

    Raises:
        EmailInUseError: If someone already has an account with this email address.
    """
    email = normalize_email(email)
    if User.objects.filter(email=email).exists():
        raise EmailInUseError("Someone already has an account with this email address.")
    now = timezone.now()
    household.invitations.filter(
        email=email, accepted_at__isnull=True, revoked_at__isnull=True
    ).update(revoked_at=now)
    raw_token = secrets.token_urlsafe(32)
    invitation = Invitation.objects.create(
        household=household,
        email=email,
        role=role,
        token_hash=_hash_token(raw_token),
        invited_by=invited_by,
        expires_at=now + INVITATION_LIFETIME,
    )
    return invitation, raw_token


def get_pending_invitation(raw_token: str) -> Invitation:
    """Return the pending invitation for `raw_token`.

    Raises:
        InvitationInvalidError: If there's no such invitation, or it was used, revoked, or
            has expired.
    """
    invitation = (
        Invitation.objects.select_related("household", "invited_by")
        .filter(token_hash=_hash_token(raw_token))
        .first()
    )
    if invitation is None or not invitation.is_pending(timezone.now()):
        raise InvitationInvalidError("This invitation link is invalid or has expired.")
    return invitation


@transaction.atomic
def accept_invitation(*, raw_token: str, display_name: str, password: str) -> User:
    """Create an account for the invited person and add them to the household.

    Raises:
        InvitationInvalidError: If the invitation can't be used.
        EmailInUseError: If an account with the invited address was created meanwhile.
        django.core.exceptions.ValidationError: If the password is too weak.
    """
    invitation = get_pending_invitation(raw_token)
    if User.objects.filter(email=invitation.email).exists():
        raise EmailInUseError("Someone already has an account with this email address.")
    user = _create_user(
        email=invitation.email, password=password, display_name=display_name, is_superuser=False
    )
    Membership.objects.create(user=user, household=invitation.household, role=invitation.role)
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["accepted_at"])
    return user


def revoke_invitation(invitation: Invitation, *, now: datetime | None = None) -> None:
    """Make an invitation link stop working."""
    if invitation.revoked_at is None:
        invitation.revoked_at = now or timezone.now()
        invitation.save(update_fields=["revoked_at"])


def _is_last_admin(membership: Membership) -> bool:
    if membership.role != Role.ADMIN:
        return False
    other_admins = membership.household.memberships.filter(role=Role.ADMIN).exclude(
        pk=membership.pk
    )
    return not other_admins.exists()


@transaction.atomic
def change_role(membership: Membership, role: Role) -> Membership:
    """Give a member a different role.

    Raises:
        LastAdminError: If this would leave the household without an Admin.
    """
    if role != Role.ADMIN and _is_last_admin(membership):
        raise LastAdminError("A household needs at least one Admin.")
    membership.role = role
    membership.save(update_fields=["role", "updated_at"])
    return membership


@transaction.atomic
def remove_member(membership: Membership) -> None:
    """Remove someone from the household and delete their account.

    Each account belongs to exactly one household for now, so an account without a household
    would be useless. Their data (care events etc.) stays, without their name.

    Raises:
        LastAdminError: If this would leave the household without an Admin.
    """
    if _is_last_admin(membership):
        raise LastAdminError("A household needs at least one Admin.")
    membership.user.delete()


def password_reset_url(request: HttpRequest, user: User) -> str:
    """Return a link that lets `user` choose a new password, for an Admin to pass on.

    Works without email being configured. The link stops working once it's used or the user's
    password changes.
    """
    token = allauth_settings.PASSWORD_RESET_TOKEN_GENERATOR().make_token(user)
    key = f"{user_pk_to_url_str(user)}-{token}"
    # allauth builds the URL from the request it's handling; make sure it knows this one.
    with allauth_context.request_context(request):
        return str(get_adapter(request).get_reset_password_from_key_url(key))
