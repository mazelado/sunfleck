"""Plants API: plants, the light that reaches them, and their photos.

Everyone in the household can see plants; Gardeners and Admins can change them.
"""

import io
from dataclasses import asdict
from datetime import date, datetime

from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q, QuerySet
from django.http import FileResponse, HttpRequest
from django.urls import reverse
from ninja import File, Form, Query, Router, Schema, Status
from ninja.files import UploadedFile
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.ai import diagnosis
from sunfleck.care import services as care_services
from sunfleck.care.glance import glance
from sunfleck.care.models import CareSchedule
from sunfleck.care.schedules import local_today
from sunfleck.core import images
from sunfleck.core.errors import ApiError
from sunfleck.places.api import (
    LightSourceOut,
    PlantLightReportOut,
    SeasonLightOut,
    light_source_out,
    source_light_out,
)
from sunfleck.places.light_report import plant_light_report
from sunfleck.places.models import LocationKind
from sunfleck.plants import services
from sunfleck.plants.models import (
    CARED_FOR,
    ContainerMaterial,
    Photo,
    Plant,
    PlantLight,
    PlantStatus,
    PropagationMethod,
    SoilType,
    Wish,
)
from sunfleck.taxonomy.api import ToxicityOut, care_profile_ref, language, toxicity_out
from sunfleck.taxonomy.models import Taxon, translated_names

router = Router(tags=["plants"], auth=django_auth)

# Photos never change (only their caption does), so browsers may keep them.
PHOTO_CACHE_CONTROL = "private, max-age=31536000, immutable"

# --- Schemas ----------------------------------------------------------------------------------


class PlantLightIn(Schema):
    light_source_id: int
    distance_cm: int | None = Field(
        default=None,
        ge=0,
        le=10_000,
        description="The plant's distance from the window, or below the grow light.",
    )


class PlantIn(Schema):
    nickname: str = Field(min_length=1, max_length=100)
    location_id: int | None = None
    status: PlantStatus = PlantStatus.ACTIVE
    container_diameter_cm: int | None = Field(default=None, ge=1, le=500)
    container_height_cm: int | None = Field(default=None, ge=1, le=500)
    container_material: ContainerMaterial | None = None
    soil_type: SoilType | None = None
    acquired_on: date | None = None
    notes: str = Field(default="", max_length=5000)
    light_sources: list[PlantLightIn] = Field(
        default=[], max_length=50, description="The windows and grow lights that reach it."
    )
    taxon_id: int | None = Field(default=None, description="Its genus or species.")
    care_profile_key: str | None = Field(
        default=None,
        max_length=50,
        description="A care profile chosen for it; leave out to use its species' profile.",
    )


