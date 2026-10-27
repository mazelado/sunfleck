"""Top-level URL routes."""

from django.contrib import admin
from django.urls import include, path, re_path

from sunfleck.config.api import api
from sunfleck.core.views import frontend_index

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Sign-in, sign-out, and password resets (django-allauth's JSON API for the React app).
    path("_allauth/", include("allauth.headless.urls")),
    # Everything else belongs to the React app, which handles its own routes.
    re_path(r"^(?!api/|admin/|static/|_allauth/).*$", frontend_index, name="frontend"),
]
