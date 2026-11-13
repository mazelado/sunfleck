"""Less to attack, and nothing that signs people in in the logs (security review 1.0, S10,
S11, S14)."""

import json
import threading
from collections.abc import Callable
from typing import Any

import pytest
from django.db import connection
from django.test import Client, override_settings

from sunfleck.accounts import services
from sunfleck.accounts.models import Membership, Role, User
from sunfleck.config import settings as production_settings

STRONG_PASSWORD = "a long and unusual passphrase"
UNSENT = {"default": {"BACKEND": "sunfleck.core.mail.UnsentEmailBackend"}}


def browser() -> Client:
    client = Client(enforce_csrf_checks=True)
    client.get("/")  # the frontend page sets the CSRF cookie
    return client


def post(client: Client, url: str, data: dict[str, Any]) -> Any:
    token = client.cookies["csrftoken"].value
    return client.post(
        url, json.dumps(data), content_type="application/json", headers={"X-CSRFToken": token}
    )


# --- S10: only the allauth endpoints the app uses ---------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path",
    [
        "browser/v1/auth/signup",
        "browser/v1/account/email",
        "browser/v1/account/phone",
        "browser/v1/auth/email/verify",
        "browser/v1/auth/code/confirm",
        "browser/v1/auth/reauthenticate",
        "app/v1/config",
        "openapi.json",
    ],
)
def test_allauth_endpoints_the_app_doesnt_use_dont_exist(path: str) -> None:
    client = browser()

    assert client.get(f"/_allauth/{path}").status_code == 404
    assert post(client, f"/_allauth/{path}", {"email": "x@example.com"}).status_code == 404


@pytest.mark.django_db
def test_the_ones_it_uses_do(member_of: Callable[[Role], Membership]) -> None:
    client = browser()

    assert client.get("/_allauth/browser/v1/config").status_code == 200
    assert client.get("/_allauth/browser/v1/auth/session").status_code == 401
    client.force_login(member_of(Role.VIEWER).user)
    assert client.get("/_allauth/browser/v1/auth/session").status_code == 200


# --- S11: links that sign people in stay out of the logs --------------------------------------


@pytest.mark.django_db
@override_settings(MAILERS=UNSENT)
def test_without_email_no_link_reaches_the_log(
    member_of: Callable[[Role], Membership],
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
) -> None:
    admin = Client()
    admin.force_login(member_of(Role.ADMIN).user)
    user = member_of(Role.GARDENER).user

    reset = post(browser(), "/_allauth/browser/v1/auth/password/request", {"email": user.email})
    invited = admin.post(
        "/api/v1/household/invitations",
        json.dumps({"email": "new@example.com", "role": "viewer"}),
        content_type="application/json",
    )

    assert reset.status_code == 200
    assert invited.status_code == 201
    printed = capsys.readouterr()
    everything = caplog.text + printed.out + printed.err
    assert "reset-password" not in everything
    assert invited.json()["url"] not in everything
    assert "wasn't sent: email isn't set up" in caplog.text
    assert user.email not in caplog.text  # only part of the address


def test_emails_are_only_printed_in_development() -> None:
    if production_settings.EMAIL_URL or production_settings.DEBUG:  # pragma: no cover
        pytest.skip("email or DEBUG is set in this environment")
    backend = production_settings.MAILERS["default"]["BACKEND"]

    assert backend == "sunfleck.core.mail.UnsentEmailBackend"


# --- S14: one first-run setup at a time -------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql", reason="SQLite serializes transactions already"
)
def test_two_simultaneous_setups_make_one_account() -> None:
    barrier = threading.Barrier(2)
    outcomes: list[str] = []

    def set_up(number: int) -> None:
        barrier.wait()
        try:
            services.complete_setup(
                email=f"first{number}@example.com",
                password=STRONG_PASSWORD,
                display_name="First",
                household_name="Home",
            )
            outcomes.append("set up")
        except services.SetupAlreadyCompletedError:
            outcomes.append("already")
        finally:
            connection.close()

    threads = [threading.Thread(target=set_up, args=(n,)) for n in (1, 2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert sorted(outcomes) == ["already", "set up"]
    assert User.objects.filter(is_superuser=True).count() == 1
