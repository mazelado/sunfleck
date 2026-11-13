"""Garden API: the seeds the household has, the sowing calendar, and harvests.

Everyone in the household can see them; Gardeners and Admins can change them.
"""

from datetime import date
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.http import HttpRequest
from django.utils import timezone
from ninja import Query, Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.core.pagination import ListQuery, paginate
from sunfleck.garden import calendar, services
from sunfleck.garden.models import Harvest, HarvestUnit, SeedPacket
from sunfleck.places.models import Site
from sunfleck.plants import services as plant_services
from sunfleck.plants.models import Plant
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


class SowingEntryOut(Schema):
    seed_id: int
    name: str = Field(description="The seeds' name, with their variety.")
    action: calendar.Action
    starts_on: date
    ends_on: date


class SowingCalendarOut(Schema):
    site_id: int
    site_name: str
    frost: calendar.FrostState = Field(
        description="`known`: timed from the site's frost dates. `none`: it doesn't freeze "
        "there, so nothing is timed. `unknown`: the frost dates aren't known yet."
    )
    today: date = Field(description="Today at the site.")
    entries: list[SowingEntryOut]


class SownIn(Schema):
    location_id: int | None = Field(default=None, description="Where the seedlings are.")


class SownOut(Schema):
    plant_id: int


def _seed_name(packet: SeedPacket) -> str:
    return f"{packet.name} '{packet.variety}'" if packet.variety else packet.name


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


class SeedPage(Schema):
    items: list[SeedOut]
    count: int = Field(description="How many seed packets there are, across all pages.")


@router.get("/seeds", response=SeedPage)
def list_seeds(request: HttpRequest, query: Query[ListQuery]) -> SeedPage:
    """The household's seeds, by name."""
    household = require_role(request, Role.VIEWER).household
    lang = language(request)
    packets = (
        SeedPacket.objects.filter(household=household)
        .select_related("taxon__archetype")
        .order_by("name", "variety", "id")  # the id too, so pages don't overlap
    )
    items, count = paginate(packets, query)
    return SeedPage(items=[_seed_out(packet, lang) for packet in items], count=count)


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


@router.get("/calendar", response=SowingCalendarOut)
def sowing_calendar(request: HttpRequest, site_id: int | None = None) -> SowingCalendarOut:
    """When to sow, plant out and harvest the household's seeds, from today to a year ahead,
    at a site (by default the first with frost dates, or the first)."""
    household = require_role(request, Role.VIEWER).household
    sites = Site.objects.filter(household=household).order_by("pk")
    if site_id is not None:
        site = sites.filter(pk=site_id).first()
    else:
        site = sites.exclude(frost_source="").first() or sites.first()
    if site is None:
        raise ApiError(404, "site_not_found", "There's no place yet to grow them.")
    today = timezone.now().astimezone(ZoneInfo(site.timezone)).date()
    return SowingCalendarOut(
        site_id=site.pk,
        site_name=site.name,
        frost=calendar.frost_state(site),
        today=today,
        entries=[
            SowingEntryOut(
                seed_id=entry.seed.pk,
                name=_seed_name(entry.seed),
                action=entry.action,
                starts_on=entry.starts_on,
                ends_on=entry.ends_on,
            )
            for entry in calendar.calendar(site, today)
        ],
    )


@router.post("/seeds/{seed_id}/sown", response={201: SownOut})
def seeds_sown(request: HttpRequest, seed_id: int, data: SownIn) -> Status[SownOut]:
    """The seeds were sown today: add the seedlings as a plant, of the seeds' species."""
    household = require_role(request, Role.GARDENER).household
    packet = _get_seed(household, seed_id)
    site = Site.objects.filter(household=household).order_by("pk").first()
    zone = ZoneInfo(site.timezone) if site else timezone.get_current_timezone()
    try:
        plant = services.sown(packet, data.location_id, timezone.now().astimezone(zone).date())
    except plant_services.PlantsError as exc:
        raise ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {}) from exc
    return Status(201, SownOut(plant_id=plant.pk))


