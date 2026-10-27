"""Business rules for plants and their photos.

API endpoints call these functions; they never change plant data directly.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import IO
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from sunfleck.accounts.models import Household
from sunfleck.places.models import LightSourceKind, Location
from sunfleck.plants import images
from sunfleck.plants.models import (
    ContainerMaterial,
    Photo,
    Plant,
    PlantLight,
    PlantStatus,
    SoilType,
)

MAX_CAPTION_LENGTH = 200


class PlantsError(Exception):
    """A plants rule was broken. `code` is stable and shown to API clients; `field` names the
    form field at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


# --- Plants -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class PlantLightData:
    light_source_id: int
    distance_cm: int | None = None


@dataclass(frozen=True)
class PlantData:
    nickname: str
    location_id: int | None = None
    status: PlantStatus = PlantStatus.ACTIVE
    container_diameter_cm: int | None = None
    container_material: ContainerMaterial | None = None
    soil_type: SoilType | None = None
    acquired_on: date | None = None
    notes: str = ""
    light_sources: list[PlantLightData] = field(default_factory=list)


def _location(household: Household, location_id: int | None) -> Location | None:
    if location_id is None:
        return None
    location = Location.objects.filter(pk=location_id, site__household=household).first()
    if location is None:
        raise PlantsError("location_not_found", "This location doesn't exist.", "location_id")
    return location


def _light_links(
    plant: Plant, location: Location | None, lights: list[PlantLightData]
) -> list[PlantLight]:
    """Check that every light reaching the plant belongs to its location."""
    ids = [light.light_source_id for light in lights]
    if len(set(ids)) != len(ids):
        raise PlantsError(
            "duplicate_light_source", "Each light source can be added once.", "light_sources"
        )
    found = {
        light.pk: light for light in (location.light_sources.filter(pk__in=ids) if location else [])
    }
    if len(found) != len(ids):
        raise PlantsError(
            "light_source_not_in_location",
            "Choose windows and grow lights from the plant's location.",
            "light_sources",
        )
    return [
        PlantLight(
            plant=plant,
            light_source=found[light.light_source_id],
            distance_cm=(
                light.distance_cm
                if found[light.light_source_id].kind == LightSourceKind.WINDOW
                else None
            ),
        )
        for light in lights
    ]


def _apply_plant(plant: Plant, data: PlantData) -> None:
    """Copy `data` onto `plant`, save it, and set which light sources reach it."""
    location = _location(plant.household, data.location_id)
    plant.location = location
    plant.nickname = data.nickname.strip()
    plant.status = data.status
    plant.container_diameter_cm = data.container_diameter_cm
    plant.container_material = data.container_material or ""
    plant.soil_type = data.soil_type or ""
    plant.acquired_on = data.acquired_on
    plant.notes = data.notes.strip()
    plant.save()
    links = _light_links(plant, location, data.light_sources)
    plant.light_links.all().delete()
    PlantLight.objects.bulk_create(links)


@transaction.atomic
def create_plant(household: Household, data: PlantData) -> Plant:
    """Add a plant.

    Raises:
        PlantsError: If the location isn't the household's, or a light source isn't in the
            plant's location.
    """
    plant = Plant(household=household)
    _apply_plant(plant, data)
    return plant


@transaction.atomic
def update_plant(plant: Plant, data: PlantData) -> Plant:
    """Update a plant. Moving it to another location requires choosing that location's lights.

    Raises:
        PlantsError: As for `create_plant`.
    """
    _apply_plant(plant, data)
    return plant


# --- Photos -----------------------------------------------------------------------------------


def _local_time(plant: Plant, taken_at: datetime) -> datetime:
    """Cameras usually record local time without a time zone; use the plant's site's."""
    if timezone.is_aware(taken_at):
        return taken_at
    zone = plant.location.site.timezone if plant.location else settings.TIME_ZONE
    return taken_at.replace(tzinfo=ZoneInfo(zone))


def add_photo(plant: Plant, file: IO[bytes], size: int, caption: str = "") -> Photo:
    """Resize and store a photo of `plant`. Its first photo becomes its cover photo.

    Raises:
        PlantsError: If the file is too large or isn't a usable image.
    """
    if len(caption) > MAX_CAPTION_LENGTH:
        raise PlantsError("caption_too_long", "Captions can be up to 200 characters.", "caption")
    if size > images.MAX_UPLOAD_BYTES:
        limit = images.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise PlantsError("photo_too_large", f"Photos can be up to {limit} MB.", "file")
    try:
        processed = images.process_photo(file)
    except images.ImageError as exc:
        raise PlantsError(exc.code, str(exc), "file") from exc

    photo = Photo(
        plant=plant,
        width=processed.width,
        height=processed.height,
        taken_at=_local_time(plant, processed.taken_at) if processed.taken_at else timezone.now(),
        caption=caption.strip(),
    )
    name = uuid.uuid4().hex
    photo.image.save(f"{name}.webp", ContentFile(processed.image), save=False)
    photo.thumbnail.save(f"{name}-thumbnail.webp", ContentFile(processed.thumbnail), save=False)
    try:
        with transaction.atomic():
            photo.save()
            if plant.cover_photo_id is None:
                plant.cover_photo = photo
                plant.save(update_fields=["cover_photo", "updated_at"])
    except Exception:
        # Don't leave files behind that no photo refers to.
        for file_field in (photo.image, photo.thumbnail):
            if file_field.name:
                file_field.storage.delete(file_field.name)
        raise
    return photo


def update_photo(photo: Photo, caption: str) -> Photo:
    photo.caption = caption.strip()
    photo.save(update_fields=["caption"])
    return photo


@transaction.atomic
def delete_photo(photo: Photo) -> None:
    """Delete a photo. If it was the cover photo, the newest remaining photo takes its place."""
    plant = photo.plant
    if plant.cover_photo_id == photo.pk:
        plant.cover_photo = plant.photos.exclude(pk=photo.pk).first()
        plant.save(update_fields=["cover_photo", "updated_at"])
    photo.delete()


def set_cover_photo(plant: Plant, photo_id: int) -> Plant:
    """Show one of the plant's photos on its card.

    Raises:
        PlantsError: If the photo isn't one of the plant's.
    """
    photo = plant.photos.filter(pk=photo_id).first()
    if photo is None:
        raise PlantsError("photo_not_found", "This photo doesn't exist.", "photo_id")
    plant.cover_photo = photo
    plant.save(update_fields=["cover_photo", "updated_at"])
    return plant
