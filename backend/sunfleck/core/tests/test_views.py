from pathlib import Path

import pytest
from django.test import Client
from pytest_django.fixtures import Settings


@pytest.fixture
def built_frontend(tmp_path: Path, settings: Settings) -> Path:
    (tmp_path / "index.html").write_text("<!doctype html><div id='root'></div>")
    settings.FRONTEND_DIR = tmp_path
    return tmp_path


@pytest.mark.usefixtures("built_frontend")
@pytest.mark.parametrize("url", ["/", "/plants/42", "/settings/notifications"])
def test_frontend_routes_return_index_html(client: Client, url: str) -> None:
    response = client.get(url)

    assert response.status_code == 200
    assert response["Content-Type"] == "text/html; charset=utf-8"
    assert response["Cache-Control"] == "no-cache"
    assert b"<div id='root'>" in response.content


@pytest.mark.usefixtures("built_frontend")
def test_api_urls_are_not_handled_by_the_frontend(client: Client) -> None:
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert b"<div id='root'>" not in response.content


@pytest.mark.usefixtures("built_frontend")
def test_frontend_rejects_unsafe_methods(client: Client) -> None:
    response = client.post("/plants/42")

    assert response.status_code == 405


def test_missing_frontend_build_explains_what_to_do(
    client: Client, tmp_path: Path, settings: Settings
) -> None:
    settings.FRONTEND_DIR = tmp_path

    response = client.get("/")

    assert response.status_code == 404
    assert b"make dev" in response.content


@pytest.mark.usefixtures("built_frontend")
def test_frontend_sets_the_csrf_cookie(client: Client) -> None:
    response = client.get("/")

    assert "csrftoken" in response.cookies


@pytest.mark.usefixtures("built_frontend")
def test_sign_in_api_urls_are_not_handled_by_the_frontend(client: Client) -> None:
    response = client.get("/_allauth/browser/v1/config")

    assert response.status_code == 200
    assert b"<div id='root'>" not in response.content


@pytest.mark.usefixtures("built_frontend")
def test_a_missing_app_file_is_not_found_rather_than_the_app(client: Client) -> None:
    # A page's script from before an update: the browser can't run HTML in its place.
    response = client.get("/assets/AboutPage-BA94-1LF.js")

    assert response.status_code == 404
    assert b"<div id='root'>" not in response.content
