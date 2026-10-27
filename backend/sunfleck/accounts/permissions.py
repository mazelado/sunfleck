"""Helpers that find the signed-in user's household and check their role.

Every API endpoint that touches household data must go through `require_role`, so a missing
permission check is easy to spot in review.
"""

from django.http import HttpRequest

from sunfleck.accounts.models import Membership, Role, User
from sunfleck.core.errors import ApiError


def get_membership(user: User) -> Membership | None:
    """Return the user's household membership. Each user belongs to one household for now."""
    return user.memberships.select_related("household").first()


def require_role(request: HttpRequest, minimum: Role) -> Membership:
    """Return the signed-in user's membership if their role is at least `minimum`.

    Raises:
        ApiError: 403 if the user has no household or their role is too low.
    """
    user = request.user
    if not isinstance(user, User):  # pragma: no cover - authentication runs first
        raise ApiError(401, "not_authenticated", "Please sign in.")
    membership = get_membership(user)
    if membership is None:
        raise ApiError(403, "no_household", "Your account doesn't belong to a household.")
    if not Role(membership.role).includes(minimum):
        raise ApiError(403, "permission_denied", "Your role doesn't allow this.")
    return membership
