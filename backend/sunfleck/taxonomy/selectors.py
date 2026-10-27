"""Read queries for plant names and care profiles."""

from dataclasses import dataclass

from sunfleck.taxonomy.models import Taxon

MIN_QUERY_LENGTH = 2


@dataclass(frozen=True)
class SearchHit:
    taxon: Taxon
    # The name that matched best, when it isn't the scientific name: a common or older name.
    matched_name: str | None


def _score(name: str, query: str) -> int | None:
    """How well `name` matches: 0 exactly, 1 at its start, 2 at a word's start, 3 inside."""
    name = name.lower()
    if name == query:
        return 0
    if name.startswith(query):
        return 1
    if any(word.startswith(query) for word in name.replace("-", " ").split()):
        return 2
    return 3 if query in name else None


def search_taxa(query: str, limit: int = 20) -> list[SearchHit]:
    """Genera and species whose scientific, older, or common name (in any language) matches
    `query`, best matches first."""
    query = " ".join(query.lower().split())
    if len(query) < MIN_QUERY_LENGTH:
        return []
    ranked = []
    for taxon in Taxon.objects.select_related("archetype").filter(search_text__contains=query):
        scored = [
            (score, name)
            for name in taxon.all_names()
            if (score := _score(name, query)) is not None
        ]
        if not scored:  # matched across two names in search_text; not a real match
            continue
        score, name = min(scored, key=lambda pair: (pair[0], len(pair[1])))
        ranked.append((score, len(name), taxon.scientific_name, taxon, name))
    ranked.sort(key=lambda row: row[:3])
    return [
        SearchHit(taxon, None if name == taxon.scientific_name else name)
        for *_, taxon, name in ranked[:limit]
    ]
