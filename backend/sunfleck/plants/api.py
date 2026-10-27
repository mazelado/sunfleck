"""Plants API: plants, the light that reaches them, and their photos.

Everyone in the household can see plants; Gardeners and Admins can change them.
"""

from datetime import date, datetime

from django.db.models import Q, QuerySet
from django.http import FileResponse, HttpRequest
from django.urls import reverse
from ninja import File, Form, Query, Router, Schema, Status
from ninja.files import UploadedFile
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.places.api import LightSourceOut, light_source_out
from sunfleck.places.models import LocationKind
from sunfleck.plants import services
from sunfleck.plants.models import ContainerMaterial, Photo, Plant, PlantStatus, SoilType

router = Router(tags=["plants"], auth=django_auth)

# Photos never change (only their caption does), so browsers may keep them.
PHOTO_CACHE_CONTROL = "private, max-age=31536000, immutable"

# --- Schemas ----------------------------------------------------------------------------------


class PlantLightIn(Schema):
    light_source_id: int
    distance_cm: int | None = Field(
        default=None, ge=0, le=10_000, description="Windows: the plant's distance from it."
    )


class PlantIn(Schema):
    nickname: str = Field(min_length=1, max_length=100)
    location_id: int | None = None
    status: PlantStatus = PlantStatus.ACTIVE
    container_diameter_cm: int | None = Field(default=None, ge=1, le=500)
    container_material: ContainerMaterial | None = None
    soil_type: SoilType | None = None
    acquired_on: date | None = None
    notes: str = Field(default="", max_length=5000)
    light_sources: list[PlantLightIn] = Field(
        default=[], max_length=50, description="The windows and grow lights that reach it."
    )


class PlantLocationOut(Schema):
    id: int
    name: str
    kind: LocationKind
    site_id: int
    site_name: str


class PhotoOut(Schema):
    id: int
    plant_id: int
    caption: str
    taken_at: datetime
    width: int
    height: int
    image_url: str
    thumbnail_url: str


class PhotoIn(Schema):
    caption: str = Field(default="", max_length=200)


class CoverIn(Schema):
    photo_id: int


class PlantLightOut(Schema):
    light_source: LightSourceOut
    distance_cm: int | None


class PlantSummaryOut(Schema):
    id: int
    nickname: str
    status: PlantStatus
    location: PlantLocationOut | None
    cover_thumbnail_url: str | None


class PlantOut(Schema):
    id: int
    nickname: str
    status: PlantStatus
    location: PlantLocationOut | None
    container_diameter_cm: int | None
    container_material: ContainerMaterial | None
    soil_type: SoilType | None
    acquired_on: date | None
    notes: str
    cover_photo: PhotoOut | None
    light_sources: list[PlantLightOut]
    created_at: datetime


class PlantPage(Schema):
    items: list[PlantSummaryOut]
    count: int = Field(description="How many plants match, across all pages.")


class PhotoPage(Schema):
    items: list[PhotoOut]
    count: int


class PageQuery(Schema):
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class PlantFilters(PageQuery):
    q: str = Field(default="", max_length=100, description="Search by name.")
    location_id: int | None = None
    status: PlantStatus | None = None


# --- Conversions ------------------------------------------------------------------------------


def _photo_url(photo_id: int, variant: str) -> str:
    return reverse(f"api-v1:photo_{variant}", kwargs={"photo_id": photo_id})


def _photo_out(photo: Photo) -> PhotoOut:
    return PhotoOut(
        id=photo.pk,
        plant_id=photo.plant_id,
        caption=photo.caption,
        taken_at=photo.taken_at,
        width=photo.width,
        height=photo.height,
        image_url=_photo_url(photo.pk, "image"),
        thumbnail_url=_photo_url(photo.pk, "thumbnail"),
    )


def _location_out(plant: Plant) -> PlantLocationOut | None:
    location = plant.location
    if location is None:
        return None
    return PlantLocationOut(
        id=location.pk,
        name=location.name,
        kind=LocationKind(location.kind),
        site_id=location.site_id,
        site_name=location.site.name,
    )


def _summary_out(plant: Plant) -> PlantSummaryOut:
    return PlantSummaryOut(
        id=plant.pk,
        nickname=plant.nickname,
        status=PlantStatus(plant.status),
        location=_location_out(plant),
        cover_thumbnail_url=(
            _photo_url(plant.cover_photo_id, "thumbnail") if plant.cover_photo_id else None
        ),
    )


def _plant_out(plant: Plant) -> PlantOut:
    return PlantOut(
        id=plant.pk,
        nickname=plant.nickname,
        status=PlantStatus(plant.status),
        location=_location_out(plant),
        container_diameter_cm=plant.container_diameter_cm,
        container_material=(
            ContainerMaterial(plant.container_material) if plant.container_material else None
        ),
        soil_type=SoilType(plant.soil_type) if plant.soil_type else None,
        acquired_on=plant.acquired_on,
        notes=plant.notes,
        cover_photo=_photo_out(plant.cover_photo) if plant.cover_photo else None,
        light_sources=[
            PlantLightOut(
                light_source=light_source_out(link.light_source), distance_cm=link.distance_cm
            )
            for link in plant.light_links.all()
        ],
        created_at=plant.created_at,
    )


