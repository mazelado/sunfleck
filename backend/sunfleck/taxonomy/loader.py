"""Loading the care dataset (data/care) into the database.

Runs after every `migrate` (so on each start of the Docker image), but only does work when the
dataset's version differs from the one loaded last.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.db import transaction

from sunfleck.taxonomy.dataset import Dataset, load_dataset
from sunfleck.taxonomy.models import CareArchetype, CareDataset, Taxon, TaxonRank

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LoadResult:
    version: str
    loaded: bool
    archetypes: int = 0
    taxa: int = 0


def loaded_version() -> str | None:
    dataset = CareDataset.objects.first()
    return dataset.version if dataset else None


def load_care_data(path: Path, *, force: bool = False) -> LoadResult:
    """Load the dataset in `path`, unless that version is already loaded.

    Raises:
        DatasetError: If the dataset has problems; nothing is changed then.
    """
    dataset = load_dataset(path)
    if not force and loaded_version() == dataset.version:
        return LoadResult(dataset.version, loaded=False)
    with transaction.atomic():
        archetypes = _load_archetypes(dataset)
        taxa = _load_taxa(dataset, archetypes)
        CareDataset.objects.all().delete()
        CareDataset.objects.create(version=dataset.version)
    logger.info(
        "Loaded care dataset %s: %d care profiles, %d genera and species",
        dataset.version,
        len(archetypes),
        taxa,
    )
    return LoadResult(dataset.version, loaded=True, archetypes=len(archetypes), taxa=taxa)


def _load_archetypes(dataset: Dataset) -> dict[str, CareArchetype]:
    archetypes = {}
    for key, profile in dataset.archetypes.items():
        archetypes[key], _ = CareArchetype.objects.update_or_create(
            key=key, defaults={"name": profile["name"], "profile": profile}
        )
    # Keys are never supposed to be removed (data/care/README.md); if one is, plants that
    # chose it lose the choice rather than pointing at a profile that no longer exists.
    CareArchetype.objects.exclude(key__in=archetypes).delete()
    return archetypes


def _load_taxa(dataset: Dataset, archetypes: dict[str, CareArchetype]) -> int:
    names = []
    for entry in dataset.genera:
        genus = entry["genus"]
        _save_taxon(
            genus,
            TaxonRank.GENUS,
            genus,
            entry,
            archetypes[entry["archetype"]],
        )
        names.append(genus)
        for species in entry.get("species", []):
            archetype = archetypes[species.get("archetype", entry["archetype"])]
            _save_taxon(species["name"], TaxonRank.SPECIES, genus, species, archetype, entry)
            names.append(species["name"])
    # Plants keep a removed name (it's still a real plant), just no longer from the dataset.
    Taxon.objects.exclude(scientific_name__in=names).filter(plants__isnull=True).delete()
    return len(names)


def _save_taxon(
    scientific_name: str,
    rank: TaxonRank,
    genus: str,
    entry: dict[str, Any],
    archetype: CareArchetype,
    genus_entry: dict[str, Any] | None = None,
) -> None:
    taxon = Taxon(
        scientific_name=scientific_name,
        rank=rank,
        genus=genus,
        family=(genus_entry or entry)["family"],
        common_names=entry.get("common_names", {}),
        synonyms=entry.get("synonyms", []),
        note=entry.get("note", {}),
        archetype=archetype,
    )
    taxon.search_text = "\n".join(name.lower() for name in taxon.all_names())
    Taxon.objects.update_or_create(
        scientific_name=scientific_name,
        defaults={
            field: getattr(taxon, field)
            for field in (
                "rank",
                "genus",
                "family",
                "common_names",
                "synonyms",
                "note",
                "archetype",
                "search_text",
            )
        },
    )
