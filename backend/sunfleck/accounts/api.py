"""Account API: first-run setup, the signed-in user's profile, household members, invitations.

Signing in, signing out, and password resets are handled by django-allauth's headless API
under /_allauth/browser/v1/.
"""

import logging
from datetime import datetime

from django.conf import settings
from django.contrib.auth import login
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import HttpRequest
from django.utils import timezone
from django.utils.translation import gettext as _
from ninja import Router, Schema, Status
from ninja.security import django_auth
from ninja.utils import check_csrf
from pydantic import Field, field_validator

from sunfleck.accounts import services
from sunfleck.accounts.models import Household, Invitation, Membership, Role, UnitSystem, User
from sunfleck.accounts.permissions import get_membership, require_role
from sunfleck.core.errors import ApiError

logger = logging.getLogger(__name__)

router = Router(tags=["accounts"], auth=django_auth)

ALLAUTH_BACKEND = "allauth.account.auth_backends.AuthenticationBackend"

# --- Schemas ----------------------------------------------------------------------------------


class EmailSchema(Schema):
    email: str

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        try:
            validate_email(value.strip())
        except DjangoValidationError as exc:
            raise ValueError("Enter a valid email address.") from exc
        return value.strip()


class HouseholdOut(Schema):
    id: int
    name: str


class MeOut(Schema):
    id: int
    email: str
    display_name: str
    locale: str
    unit_system: UnitSystem
    household: HouseholdOut | None
    role: Role | None


class MeUpdate(Schema):
    display_name: str | None = Field(default=None, max_length=150)
    locale: str | None = None
    unit_system: UnitSystem | None = None

    @field_validator("locale")
    @classmethod
    def _known_locale(cls, value: str | None) -> str | None:
        if value is not None and value not in dict(settings.LANGUAGES):
            raise ValueError("Unknown language code.")
        return value


class SetupStatusOut(Schema):
    needs_setup: bool


class SetupIn(EmailSchema):
    password: str
    display_name: str = Field(max_length=150)
    household_name: str = Field(min_length=1, max_length=100)


class HouseholdUpdate(Schema):
    name: str = Field(min_length=1, max_length=100)


class MemberOut(Schema):
    id: int
    user_id: int
    email: str
    display_name: str
    role: Role


class MemberUpdate(Schema):
    role: Role


class LinkOut(Schema):
    url: str


class InvitationIn(EmailSchema):
    role: Role = Role.GARDENER


class InvitationOut(Schema):
    id: int
    email: str
    role: Role
    invited_by: str | None
    created_at: datetime
    expires_at: datetime


class InvitationCreatedOut(InvitationOut):
    url: str
    email_sent: bool


class InvitationPreviewOut(Schema):
    household_name: str
    email: str
    role: Role
    invited_by: str | None


class AcceptInvitationIn(Schema):
    display_name: str = Field(max_length=150)
    password: str


# --- Helpers ----------------------------------------------------------------------------------


def _user(request: HttpRequest) -> User:
    """Return the signed-in user. Only for endpoints that require signing in."""
    user = request.user
    if not isinstance(user, User):  # pragma: no cover - authentication runs first
        raise ApiError(401, "not_authenticated", "Please sign in.")
    return user


def _require_csrf(request: HttpRequest) -> None:
    """Endpoints that work without signing in must still be protected against CSRF."""
    if check_csrf(request) is not None:
        raise ApiError(403, "csrf_failed", "Your session expired. Reload the page and retry.")


def _accounts_error(exc: services.AccountsError, status: int = 409) -> ApiError:
    return ApiError(status, exc.code, str(exc))


def _password_error(exc: DjangoValidationError) -> ApiError:
    return ApiError(
        422, "weak_password", "Please choose a stronger password.", {"password": exc.messages}
    )


def _me(user: User) -> MeOut:
    membership = get_membership(user)
    return MeOut(
        id=user.pk,
        email=user.email,
        display_name=user.display_name,
        locale=user.locale,
        unit_system=UnitSystem(user.unit_system),
        household=(
            HouseholdOut(id=membership.household.pk, name=membership.household.name)
            if membership
            else None
        ),
        role=Role(membership.role) if membership else None,
    )


