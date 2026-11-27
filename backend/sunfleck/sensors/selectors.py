"""Reading sensors: the ones plugins offer to choose from, and a plant's chosen sensors with
their daily summaries (see docs/STYLE_GUIDE.md: selectors read, services change)."""

from dataclasses import dataclass

from django.db.models import QuerySet

from sunfleck.accounts.models import Household
from sunfleck.plants.models import Plant
from sunfleck.plugins import SensorChoice
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.sensors.kinds import KINDS
from sunfleck.sensors.models import PlantSensor, SensorDay

HOOK = "sensor_choices"


@dataclass(frozen=True)
class Choice:
    """A sensor a plugin that's on offers, for choosing one for a plant."""

    plugin_id: str
    sensor_id: str
    name: str
    kind: str


def plugin_on(household: Household) -> bool:
    """Whether a plugin that offers sensors is on for the household."""
    implementers = registry.implementers(HOOK)
    if not implementers:
        return False
    return any(state.enabled for state in plugin_services.states(household, implementers).values())


def sensor_choices(household: Household, kind: str | None = None) -> list[Choice]:
    """The sensors the plugins that are on offer (of one kind, if given), by name.

    A plugin that fails is left out, and the registry keeps its error for the Admin. Items
    that aren't a SensorChoice, and kinds Sunfleck doesn't know, are left out; a sensor a
    plugin lists twice is offered once.
    """
    choices: dict[tuple[str, str], Choice] = {}
    for answer in registry.call(HOOK, household, expect=list):
        for item in answer.result:
            if not isinstance(item, SensorChoice) or item.kind not in KINDS:
                continue
            if kind is not None and item.kind != kind:
                continue
            key = (answer.plugin_id, item.id)
            choices.setdefault(key, Choice(answer.plugin_id, item.id, item.name, item.kind))
    return sorted(
        choices.values(),
        key=lambda choice: (choice.name.casefold(), choice.plugin_id, choice.sensor_id),
    )


def find_choice(household: Household, kind: str, plugin_id: str, sensor_id: str) -> Choice | None:
    """The plugin's sensor with this id, if it's among the current choices of this kind."""
    return next(
        (
            choice
            for choice in sensor_choices(household, kind)
            if (choice.plugin_id, choice.sensor_id) == (plugin_id, sensor_id)
        ),
        None,
    )


def plant_sensors(plant: Plant) -> QuerySet[PlantSensor]:
    """The plant's chosen sensors, by kind (at most one of each)."""
    return PlantSensor.objects.filter(plant=plant).order_by("kind")


def plant_sensor(plant: Plant, kind: str) -> PlantSensor | None:
    """The plant's sensor of this kind, if one is chosen."""
    return PlantSensor.objects.filter(plant=plant, kind=kind).first()


def sensor_days(sensor: PlantSensor) -> QuerySet[SensorDay]:
    """The sensor's daily summaries, the newest first (one a day, so the date is unique)."""
    return SensorDay.objects.filter(sensor=sensor).order_by("-date")
