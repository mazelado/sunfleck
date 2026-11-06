"""Seeds the household has."""

from dataclasses import dataclass
from datetime import date

from sunfleck.accounts.models import Household
from sunfleck.garden.models import SeedPacket
from sunfleck.plants import services as plants
from sunfleck.plants.models import Plant
from sunfleck.taxonomy.models import Taxon


class GardenError(Exception):
    """A change was refused. `field` names the field at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


@dataclass(frozen=True)
class SeedData:
    name: str
    taxon_id: int | None = None
    variety: str = ""
    quantity: str = ""
    sow_by: int | None = None
    notes: str = ""


def _apply(packet: SeedPacket, data: SeedData) -> None:
    taxon = None
    if data.taxon_id is not None:
        taxon = Taxon.objects.filter(pk=data.taxon_id).first()
        if taxon is None:
            raise GardenError("species_not_found", "This species isn't in the list.", "taxon_id")
    packet.taxon = taxon
    packet.name = data.name.strip()
    packet.variety = data.variety.strip()
    packet.quantity = data.quantity.strip()
    packet.sow_by = data.sow_by
    packet.notes = data.notes.strip()


def create_seed(household: Household, data: SeedData) -> SeedPacket:
    """Add seeds.

    Raises:
        GardenError: If the species isn't in the list.
    """
    packet = SeedPacket(household=household)
    _apply(packet, data)
    packet.save()
    return packet


def sown(packet: SeedPacket, location_id: int | None, today: date) -> Plant:
    """The seeds were sown: add the seedlings as a plant, of their species, sown today.

    Raises:
        PlantsError: If the location isn't the household's.
    """
    name = f"{packet.name} '{packet.variety}'" if packet.variety else packet.name
    return plants.create_plant(
        packet.household,
        plants.PlantData(
            nickname=name[:100],
            location_id=location_id,
            taxon_id=packet.taxon_id,
            acquired_on=today,
        ),
    )


def update_seed(packet: SeedPacket, data: SeedData) -> SeedPacket:
    """Change seeds.

    Raises:
        GardenError: If the species isn't in the list.
    """
    _apply(packet, data)
    packet.save()
    return packet
