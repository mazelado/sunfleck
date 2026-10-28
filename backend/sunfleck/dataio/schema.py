"""The export format (version 1): `sunfleck.json` in the export's ZIP file, next to the
photos in `photos/`.

Objects refer to each other by `ref`, their id in the household they were exported from. Built-in
care types are referred to by their key (e.g. "water"), species by scientific name and care
profiles by key, since those come from the care dataset rather than the household.
"""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FORMAT: Literal["sunfleck-export"] = "sunfleck-export"
FORMAT_VERSION = 1
DATA_FILE = "sunfleck.json"


class Model(BaseModel):
    # Newer versions may add fields; older ones ignore what they don't know.
    model_config = ConfigDict(extra="ignore")


class Member(Model):
    ref: int
    email: str
    display_name: str
    role: str


class CareTypeRef(Model):
    """A built-in care type by `key`, or one of the household's own by `ref`."""

    key: str | None = None
    ref: int | None = None


class CustomCareType(Model):
    ref: int
    name: str
    icon: str
    affects_prediction: bool
    counts_as_watering: bool


class LightSource(Model):
    ref: int
    kind: str
    name: str
    direction: str
    ppfd: int | None
    on_time: time | None
    off_time: time | None
    enabled: bool


class Location(Model):
    ref: int
    name: str
    kind: str
    temperature_min_c: float | None
    temperature_max_c: float | None
    humidity: str
    exposure: str
    light_sources: list[LightSource] = Field(default_factory=list)


class Site(Model):
    ref: int
    name: str
    latitude: float
    longitude: float
    timezone: str
    locations: list[Location] = Field(default_factory=list)


class PlantLight(Model):
    light_source: int
    distance_cm: int | None


class Photo(Model):
    ref: int
    # Paths inside the ZIP file.
    image: str
    thumbnail: str
    width: int
    height: int
    taken_at: datetime
    caption: str


class CareEvent(Model):
    care_type: CareTypeRef
    performed_at: datetime
    # A member's `ref`, if known.
    performed_by: int | None
    notes: str
    feedback: str
    skipped: bool


class Schedule(Model):
    care_type: CareTypeRef
    mode: str
    fixed_interval_days: int | None
    origin: str
    enabled: bool
    started_on: date
    snoozed_until: date | None


class Plant(Model):
    ref: int
    nickname: str
    location: int | None
    species: str | None = Field(description="Scientific name")
    care_profile: str | None = Field(description="Care profile key, if one was chosen")
    status: str
    container_diameter_cm: int | None
    container_material: str
    soil_type: str
    acquired_on: date | None
    notes: str
    created_at: datetime
    cover_photo: int | None
    lights: list[PlantLight] = Field(default_factory=list)
    photos: list[Photo] = Field(default_factory=list)
    care_events: list[CareEvent] = Field(default_factory=list)
    schedules: list[Schedule] = Field(default_factory=list)


class PluginSettings(Model):
    id: str
    enabled: bool
    # Secret settings (API keys) are never exported.
    settings: dict[str, object]


class Export(Model):
    format: Literal["sunfleck-export"]
    format_version: int
    app_version: str
    exported_at: datetime
    care_dataset: str | None
    household: str
    members: list[Member] = Field(default_factory=list)
    care_types: list[CustomCareType] = Field(default_factory=list)
    sites: list[Site] = Field(default_factory=list)
    plants: list[Plant] = Field(default_factory=list)
    plugins: list[PluginSettings] = Field(default_factory=list)
