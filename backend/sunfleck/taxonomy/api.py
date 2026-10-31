"""Taxonomy API: search for genera and species, and read care profiles.

Reference data from the care dataset (data/care), shared by all households. Anyone signed in
can read it; nobody changes it through the API.
"""

from typing import Any, Literal

from django.db.models import Count, Q
from django.http import HttpRequest
from ninja import File, Query, Router, Schema
from ninja.files import UploadedFile
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.taxonomy import identify as identification
from sunfleck.taxonomy import suggest as suggestions
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


class IdentifyAvailableOut(Schema):
    available: bool = Field(description="Whether a plugin that identifies plants is on.")


class CareProfileSuggestionAvailableOut(Schema):
    available: bool = Field(description="Whether an AI plugin is on to suggest care profiles.")


class CareProfileSuggestionIn(Schema):
    name: str = Field(min_length=1, max_length=150, description="What the plant is called.")
    taxon_id: int | None = Field(default=None, description="Its genus or species, if known.")
    indoor: bool | None = Field(default=None, description="Whether it grows indoors.")


class CareProfileRefOut(Schema):
    key: str
    name: str


class CareProfileSuggestionOut(Schema):
    profile: CareProfileRefOut
    confidence: str = Field(description="high, medium or low.")
    reason: str
    attribution: str = Field(description="Which AI suggested it, shown with the suggestion.")


class CandidateOut(Schema):
    scientific_name: str
    score: float = Field(description="How likely it is, from 0 to 1.")
    family: str
    common_names: list[str]
    species: SpeciesOut | None = Field(
        description="The species in the care guide or, if it isn't there, its genus."
    )
    exact: bool = Field(description="Whether `species` is this species rather than its genus.")


class IdentificationOut(Schema):
    attribution: str = Field(description="Who identified it, to show with the results.")
    candidates: list[CandidateOut] = Field(description="Most likely first; may be empty.")
    remaining: int | None = Field(description="Identifications left today, if known.")


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


SUGGEST_ERROR_STATUS = {
    "suggestion_unavailable": 404,
    "ai_quota_exceeded": 429,
    "ai_missing_settings": 502,
    "ai_invalid_api_key": 502,
    "ai_unavailable": 502,
    "ai_invalid_answer": 502,
}


@router.get("/care-profile-suggestions", response=CareProfileSuggestionAvailableOut)
def suggest_available(request: HttpRequest) -> CareProfileSuggestionAvailableOut:
    """Whether care profiles can be suggested with AI (an AI plugin is on)."""
    household = require_role(request, Role.VIEWER).household
    return CareProfileSuggestionAvailableOut(available=suggestions.available(household))


@router.post("/care-profile-suggestions", response=CareProfileSuggestionOut)
def suggest_care_profile(
    request: HttpRequest, data: CareProfileSuggestionIn
) -> CareProfileSuggestionOut:
    """Ask the household's AI plugin which built-in care profile fits a plant best, and why.

    Sends the plant's name, its species (if known) and whether it grows indoors, with the
    list of care profiles. The suggestion is only shown: choosing it is up to the person."""
    household = require_role(request, Role.GARDENER).household
    taxon = Taxon.objects.filter(pk=data.taxon_id).first() if data.taxon_id else None
    lang = language(request)
    try:
        found = suggestions.suggest(household, data.name, taxon, data.indoor, lang)
    except suggestions.SuggestError as exc:
        raise ApiError(SUGGEST_ERROR_STATUS.get(exc.code, 502), exc.code, str(exc)) from exc
    return CareProfileSuggestionOut(
        profile=CareProfileRefOut(key=found.profile.key, name=translated(found.profile.name, lang)),
        confidence=found.confidence,
        reason=found.reason,
        attribution=found.attribution,
    )


IDENTIFY_ERROR_STATUS = {
    "identification_unavailable": 404,
    "quota_exceeded": 429,
    "missing_api_key": 502,
    "invalid_api_key": 502,
    "unavailable": 502,
    "identification_failed": 502,
}


@router.get("/identify", response=IdentifyAvailableOut)
def identify_available(request: HttpRequest) -> IdentifyAvailableOut:
    """Whether plants can be identified from photos (a plugin for it is on)."""
    household = require_role(request, Role.VIEWER).household
    return IdentifyAvailableOut(available=identification.available(household))


@router.post("/identify", response=IdentificationOut)
def identify(request: HttpRequest, photos: File[list[UploadedFile]]) -> IdentificationOut:
    """Identify a plant from 1 to 5 photos of it, through a plugin such as Pl@ntNet.

    The photos are sent without their metadata (such as where they were taken) and aren't
    kept by Sunfleck."""
    household = require_role(request, Role.GARDENER).household
    lang = language(request)
    try:
        result = identification.identify(
            household, [(photo, photo.size or 0) for photo in photos], lang
        )
    except identification.IdentifyError as exc:
        status = IDENTIFY_ERROR_STATUS.get(exc.code, 422)
        raise ApiError(status, exc.code, str(exc)) from exc
    return IdentificationOut(
        attribution=result.attribution,
        candidates=[
            CandidateOut(
                scientific_name=match.candidate.scientific_name,
                score=match.candidate.score,
                family=match.candidate.family,
                common_names=list(match.candidate.common_names),
                species=species_out(match.taxon, lang) if match.taxon else None,
                exact=match.exact,
            )
            for match in result.matches
        ],
        remaining=result.remaining,
    )
