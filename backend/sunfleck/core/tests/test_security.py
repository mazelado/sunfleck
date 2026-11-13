import os
import subprocess
import sys
from collections.abc import Callable

import pytest
from django.test import Client

from sunfleck.accounts.models import Membership, Role

pytestmark = pytest.mark.django_db


def test_the_admin_site_has_no_sign_in_form_of_its_own() -> None:
    response = Client().get("/admin/login/?next=/admin/")

    # Signing in happens in the app, where failed attempts are rate-limited.
    assert response.status_code == 302
    assert response["Location"] == "/sign-in?next=%2Fadmin%2F"


def test_the_admin_site_is_for_its_staff_only(member_of: Callable[[Role], Membership]) -> None:
    admin = member_of(Role.ADMIN).user
    admin.is_staff = admin.is_superuser = True
    admin.save()
    staff, other = Client(), Client()
    staff.force_login(admin)
    other.force_login(member_of(Role.ADMIN).user)

    assert staff.get("/admin/").status_code == 200
    # A household Admin who isn't the site's staff.
    assert other.get("/admin/login/").status_code == 403


def test_pages_say_what_they_may_load() -> None:
    policy = Client().get("/")["Content-Security-Policy"]

    directives = dict(part.strip().split(" ", 1) for part in policy.split(";"))
    assert directives["script-src"] == "'self'"
    assert directives["object-src"] == "'none'"
    assert directives["frame-ancestors"] == "'none'"
    assert "https://tile.openstreetmap.org" in directives["img-src"]


def test_behind_an_https_proxy_cookies_and_browsers_stay_on_https() -> None:
    # Settings are read once at start-up, so in a fresh Python with the setting on.
    script = (
        "import django; django.setup(); from django.conf import settings as s; "
        "print(s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, s.ALLAUTH_TRUSTED_PROXY_COUNT, "
        "s.SECURE_HSTS_SECONDS)"
    )
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "sunfleck.config.settings",
        "SECRET_KEY": "test",
        "SUNFLECK_BEHIND_PROXY": "true",
    }

    output = subprocess.run(  # noqa: S603 - this Python, a fixed script
        [sys.executable, "-c", script], env=env, capture_output=True, text=True, check=True
    ).stdout

    assert output.split() == ["True", "True", "1", str(365 * 24 * 60 * 60)]
