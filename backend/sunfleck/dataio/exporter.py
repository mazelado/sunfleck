"""Exporting a household: its places, plants, photos, care history and settings, as a ZIP file.

Account passwords and secrets (notification addresses, plugins' API keys) are left out.
"""

import zipfile
from pathlib import PurePosixPath
from typing import IO

from django.db.models import Prefetch
from django.utils import timezone

from sunfleck import __version__
from sunfleck.accounts.models import Household
from sunfleck.care.models import CareEvent, CareSchedule, CareType
from sunfleck.dataio import schema
from sunfleck.places.models import Site
from sunfleck.plants.models import Photo, Plant
from sunfleck.plugins import services as plugin_services
from sunfleck.taxonomy.models import CareDataset


def _care_type(care_type: CareType) -> schema.CareTypeRef:
    if care_type.household_id is None:
        return schema.CareTypeRef(key=care_type.key)
    return schema.CareTypeRef(ref=care_type.pk)


def _photo_name(photo: Photo, field: str) -> str:
    suffix = PurePosixPath(getattr(photo, field).name).suffix or ".webp"
    return f"photos/{photo.pk}{'-thumb' if field == 'thumbnail' else ''}{suffix}"


def _sites(household: Household) -> list[schema.Site]:
    sites = Site.objects.filter(household=household).prefetch_related("locations__light_sources")
    return [
        schema.Site(
            ref=site.pk,
            name=site.name,
            latitude=site.latitude,
            longitude=site.longitude,
            timezone=site.timezone,
            locations=[
                schema.Location(
                    ref=location.pk,
                    name=location.name,
                    kind=location.kind,
                    temperature_min_c=location.temperature_min_c,
                    temperature_max_c=location.temperature_max_c,
                    humidity=location.humidity,
                    exposure=location.exposure,
                    light_sources=[
                        schema.LightSource(
                            ref=light.pk,
                            kind=light.kind,
                            name=light.name,
                            direction=light.direction,
                            ppfd=light.ppfd,
                            on_time=light.on_time,
                            off_time=light.off_time,
                            enabled=light.enabled,
                        )
                        for light in location.light_sources.all()
                    ],
                )
                for location in site.locations.all()
            ],
        )
        for site in sites
    ]


def _plant(plant: Plant) -> schema.Plant:
    return schema.Plant(
        ref=plant.pk,
        nickname=plant.nickname,
        location=plant.location_id,
        species=plant.taxon.scientific_name if plant.taxon else None,
        care_profile=plant.care_profile.key if plant.care_profile else None,
        status=plant.status,
        container_diameter_cm=plant.container_diameter_cm,
        container_height_cm=plant.container_height_cm,
        container_material=plant.container_material,
        soil_type=plant.soil_type,
        acquired_on=plant.acquired_on,
        notes=plant.notes,
        created_at=plant.created_at,
        cover_photo=plant.cover_photo_id,
        lights=[
            schema.PlantLight(light_source=link.light_source_id, distance_cm=link.distance_cm)
            for link in plant.light_links.all()
        ],
        photos=[
            schema.Photo(
                ref=photo.pk,
                image=_photo_name(photo, "image"),
                thumbnail=_photo_name(photo, "thumbnail"),
                width=photo.width,
                height=photo.height,
                taken_at=photo.taken_at,
                caption=photo.caption,
            )
            for photo in plant.photos.all()
        ],
        care_events=[
            schema.CareEvent(
                care_type=_care_type(event.care_type),
                performed_at=event.performed_at,
                performed_by=event.performed_by_id,
                notes=event.notes,
                feedback=event.feedback,
                skipped=event.skipped,
            )
            for event in CareEvent.objects.filter(plant=plant)
            .select_related("care_type")
            .order_by("performed_at", "pk")
        ],
        schedules=[
            schema.Schedule(
                care_type=_care_type(item.care_type),
                mode=item.mode,
                fixed_interval_days=item.fixed_interval_days,
                origin=item.origin,
                enabled=item.enabled,
                started_on=item.started_on,
                snoozed_until=item.snoozed_until,
            )
            for item in CareSchedule.objects.filter(plant=plant).select_related("care_type")
        ],
    )


def build(household: Household) -> schema.Export:
    """The household's data, as it's written to `sunfleck.json`."""
    dataset = CareDataset.objects.first()
    plants = (
        Plant.objects.filter(household=household)
        .select_related("taxon", "care_profile")
        # Oldest first, so that importing creates them in the same order.
        .prefetch_related(
            "light_links", Prefetch("photos", queryset=Photo.objects.order_by("taken_at", "pk"))
        )
        .order_by("pk")
    )
    states = plugin_services.states(household)
    return schema.Export(
        format=schema.FORMAT,
        format_version=schema.FORMAT_VERSION,
        app_version=__version__,
        exported_at=timezone.now(),
        care_dataset=dataset.version if dataset else None,
        household=household.name,
        members=[
            schema.Member(
                ref=membership.user_id,
                email=membership.user.email,
                display_name=membership.user.display_name,
                role=membership.role,
            )
            for membership in household.memberships.select_related("user").order_by("pk")
        ],
        care_types=[
            schema.CustomCareType(
                ref=care_type.pk,
                name=care_type.name,
                icon=care_type.icon,
                affects_prediction=care_type.affects_prediction,
                counts_as_watering=care_type.counts_as_watering,
            )
            for care_type in CareType.objects.filter(household=household).order_by("pk")
        ],
        sites=_sites(household),
        plants=[_plant(plant) for plant in plants],
        plugins=[
            schema.PluginSettings(
                id=plugin_id,
                enabled=state.enabled,
                settings=state.settings.model_dump(
                    mode="json", exclude=plugin_services.secret_fields(state.info.settings_schema)
                )
                if state.settings
                else {},
            )
            for plugin_id, state in states.items()
        ],
    )


def write(household: Household, out: IO[bytes]) -> schema.Export:
    """Write the household's export (a ZIP file) to `out`."""
    data = build(household)
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr(
            schema.DATA_FILE, data.model_dump_json(indent=2), compress_type=zipfile.ZIP_DEFLATED
        )
        for photo in Photo.objects.filter(plant__household=household):
            for field in ("image", "thumbnail"):
                with getattr(photo, field).open("rb") as file:
                    # Photos are compressed already.
                    archive.writestr(_photo_name(photo, field), file.read())
    return data