class PlantCreateIn(PlantIn):
    last_watered_days_ago: int | None = Field(
        default=None,
        ge=0,
        le=365,
        description="Roughly when it was last watered (0: today); leave out if not known.",
    )
    last_fertilized_days_ago: int | None = Field(
        default=None,
        ge=0,
        le=365,
        description="Roughly when it was last fertilized; leave out if not known or never.",
    )
    from_wish_id: int | None = Field(
        default=None, description="The wishlist entry it was on; taken off the wishlist."
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


class PlantSpeciesOut(Schema):
    id: int
    scientific_name: str
    common_name: str | None
    toxicity: ToxicityOut | None = Field(
        default=None, description="Known toxicity to pets; None means unknown, never safe."
    )


class WishIn(Schema):
    name: str = Field(min_length=1, max_length=100)
    taxon_id: int | None = Field(default=None, description="Its species, if known.")
    link: str = Field(
        default="",
        max_length=500,
        pattern=r"^(https?://\S+)?$",
        description="Where to get it, e.g. a shop's page.",
    )
    notes: str = Field(default="", max_length=2000)


class WishOut(Schema):
    id: int
    name: str
    species: PlantSpeciesOut | None
    link: str
    notes: str
    created_at: datetime


class PlantCareProfileOut(Schema):
    key: str
    name: str
    chosen: bool = Field(description="Chosen for this plant, rather than from its species.")


class CareLevelOut(Schema):
    level: float | None = Field(
        description="1 just after the care, down to 0 when it's due; None while it rests."
    )
    due_in_days: int | None = Field(description="Negative when overdue; None while it rests.")
    resting_until: date | None = Field(description="While it rests: when it starts again.")


class LightLevelOut(Schema):
    dli: float = Field(description="The light at the plant's spot, mol/m²/day.")
    ideal: float = Field(description="What its care profile likes there at this time of year.")


class GlanceOut(Schema):
    """For the slim water, fertilizer and light bars. Each is None when it isn't known."""

    water: CareLevelOut | None
    fertilizer: CareLevelOut | None
    light: LightLevelOut | None


class PlantRefOut(Schema):
    id: int
    nickname: str


class OffspringOut(Schema):
    id: int
    nickname: str
    status: PlantStatus
    propagation_method: PropagationMethod | None
    acquired_on: date | None


class LineageOut(Schema):
    parent: PlantRefOut | None = Field(description="The plant it was grown from, if it's kept.")
    propagation_method: PropagationMethod | None = Field(description="How it was grown.")
    offspring: list[OffspringOut] = Field(description="The plants grown from it, newest first.")


class PlantSummaryOut(Schema):
    id: int
    nickname: str
    status: PlantStatus
    location: PlantLocationOut | None
    cover_thumbnail_url: str | None
    last_watered_at: datetime | None
    species: PlantSpeciesOut | None
    needs_routine: bool = Field(
        description="Looked after (active, dormant or propagating) but has no care schedule yet."
    )
    glance: GlanceOut


class PlantOut(Schema):
    id: int
    nickname: str
    status: PlantStatus
    location: PlantLocationOut | None
    container_diameter_cm: int | None
    container_height_cm: int | None
    container_material: ContainerMaterial | None
    soil_type: SoilType | None
    acquired_on: date | None
    notes: str
    cover_photo: PhotoOut | None
    light_sources: list[PlantLightOut]
    last_watered_at: datetime | None
    species: PlantSpeciesOut | None
    care_profile: PlantCareProfileOut | None = Field(
        description="The care profile that applies: chosen for it, or its species'."
    )
    created_at: datetime
    glance: GlanceOut
    lineage: LineageOut


class PropagateIn(Schema):
    method: PropagationMethod
    count: int = Field(default=1, ge=1, le=services.MAX_PROPAGATED)
    nickname: str = Field(
        default="",
        max_length=90,
        description="Their name; by default the parent's with the method: 'Monty (cutting)'.",
    )
    location_id: int | None = Field(default=None, description="By default, the parent's.")
    started_on: date | None = Field(default=None, description="By default, today.")


class MovePlantsIn(Schema):
    location_id: int
    plant_ids: list[int] = Field(min_length=1, max_length=100)


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
    needs_routine: bool | None = Field(
        default=None, description="Only plants that do (or don't) need a care schedule."
    )


# --- Conversions ------------------------------------------------------------------------------


def _photo_url(photo_id: int, variant: str) -> str:
    return reverse(f"api-v1:photo_{variant}", kwargs={"photo_id": photo_id})


def photo_out(photo: Photo) -> PhotoOut:
    """Convert a photo for the API. Also used by the care timeline."""
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


def location_out(plant: Plant) -> PlantLocationOut | None:
    """The plant's location for the API. Also used by the Today list."""
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


def _last_watered_at(plant: Plant) -> datetime | None:
    value = getattr(plant, "last_watered_at", None)  # see _plants
    return value if isinstance(value, datetime) else None


def _species_out(plant: Plant, lang: str) -> PlantSpeciesOut | None:
    return _taxon_out(plant.taxon, lang)


def _taxon_out(taxon: Taxon | None, lang: str) -> PlantSpeciesOut | None:
    if taxon is None:
        return None
    names = translated_names(taxon.common_names, lang)
    return PlantSpeciesOut(
        id=taxon.pk,
        scientific_name=taxon.scientific_name,
        common_name=names[0] if names else None,
        toxicity=toxicity_out(taxon, lang),
    )


def _care_profile_out(plant: Plant, lang: str) -> PlantCareProfileOut | None:
    ref = care_profile_ref(plant.effective_care_profile, lang)
    if ref is None:
        return None
    return PlantCareProfileOut(key=ref.key, name=ref.name, chosen=plant.care_profile_id is not None)


def _summary_out(plant: Plant, lang: str) -> PlantSummaryOut:
    return PlantSummaryOut(
        id=plant.pk,
        nickname=plant.nickname,
        status=PlantStatus(plant.status),
        location=location_out(plant),
        cover_thumbnail_url=(
            _photo_url(plant.cover_photo_id, "thumbnail") if plant.cover_photo_id else None
        ),
        last_watered_at=_last_watered_at(plant),
        species=_species_out(plant, lang),
        needs_routine=_needs_routine(plant),
        glance=_glance_out(plant),
    )


def _glance_out(plant: Plant) -> GlanceOut:
    found = glance(plant)
    return GlanceOut(
        water=CareLevelOut(**asdict(found.water)) if found.water else None,
        fertilizer=CareLevelOut(**asdict(found.fertilizer)) if found.fertilizer else None,
        light=LightLevelOut(**asdict(found.light)) if found.light else None,
    )


def _needs_routine(plant: Plant) -> bool:
    schedule_count: int = getattr(plant, "schedule_count", 0)
    return plant.status in CARED_FOR and schedule_count == 0


def _plant_out(plant: Plant, lang: str) -> PlantOut:
    return PlantOut(
        id=plant.pk,
        nickname=plant.nickname,
        status=PlantStatus(plant.status),
        location=location_out(plant),
        container_diameter_cm=plant.container_diameter_cm,
        container_height_cm=plant.container_height_cm,
        container_material=(
            ContainerMaterial(plant.container_material) if plant.container_material else None
        ),
        soil_type=SoilType(plant.soil_type) if plant.soil_type else None,
        acquired_on=plant.acquired_on,
        notes=plant.notes,
        cover_photo=photo_out(plant.cover_photo) if plant.cover_photo else None,
        light_sources=[
            PlantLightOut(
                light_source=light_source_out(link.light_source), distance_cm=link.distance_cm
            )
            for link in plant.light_links.all()
        ],
        last_watered_at=_last_watered_at(plant),
        species=_species_out(plant, lang),
        care_profile=_care_profile_out(plant, lang),
        created_at=plant.created_at,
        glance=_glance_out(plant),
        lineage=_lineage_out(plant),
    )


def _lineage_out(plant: Plant) -> LineageOut:
    offspring = plant.offspring.order_by("-acquired_on", "-id")
    return LineageOut(
        parent=(
            PlantRefOut(id=plant.parent.pk, nickname=plant.parent.nickname)
            if plant.parent
            else None
        ),
        propagation_method=(
            PropagationMethod(plant.propagation_method) if plant.propagation_method else None
        ),
        offspring=[
            OffspringOut(
                id=child.pk,
                nickname=child.nickname,
                status=PlantStatus(child.status),
                propagation_method=(
                    PropagationMethod(child.propagation_method)
                    if child.propagation_method
                    else None
                ),
                acquired_on=child.acquired_on,
            )
            for child in offspring
        ],
    )


def _plants_error(exc: services.PlantsError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


def _plant_data(data: PlantIn) -> services.PlantData:
    fields = data.model_dump(
        exclude={
            "light_sources",
            "last_watered_days_ago",
            "last_fertilized_days_ago",
            "from_wish_id",
        }
    )
    lights = [services.PlantLightData(**light.model_dump()) for light in data.light_sources]
    return services.PlantData(**fields, light_sources=lights)


# --- Lookups (always within the user's household) ---------------------------------------------


def _plants(household: Household) -> QuerySet[Plant]:
    # When the plant was last watered, from the care log (sunfleck.care): care of any type
    # that counts as watering. Skipped waterings don't count.
    last_watered_at = Max(
        "care_events__performed_at",
        filter=Q(care_events__care_type__counts_as_watering=True, care_events__skipped=False),
    )
    # The aggregates drop the model's default ordering, so it's repeated here. Schedules are
    # counted distinct: the join with care events repeats them.
    return (
        household.plants.select_related("location__site", "taxon__archetype", "care_profile")
        .annotate(
            last_watered_at=last_watered_at,
            schedule_count=Count("schedules", distinct=True),
        )
        # For the care bars: each plant's schedules and the lights that reach it.
        .prefetch_related(
            Prefetch("schedules", CareSchedule.objects.select_related("care_type")),
            Prefetch("light_links", PlantLight.objects.select_related("light_source")),
        )
        .order_by("nickname", "id")
    )


def _get_plant(household: Household, plant_id: int) -> Plant:
    plant = _plants(household).select_related("cover_photo", "parent").filter(pk=plant_id).first()
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
        query = filters.q.strip()
        # By the plant's name, or its species' names (scientific, older, or common).
        plants = plants.filter(
            Q(nickname__icontains=query) | Q(taxon__search_text__contains=query.lower())
        )
    if filters.location_id is not None:
        plants = plants.filter(location_id=filters.location_id)
    if filters.status is not None:
        plants = plants.filter(status=filters.status)
    if filters.needs_routine is not None:
        needing = Q(status__in=CARED_FOR, schedule_count=0)
        plants = plants.filter(needing if filters.needs_routine else ~needing)
    page = plants[filters.offset : filters.offset + filters.limit]
    lang = language(request)
    return PlantPage(items=[_summary_out(plant, lang) for plant in page], count=plants.count())


@router.post("/plants", response={201: PlantOut})
def create_plant(request: HttpRequest, data: PlantCreateIn) -> Status[PlantOut]:
    """Add a plant. When it was last watered and fertilized, if known, is recorded as care
    (marked as estimated), so its first due dates start from there."""
    membership = require_role(request, Role.GARDENER)
    household = membership.household
    try:
        with transaction.atomic():
            plant = services.create_plant(household, _plant_data(data))
            care_services.log_last_care(
                plant,
                membership.user,
                data.last_watered_days_ago,
                data.last_fertilized_days_ago,
            )
            if data.from_wish_id is not None:
                # Got it: off the wishlist (if someone hasn't taken it off already).
                household.wishlist.filter(pk=data.from_wish_id).delete()
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return Status(201, _plant_out(_get_plant(household, plant.pk), language(request)))


@router.post("/plants/move", response=list[PlantSummaryOut])
def move_plants(request: HttpRequest, data: MovePlantsIn) -> list[PlantSummaryOut]:
    """Move plants into a location. Returns the plants that moved (those already there don't).
    The lights that reached them are removed, as they belong to their old location."""
    household = require_role(request, Role.GARDENER).household
    try:
        moved = services.move_plants(household, data.location_id, data.plant_ids)
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    plants = _plants(household).filter(pk__in=[plant.pk for plant in moved])
    lang = language(request)
    return [_summary_out(plant, lang) for plant in plants]


@router.get("/plants/{plant_id}", response=PlantOut)
def get_plant(request: HttpRequest, plant_id: int) -> PlantOut:
    household = require_role(request, Role.VIEWER).household
    return _plant_out(_get_plant(household, plant_id), language(request))


@router.get("/plants/{plant_id}/light", response=PlantLightReportOut | None)
def plant_light(request: HttpRequest, plant_id: int) -> PlantLightReportOut | None:
    """Is the plant's spot bright enough? Its light in each season compared with what it likes,
    and what each window or grow light gives. None if the plant has no location or care
    profile, or nothing is known about the light there."""
    household = require_role(request, Role.VIEWER).household
    plant = _get_plant(household, plant_id)
    report = plant_light_report(plant, local_today(plant))
    if report is None:
        return None
    return PlantLightReportOut(
        current_season=report.current_season.value,
        seasons=[
            SeasonLightOut(
                season=season.season.value,
                dli=season.dli,
                ideal=season.ideal,
                verdict=season.verdict,
            )
            for season in report.seasons
        ],
        sources=[source_light_out(source) for source in report.sources],
    )


@router.put("/plants/{plant_id}", response=PlantOut)
def update_plant(request: HttpRequest, plant_id: int, data: PlantIn) -> PlantOut:
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant(household, plant_id)
    try:
        services.update_plant(plant, _plant_data(data))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return _plant_out(_get_plant(household, plant_id), language(request))


@router.post("/plants/{plant_id}/propagate", response={201: list[PlantSummaryOut]})
def propagate_plant(
    request: HttpRequest, plant_id: int, data: PropagateIn
) -> Status[list[PlantSummaryOut]]:
    """Add plants grown from this one (cuttings, divisions, offsets, seedlings), marked as
    propagating. They get its species, care profile and, by default, its location and
    lights."""
    household = require_role(request, Role.GARDENER).household
    parent = _get_plant(household, plant_id)
    try:
        added = services.propagate(parent, services.PropagationData(**data.model_dump()))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    plants = _plants(household).filter(pk__in=[plant.pk for plant in added]).order_by("id")
    lang = language(request)
    return Status(201, [_summary_out(plant, lang) for plant in plants])


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
    return _plant_out(_get_plant(household, plant_id), language(request))


# --- Photos -----------------------------------------------------------------------------------


@router.get("/plants/{plant_id}/photos", response=PhotoPage)
def list_photos(request: HttpRequest, plant_id: int, page: Query[PageQuery]) -> PhotoPage:
    """The plant's photos, newest first."""
    household = require_role(request, Role.VIEWER).household
    photos = _get_plant(household, plant_id).photos.all()
    items = photos[page.offset : page.offset + page.limit]
    return PhotoPage(items=[photo_out(photo) for photo in items], count=photos.count())


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
    return Status(201, photo_out(photo))


class CauseOut(Schema):
    cause: str
    likelihood: str = Field(description="`likely` or `possible`.")
    signs: str = Field(description="What in the photo or the plant's history points to it.")


class DiagnosisOut(Schema):
    summary: str
    causes: list[CauseOut]
    next_steps: list[str]
    urgent: bool = Field(description="The plant could be lost within days without action.")
    photo_clear: bool = Field(description="False if the photo didn't clearly show the problem.")
    attribution: str = Field(description="Which AI suggested it, to show with it.")
    photo: PhotoOut | None = Field(description="The photo, if it was kept on the plant.")


DIAGNOSIS_ERROR_STATUS = {
    "diagnosis_unavailable": 404,
    "ai_quota_exceeded": 429,
}


@router.post("/plants/{plant_id}/diagnosis", response=DiagnosisOut)
def diagnose_plant(
    request: HttpRequest,
    plant_id: int,
    file: File[UploadedFile],
    description: Form[str] = "",
    keep_photo: Form[bool] = False,
) -> DiagnosisOut:
    """What might be wrong with the plant, from a photo of the problem (and a few words, if
    given), with the household's AI plugin. Sends the photo (resized, without metadata), the
    words, and the plant's species, conditions, schedules and recent care; only when asked.
    The answer is suggestions. With `keep_photo`, the photo is added to the plant's photos."""
    household = require_role(request, Role.GARDENER).household
    plant = _get_plant(household, plant_id)
    size = file.size or 0
    if size > images.MAX_UPLOAD_BYTES:
        limit = images.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise ApiError(
            422, "photo_too_large", f"Photos can be up to {limit} MB.", {"field": "file"}
        )
    data = file.read()
    try:
        found = diagnosis.diagnose(plant, io.BytesIO(data), description, language(request))
    except diagnosis.DiagnosisError as exc:
        status = DIAGNOSIS_ERROR_STATUS.get(exc.code, 502 if exc.code.startswith("ai_") else 422)
        raise ApiError(status, exc.code, str(exc)) from exc
    photo = None
    if keep_photo:
        caption = description.strip()[: services.MAX_CAPTION_LENGTH]
        try:
            photo = services.add_photo(plant, io.BytesIO(data), len(data), caption)
        except services.PlantsError as exc:
            raise _plants_error(exc) from exc
    return DiagnosisOut(
        summary=found.summary,
        causes=[CauseOut(**vars(cause)) for cause in found.causes],
        next_steps=found.next_steps,
        urgent=found.urgent,
        photo_clear=found.photo_clear,
        attribution=found.attribution,
        photo=photo_out(photo) if photo else None,
    )


@router.put("/photos/{photo_id}", response=PhotoOut)
def update_photo(request: HttpRequest, photo_id: int, data: PhotoIn) -> PhotoOut:
    household = require_role(request, Role.GARDENER).household
    photo = services.update_photo(_get_photo(household, photo_id), data.caption)
    return photo_out(photo)


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


# --- The wishlist -----------------------------------------------------------------------------


def _wish_out(wish: Wish, lang: str) -> WishOut:
    return WishOut(
        id=wish.pk,
        name=wish.name,
        species=_taxon_out(wish.taxon, lang),
        link=wish.link,
        notes=wish.notes,
        created_at=wish.created_at,
    )


def _get_wish(household: Household, wish_id: int) -> Wish:
    wish = household.wishlist.select_related("taxon").filter(pk=wish_id).first()
    if wish is None:
        raise ApiError(404, "wish_not_found", "This isn't on the wishlist.")
    return wish


@router.get("/wishlist", response=list[WishOut])
def list_wishlist(request: HttpRequest) -> list[WishOut]:
    """The plants the household would like to have, by name."""
    household = require_role(request, Role.VIEWER).household
    lang = language(request)
    return [_wish_out(wish, lang) for wish in household.wishlist.select_related("taxon")]


@router.post("/wishlist", response={201: WishOut})
def add_wish(request: HttpRequest, data: WishIn) -> Status[WishOut]:
    household = require_role(request, Role.GARDENER).household
    try:
        wish = services.save_wish(household, None, services.WishData(**data.model_dump()))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return Status(201, _wish_out(wish, language(request)))


@router.put("/wishlist/{wish_id}", response=WishOut)
def update_wish(request: HttpRequest, wish_id: int, data: WishIn) -> WishOut:
    household = require_role(request, Role.GARDENER).household
    wish = _get_wish(household, wish_id)
    try:
        services.save_wish(household, wish, services.WishData(**data.model_dump()))
    except services.PlantsError as exc:
        raise _plants_error(exc) from exc
    return _wish_out(wish, language(request))


@router.delete("/wishlist/{wish_id}", response={204: None})
def delete_wish(request: HttpRequest, wish_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_wish(household, wish_id).delete()
    return Status(204, None)
