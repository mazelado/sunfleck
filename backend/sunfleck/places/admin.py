"""Django admin pages for places."""

from django.contrib import admin

from sunfleck.places.models import LightSource, Location, Site


class LocationInline(admin.TabularInline[Location, Site]):
    model = Location
    extra = 0
    fields = ("name", "kind")
    show_change_link = True


class LightSourceInline(admin.TabularInline[LightSource, Location]):
    model = LightSource
    extra = 0


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin[Site]):
    list_display = ("name", "household", "latitude", "longitude", "timezone")
    list_filter = ("household",)
    inlines = (LocationInline,)


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin[Location]):
    list_display = ("name", "site", "kind")
    list_filter = ("kind", "site")
    inlines = (LightSourceInline,)
