"""Fixtures shared by all test modules."""

from collections.abc import Callable

import pytest
from django.test import Client
from hypothesis import settings

from sunfleck.accounts.models import Household, Membership, Role
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory

# Property-based tests try 100 random cases each by default; `pytest
# --hypothesis-profile=thorough` tries many more, e.g. after changing the prediction engine.
settings.register_profile("thorough", max_examples=5000)


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
