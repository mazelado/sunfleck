"""The limits on failed sign-ins (security review 1.0, S4)."""

import json
from typing import Any

import pytest
from django.conf import settings
from django.core.cache import cache
from django.test import Client, override_settings

from sunfleck.accounts.tests.factories import UserFactory
from sunfleck.config import settings as production_settings

pytestmark = pytest.mark.django_db

LOGIN = "/_allauth/browser/v1/auth/login"


def browser(**headers: str) -> Client:
    client = Client(enforce_csrf_checks=True, headers=headers)
    client.get("/")  # the frontend page sets the CSRF cookie
    return client


WRONG_PASSWORD = "not the password"


def sign_in(client: Client, email: str, password: str = WRONG_PASSWORD) -> Any:
    return client.post(
        LOGIN,
        json.dumps({"email": email, "password": password}),
        content_type="application/json",
        headers={"X-CSRFToken": client.cookies["csrftoken"].value},
    )


def refused(response: Any) -> bool:
    """Whether the sign-in was refused for too many failures (rather than checked)."""
    codes = [error.get("code") for error in response.json().get("errors", [])]
    return "too_many_login_attempts" in codes


@pytest.fixture(autouse=True)
def empty_counters() -> None:
    cache.clear()


def test_failed_sign_ins_are_limited_per_account() -> None:
    user = UserFactory.create(email="ada@example.com")
    # From different addresses, so only the account's own limit applies.
    answers = [sign_in(browser(REMOTE_ADDR=f"203.0.113.{n}"), user.email) for n in range(1, 7)]

    assert [refused(answer) for answer in answers] == [False] * 5 + [True]


def test_failed_sign_ins_are_limited_per_address() -> None:
    client = browser()
    answers = [sign_in(client, f"person{n}@example.com") for n in range(11)]

    assert [refused(answer) for answer in answers] == [False] * 10 + [True]


@override_settings(ALLAUTH_TRUSTED_PROXY_COUNT=1)
def test_behind_a_proxy_each_person_is_counted_on_their_own() -> None:
    # Everyone reaches Sunfleck from the proxy's address; it says who they are.
    first = [
        sign_in(browser(REMOTE_ADDR="10.0.0.2", X_FORWARDED_FOR="198.51.100.1"), f"a{n}@x.org")
        for n in range(11)
    ]
    second = sign_in(
        browser(REMOTE_ADDR="10.0.0.2", X_FORWARDED_FOR="198.51.100.2"), "b@example.org"
    )

    assert refused(first[-1])
    assert not refused(second)


def test_the_counts_are_shared_by_every_worker() -> None:
    # Each web worker is its own process: a cache in its memory would count per worker, and
    # forget everything on restart.
    for configured in (production_settings.CACHES, settings.CACHES):
        assert configured["default"]["BACKEND"] in (
            "django.core.cache.backends.db.DatabaseCache",
            "django.core.cache.backends.redis.RedisCache",
        )
