from collections.abc import Callable

import pytest

from sunfleck.accounts.admin import MembershipForm
from sunfleck.accounts.models import Membership, Role
from sunfleck.accounts.permissions import get_membership
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory

pytestmark = pytest.mark.django_db


def test_a_second_membership_is_refused_in_the_admin_site(
    member_of: Callable[[Role], Membership],
) -> None:
    member = member_of(Role.ADMIN)
    elsewhere = HouseholdFactory.create(name="Elsewhere")

    form = MembershipForm(
        data={"user": member.user.pk, "household": elsewhere.pk, "role": Role.VIEWER}
    )

    assert not form.is_valid()
    assert "already belongs to a household" in str(form.errors)
    assert not elsewhere.memberships.exists()


def test_an_existing_membership_can_still_be_edited_in_the_admin_site(
    member_of: Callable[[Role], Membership],
) -> None:
    member = member_of(Role.GARDENER)

    form = MembershipForm(
        data={"user": member.user.pk, "household": member.household.pk, "role": Role.VIEWER},
        instance=member,
    )

    assert form.is_valid(), form.errors


def test_someone_with_two_memberships_always_gets_the_oldest(
    member_of: Callable[[Role], Membership],
) -> None:
    first = member_of(Role.ADMIN)
    # Made outside the admin site, which would refuse it.
    MembershipFactory.create(user=first.user, household=HouseholdFactory.create(name="Later"))

    assert get_membership(first.user) == first
