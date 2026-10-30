"""Importing an export into a household that has no places or plants yet, e.g. when moving to
a new server or restoring a backup.

Accounts aren't created: care is credited to the members who already have an account in the
household (by email), and the others can be invited again. Secrets weren't exported, so
notification channels and plugins' API keys have to be set up again.
"""

import io
import uuid
import zipfile
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import IO, Any
from zoneinfo import available_timezones

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError, models, transaction
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError as SchemaError

from sunfleck.accounts.models import Household, User
from sunfleck.care.models import CareEvent, CareSchedule, CareType
from sunfleck.core.images import MAX_UPLOAD_BYTES
from sunfleck.dataio import schema
from sunfleck.places.models import LightSource, Location, Site
from sunfleck.plants.models import Photo, Plant, PlantLight
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.taxonomy.models import CareArchetype, Taxon

MAX_DATA_BYTES = 200 * 1024 * 1024
PHOTO_FORMATS = {"WEBP", "JPEG", "PNG"}


class DataImportError(Exception):
    """The file can't be imported. `code` is stable and shown to API clients."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass
class Summary:
    """What was imported, and what needs attention."""

    sites: int = 0
    plants: int = 0
    photos: int = 0
    care_events: int = 0
    # Members of the exported household without an account here, to invite again.
    members_to_invite: list[str] = field(default_factory=list)
    # Species and care profiles this server's care dataset doesn't have; left unset.
    unknown_species: list[str] = field(default_factory=list)
    unknown_care_profiles: list[str] = field(default_factory=list)
    # Plugins whose API keys (not exported) have to be entered again, or that aren't installed.
    plugins_needing_keys: list[str] = field(default_factory=list)
    plugins_not_installed: list[str] = field(default_factory=list)


def _invalid(where: str, problem: object) -> DataImportError:
    return DataImportError("invalid_export", f"{where}: {problem}")


def _check(instance: models.Model, where: str) -> None:
    """Check field values (choices, lengths, limits) as a form would; relations are set by the
    importer itself, and the database checks the rest."""
    relations = [f.name for f in instance._meta.concrete_fields if f.is_relation]
    try:
        instance.full_clean(exclude=relations, validate_unique=False, validate_constraints=False)
    except ValidationError as exc:
        raise _invalid(where, "; ".join(exc.messages)) from exc


class _Importer:
    def __init__(self, household: Household, archive: zipfile.ZipFile) -> None:
        self.household = household
        self.archive = archive
        self.names = set(archive.namelist())
        self.summary = Summary()
        self.saved_files: list[tuple[Any, str]] = []
        self.care_types: dict[int, CareType] = {}
        self.builtin = {c.key: c for c in CareType.objects.filter(household__isnull=True)}
        self.locations: dict[int, Location] = {}
        self.lights: dict[int, LightSource] = {}
        self.members: dict[int, User] = {}

    # --- Lookups --------------------------------------------------------------------------

    def care_type(self, ref: schema.CareTypeRef, where: str) -> CareType:
        found = (
            self.builtin.get(ref.key)
            if ref.key
            else self.care_types.get(ref.ref)
            if ref.ref is not None
            else None
        )
        if found is None:
            raise _invalid(where, f"unknown care type {ref.key or ref.ref}")
        return found

    # --- Parts ----------------------------------------------------------------------------

    def import_members(self, members: list[schema.Member]) -> None:
        here = {
            m.user.email.lower(): m.user for m in self.household.memberships.select_related("user")
        }
        for member in members:
            user = here.get(member.email.lower())
            if user:
                self.members[member.ref] = user
            else:
                self.summary.members_to_invite.append(member.email)

    def import_care_types(self, care_types: list[schema.CustomCareType]) -> None:
        for item in care_types:
            care_type = CareType(
                household=self.household,
                name=item.name,
                icon=item.icon,
                affects_prediction=item.affects_prediction,
                counts_as_watering=item.counts_as_watering,
            )
            _check(care_type, f"care type {item.name!r}")
            care_type.save()
            self.care_types[item.ref] = care_type

    def import_sites(self, sites: list[schema.Site]) -> None:
        zones = available_timezones()
        for item in sites:
            if item.timezone not in zones:
                raise _invalid(f"site {item.name!r}", f"unknown time zone {item.timezone}")
            site = Site(
                household=self.household,
                name=item.name,
                latitude=item.latitude,
                longitude=item.longitude,
                timezone=item.timezone,
            )
            _check(site, f"site {item.name!r}")
            site.save()
            self.summary.sites += 1
            for loc in item.locations:
                location = Location(
                    site=site,
                    name=loc.name,
                    kind=loc.kind,
                    temperature_min_c=loc.temperature_min_c,
                    temperature_max_c=loc.temperature_max_c,
                    humidity=loc.humidity,
                    exposure=loc.exposure,
                )
                _check(location, f"location {loc.name!r}")
                location.save()
                self.locations[loc.ref] = location
                for light_item in loc.light_sources:
                    light = LightSource(
                        location=location,
                        kind=light_item.kind,
                        name=light_item.name,
                        direction=light_item.direction,
                        ppfd=light_item.ppfd,
                        on_time=light_item.on_time,
                        off_time=light_item.off_time,
                        enabled=light_item.enabled,
                    )
                    _check(light, f"light {light_item.name!r}")
                    light.save()
                    self.lights[light_item.ref] = light

    def read_photo(self, name: str, where: str) -> bytes:
        if name not in self.names:
            raise _invalid(where, f"{name} is missing")
        if self.archive.getinfo(name).file_size > MAX_UPLOAD_BYTES:
            raise _invalid(where, f"{name} is too large")
        content = self.archive.read(name)
        try:
            with Image.open(io.BytesIO(content)) as image:
                image_format = image.format
                image.verify()
        except (UnidentifiedImageError, OSError) as exc:
            raise _invalid(where, f"{name} isn't an image") from exc
        if image_format not in PHOTO_FORMATS:
            raise _invalid(where, f"{name} isn't a WebP, JPEG or PNG image")
        return content

    def delete_saved_files(self) -> None:
        for storage, name in self.saved_files:
            storage.delete(name)

    def save_file(self, file_field: Any, name: str, content: bytes) -> None:
        file_field.save(name, ContentFile(content), save=False)
        self.saved_files.append((file_field.storage, file_field.name))

    def import_photos(self, plant: Plant, item: schema.Plant) -> None:
        for photo_item in item.photos:
            where = f"photo of {item.nickname!r}"
            photo = Photo(
                plant=plant,
                width=photo_item.width,
                height=photo_item.height,
                taken_at=photo_item.taken_at,
                caption=photo_item.caption,
            )
            name = uuid.uuid4().hex
            for field_name, path, suffix in (
                ("image", photo_item.image, ""),
                ("thumbnail", photo_item.thumbnail, "-thumbnail"),
            ):
                content = self.read_photo(path, where)
                extension = PurePosixPath(path).suffix.lower() or ".webp"
                self.save_file(getattr(photo, field_name), f"{name}{suffix}{extension}", content)
            photo.save()
            self.summary.photos += 1
            if photo_item.ref == item.cover_photo:
                plant.cover_photo = photo
                plant.save(update_fields=["cover_photo"])

    def import_plant(self, item: schema.Plant) -> None:
        where = f"plant {item.nickname!r}"
        taxon = None
        if item.species:
            taxon = Taxon.objects.filter(scientific_name=item.species).first()
            if taxon is None:
                self.summary.unknown_species.append(item.species)
        care_profile = None
        if item.care_profile:
            care_profile = CareArchetype.objects.filter(key=item.care_profile).first()
            if care_profile is None:
                self.summary.unknown_care_profiles.append(item.care_profile)
        if item.location is not None and item.location not in self.locations:
            raise _invalid(where, f"unknown location {item.location}")
        plant = Plant(
            household=self.household,
            location=self.locations.get(item.location) if item.location is not None else None,
            nickname=item.nickname,
            taxon=taxon,
            care_profile=care_profile,
            status=item.status,
            container_diameter_cm=item.container_diameter_cm,
            container_height_cm=item.container_height_cm,
            container_material=item.container_material,
            soil_type=item.soil_type,
            acquired_on=item.acquired_on,
            notes=item.notes,
        )
        _check(plant, where)
        plant.save()
        Plant.objects.filter(pk=plant.pk).update(created_at=item.created_at)
        self.summary.plants += 1

        for link in item.lights:
            light = self.lights.get(link.light_source)
            if light is None or light.location_id != plant.location_id:
                raise _invalid(where, f"unknown light {link.light_source}")
            PlantLight.objects.create(plant=plant, light_source=light, distance_cm=link.distance_cm)

        self.import_photos(plant, item)

        events = []
        for event_item in item.care_events:
            event = CareEvent(
                plant=plant,
                care_type=self.care_type(event_item.care_type, where),
                performed_at=event_item.performed_at,
                performed_by=self.members.get(event_item.performed_by)
                if event_item.performed_by is not None
                else None,
                notes=event_item.notes,
                feedback=event_item.feedback,
                skipped=event_item.skipped,
                estimated=event_item.estimated,
            )
            _check(event, f"care of {item.nickname!r}")
            events.append(event)
        # In bulk: plugins aren't told about care logged long ago.
        CareEvent.objects.bulk_create(events)
        self.summary.care_events += len(events)

        for schedule_item in item.schedules:
            schedule = CareSchedule(
                plant=plant,
                care_type=self.care_type(schedule_item.care_type, where),
                mode=schedule_item.mode,
                fixed_interval_days=schedule_item.fixed_interval_days,
                origin=schedule_item.origin,
                enabled=schedule_item.enabled,
                started_on=schedule_item.started_on,
                snoozed_until=schedule_item.snoozed_until,
                routine_multiplier=schedule_item.routine_multiplier,
                routine_set_on=schedule_item.routine_set_on,
                # Recalculated when first read, from the imported care history.
                calculated_on=None,
            )
            _check(schedule, f"schedule of {item.nickname!r}")
            schedule.save()

    def import_plugins(self, plugins: list[schema.PluginSettings]) -> None:
        for item in plugins:
            info = registry.plugins.get(item.id)
            if info is None:
                if item.enabled:
                    self.summary.plugins_not_installed.append(item.id)
                continue
            try:
                plugin_services.update(self.household, item.id, item.enabled, item.settings)
            except plugin_services.PluginError:
                # Settings from another version of the plugin: keep its defaults.
                plugin_services.update(self.household, item.id, item.enabled, {})
            if item.enabled and plugin_services.secret_fields(info.settings_schema):
                self.summary.plugins_needing_keys.append(info.name)

    def run(self, data: schema.Export) -> Summary:
        self.household.name = data.household
        self.household.save(update_fields=["name", "updated_at"])
        self.import_members(data.members)
        self.import_care_types(data.care_types)
        self.import_sites(data.sites)
        for plant in data.plants:
            self.import_plant(plant)
        self.import_plugins(data.plugins)
        return self.summary


def read(file: IO[bytes]) -> tuple[zipfile.ZipFile, schema.Export]:
    """Open an export and read its data.

    Raises:
        DataImportError: If it isn't a Sunfleck export this version can read.
    """
    try:
        archive = zipfile.ZipFile(file)
        info = archive.getinfo(schema.DATA_FILE)
    except (zipfile.BadZipFile, KeyError) as exc:
        raise DataImportError("not_an_export", "This file isn't a Sunfleck export.") from exc
    if info.file_size > MAX_DATA_BYTES:
        raise DataImportError("not_an_export", "This file isn't a Sunfleck export.")
    try:
        data = schema.Export.model_validate_json(archive.read(schema.DATA_FILE))
    except SchemaError as exc:
        error = exc.errors()[0]
        where = ".".join(str(part) for part in error["loc"])
        raise _invalid(where, error["msg"]) from exc
    if data.format_version > schema.FORMAT_VERSION:
        raise DataImportError(
            "export_too_new", "This export is from a newer version of Sunfleck. Update first."
        )
    return archive, data


def is_empty(household: Household) -> bool:
    return not (
        household.sites.exists()
        or household.plants.exists()
        or CareType.objects.filter(household=household).exists()
    )


def import_into(household: Household, file: IO[bytes]) -> Summary:
    """Import an export into the household, which must have no places, plants or care types
    of its own yet. Nothing is imported if anything in the file is wrong.

    Raises:
        DataImportError: If the household isn't empty, or the file isn't a valid export.
    """
    if not is_empty(household):
        raise DataImportError(
            "household_not_empty",
            "Exports can only be imported into a household without places or plants yet.",
        )
    archive, data = read(file)
    importer = _Importer(household, archive)
    try:
        with transaction.atomic():
            return importer.run(data)
    except IntegrityError as exc:
        importer.delete_saved_files()
        raise _invalid("export", exc) from exc
    except BaseException:
        importer.delete_saved_files()
        raise
