"""Views that serve the frontend application."""

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_safe

FRONTEND_MISSING_MESSAGE = (
    "The Sunfleck frontend hasn't been built.\n\n"
    "During development, run `make dev` and open http://localhost:5173 instead.\n"
)


@require_safe
@ensure_csrf_cookie
def frontend_index(request: HttpRequest) -> HttpResponse:
    """Return the React app's index.html for any URL the app handles itself.

    The React app does its own routing (e.g. /plants/42), so every such URL must return the
    same page. Browsers must always revalidate it so they pick up new releases. It also sets
    the CSRF cookie, which the app sends back with every change it makes.
    """
    index_file = settings.FRONTEND_DIR / "index.html"
    if not index_file.is_file():
        return HttpResponse(FRONTEND_MISSING_MESSAGE, status=404, content_type="text/plain")
    response = HttpResponse(index_file.read_bytes(), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response


def not_found(request: HttpRequest) -> HttpResponse:
    """404 for addresses that exist in a library but aren't part of Sunfleck."""
    return JsonResponse({"status": 404}, status=404)
