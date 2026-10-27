"""Business rules for sites, locations, and light sources.

API endpoints call these functions; they never change places data directly.
"""

from dataclasses import dataclass
from datetime import time
from zoneinfo import available_timezones

from django.db import transaction

from sunfleck.accounts.models import Household
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


class PlacesError(Exception):
    """A places rule was broken. `code` is stable and shown to API clients; `field` names the
    form field at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


# --- Sites ------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SiteData:
    name: str
    latitude: float
    longitude: float
    timezone: str


def _validated_site(data: SiteData) -> SiteData:
    if data.timezone not in available_timezones():
        raise PlacesError("unknown_timezone", "Unknown time zone.", "timezone")
    if not -90 <= data.latitude <= 90:
        raise PlacesError("invalid_latitude", "Latitude must be between -90 and 90.", "latitude")
    if not -180 <= data.longitude <= 180:
        raise PlacesError(
            "invalid_longitude", "Longitude must be between -180 and 180.", "longitude"
        )
    return SiteData(
        name=data.name.strip(),
        # Six decimals is about 10 cm: more precise than needed, and keeps values tidy.
        latitude=round(data.latitude, 6),
        longitude=round(data.longitude, 6),
        timezone=data.timezone,
    )


def create_site(household: Household, data: SiteData) -> Site:
    data = _validated_site(data)
    return Site.objects.create(household=household, **data.__dict__)


def update_site(site: Site, data: SiteData) -> Site:
    data = _validated_site(data)
    for field, value in data.__dict__.items():
        setattr(site, field, value)
    site.save()
    return site


# --- Locations --------------------------------------------------------------------------------


@dataclass(frozen=True)
class LocationData:
    name: str
    kind: LocationKind
    temperature_min_c: float | None = None
    temperature_max_c: float | None = None
    humidity: Humidity | None = None
    exposure: Exposure | None = None


def _apply_location(location: Location, data: LocationData) -> None:
    """Copy `data` onto `location`, keeping only the fields that fit its kind."""
    low, high = data.temperature_min_c, data.temperature_max_c
    if low is not None and high is not None and low > high:
        raise PlacesError(
            "temperature_order",
            "The minimum temperature must not be higher than the maximum.",
            "temperature_min_c",
        )
    location.name = data.name.strip()
    location.kind = data.kind
    indoor = data.kind == LocationKind.INDOOR
    location.temperature_min_c = low if indoor else None
    location.temperature_max_c = high if indoor else None
    location.humidity = (data.humidity or "") if indoor else ""
    location.exposure = "" if indoor else (data.exposure or "")


def create_location(site: Site, data: LocationData) -> Location:
    location = Location(site=site)
    _apply_location(location, data)
    location.save()
    return location


def update_location(location: Location, data: LocationData) -> Location:
    """Update a location.

    Raises:
        PlacesError: If an indoor location with windows or grow lights would become outdoor.
    """
    if data.kind == LocationKind.OUTDOOR and location.light_sources.exists():
        raise PlacesError(
            "location_has_light_sources",
            "Remove this location's windows and grow lights before making it outdoor.",
            "kind",
        )
    _apply_location(location, data)
    location.save()
    return location


# --- Light sources ----------------------------------------------------------------------------


@dataclass(frozen=True)
class LightSourceData:
    kind: LightSourceKind
    name: str = ""
    direction: Direction | None = None
    ppfd: int | None = None
    on_time: time | None = None
    off_time: time | None = None
    enabled: bool = True


def _apply_light_source(light: LightSource, data: LightSourceData) -> None:
    """Copy `data` onto `light`, checking and keeping only the fields that fit its kind."""
    light.kind = data.kind
    light.name = data.name.strip()
    light.enabled = data.enabled
    if data.kind == LightSourceKind.WINDOW:
        if not data.direction:
            raise PlacesError("direction_required", "Choose the direction it faces.", "direction")
        light.direction = data.direction
        light.ppfd = light.on_time = light.off_time = None
    else:
        if data.ppfd is None:
            raise PlacesError("ppfd_required", "Enter the light's brightness (PPFD).", "ppfd")
        if data.on_time is None or data.off_time is None:
            raise PlacesError("schedule_required", "Enter when it turns on and off.", "on_time")
        if data.on_time == data.off_time:
            raise PlacesError(
                "schedule_empty", "It must turn on and off at different times.", "off_time"
            )
        light.ppfd = data.ppfd
        light.on_time = data.on_time
        light.off_time = data.off_time
        light.direction = ""


@transaction.atomic
def create_light_source(location: Location, data: LightSourceData) -> LightSource:
    """Add a window or grow light to an indoor location.

    Raises:
        PlacesError: If the location is outdoor, or required fields are missing.
    """
    if location.kind != LocationKind.INDOOR:
        raise PlacesError(
            "outdoor_location", "Windows and grow lights belong to indoor locations.", "kind"
        )
    light = LightSource(location=location)
    _apply_light_source(light, data)
    light.save()
    return light


@transaction.atomic
def update_light_source(light: LightSource, data: LightSourceData) -> LightSource:
    _apply_light_source(light, data)
    light.save()
    if light.kind == LightSourceKind.GROW_LIGHT:
        # Distances only mean something for windows (see sunfleck.plants.models.PlantLight).
        light.plant_links.update(distance_cm=None)
    return light
