"""Places API: sites, their locations, and the locations' windows and grow lights.

Everyone in the household can see places; Gardeners and Admins can change them.
"""

from datetime import date, time

from django.db.models import Prefetch, QuerySet
from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.places import frost, light_report, services
from sunfleck.places.humidity import estimated_humidity
from sunfleck.places.light import (
    DEFAULT_PPFD_DISTANCE_CM,
    MAX_DISTANCE_CM,
    MIN_DISTANCE_CM,
    grow_light_dli,
    hours_on,
)
from sunfleck.places.models import (
    BedType,
    Direction,
    Exposure,
    FrostSource,
    Humidity,
    LightSource,
    LightSourceKind,
    Location,
    LocationKind,
    Site,
)
from sunfleck.prediction.light import ASSUMED_WINDOW_DISTANCE_CM

router = Router(tags=["places"], auth=django_auth)

# --- Schemas ----------------------------------------------------------------------------------


class LightSourceIn(Schema):
    kind: LightSourceKind
    name: str = Field(default="", max_length=100)
    direction: Direction | None = None
    ppfd: int | None = Field(default=None, ge=1, le=2500)
    ppfd_distance_cm: int = Field(
        default=DEFAULT_PPFD_DISTANCE_CM,
        ge=MIN_DISTANCE_CM,
        le=MAX_DISTANCE_CM,
        description="Grow lights: how far below the light its PPFD was measured.",
    )
    on_time: time | None = None
    off_time: time | None = None
    enabled: bool = True


class LightSourceOut(Schema):
    id: int
    kind: LightSourceKind
    name: str
    direction: Direction | None
    ppfd: int | None
    ppfd_distance_cm: int
    on_time: time | None
    off_time: time | None
    enabled: bool
    hours_per_day: float | None = Field(description="Grow lights: hours on per day.")
    dli: float | None = Field(description="Grow lights: daily light integral, mol/m²/day.")


class LocationIn(Schema):
    name: str = Field(min_length=1, max_length=100)
    kind: LocationKind
    temperature_min_c: float | None = Field(default=None, ge=-50, le=60)
    temperature_max_c: float | None = Field(default=None, ge=-50, le=60)
    humidity: Humidity | None = None
    exposure: Exposure | None = None
    bed_type: BedType | None = Field(default=None, description="Outdoors: a garden bed's kind.")
    bed_width_cm: int | None = Field(default=None, ge=1, le=10_000)
    bed_length_cm: int | None = Field(default=None, ge=1, le=10_000)


class LocationOut(Schema):
    id: int
    site_id: int
    name: str
    kind: LocationKind
    temperature_min_c: float | None
    temperature_max_c: float | None
    humidity: Humidity | None
    exposure: Exposure | None
    bed_type: BedType | None
    bed_width_cm: int | None
    bed_length_cm: int | None
    light_sources: list[LightSourceOut]
    humidity_estimate: int | None = Field(
        default=None,
        description="Indoors, on a single location: today's humidity in % estimated from the "
        "weather (a plugin). None when there's no weather, or it's warm outside.",
    )


class SeasonDli(Schema):
    spring: float
    summer: float
    autumn: float
    winter: float


class SourceLightOut(Schema):
    """A window or grow light and the light it gives through the year (DLI, mol/m²/day)."""

    id: int
    kind: LightSourceKind
    name: str
    distance_cm: int = Field(
        description="Windows: how far from the glass. On a location, a typical distance."
    )
    dli: SeasonDli


class SeasonLightOut(Schema):
    season: str
    dli: float
    ideal: float = Field(description="What the plant's care profile likes there then.")
    verdict: str = Field(description="low, a_bit_low, good, or bright (more than it likes).")


class PlantLightReportOut(Schema):
    current_season: str
    seasons: list[SeasonLightOut]
    sources: list[SourceLightOut]


class SiteIn(Schema):
    name: str = Field(min_length=1, max_length=100)
    latitude: float
    longitude: float
    timezone: str = Field(max_length=64)


# A frost date's day and month, e.g. "04-20" for 20 April.
MONTH_DAY = r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$"


class FrostDatesIn(Schema):
    last_frost: str | None = Field(default=None, pattern=MONTH_DAY, examples=["04-20"])
    first_frost: str | None = Field(default=None, pattern=MONTH_DAY, examples=["10-25"])


