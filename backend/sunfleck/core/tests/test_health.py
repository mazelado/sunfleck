from typing import Any
from unittest.mock import patch

import pytest
from django.db import DatabaseError
from django.test import Client

from sunfleck import __version__
from sunfleck.accounts.models import Role


@pytest.mark.django_db
def test_health_reports_ok_when_database_is_reachable(client: Client) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__, "database": "ok"}


@pytest.mark.django_db
def test_health_reports_error_when_database_is_unreachable(client: Client) -> None:
    with patch("sunfleck.core.api.connection.cursor", side_effect=DatabaseError):
        response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unreachable"


@pytest.mark.django_db
def test_health_hides_the_version_from_strangers(member_of: Any) -> None:
    stranger = Client(REMOTE_ADDR="203.0.113.5")
    through_a_local_proxy = Client(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.5")
    member = Client(REMOTE_ADDR="203.0.113.5")
    member.force_login(member_of(Role.VIEWER).user)
    docker = Client(REMOTE_ADDR="127.0.0.1")  # the container's own health check

    versions = [
        client.get("/api/v1/health").json()["version"]
        for client in (stranger, through_a_local_proxy, member, docker)
    ]

    assert versions == ["", "", __version__, __version__]
