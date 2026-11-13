"""Limits on how much work one request or one member can cause (security review 1.0, S7)."""

import io
import json
from collections.abc import Callable

import pytest
from django.test import Client
from PIL import Image

from sunfleck.accounts.models import Membership, Role, User
from sunfleck.core import images, limits

pytestmark = pytest.mark.django_db


def test_bodies_over_the_limit_are_refused_before_they_are_read() -> None:
    # Says it sends more than the limit, sends nothing: the body is never read.
    response = Client().post(
        "/api/v1/setup",
        b"",
        content_type="multipart/form-data; boundary=x",
        CONTENT_LENGTH=str(limits.MAX_BODY_BYTES + 1),
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"
    assert not User.objects.exists()


def test_bodies_within_the_limit_are_read() -> None:
    response = Client().post("/api/v1/setup", json.dumps({}), content_type="application/json")

    assert response.status_code == 422  # read, and found incomplete


def test_an_import_may_be_larger() -> None:
    assert limits.max_body_bytes("/api/v1/import") > limits.max_body_bytes("/api/v1/plants")
    assert limits.max_body_bytes("/api/v1/plants") == limits.MAX_BODY_BYTES


def suggest(client: Client) -> int:
    response = client.post(
        "/api/v1/care-profile-suggestions",
        json.dumps({"name": "Monstera", "indoor": True}),
        content_type="application/json",
    )
    return response.status_code


def test_asking_the_ai_is_limited_per_member(
    client_as: Callable[[Role], Client], member_of: Callable[[Role], Membership]
) -> None:
    keen = client_as(Role.GARDENER)
    other = client_as(Role.GARDENER)

    statuses = [suggest(keen) for _ in range(limits.AI_PER_MINUTE + 1)]

    # No AI plugin is on, so each is answered with that, until the limit.
    assert 429 not in statuses[:-1]
    assert statuses[-1] == 429
    assert suggest(other) != 429  # each member has their own


def test_photos_with_too_many_pixels_are_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    buffer = io.BytesIO()
    Image.new("RGB", (400, 300)).save(buffer, "PNG")
    monkeypatch.setattr(images, "MAX_PIXELS", 400 * 300 - 1)

    with pytest.raises(images.ImageError) as error:
        images.process_photo(io.BytesIO(buffer.getvalue()))

    assert error.value.code == "image_too_large"