# --- Harvests ---------------------------------------------------------------------------------


class HarvestIn(Schema):
    harvested_on: date
    amount: Decimal | None = Field(default=None, ge=0, max_digits=8, decimal_places=2)
    unit: HarvestUnit | None = Field(default=None, description="Needed with an amount.")
    notes: str = Field(default="", max_length=2000)


class HarvestOut(Schema):
    id: int
    harvested_on: date
    amount: float | None
    unit: HarvestUnit | None
    notes: str
    logged_by: str | None = Field(description="The name of who logged it.")


class HarvestTotalsOut(Schema):
    year: int
    grams: float | None = Field(description="The weighed harvests, in grams.")
    pieces: float | None
    bunches: float | None


class HarvestsOut(Schema):
    items: list[HarvestOut] = Field(description="The latest first.")
    count: int = Field(description="How many harvests the plant has, across all pages.")
    this_year: HarvestTotalsOut


def _harvest_out(harvest: Harvest) -> HarvestOut:
    return HarvestOut(
        id=harvest.pk,
        harvested_on=harvest.harvested_on,
        amount=float(harvest.amount) if harvest.amount is not None else None,
        unit=HarvestUnit(harvest.unit) if harvest.unit else None,
        notes=harvest.notes,
        logged_by=harvest.logged_by.get_full_name() if harvest.logged_by else None,
    )


def _get_plant(household: Household, plant_id: int) -> Plant:
    plant = Plant.objects.filter(pk=plant_id, household=household).first()
    if plant is None:
        raise ApiError(404, "plant_not_found", "This plant doesn't exist.")
    return plant


def _plant_today(plant: Plant) -> date:
    zone = ZoneInfo(plant.location.site.timezone) if plant.location else None
    return timezone.now().astimezone(zone).date() if zone else timezone.localdate()


@router.get("/plants/{plant_id}/harvests", response=HarvestsOut)
def list_harvests(request: HttpRequest, plant_id: int, query: Query[ListQuery]) -> HarvestsOut:
    """A plant's harvests, the latest first, and this year's total."""
    household = require_role(request, Role.VIEWER).household
    plant = _get_plant(household, plant_id)
    totals = services.harvest_totals(plant, _plant_today(plant).year)
    harvests, count = paginate(
        # The id too, so pages don't overlap.
        plant.harvests.select_related("logged_by").order_by("-harvested_on", "-created_at", "-id"),
        query,
    )
    return HarvestsOut(
        items=[_harvest_out(harvest) for harvest in harvests],
        count=count,
        this_year=HarvestTotalsOut(
            year=totals.year,
            grams=totals.grams,
            pieces=float(totals.pieces) if totals.pieces is not None else None,
            bunches=float(totals.bunches) if totals.bunches is not None else None,
        ),
    )


@router.post("/plants/{plant_id}/harvests", response={201: HarvestOut})
def log_harvest(request: HttpRequest, plant_id: int, data: HarvestIn) -> Status[HarvestOut]:
    membership = require_role(request, Role.GARDENER)
    plant = _get_plant(membership.household, plant_id)
    if data.harvested_on > _plant_today(plant):
        raise ApiError(
            422, "harvest_in_future", "A harvest can't be in the future.", {"field": "harvested_on"}
        )
    try:
        harvest = services.log_harvest(
            plant, services.HarvestData(**data.model_dump()), membership.user
        )
    except services.GardenError as exc:
        raise _garden_error(exc) from exc
    return Status(201, _harvest_out(harvest))


@router.delete("/harvests/{harvest_id}", response={204: None})
def delete_harvest(request: HttpRequest, harvest_id: int) -> Status[None]:
    household = require_role(request, Role.GARDENER).household
    harvest = Harvest.objects.filter(pk=harvest_id, plant__household=household).first()
    if harvest is None:
        raise ApiError(404, "harvest_not_found", "This harvest doesn't exist.")
    harvest.delete()
    return Status(204, None)