class SiteOut(Schema):
    id: int
    name: str
    latitude: float
    longitude: float
    timezone: str
    last_frost: str | None = Field(
        description="The typical last spring frost, as MM-DD. With `frost_source` but none, "
        "it typically doesn't freeze in spring there."
    )
    first_frost: str | None = Field(description="The typical first autumn frost, as MM-DD.")
    frost_source: FrostSource | None = Field(
        description="Where the frost dates come from; none while they're not known."
    )
    frost_years: int | None = Field(description="For an estimate: the years of weather it's from.")
    locations: list[LocationOut]


# --- Conversions ------------------------------------------------------------------------------


def light_source_out(light: LightSource) -> LightSourceOut:
    """Convert a light source for the API. Also used by the plants API."""
    hours = dli = None
    if light.kind == LightSourceKind.GROW_LIGHT and light.on_time and light.off_time:
        hours = round(hours_on(light.on_time, light.off_time), 2)
        if light.ppfd:
            dli = round(grow_light_dli(light.ppfd, light.on_time, light.off_time), 1)
    return LightSourceOut(
        id=light.pk,
        kind=LightSourceKind(light.kind),
        name=light.name,
        direction=Direction(light.direction) if light.direction else None,
        ppfd=light.ppfd,
        ppfd_distance_cm=light.ppfd_distance_cm,
        on_time=light.on_time,
        off_time=light.off_time,
        enabled=light.enabled,
        hours_per_day=hours,
        dli=dli,
    )


def source_light_out(light: light_report.SourceLight) -> SourceLightOut:
    """Also used by the plants API."""
    distance = light.distance_cm
    if distance is None and light.source.kind == LightSourceKind.WINDOW:
        distance = ASSUMED_WINDOW_DISTANCE_CM
    return SourceLightOut(
        id=light.source.pk,
        kind=LightSourceKind(light.source.kind),
        name=light.source.name,
        distance_cm=distance or 0,
        dli=SeasonDli(**{season.value: dli for season, dli in light.dli.items()}),
    )


def _location_out(location: Location, *, with_estimate: bool = False) -> LocationOut:
    estimate = None
    if with_estimate and location.kind == LocationKind.INDOOR:
        estimate = estimated_humidity(location)
    return LocationOut(
        id=location.pk,
        site_id=location.site_id,
        name=location.name,
        kind=LocationKind(location.kind),
        temperature_min_c=location.temperature_min_c,
        temperature_max_c=location.temperature_max_c,
        humidity=Humidity(location.humidity) if location.humidity else None,
        exposure=Exposure(location.exposure) if location.exposure else None,
        bed_type=BedType(location.bed_type) if location.bed_type else None,
        bed_width_cm=location.bed_width_cm,
        bed_length_cm=location.bed_length_cm,
        light_sources=[light_source_out(light) for light in location.light_sources.all()],
        humidity_estimate=round(estimate) if estimate is not None else None,
    )


def _site_out(site: Site) -> SiteOut:
    return SiteOut(
        id=site.pk,
        name=site.name,
        latitude=site.latitude,
        longitude=site.longitude,
        timezone=site.timezone,
        last_frost=site.last_frost.strftime("%m-%d") if site.last_frost else None,
        first_frost=site.first_frost.strftime("%m-%d") if site.first_frost else None,
        frost_source=FrostSource(site.frost_source) if site.frost_source else None,
        frost_years=site.frost_years,
        locations=[_location_out(location) for location in site.locations.all()],
    )


