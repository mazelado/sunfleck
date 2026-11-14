"""Finding a household's plants (see docs/STYLE_GUIDE.md: selectors read, services change)."""

from django.db.models import QuerySet

from sunfleck.accounts.models import Household
from sunfleck.plants.models import Plant
from sunfleck.plants.services import PlantNotFoundError


def get_plant(household: Household, plant_id: int, plants: QuerySet[Plant] | None = None) -> Plant:
    """The household's plant with this id, from `plants` if given (to load what the caller
    needs with it).

    Raises:
        PlantNotFoundError: If the household has no such plant (the API answers 404, without
            saying whether it exists elsewhere).
    """
    queryset = plants if plants is not None else Plant.objects.all()
    plant = queryset.filter(pk=plant_id, household=household).first()
    if plant is None:
        raise PlantNotFoundError
    return plant
