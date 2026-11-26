"""Reference data from the care dataset (data/care): care profiles and plant names.

Shared by all households and read-only in the app: it's replaced whenever a new version of
the dataset is loaded (see sunfleck.taxonomy.loader).
"""

import unicodedata

from django.db import models
from django.utils.translation import gettext_lazy as _

FALLBACK_LANGUAGE = "en"


def fold(text: str) -> str:
    """Text as plant names are searched: lower case and without accents, so that "arandano"
    finds "arándano" and "pina" finds "piña". Used for both `search_text` and queries."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def translated(text: dict[str, str], language: str) -> str:
    """Text in `language` (or its base language, e.g. "pt" for "pt-BR"), else English."""
    return (
        text.get(language) or text.get(language.split("-")[0]) or text.get(FALLBACK_LANGUAGE) or ""
    )


def translated_names(names: dict[str, list[str]], language: str) -> list[str]:
    """Common names in `language` (or its base language). English ones only for English: in
    another language, a plant without names in it is shown by its scientific name, rather than
    with English words in the middle of the text (docs/spanish-care-data-2026-11.md)."""
    base = language.split("-")[0]
    found = names.get(language) or names.get(base)
    if found:
        return found
    return names.get(FALLBACK_LANGUAGE, []) if base == FALLBACK_LANGUAGE else []


class CareArchetype(models.Model):
    """A care profile: typical care for a group of plants with similar needs.

    `profile` holds the profile exactly as written in data/care/archetypes/<key>.yaml (see the
    field reference in data/care/README.md), so the dataset can grow without migrations.
    """

    key = models.SlugField(_("key"), max_length=50, unique=True)
    name = models.JSONField(_("name"), help_text="Per language code.")
    profile = models.JSONField(_("profile"))

    class Meta:
        verbose_name = _("care profile")
        verbose_name_plural = _("care profiles")
        ordering = ["key"]

    def __str__(self) -> str:
        return translated(self.name, FALLBACK_LANGUAGE)


class TaxonRank(models.TextChoices):
    GENUS = "genus", _("Genus")
    SPECIES = "species", _("Species")


class Taxon(models.Model):
    """A genus or species, with its common names, older names, and care profile."""

    scientific_name = models.CharField(_("scientific name"), max_length=150, unique=True)
    rank = models.CharField(_("rank"), max_length=16, choices=TaxonRank.choices)
    genus = models.CharField(_("genus"), max_length=100)
    family = models.CharField(_("family"), max_length=100)
    common_names = models.JSONField(_("common names"), default=dict)
    synonyms = models.JSONField(_("older names"), default=list)
    note = models.JSONField(_("note"), default=dict)
    # Known toxicity to pets, as in the dataset: {"cats": "toxic", "dogs": "toxic", "sources":
    # [...], "note": {...}}. Empty means unknown (never "safe"). A species without its own
    # takes its genus's.
    toxicity = models.JSONField(_("toxicity"), default=dict)
    # Known harm to people, as in the dataset: {"if_eaten": "low" | "medium" | "high", "skin":
    # true, "sources": [...], "note": {...}}, either of the first two. Empty means unknown (never
    # "safe"). A species without its own takes its genus's.
    harmful_to_people = models.JSONField(_("harmful to people"), default=dict)
    # When to sow, plant out and harvest it, as in the dataset: {"steps": [{"action":
    # "sow_indoors", "after": "last_frost", "weeks": [-8, -6]}, ...], "harvest_days": [60, 85]}.
    # Empty when it isn't grown from seed in a season. A species without its own takes its
    # genus's.
    crop = models.JSONField(_("crop timing"), default=dict)
    archetype = models.ForeignKey(
        CareArchetype,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="taxa",
        verbose_name=_("care profile"),
    )
    # Every name (scientific, older, and common in every language), folded (see `fold`), for
    # search.
    search_text = models.TextField(editable=False)

    class Meta:
        verbose_name = _("genus or species")
        verbose_name_plural = _("genera and species")
        ordering = ["scientific_name"]

    def __str__(self) -> str:
        return self.scientific_name

    def all_names(self) -> list[str]:
        common = [name for names in self.common_names.values() for name in names]
        return [self.scientific_name, *self.synonyms, *common]


class CareDataset(models.Model):
    """Which version of the care dataset is loaded. There's at most one row."""

    version = models.CharField(max_length=32)
    loaded_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.version
