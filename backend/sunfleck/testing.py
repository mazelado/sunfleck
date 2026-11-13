"""Fixtures shared by all tests, Sunfleck's and built-in plugins'. Each conftest.py imports them."""

from collections.abc import Callable

import pytest
from django.core.cache import caches
from django.core.cache.backends.db import DatabaseCache
from django.test import Client
from hypothesis import settings

from sunfleck.accounts.models import Household, Membership, Role
from sunfleck.accounts.tests.factories import HouseholdFactory, MembershipFactory

# Property-based tests try 100 random cases each by default; `pytest
# --hypothesis-profile=thorough` tries many more, e.g. after changing the prediction engine.
settings.register_profile("thorough", max_examples=5000)


@pytest.fixture(autouse=True)
def empty_cache() -> None:
    """Each test starts with an empty cache: counts of failed sign-ins and of requests
    (sunfleck.core.limits) don't carry over from earlier tests. A cache in the database is
    emptied with the rest of it after each test; one in memory is emptied here."""
    if not isinstance(caches["default"], DatabaseCache):
        caches["default"].clear()


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
