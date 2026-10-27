"""Taxonomy API: search for genera and species, and read care profiles.

Reference data from the care dataset (data/care), shared by all households. Anyone signed in
can read it; nobody changes it through the API.
"""

from typing import Any, Literal

from django.db.models import Count, Q
from django.http import HttpRequest
from ninja import Query, Router, Schema
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.taxonomy.models import (
    CareArchetype,
    Taxon,
    TaxonRank,
    translated,
    translated_names,
)
from sunfleck.taxonomy.selectors import search_taxa

router = Router(tags=["taxonomy"], auth=django_auth)

Setting = Literal["indoor", "outdoor", "either"]
LetDry = Literal["keep_moist", "top_quarter", "top_third", "top_half", "mostly", "completely"]
HumidityLevel = Literal["low", "medium", "medium_high", "high"]
OutdoorExposure = Literal["full_sun", "part_shade", "shade"]

# --- Schemas ----------------------------------------------------------------------------------


class CareProfileRef(Schema):
    key: str
    name: str


class SeasonalDays(Schema):
    spring: int | None
    summer: int | None
    autumn: int | None
    winter: int | None


class WateringOut(Schema):
    interval_days: SeasonalDays = Field(
        description="Typical days between waterings; null: only in long dry spells, or not "
        "while dormant."
    )
    let_dry: LetDry


class LightOut(Schema):
    dli_min: float
    dli_ideal: float
    dli_max: float
    outdoor_exposure: list[OutdoorExposure]


class TemperatureOut(Schema):
    min: float
    ideal_min: float
    ideal_max: float
    max: float


class FertilizingOut(Schema):
    interval_days: int
    pause_months_north: list[int]


class CareProfileSummaryOut(Schema):
    key: str
    name: str
    description: str
    setting: Setting
    genus_count: int


class CareProfileOut(Schema):
    key: str
    name: str
    description: str
    notes: str | None
    setting: Setting
    examples: list[str]
    watering: WateringOut
    light: LightOut
    humidity: HumidityLevel
    temperature_c: TemperatureOut
    fertilizing: FertilizingOut | None = Field(description="null: don't fertilize.")
    dormancy_months_north: list[int]
    status: Literal["draft", "reviewed"]
    sources: list[str]
    genera: list[str] = Field(description="The genera with this care profile.")


class SpeciesOut(Schema):
    id: int
    scientific_name: str
    rank: TaxonRank
    family: str
    common_name: str | None = Field(description="The most common name in your language.")
    common_names: list[str]
    synonyms: list[str] = Field(description="Older names.")
    note: str | None
    care_profile: CareProfileRef | None


class SpeciesHitOut(SpeciesOut):
    matched_name: str | None = Field(
        description="The common or older name that matched, if it wasn't the scientific name."
    )


class SearchQuery(Schema):
    q: str = Field(min_length=1, max_length=100)
    limit: int = Field(default=20, ge=1, le=50)


# --- Conversions ------------------------------------------------------------------------------


def language(request: HttpRequest) -> str:
    """The signed-in person's language, for names and descriptions."""
    user = request.user
    return user.locale if isinstance(user, User) else "en"


def care_profile_ref(archetype: CareArchetype | None, lang: str) -> CareProfileRef | None:
    """A care profile's key and name. Also used by the plants API."""
    if archetype is None:
        return None
    return CareProfileRef(key=archetype.key, name=translated(archetype.name, lang))


def species_out(taxon: Taxon, lang: str) -> SpeciesOut:
    names = translated_names(taxon.common_names, lang)
    return SpeciesOut(
        id=taxon.pk,
        scientific_name=taxon.scientific_name,
        rank=TaxonRank(taxon.rank),
        family=taxon.family,
        common_name=names[0] if names else None,
        common_names=names,
        synonyms=taxon.synonyms,
        note=translated(taxon.note, lang) or None,
        care_profile=care_profile_ref(taxon.archetype, lang),
    )


def _profile_out(archetype: CareArchetype, lang: str, genera: list[str]) -> CareProfileOut:
    profile: dict[str, Any] = archetype.profile
    return CareProfileOut(
        key=archetype.key,
        name=translated(profile["name"], lang),
        description=translated(profile["description"], lang),
        notes=translated(profile.get("notes", {}), lang) or None,
        setting=profile["setting"],
        examples=profile["examples"],
        watering=WateringOut(**profile["watering"]),
        light=LightOut(**{"outdoor_exposure": [], **profile["light"]}),
        humidity=profile["humidity"],
        temperature_c=TemperatureOut(**profile["temperature_c"]),
        fertilizing=FertilizingOut(**profile["fertilizing"]) if profile["fertilizing"] else None,
        dormancy_months_north=profile.get("dormancy_months_north", []),
        status=profile["status"],
        sources=profile["sources"],
        genera=genera,
    )


# --- Endpoints --------------------------------------------------------------------------------


@router.get("/species", response=list[SpeciesHitOut])
def search_species(request: HttpRequest, search: Query[SearchQuery]) -> list[SpeciesHitOut]:
    """Genera and species by scientific, older, or common name (in any language), best
    matches first. At least 2 characters; shorter searches find nothing."""
    require_role(request, Role.VIEWER)
    lang = language(request)
    return [
        SpeciesHitOut(**species_out(hit.taxon, lang).model_dump(), matched_name=hit.matched_name)
        for hit in search_taxa(search.q, search.limit)
    ]


@router.get("/species/{taxon_id}", response=SpeciesOut)
def get_species(request: HttpRequest, taxon_id: int) -> SpeciesOut:
    require_role(request, Role.VIEWER)
    taxon = Taxon.objects.select_related("archetype").filter(pk=taxon_id).first()
    if taxon is None:
        raise ApiError(404, "species_not_found", "This species isn't in the list.")
    return species_out(taxon, language(request))


@router.get("/care-profiles", response=list[CareProfileSummaryOut])
def list_care_profiles(request: HttpRequest) -> list[CareProfileSummaryOut]:
    """Every care profile, by name. A short, fixed-size list."""
    require_role(request, Role.VIEWER)
    lang = language(request)
    profiles = CareArchetype.objects.annotate(
        genus_count=Count("taxa", filter=Q(taxa__rank=TaxonRank.GENUS))
    )
    summaries = [
        CareProfileSummaryOut(
            key=archetype.key,
            name=translated(archetype.name, lang),
            description=translated(archetype.profile["description"], lang),
            setting=archetype.profile["setting"],
            genus_count=archetype.genus_count,
        )
        for archetype in profiles
    ]
    return sorted(summaries, key=lambda summary: summary.name.lower())


@router.get("/care-profiles/{key}", response=CareProfileOut)
def get_care_profile(request: HttpRequest, key: str) -> CareProfileOut:
    require_role(request, Role.VIEWER)
    archetype = CareArchetype.objects.filter(key=key).first()
    if archetype is None:
        raise ApiError(404, "care_profile_not_found", "This care profile doesn't exist.")
    genera = list(
        archetype.taxa.filter(rank=TaxonRank.GENUS).values_list("scientific_name", flat=True)
    )
    return _profile_out(archetype, language(request), genera)
