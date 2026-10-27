"""Top-level URL routes."""

from django.contrib import admin
from django.urls import path, re_path

from sunfleck.config.api import api
from sunfleck.core.views import frontend_index

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Everything else belongs to the React app, which handles its own routes.
    re_path(r"^(?!api/|admin/|static/).*$", frontend_index, name="frontend"),
]
