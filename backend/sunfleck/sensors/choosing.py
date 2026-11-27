"""Choosing a plant's sensors, and removing them (the services an Editor uses; collecting
readings is in services.py)."""

from typing import ClassVar

from django.db import transaction

from sunfleck.core.errors import ServiceError
from sunfleck.plants.models import Plant
from sunfleck.sensors import selectors
from sunfleck.sensors.kinds import KINDS
from sunfleck.sensors.models import PlantSensor


class SensorsError(ServiceError):
    """A rule about sensors was broken."""

    statuses: ClassVar[dict[str, int]] = {
        "sensor_kind_not_found": 404,
        "sensor_not_found": 404,
    }


def check_kind(kind: str) -> None:
    """Raises: SensorsError: 404 if Sunfleck doesn't know this kind of sensor."""
    if kind not in KINDS:
        raise SensorsError("sensor_kind_not_found", "Sunfleck doesn't know this kind of sensor.")


def get_sensor(plant: Plant, kind: str) -> PlantSensor:
    """The plant's sensor of this kind.

    Raises:
        SensorsError: 404 if the kind is unknown, or no sensor of it is chosen for the plant.
    """
    check_kind(kind)
    sensor = selectors.plant_sensor(plant, kind)
    if sensor is None:
        raise SensorsError("sensor_not_found", "This plant has no sensor of this kind.")
    return sensor


def choose_sensor(plant: Plant, kind: str, plugin_id: str, sensor_id: str) -> PlantSensor:
    """Choose a plugin's sensor of this kind for the plant, named as the plugin names it.

    Choosing the sensor the plant already has keeps it, with its readings. Choosing another
    replaces it: its daily summaries and latest reading start afresh.

    Raises:
        SensorsError: 404 if the kind is unknown; 422 if the sensor isn't among the sensors
            of this kind that the plugins that are on offer now.
    """
    check_kind(kind)
    choice = selectors.find_choice(plant.household, kind, plugin_id, sensor_id)
    if choice is None:
        raise SensorsError(
            "sensor_not_a_choice",
            "This sensor isn't one the plugins offer for this kind.",
            field="sensor_id",
        )
    with transaction.atomic():
        current = PlantSensor.objects.select_for_update().filter(plant=plant, kind=kind).first()
        if current is not None and (current.plugin_id, current.sensor_id) == (
            plugin_id,
            sensor_id,
        ):
            if current.name != choice.name:
                current.name = choice.name
                current.save(update_fields=["name"])
            return current
        if current is not None:
            current.delete()  # with its days
        return PlantSensor.objects.create(
            plant=plant, kind=kind, plugin_id=plugin_id, sensor_id=sensor_id, name=choice.name
        )


def remove_sensor(plant: Plant, kind: str) -> None:
    """Stop reading the plant's sensor of this kind, and forget its summaries.

    Raises:
        SensorsError: 404 if the kind is unknown, or no sensor of it is chosen for the plant.
    """
    get_sensor(plant, kind).delete()
