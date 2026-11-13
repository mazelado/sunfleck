"""Limits on how much work one request, or one member, can cause.

- Request bodies over a size are refused before anything reads them (the CSRF check reads a
  form, files included, before the session is looked at, so this needs no account).
- Work that's slow or costs money (asking the AI, identifying a plant, testing a notification
  channel) is limited per member and minute, counted in the shared cache.
"""

from collections.abc import Callable

from django.core.cache import cache
from django.http import HttpRequest, HttpResponse, JsonResponse

from sunfleck.accounts.models import User
from sunfleck.core.errors import ApiError

# Photos can be up to 20 MB (images.MAX_UPLOAD_BYTES); the rest is room for the form around one.
MAX_BODY_BYTES = 25 * 1024 * 1024
# An export, with every photo: large households should use the import command instead.
MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024
IMPORT_PATH = "/api/v1/import"


def max_body_bytes(path: str) -> int:
    return MAX_IMPORT_BYTES if path == IMPORT_PATH else MAX_BODY_BYTES


class BodySizeLimitMiddleware:
    """Refuse a request whose Content-Length is over the limit for its path, with 413,
    before its body is read."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        limit = max_body_bytes(request.path)
        if length > limit:
            message = f"This is too large: at most {limit // (1024 * 1024)} MB can be sent."
            return JsonResponse(
                {"error": {"code": "request_too_large", "message": message, "details": {}}},
                status=413,
            )
        return self.get_response(request)


# How often a member may do each of these in a minute: plenty for a person, little for a script.
AI_PER_MINUTE = 10
IDENTIFY_PER_MINUTE = 10
CHANNEL_TESTS_PER_MINUTE = 5


def per_member(request: HttpRequest, action: str, per_minute: int) -> None:
    """Count one `action` by the signed-in member, refusing it when they've done it
    `per_minute` times this minute already. Call it after the permission check.

    Raises:
        ApiError: 429 `too_many_requests`.
    """
    user = request.user
    if not isinstance(user, User):  # pragma: no cover - endpoints check sign-in first
        return
    key = f"limit:{action}:{user.pk}"
    # A new count starts with each minute's first request.
    cache.add(key, 0, timeout=60)
    try:
        count = cache.incr(key)
    except ValueError:  # it expired between the two calls
        cache.set(key, 1, timeout=60)
        count = 1
    if count > per_minute:
        raise ApiError(
            429, "too_many_requests", "Too many requests. Please wait a minute and try again."
        )
