"""Garden API: the seeds the household has.

Everyone in the household can see them; Gardeners and Admins can change them.
"""

from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.garden import services
from sunfleck.garden.models import SeedPacket
from sunfleck.taxonomy.api import SpeciesOut, language, species_out

router = Router(tags=["garden"], auth=django_auth)


class SeedIn(Schema):
    name: str = Field(min_length=1, max_length=100, description="As on the packet, e.g. Tomato.")
    taxon_id: int | None = Field(
        default=None, description="Its species, for when to sow and plant it out."
    )
    variety: str = Field(default="", max_length=100)
    quantity: str = Field(default="", max_length=50, description="e.g. about 20 seeds.")
    sow_by: int | None = Field(
        default=None, ge=2000, le=2100, description="The last year to sow them in."
    )
    notes: str = Field(default="", max_length=2000)


class SeedOut(Schema):
    id: int
    name: str
    species: SpeciesOut | None
    variety: str
    quantity: str
    sow_by: int | None
    notes: str


def _seed_out(packet: SeedPacket, lang: str) -> SeedOut:
    return SeedOut(
        id=packet.pk,
        name=packet.name,
        species=species_out(packet.taxon, lang) if packet.taxon else None,
        variety=packet.variety,
        quantity=packet.quantity,
        sow_by=packet.sow_by,
        notes=packet.notes,
    )


def _get_seed(household: Household, seed_id: int) -> SeedPacket:
    packet = (
        SeedPacket.objects.select_related("taxon__archetype")
        .filter(pk=seed_id, household=household)
        .first()
    )
    if packet is None:
        raise ApiError(404, "seed_not_found", "These seeds don't exist.")
    return packet


def _garden_error(exc: services.GardenError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


@router.get("/seeds", response=list[SeedOut])
def list_seeds(request: HttpRequest) -> list[SeedOut]:
    """The household's seeds, by name. A household has a few dozen at most."""
    household = require_role(request, Role.VIEWER).household
    lang = language(request)
    packets = SeedPacket.objects.filter(household=household).select_related("taxon__archetype")
    return [_seed_out(packet, lang) for packet in packets]


@router.post("/seeds", response={201: SeedOut})
def create_seed(request: HttpRequest, data: SeedIn) -> Status[SeedOut]:
    household = require_role(request, Role.GARDENER).household
    try:
        packet = services.create_seed(household, services.SeedData(**data.model_dump()))
    except services.GardenError as exc:
        raise _garden_error(exc) from exc
    return Status(201, _seed_out(packet, language(request)))


@router.put("/seeds/{seed_id}", response=SeedOut)
def update_seed(request: HttpRequest, seed_id: int, data: SeedIn) -> SeedOut:
    household = require_role(request, Role.GARDENER).household
    packet = _get_seed(household, seed_id)
    try:
        services.update_seed(packet, services.SeedData(**data.model_dump()))
    except services.GardenError as exc:
        raise _garden_error(exc) from exc
    return _seed_out(packet, language(request))


@router.delete("/seeds/{seed_id}", response={204: None})
def delete_seed(request: HttpRequest, seed_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    _get_seed(household, seed_id).delete()
    return Status(204, None)