def _plants_error(exc: services.PlantsError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


def _plant_data(data: PlantIn) -> services.PlantData:
    fields = data.model_dump(exclude={"light_sources"})
    lights = [services.PlantLightData(**light.model_dump()) for light in data.light_sources]
    return services.PlantData(**fields, light_sources=lights)


# --- Lookups (always within the user's household) ---------------------------------------------


def _plants(household: Household) -> QuerySet[Plant]:
    return household.plants.select_related("location__site")


def _get_plant(household: Household, plant_id: int) -> Plant:
    plant = (
        _plants(household)
        .select_related("cover_photo")
        .prefetch_related("light_links__light_source")
        .filter(pk=plant_id)
        .first()
    )
    if plant is None:
        raise ApiError(404, "plant_not_found", "This plant doesn't exist.")
    return plant


def _get_photo(household: Household, photo_id: int) -> Photo:
    photo = (
        Photo.objects.select_related("plant")
        .filter(pk=photo_id, plant__household=household)
        .first()
    )
    if photo is None:
        raise ApiError(404, "photo_not_found", "This photo doesn't exist.")
    return photo


# --- Plants -----------------------------------------------------------------------------------


@router.get("/plants", response=PlantPage)
def list_plants(request: HttpRequest, filters: Query[PlantFilters]) -> PlantPage:
    """The household's plants, by name, a page at a time."""
    household = require_role(request, Role.VIEWER).household
    plants = _plants(household)
    if filters.q.strip():
        plants = plants.filter(Q(nickname__icontains=filters.q.strip()))
    if filters.location_id is not None:
        plants = plants.filter(location_id=filters.location_id)
    if filters.status is not None:
        plants = plants.filter(status=filters.status)
    page = plants[filters.offset : filters.offset + filters.limit]
    return PlantPage(items=[_summary_out(plant) for plant in page], count=plants.count())


@router.post("/plants", response={201: PlantOut})
def create_plant(request: HttpRequest, data: PlantIn) -> Status[PlantOut]:
    household = require_role(request, Role.GARDENER).household
    try:
        plant = services.create_plant(household, _plant_data(data))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return Status(201, _plant_out(_get_plant(household, plant.pk)))


@router.get("/plants/{plant_id}", response=PlantOut)
def get_plant(request: HttpRequest, plant_id: int) -> PlantOut:
    household = require_role(request, Role.VIEWER).household
    return _plant_out(_get_plant(household, plant_id))


@router.put("/plants/{plant_id}", response=PlantOut)
def update_plant(request: HttpRequest, plant_id: int, data: PlantIn) -> PlantOut:
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant(household, plant_id)
    try:
        services.update_plant(plant, _plant_data(data))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return _plant_out(_get_plant(household, plant_id))


@router.delete("/plants/{plant_id}", response={204: None})
def delete_plant(request: HttpRequest, plant_id: int) -> Status[None]:
    """Delete a plant and its photos."""
    household = require_role(request, Role.GARDENER).household
    _get_plant(household, plant_id).delete()
    return Status(204, None)


@router.put("/plants/{plant_id}/cover", response=PlantOut)
def set_cover_photo(request: HttpRequest, plant_id: int, data: CoverIn) -> PlantOut:
    """Choose which photo shows on the plant's card."""
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant(household, plant_id)
    try:
        services.set_cover_photo(plant, data.photo_id)
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return _plant_out(_get_plant(household, plant_id))


# --- Photos -----------------------------------------------------------------------------------


@router.get("/plants/{plant_id}/photos", response=PhotoPage)
def list_photos(request: HttpRequest, plant_id: int, page: Query[PageQuery]) -> PhotoPage:
    """The plant's photos, newest first."""
    household = require_role(request, Role.VIEWER).household
    photos = _get_plant(household, plant_id).photos.all()
    items = photos[page.offset : page.offset + page.limit]
    return PhotoPage(items=[_photo_out(photo) for photo in items], count=photos.count())


@router.post("/plants/{plant_id}/photos", response={201: PhotoOut})
def add_photo(
    request: HttpRequest,
    plant_id: int,
    file: File[UploadedFile],
    caption: Form[str] = "",
    taken_at: Form[datetime | None] = None,
) -> Status[PhotoOut]:
    """Upload a photo (JPEG, PNG, WebP, or HEIC, up to 20 MB). It's resized and its metadata,
    such as GPS position, is removed. A plant's first photo becomes its cover photo.

    `taken_at` is used only if the photo itself doesn't say when it was taken. Without a time
    zone, it's taken to be local time at the plant's site."""
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant(household, plant_id)
    try:
        photo = services.add_photo(plant, file, file.size or 0, caption, taken_at)
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return Status(201, _photo_out(photo))


@router.put("/photos/{photo_id}", response=PhotoOut)
def update_photo(request: HttpRequest, photo_id: int, data: PhotoIn) -> PhotoOut:
    household = require_role(request, Role.GARDENER).household
    photo = services.update_photo(_get_photo(household, photo_id), data.caption)
    return _photo_out(photo)


@router.delete("/photos/{photo_id}", response={204: None})
def delete_photo(request: HttpRequest, photo_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    services.delete_photo(_get_photo(household, photo_id))
    return Status(204, None)


def _photo_file(request: HttpRequest, photo_id: int, variant: str) -> FileResponse:
    household = require_role(request, Role.VIEWER).household
    photo = _get_photo(household, photo_id)
    field = photo.image if variant == "image" else photo.thumbnail
    response = FileResponse(field.open("rb"), content_type="image/webp")
    response["Cache-Control"] = PHOTO_CACHE_CONTROL
    return response


@router.get("/photos/{photo_id}/image", url_name="photo_image")
def get_photo_image(request: HttpRequest, photo_id: int) -> FileResponse:
    """The photo itself (WebP, at most 2048 px on its long edge)."""
    return _photo_file(request, photo_id, "image")


@router.get("/photos/{photo_id}/thumbnail", url_name="photo_thumbnail")
def get_photo_thumbnail(request: HttpRequest, photo_id: int) -> FileResponse:
    """A small version of the photo (WebP, at most 512 px on its long edge)."""
    return _photo_file(request, photo_id, "thumbnail")
