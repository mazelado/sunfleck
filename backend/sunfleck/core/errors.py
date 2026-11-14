"""API errors, returned to clients in one consistent shape (see docs/STYLE_GUIDE.md, section 4).

{"error": {"code": "plant_not_found", "message": "...", "details": {}}}
"""

import logging
from typing import Any, ClassVar

from django.http import HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, HttpError, ValidationError

logger = logging.getLogger(__name__)


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


class ServiceError(Exception):
    """A rule a service enforces was broken, e.g. a name that's taken. `code` is stable and
    shown to API clients; `field` names the form field at fault, if any.

    Each app has its own subclass (PlantsError, CareError, ...). Raised through the API, it's
    answered with 422, or the status `statuses` gives for its code, so endpoints needn't
    catch it.
    """

    statuses: ClassVar[dict[str, int]] = {}

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field

    @property
    def status(self) -> int:
        return self.statuses.get(self.code, 422)


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

    @api.exception_handler(ServiceError)
    def handle_service_error(request: HttpRequest, exc: ServiceError) -> HttpResponse:
        details = {"field": exc.field} if exc.field else {}
        return _error_response(api, request, exc.status, exc.code, str(exc), details)

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

    @api.exception_handler(Exception)
    def handle_unexpected_error(request: HttpRequest, exc: Exception) -> HttpResponse:
        # A bug: logged with its traceback, and answered in the standard shape, so the app can
        # say something went wrong in the person's language. Nothing about it is shown.
        logger.exception("Unexpected error in %s %s", request.method, request.path)
        return _error_response(
            api, request, 500, "unexpected", "Something went wrong. Please try again."
        )
