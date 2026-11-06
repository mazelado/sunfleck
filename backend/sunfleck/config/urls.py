"""Top-level URL routes."""

from allauth.account.decorators import secure_admin_login
from django.contrib import admin
from django.urls import include, path, re_path

from sunfleck.config.api import api
from sunfleck.core.views import frontend_index

# The admin site has no sign-in form of its own: people sign in to Sunfleck (where failed
# attempts are rate-limited), and it's open to the first account, which can use it.
admin.site.login = secure_admin_login(admin.site.login)  # type: ignore[method-assign]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Sign-in, sign-out, and password resets (django-allauth's JSON API for the React app).
    path("_allauth/", include("allauth.headless.urls")),
    # Everything else belongs to the React app, which handles its own routes. Not its files
    # (assets/): one that's gone, like a page's script from before an update, must be a 404,
    # not an HTML page the browser can't run.
    re_path(r"^(?!api/|admin/|static/|_allauth/|assets/).*$", frontend_index, name="frontend"),
]
