"""Fixtures shared by all test modules."""

from collections.abc import Callable

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Membership, Role
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory


@pytest.fixture
def household(db: None) -> Household:
    return HouseholdFactory.create()


@pytest.fixture
def member_of(household: Household) -> Callable[[Role], Membership]:
    """Create a member of the household with the given role."""

    def make(role: Role) -> Membership:
        return MembershipFactory.create(household=household, role=role)

    return make


@pytest.fixture
def client_as(member_of: Callable[[Role], Membership]) -> Callable[[Role], Client]:
    """Return a test client signed in as a new household member with the given role."""

    def make(role: Role) -> Client:
        client = Client()
        client.force_login(member_of(role).user)
        return client

    return make