def _places_error(exc: services.PlacesError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


# --- Lookups (always within the user's household) ---------------------------------------------


def _sites(household: Household) -> QuerySet[Site]:
    locations = Location.objects.prefetch_related("light_sources")
    return household.sites.prefetch_related(Prefetch("locations", queryset=locations))


def _get_site(household: Household, site_id: int) -> Site:
    site = _sites(household).filter(pk=site_id).first()
    if site is None:
        raise ApiError(404, "site_not_found", "This site doesn't exist.")
    return site


def _get_location(household: Household, location_id: int) -> Location:
    location = (
        Location.objects.prefetch_related("light_sources")
        .filter(pk=location_id, site__household=household)
        .first()
    )
    if location is None:
        raise ApiError(404, "location_not_found", "This location doesn't exist.")
    return location


def _get_light_source(household: Household, light_id: int) -> LightSource:
    light = LightSource.objects.filter(pk=light_id, location__site__household=household).first()
    if light is None:
        raise ApiError(404, "light_source_not_found", "This light source doesn't exist.")
    return light


# --- Sites ------------------------------------------------------------------------------------


@router.get("/sites", response=list[SiteOut])
def list_sites(request: HttpRequest) -> list[SiteOut]:
    """All of the household's sites, with their locations and light sources."""
    household = require_role(request, Role.VIEWER).household
    return [_site_out(site) for site in _sites(household)]


@router.post("/sites", response={201: SiteOut})
def create_site(request: HttpRequest, data: SiteIn) -> Status[SiteOut]:
    household = require_role(request, Role.GARDENER).household
    try:
        site = services.create_site(household, services.SiteData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return Status(201, _site_out(_get_site(household, site.pk)))


@router.get("/sites/{site_id}", response=SiteOut)
def get_site(request: HttpRequest, site_id: int) -> SiteOut:
    household = require_role(request, Role.VIEWER).household
    return _site_out(_get_site(household, site_id))


@router.put("/sites/{site_id}", response=SiteOut)
def update_site(request: HttpRequest, site_id: int, data: SiteIn) -> SiteOut:
    household = require_role(request, Role.GARDENER).household
    site = _get_site(household, site_id)
    try:
        services.update_site(site, services.SiteData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return _site_out(_get_site(household, site_id))


@router.put("/sites/{site_id}/frost-dates", response=SiteOut)
def set_frost_dates(request: HttpRequest, site_id: int, data: FrostDatesIn) -> SiteOut:
    """Enter the site's typical frost dates. Leaving both out goes back to an estimate, from a
    plugin that can make one (within the hour)."""
    household = require_role(request, Role.GARDENER).household
    site = _get_site(household, site_id)

    def day(value: str | None, field: str) -> date | None:
        if value is None:
            return None
        month, day_of_month = (int(part) for part in value.split("-"))
        try:
            return frost.frost_day(month, day_of_month)
        except ValueError as exc:
            raise ApiError(422, "invalid_date", "There's no such day.", {"field": field}) from exc

    frost.set_frost_dates(
        site, day(data.last_frost, "last_frost"), day(data.first_frost, "first_frost")
    )
    return _site_out(_get_site(household, site_id))


@router.delete("/sites/{site_id}", response={204: None})
def delete_site(request: HttpRequest, site_id: int) -> Status[None]:
    """Delete a site, with all its locations and light sources."""
    household = require_role(request, Role.GARDENER).household
    _get_site(household, site_id).delete()
    return Status(204, None)


# --- Locations --------------------------------------------------------------------------------


@router.post("/sites/{site_id}/locations", response={201: LocationOut})
def create_location(request: HttpRequest, site_id: int, data: LocationIn) -> Status[LocationOut]:
    household = require_role(request, Role.GARDENER).household
    site = _get_site(household, site_id)
    try:
        location = services.create_location(site, services.LocationData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return Status(201, _location_out(location))


@router.get("/locations/{location_id}", response=LocationOut)
def get_location(request: HttpRequest, location_id: int) -> LocationOut:
    household = require_role(request, Role.VIEWER).household
    return _location_out(_get_location(household, location_id), with_estimate=True)


@router.get("/locations/{location_id}/light", response=list[SourceLightOut])
def location_light(request: HttpRequest, location_id: int) -> list[SourceLightOut]:
    """How much light each window (at a typical distance) and grow light gives, by season."""
    household = require_role(request, Role.VIEWER).household
    location = _get_location(household, location_id)
    return [source_light_out(light) for light in light_report.location_light(location)]


@router.put("/locations/{location_id}", response=LocationOut)
def update_location(request: HttpRequest, location_id: int, data: LocationIn) -> LocationOut:
    household = require_role(request, Role.GARDENER).household
    location = _get_location(household, location_id)
    try:
        services.update_location(location, services.LocationData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return _location_out(_get_location(household, location_id))


@router.delete("/locations/{location_id}", response={204: None})
def delete_location(request: HttpRequest, location_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_location(household, location_id).delete()
    return Status(204, None)


# --- Light sources ----------------------------------------------------------------------------


@router.post("/locations/{location_id}/light-sources", response={201: LightSourceOut})
def create_light_source(
    request: HttpRequest, location_id: int, data: LightSourceIn
) -> Status[LightSourceOut]:
    household = require_role(request, Role.GARDENER).household
    location = _get_location(household, location_id)
    try:
        light = services.create_light_source(
            location, services.LightSourceData(**data.model_dump())
        )
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return Status(201, light_source_out(light))


@router.put("/light-sources/{light_id}", response=LightSourceOut)
def update_light_source(request: HttpRequest, light_id: int, data: LightSourceIn) -> LightSourceOut:
    household = require_role(request, Role.GARDENER).household
    light = _get_light_source(household, light_id)
    try:
        services.update_light_source(light, services.LightSourceData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return light_source_out(light)


@router.delete("/light-sources/{light_id}", response={204: None})
def delete_light_source(request: HttpRequest, light_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_light_source(household, light_id).delete()
    return Status(204, None)
