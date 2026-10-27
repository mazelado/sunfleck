"""Places API: sites, their locations, and the locations' windows and grow lights.

Everyone in the household can see places; Gardeners and Admins can change them.
"""

from datetime import time

from django.db.models import Prefetch, QuerySet
from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.places import services
from sunfleck.places.light import grow_light_dli, hours_on
from sunfleck.places.models import (
    Direction,
    Exposure,
    Humidity,
    LightSource,
    LightSourceKind,
    Location,
    LocationKind,
    Site,
)

router = Router(tags=["places"], auth=django_auth)

# --- Schemas ----------------------------------------------------------------------------------


class LightSourceIn(Schema):
    kind: LightSourceKind
    name: str = Field(default="", max_length=100)
    direction: Direction | None = None
    distance_cm: int | None = Field(default=None, ge=0, le=10_000)
    ppfd: int | None = Field(default=None, ge=1, le=2500)
    on_time: time | None = None
    off_time: time | None = None
    enabled: bool = True


class LightSourceOut(Schema):
    id: int
    kind: LightSourceKind
    name: str
    direction: Direction | None
    distance_cm: int | None
    ppfd: int | None
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


class LocationOut(Schema):
    id: int
    site_id: int
    name: str
    kind: LocationKind
    temperature_min_c: float | None
    temperature_max_c: float | None
    humidity: Humidity | None
    exposure: Exposure | None
    light_sources: list[LightSourceOut]


class SiteIn(Schema):
    name: str = Field(min_length=1, max_length=100)
    latitude: float
    longitude: float
    timezone: str = Field(max_length=64)


class SiteOut(Schema):
    id: int
    name: str
    latitude: float
    longitude: float
    timezone: str
    locations: list[LocationOut]


# --- Conversions ------------------------------------------------------------------------------


def _light_source_out(light: LightSource) -> LightSourceOut:
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
        distance_cm=light.distance_cm,
        ppfd=light.ppfd,
        on_time=light.on_time,
        off_time=light.off_time,
        enabled=light.enabled,
        hours_per_day=hours,
        dli=dli,
    )


def _location_out(location: Location) -> LocationOut:
    return LocationOut(
        id=location.pk,
        site_id=location.site_id,
        name=location.name,
        kind=LocationKind(location.kind),
        temperature_min_c=location.temperature_min_c,
        temperature_max_c=location.temperature_max_c,
        humidity=Humidity(location.humidity) if location.humidity else None,
        exposure=Exposure(location.exposure) if location.exposure else None,
        light_sources=[_light_source_out(light) for light in location.light_sources.all()],
    )


def _site_out(site: Site) -> SiteOut:
    return SiteOut(
        id=site.pk,
        name=site.name,
        latitude=site.latitude,
        longitude=site.longitude,
        timezone=site.timezone,
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
    return _location_out(_get_location(household, location_id))


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
    return Status(201, _light_source_out(light))


@router.put("/light-sources/{light_id}", response=LightSourceOut)
def update_light_source(request: HttpRequest, light_id: int, data: LightSourceIn) -> LightSourceOut:
    household = require_role(request, Role.GARDENER).household
    light = _get_light_source(household, light_id)
    try:
        services.update_light_source(light, services.LightSourceData(**data.model_dump()))
    except services.PlacesError as exc:
        raise _places_error(exc) from exc
    return _light_source_out(light)


@router.delete("/light-sources/{light_id}", response={204: None})
def delete_light_source(request: HttpRequest, light_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_light_source(household, light_id).delete()
    return Status(204, None)
