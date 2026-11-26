from sunfleck.taxonomy.models import translated, translated_names

NAMES = {"en": ["avocado"], "es": ["aguacate", "palta"], "pt": ["abacate"]}


def test_common_names_in_the_language_or_its_base_language() -> None:
    assert translated_names(NAMES, "es") == ["aguacate", "palta"]
    assert translated_names(NAMES, "pt-BR") == ["abacate"]
    assert translated_names(NAMES, "en") == ["avocado"]
    assert translated_names(NAMES, "en-GB") == ["avocado"]


def test_no_english_common_names_in_another_language() -> None:
    assert translated_names(NAMES, "de") == []
    assert translated_names({}, "en") == []


def test_other_text_still_falls_back_to_english() -> None:
    assert translated({"en": "Tropical aroid"}, "de") == "Tropical aroid"
    assert translated({"en": "Tropical aroid", "es": "Arácea tropical"}, "es") == "Arácea tropical"
