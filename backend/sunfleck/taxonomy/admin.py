"""Django admin pages for the care dataset (read-only: it comes from data/care)."""

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from sunfleck.taxonomy.models import CareArchetype, Taxon


class ReadOnlyAdmin(admin.ModelAdmin[Any]):
    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        return False


@admin.register(CareArchetype)
class CareArchetypeAdmin(ReadOnlyAdmin):
    list_display = ("key", "__str__")
    search_fields = ("key",)


@admin.register(Taxon)
class TaxonAdmin(ReadOnlyAdmin):
    list_display = ("scientific_name", "rank", "family", "archetype")
    list_filter = ("rank", "archetype")
    search_fields = ("search_text",)
