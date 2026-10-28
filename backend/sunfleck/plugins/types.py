"""Data that passes between Sunfleck and plugins' hooks. Part of the plugin API (version 1)."""

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sunfleck.prediction.engine import Adjustment, Conditions, Factor, Profile

if TYPE_CHECKING:
    from sunfleck.care.models import CareType
    from sunfleck.places.models import Site
    from sunfleck.plants.models import Plant

__all__ = [
    "Adjustment",
    "Alert",
    "Candidate",
    "CareContext",
    "Conditions",
    "Factor",
    "Identification",
    "PeriodicJob",
    "PhotoToIdentify",
    "Profile",
    "SiteConditions",
]


@dataclass(frozen=True)
class CareContext:
    """What a `care_factors` hook gets: the care being predicted, and for which plant."""

    plant: "Plant"
    # The plant's site, if it has a location.
    site: "Site | None"
    care_type: "CareType"
    # The plant's today, in its site's time zone.
    today: date
    profile: Profile
    conditions: Conditions


@dataclass(frozen=True)
class Alert:
    """Something to warn about at a site, e.g. `frost` on a day."""

    kind: str
    on: date
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SiteConditions:
    """Current conditions and today's forecast at a site, for the Today page.

    Temperatures are in °C and precipitation in mm; `weather_code` is a WMO weather code.
    """

    # Who the data comes from, shown with it (e.g. "Weather data by Open-Meteo.com").
    attribution: str
    updated_at: datetime
    temperature_c: float | None = None
    today_min_c: float | None = None
    today_max_c: float | None = None
    precipitation_mm: float | None = None
    weather_code: int | None = None
    alerts: tuple[Alert, ...] = ()


@dataclass(frozen=True)
class PeriodicJob:
    """A background job and when to run it (a cron expression, in UTC). Run from M9 on."""

    name: str
    cron: str
    function: Callable[[], object]  # what it returns is ignored


@dataclass(frozen=True)
class PhotoToIdentify:
    """A photo to identify a plant from: a JPEG without metadata (no GPS position), at most
    1280 px on its long edge."""

    jpeg: bytes
    # What the photo shows: `auto` (unknown), `leaf`, `flower`, `fruit` or `bark`.
    organ: str = "auto"


@dataclass(frozen=True)
class Candidate:
    """A species a plant may be, by its scientific name without the author (e.g. "Monstera
    deliciosa"), with how likely it is (0 to 1)."""

    scientific_name: str
    score: float
    genus: str = ""
    family: str = ""
    common_names: tuple[str, ...] = ()


@dataclass(frozen=True)
class Identification:
    """What an `identify_plant` hook found: candidates, most likely first (none if the photos
    don't show a plant it knows), or a problem.

    `problem` is one of `missing_api_key`, `invalid_api_key`, `quota_exceeded` or
    `unavailable`, for problems the person can do something about (or wait out); other
    failures should raise.
    """

    # Who identified it, shown with the results (e.g. "Identified by Pl@ntNet").
    attribution: str
    candidates: tuple[Candidate, ...] = ()
    problem: str | None = None
    # Identifications left today, if the service says.
    remaining: int | None = None