def _member(membership: Membership) -> MemberOut:
    return MemberOut(
        id=membership.pk,
        user_id=membership.user.pk,
        email=membership.user.email,
        display_name=membership.user.display_name,
        role=Role(membership.role),
    )


def _invitation(invitation: Invitation) -> InvitationOut:
    return InvitationOut(
        id=invitation.pk,
        email=invitation.email,
        role=Role(invitation.role),
        invited_by=invitation.invited_by.get_short_name() if invitation.invited_by else None,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
    )


def _get_member(household: Household, member_id: int) -> Membership:
    membership = (
        household.memberships.select_related("user", "household").filter(pk=member_id).first()
    )
    if membership is None:
        raise ApiError(404, "member_not_found", "This member doesn't exist.")
    return membership


def _send_invitation_email(request: HttpRequest, invitation: Invitation, url: str) -> bool:
    """Email the invitation link. Returns whether it was sent by a real email server."""
    inviter = invitation.invited_by.get_short_name() if invitation.invited_by else "Someone"
    subject = _("You're invited to %(household)s on Sunfleck") % {
        "household": invitation.household.name
    }
    body = _(
        "%(inviter)s invited you to join %(household)s on Sunfleck, a plant care app.\n\n"
        "Accept the invitation and create your account here:\n%(url)s\n\n"
        "The link works for 7 days."
    ) % {"inviter": inviter, "household": invitation.household.name, "url": url}
    try:
        send_mail(subject, body, None, [invitation.email])
    except OSError:
        logger.exception("Couldn't send the invitation email to %s", invitation.email)
        return False
    return bool(settings.SUNFLECK_EMAIL_CONFIGURED)


# --- First-run setup --------------------------------------------------------------------------


@router.get("/setup", response=SetupStatusOut, auth=None)
def setup_status(request: HttpRequest) -> SetupStatusOut:
    """Report whether Sunfleck still needs its first account."""
    return SetupStatusOut(needs_setup=services.needs_setup())


@router.post("/setup", response={201: MeOut}, auth=None)
def setup(request: HttpRequest, data: SetupIn) -> Status[MeOut]:
    """Create the first account (an Admin) and its household, then sign in."""
    _require_csrf(request)
    try:
        user = services.complete_setup(
            email=data.email,
            password=data.password,
            display_name=data.display_name,
            household_name=data.household_name,
        )
    except services.SetupAlreadyCompletedError as exc:
        raise _accounts_error(exc) from exc
    except DjangoValidationError as exc:
        raise _password_error(exc) from exc
    login(request, user, backend=ALLAUTH_BACKEND)
    return Status(201, _me(user))


# --- The signed-in user -----------------------------------------------------------------------


@router.get("/me", response=MeOut)
def get_me(request: HttpRequest) -> MeOut:
    return _me(_user(request))


@router.patch("/me", response=MeOut)
def update_me(request: HttpRequest, data: MeUpdate) -> MeOut:
    user = _user(request)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "display_name" in changes:
        changes["display_name"] = changes["display_name"].strip()
    for field, value in changes.items():
        setattr(user, field, value)
    user.save(update_fields=[*changes.keys()])
    return _me(user)


# --- Household and members --------------------------------------------------------------------


@router.get("/household", response=HouseholdOut)
def get_household(request: HttpRequest) -> HouseholdOut:
    household = require_role(request, Role.VIEWER).household
    return HouseholdOut(id=household.pk, name=household.name)


@router.patch("/household", response=HouseholdOut)
def update_household(request: HttpRequest, data: HouseholdUpdate) -> HouseholdOut:
    household = require_role(request, Role.ADMIN).household
    household.name = data.name.strip()
    household.save(update_fields=["name", "updated_at"])
    return HouseholdOut(id=household.pk, name=household.name)


@router.get("/household/members", response=list[MemberOut])
def list_members(request: HttpRequest) -> list[MemberOut]:
    household = require_role(request, Role.VIEWER).household
    members = household.memberships.select_related("user").order_by("created_at")
    return [_member(m) for m in members]


