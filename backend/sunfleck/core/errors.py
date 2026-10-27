"""API errors, returned to clients in one consistent shape (see docs/STYLE_GUIDE.md, section 4).

{"error": {"code": "plant_not_found", "message": "...", "details": {}}}
"""

from typing import Any

from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, HttpError, ValidationError


class ApiError(Exception):
    """An error with an HTTP status, a stable machine-readable code, and a human message."""

    def __init__(
        self, status: int, code: str, message: str, details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}


def _error_response(
    api: NinjaAPI,
    request: HttpRequest,
    status: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> HttpResponse:
    body = {"error": {"code": code, "message": message, "details": details or {}}}
    return api.create_response(request, body, status=status)


def register_error_handlers(api: NinjaAPI) -> None:
    """Make every error from `api` use the standard error shape."""

    @api.exception_handler(ApiError)
    def handle_api_error(request: HttpRequest, exc: ApiError) -> HttpResponse:
        return _error_response(api, request, exc.status, exc.code, exc.message, exc.details)

    @api.exception_handler(ValidationError)
    def handle_validation_error(request: HttpRequest, exc: ValidationError) -> HttpResponse:
        return _error_response(
            api,
            request,
            422,
            "validation_error",
            "Some fields are missing or invalid.",
            {"fields": exc.errors},
        )

    @api.exception_handler(AuthenticationError)
    def handle_authentication_error(request: HttpRequest, exc: AuthenticationError) -> HttpResponse:
        return _error_response(api, request, 401, "not_authenticated", "Please sign in.")

    @api.exception_handler(HttpError)
    def handle_http_error(request: HttpRequest, exc: HttpError) -> HttpResponse:
        return _error_response(api, request, exc.status_code, "http_error", str(exc))
