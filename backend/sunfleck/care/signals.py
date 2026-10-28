"""Mark care schedules out of date when something their predictions depend on changes.

Marking is one cheap update; the schedules are recalculated when they're next read (see
schedules.py), after the change is complete. Changes made with bulk queries (e.g. a plant's
light being replaced) don't send signals, but always come with a save that does.
"""

from typing import Any

from django.db.models import Model
from django.db.models.signals import post_delete, post_save, pre_delete

from sunfleck.care.models import CareEvent, CareSchedule
from sunfleck.places.models import LightSource, Location, Site
from sunfleck.plants.models import Plant, PlantLight
from sunfleck.taxonomy.models import CareArchetype, Taxon


def mark_out_of_date(**plants: Any) -> None:
    """Mark the schedules of the plants matching `plants` (Plant lookups) out of date."""
    lookups = {f"plant__{field}": value for field, value in plants.items()}
    CareSchedule.objects.filter(**lookups).exclude(calculated_on=None).update(calculated_on=None)


def _plant(sender: type[Model], instance: Plant, **kwargs: Any) -> None:
    mark_out_of_date(pk=instance.pk)


def _by_plant_id(sender: type[Model], instance: PlantLight | CareEvent, **kwargs: Any) -> None:
    mark_out_of_date(pk=instance.plant_id)


def _location(sender: type[Model], instance: Location, **kwargs: Any) -> None:
    mark_out_of_date(location=instance.pk)


def _light_source(sender: type[Model], instance: LightSource, **kwargs: Any) -> None:
    mark_out_of_date(location=instance.location_id)


def _site(sender: type[Model], instance: Site, **kwargs: Any) -> None:
    mark_out_of_date(location__site=instance.pk)


def _care_profile(sender: type[Model], instance: CareArchetype, **kwargs: Any) -> None:
    mark_out_of_date(care_profile=instance.pk)
    mark_out_of_date(care_profile=None, taxon__archetype=instance.pk)


def _taxon(sender: type[Model], instance: Taxon, **kwargs: Any) -> None:
    mark_out_of_date(taxon=instance.pk)


def connect() -> None:
    post_save.connect(_plant, sender=Plant, dispatch_uid="care_schedules_plant")
    for model in (PlantLight, CareEvent):
        for signal in (post_save, post_delete):
            signal.connect(_by_plant_id, sender=model, dispatch_uid=f"care_schedules_{model}")
    post_save.connect(_location, sender=Location, dispatch_uid="care_schedules_location")
    # Before deleting: afterwards, its plants no longer point at it.
    pre_delete.connect(_location, sender=Location, dispatch_uid="care_schedules_location_del")
    for signal in (post_save, post_delete):
        signal.connect(_light_source, sender=LightSource, dispatch_uid="care_schedules_light")
    post_save.connect(_site, sender=Site, dispatch_uid="care_schedules_site")
    pre_delete.connect(_site, sender=Site, dispatch_uid="care_schedules_site_delete")
    post_save.connect(_care_profile, sender=CareArchetype, dispatch_uid="care_schedules_profile")
    post_save.connect(_taxon, sender=Taxon, dispatch_uid="care_schedules_taxon")
