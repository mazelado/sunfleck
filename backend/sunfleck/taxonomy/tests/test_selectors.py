import pytest

from sunfleck.taxonomy.selectors import search_taxa


def _names(query: str) -> list[tuple[str, str | None]]:
    return [(hit.taxon.scientific_name, hit.matched_name) for hit in search_taxa(query)]


@pytest.mark.django_db
def test_genus_comes_before_its_species() -> None:
    assert _names("monstera")[:3] == [
        ("Monstera", None),
        ("Monstera adansonii", None),
        ("Monstera deliciosa", None),
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("snake plant", ("Dracaena trifasciata", "snake plant")),
        ("Sansevieria trifasciata", ("Dracaena trifasciata", "Sansevieria trifasciata")),
        ("calathea orbifolia", ("Goeppertia orbifolia", "Calathea orbifolia")),
        ("african violet", ("Streptocarpus ionanthus", "African violet")),
        ("rosemary", ("Salvia rosmarinus", "rosemary")),
    ],
)
def test_common_and_older_names_find_the_current_name(
    query: str, expected: tuple[str, str]
) -> None:
    assert expected in _names(query)


@pytest.mark.django_db
def test_exact_matches_come_before_partial_ones() -> None:
    names = _names("pothos")

    assert names[0] == ("Epipremnum", "pothos")
    assert ("Epipremnum aureum", "pothos") in names


@pytest.mark.django_db
def test_words_inside_names_match() -> None:
    assert ("Monstera deliciosa", "Swiss cheese plant") in _names("cheese")


@pytest.mark.django_db
@pytest.mark.parametrize("query", ["", "m", "  ", "xyzzy"])
def test_short_or_unknown_searches_find_nothing(query: str) -> None:
    assert search_taxa(query) == []


@pytest.mark.django_db
def test_results_are_limited() -> None:
    assert len(search_taxa("a", limit=5)) == 0  # too short
    assert len(search_taxa("ia", limit=5)) == 5
