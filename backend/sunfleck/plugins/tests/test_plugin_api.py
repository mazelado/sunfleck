"""Plugins' own API endpoints get the same protection as Sunfleck's (security review S3)."""

import json
from collections.abc import Callable
from typing import Any

import pytest
from django.http import HttpRequest
from django.test import Client
from django.urls import path
from ninja import NinjaAPI

from sunfleck.accounts.models import Membership, Role
from sunfleck.config.api import plugin_router
from sunfleck.config.urls import urlpatterns as sunfleck_urlpatterns
from sunfleck.core.errors import register_error_handlers

# A plugin's router, made exactly as Sunfleck makes them, mounted in an API of its own.
router = plugin_router("fake_api")


@router.post("/do")
def do(request: HttpRequest) -> dict[str, bool]:
    return {"changed": True}


@router.get("/public", auth=None)
def public(request: HttpRequest) -> dict[str, bool]:
    return {"public": True}


test_api = NinjaAPI(urls_namespace="test-plugin-api")
register_error_handlers(test_api)
test_api.add_router("/plugins/fake_api/", router)

urlpatterns = [path("test-api/", test_api.urls), *sunfleck_urlpatterns]

pytestmark = [pytest.mark.django_db, pytest.mark.urls(__name__)]

URL = "/test-api/plugins/fake_api/do"


def signed_in_browser(member: Membership) -> Client:
    """A client that, like a browser, must send the CSRF token with every change."""
    client = Client(enforce_csrf_checks=True)
    client.force_login(member.user)
    client.get("/")  # the frontend page sets the CSRF cookie
    return client


def post(client: Client, url: str, headers: dict[str, Any] | None = None) -> Any:
    return client.post(url, json.dumps({}), content_type="application/json", headers=headers)


def test_plugin_endpoints_need_sign_in_and_a_csrf_token(
    member_of: Callable[[Role], Membership],
) -> None:
    browser = signed_in_browser(member_of(Role.VIEWER))
    token = browser.cookies["csrftoken"].value

    assert post(Client(), URL).status_code == 401
    assert post(browser, URL).status_code == 403
    response = post(browser, URL, headers={"X-CSRFToken": token})
    assert response.status_code == 200
    assert response.json() == {"changed": True}


def test_a_plugin_endpoint_can_choose_to_be_public() -> None:
    response = Client().get("/test-api/plugins/fake_api/public")

    assert response.status_code == 200
    assert response.json() == {"public": True}
