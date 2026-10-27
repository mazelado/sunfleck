from datetime import UTC, datetime

from factory.declarations import LazyFunction, SubFactory
from factory.django import DjangoModelFactory

from sunfleck.care.models import CareEvent, CareType
from sunfleck.plants.tests.factories import PlantFactory


def builtin(key: str) -> CareType:
    """A built-in care type (created by migration care/0002)."""
    return CareType.objects.get(household=None, key=key)


class CareEventFactory(DjangoModelFactory[CareEvent]):
    class Meta:
        model = CareEvent

    plant = SubFactory(PlantFactory)
    care_type = LazyFunction(lambda: builtin("water"))
    performed_at = datetime(2026, 5, 1, 9, tzinfo=UTC)
