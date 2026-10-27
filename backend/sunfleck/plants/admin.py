"""Django admin pages for plants."""

from django.contrib import admin

from sunfleck.plants.models import Photo, Plant, PlantLight


class PlantLightInline(admin.TabularInline[PlantLight, Plant]):
    model = PlantLight
    extra = 0


class PhotoInline(admin.TabularInline[Photo, Plant]):
    model = Photo
    extra = 0
    fields = ("taken_at", "caption", "width", "height")
    readonly_fields = ("taken_at", "width", "height")
    can_delete = False


@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin[Plant]):
    list_display = ("nickname", "household", "location", "status")
    list_filter = ("status", "household")
    search_fields = ("nickname",)
    raw_id_fields = ("cover_photo",)
    inlines = (PlantLightInline, PhotoInline)
