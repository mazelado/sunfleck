from unittest.mock import patch

import pytest
from django.db import DatabaseError
from django.test import Client

from sunfleck import __version__


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