@router.patch("/household/members/{member_id}", response=MemberOut)
def update_member(request: HttpRequest, member_id: int, data: MemberUpdate) -> MemberOut:
    household = require_role(request, Role.ADMIN).household
    membership = _get_member(household, member_id)
    try:
        services.change_role(membership, data.role)
    except services.LastAdminError as exc:
        raise _accounts_error(exc) from exc
    return _member(membership)


@router.delete("/household/members/{member_id}", response={204: None})
def remove_member(request: HttpRequest, member_id: int) -> Status[None]:
    household = require_role(request, Role.ADMIN).household
    membership = _get_member(household, member_id)
    try:
        services.remove_member(membership)
    except services.LastAdminError as exc:
        raise _accounts_error(exc) from exc
    return Status(204, None)


@router.post("/household/members/{member_id}/password-reset-link", response=LinkOut)
def create_password_reset_link(request: HttpRequest, member_id: int) -> LinkOut:
    """Create a link that lets a member choose a new password, for when email isn't set up."""
    household = require_role(request, Role.ADMIN).household
    membership = _get_member(household, member_id)
    return LinkOut(url=services.password_reset_url(request, membership.user))


# --- Invitations ------------------------------------------------------------------------------


@router.get("/household/invitations", response=list[InvitationOut])
def list_invitations(request: HttpRequest) -> list[InvitationOut]:
    household = require_role(request, Role.ADMIN).household
    pending = household.invitations.select_related("invited_by").filter(
        accepted_at__isnull=True, revoked_at__isnull=True, expires_at__gt=timezone.now()
    )
    return [_invitation(i) for i in pending.order_by("-created_at")]


@router.post("/household/invitations", response={201: InvitationCreatedOut})
def create_invitation(request: HttpRequest, data: InvitationIn) -> Status[InvitationCreatedOut]:
    membership = require_role(request, Role.ADMIN)
    try:
        invitation, raw_token = services.create_invitation(
            household=membership.household,
            email=data.email,
            role=data.role,
            invited_by=_user(request),
        )
    except services.EmailInUseError as exc:
        raise _accounts_error(exc) from exc
    url = request.build_absolute_uri(f"/invite/{raw_token}")
    email_sent = _send_invitation_email(request, invitation, url)
    out = InvitationCreatedOut(
        **_invitation(invitation).model_dump(), url=url, email_sent=email_sent
    )
    return Status(201, out)


@router.delete("/household/invitations/{invitation_id}", response={204: None})
def revoke_invitation(request: HttpRequest, invitation_id: int) -> Status[None]:
    household = require_role(request, Role.ADMIN).household
    invitation = household.invitations.filter(pk=invitation_id).first()
    if invitation is None:
        raise ApiError(404, "invitation_not_found", "This invitation doesn't exist.")
    services.revoke_invitation(invitation)
    return Status(204, None)


@router.get("/invitations/{token}", response=InvitationPreviewOut, auth=None)
def preview_invitation(request: HttpRequest, token: str) -> InvitationPreviewOut:
    """Show who invited whom, so the invite page can greet the person. No sign-in needed."""
    try:
        invitation = services.get_pending_invitation(token)
    except services.InvitationInvalidError as exc:
        raise _accounts_error(exc, status=404) from exc
    return InvitationPreviewOut(
        household_name=invitation.household.name,
        email=invitation.email,
        role=Role(invitation.role),
        invited_by=invitation.invited_by.get_short_name() if invitation.invited_by else None,
    )


@router.post("/invitations/{token}/accept", response={201: MeOut}, auth=None)
def accept_invitation(request: HttpRequest, token: str, data: AcceptInvitationIn) -> Status[MeOut]:
    """Create the invited person's account, then sign them in."""
    _require_csrf(request)
    try:
        user = services.accept_invitation(
            raw_token=token, display_name=data.display_name, password=data.password
        )
    except services.InvitationInvalidError as exc:
        raise _accounts_error(exc, status=404) from exc
    except services.EmailInUseError as exc:
        raise _accounts_error(exc) from exc
    except DjangoValidationError as exc:
        raise _password_error(exc) from exc
    login(request, user, backend=ALLAUTH_BACKEND)
    return Status(201, _me(user))
