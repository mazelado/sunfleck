"""Identifying a plant from photos through a plugin (such as Pl@ntNet), and finding the
candidates in the care dataset.

Photos are sent as JPEG copies without metadata, so the place they were taken stays private.
"""

from dataclasses import dataclass
from typing import IO

from django.db.models import Q

from sunfleck.accounts.models import Household
from sunfleck.plants.images import MAX_UPLOAD_BYTES, ImageError, jpeg_for_identification
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import Candidate, Identification, PhotoToIdentify
from sunfleck.taxonomy.models import Taxon, TaxonRank

HOOK = "identify_plant"
MAX_PHOTOS = 5
MAX_CANDIDATES = 5

PROBLEMS = {
    "missing_api_key": "The identification service needs an API key. An Admin can add it in "
    "the plugin's settings.",
    "invalid_api_key": "The identification service didn't accept its API key. An Admin can "
    "check it in the plugin's settings.",
    "quota_exceeded": "No identifications are left for today. Try again tomorrow.",
    "unavailable": "The identification service can't be reached. Try again later.",
}


class IdentifyError(Exception):
    """The plant couldn't be identified. `code` is stable and shown to API clients."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Match:
    candidate: Candidate
    # The species in the care dataset or, if it isn't there, its genus; None if neither is.
    taxon: Taxon | None

    @property
    def exact(self) -> bool:
        return self.taxon is not None and self.taxon.rank == TaxonRank.SPECIES


@dataclass(frozen=True)
class Result:
    attribution: str
    matches: list[Match]
    remaining: int | None


def available(household: Household) -> bool:
    """Whether a plugin that identifies plants is on for the household."""
    implementers = registry.implementers(HOOK)
    return any(state.enabled for state in plugin_services.states(household, implementers).values())


def identify(household: Household, files: list[tuple[IO[bytes], int]], language: str) -> Result:
    """Identify the plant in the photos (each a file and its size), all of the same plant.

    Raises:
        IdentifyError: If there are no or too many photos, one isn't a usable image, no
            plugin identifies plants, or the plugin couldn't identify it.
    """
    if not 1 <= len(files) <= MAX_PHOTOS:
        raise IdentifyError("too_many_photos", f"Choose 1 to {MAX_PHOTOS} photos.")
    if not available(household):
        raise IdentifyError(
            "identification_unavailable", "No plugin for identifying plants is turned on."
        )
    photos = []
    for file, size in files:
        if size > MAX_UPLOAD_BYTES:
            limit = MAX_UPLOAD_BYTES // (1024 * 1024)
            raise IdentifyError("photo_too_large", f"Photos can be up to {limit} MB.")
        try:
            photos.append(PhotoToIdentify(jpeg_for_identification(file)))
        except ImageError as exc:
            raise IdentifyError(exc.code, str(exc)) from exc

    answers = registry.call(HOOK, household, Identification, photos=photos, language=language)
    if not answers:  # the plugin failed; its error is shown to Admins on the Plugins page
        raise IdentifyError("identification_failed", "The plant couldn't be identified.")
    answer: Identification = answers[0].result
    if answer.problem:
        message = PROBLEMS.get(answer.problem, "The plant couldn't be identified.")
        raise IdentifyError(answer.problem, message)
    candidates = sorted(answer.candidates, key=lambda c: c.score, reverse=True)
    return Result(
        attribution=answer.attribution,
        matches=[Match(c, _find(c)) for c in candidates[:MAX_CANDIDATES]],
        remaining=answer.remaining,
    )


def _find(candidate: Candidate) -> Taxon | None:
    """The candidate's species in the care dataset, by its current or an older name; else its
    genus."""
    name = " ".join(candidate.scientific_name.split())
    genus = candidate.genus or name.split(" ")[0]
    possible = Taxon.objects.select_related("archetype").filter(
        Q(scientific_name__iexact=name)
        | Q(search_text__contains=name.lower())
        | Q(scientific_name__iexact=genus, rank=TaxonRank.GENUS)
    )
    species = genus_taxon = None
    for taxon in possible:
        if taxon.rank == TaxonRank.GENUS:
            if taxon.scientific_name.lower() == genus.lower():
                genus_taxon = taxon
        elif taxon.scientific_name.lower() == name.lower() or name.lower() in (
            synonym.lower() for synonym in taxon.synonyms
        ):
            species = taxon
    return species or genus_taxon
