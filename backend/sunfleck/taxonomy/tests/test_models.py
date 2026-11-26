import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from sunfleck.taxonomy.models import Taxon, fold, translated, translated_names

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


def test_names_are_folded_for_search() -> None:
    assert fold("Árbol del Caucho") == "arbol del caucho"
    assert fold("piña") == "pina"
    # Hybrids keep their multiplication sign: only accents are removed.
    assert fold("Citrus \u00d7 limon") == "citrus \u00d7 limon"


@pytest.mark.django_db(transaction=True)
def test_upgrading_folds_the_search_names_already_loaded() -> None:
    before = [("taxonomy", "0003_taxon_crop")]
    executor = MigrationExecutor(connection)
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    taxon = old.get_model("taxonomy", "Taxon").objects.create(
        scientific_name="Vaccinium testii",
        rank="species",
        genus="Vaccinium",
        family="Ericaceae",
        search_text="vaccinium testii\narándano de prueba",
    )

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())

    assert Taxon.objects.get(pk=taxon.pk).search_text == "vaccinium testii\narandano de prueba"
