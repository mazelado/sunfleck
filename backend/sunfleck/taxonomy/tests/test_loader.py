from pathlib import Path
from typing import Any

import pytest
import yaml
from django.core.management import CommandError, call_command
from django.test import override_settings

from sunfleck.accounts.models import Household
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.taxonomy.dataset import DatasetError
from sunfleck.taxonomy.loader import load_care_data, loaded_version
from sunfleck.taxonomy.models import CareArchetype, Taxon
from sunfleck.taxonomy.signals import load_care_data_after_migrate


def _edit_genera(root: Path, change: Any) -> None:
    file = root / "genera.yaml"
    data = yaml.safe_load(file.read_text(encoding="utf-8"))
    change(data["genera"])
    file.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")


def _set_version(root: Path, version: str) -> None:
    (root / "dataset.yaml").write_text(f"version: {version}\n", encoding="utf-8")


@pytest.mark.django_db
def test_the_dataset_is_loaded_by_migrate() -> None:
    snake = Taxon.objects.get(scientific_name="Dracaena trifasciata")

    assert loaded_version() is not None
    assert CareArchetype.objects.count() == 28
    assert snake.archetype is not None
    assert snake.archetype.key == "low_light_tough"
    assert snake.synonyms == ["Sansevieria trifasciata"]
    assert "snake plant" in snake.search_text
    assert Taxon.objects.get(scientific_name="Dracaena").archetype.key == "indoor_tree"  # type: ignore[union-attr]


@pytest.mark.django_db
def test_the_same_version_is_not_loaded_twice(dataset_copy: Path) -> None:
    result = load_care_data(dataset_copy)

    assert not result.loaded


@pytest.mark.django_db
def test_a_new_version_updates_the_data(dataset_copy: Path, household: Household) -> None:
    kept = PlantFactory.create(
        household=household, taxon=Taxon.objects.get(scientific_name="Lithops")
    )

    def change(genera: list[dict[str, Any]]) -> None:
        monstera = next(entry for entry in genera if entry["genus"] == "Monstera")
        monstera["common_names"] = {"en": ["monstera"], "de": ["Fensterblatt"]}
        genera[:] = [entry for entry in genera if entry["genus"] not in ("Lithops", "Cereus")]

    _edit_genera(dataset_copy, change)
    _set_version(dataset_copy, "2099.1.0")

    result = load_care_data(dataset_copy)

    assert result.loaded
    assert loaded_version() == "2099.1.0"
    assert Taxon.objects.get(scientific_name="Monstera").common_names["de"] == ["Fensterblatt"]
    assert not Taxon.objects.filter(scientific_name="Cereus").exists()
    # A plant's species is kept even if the dataset drops it.
    kept.refresh_from_db()
    assert kept.taxon is not None
    assert kept.taxon.scientific_name == "Lithops"


@pytest.mark.django_db
def test_a_broken_dataset_changes_nothing(dataset_copy: Path) -> None:
    _set_version(dataset_copy, "2099.1.0")
    (dataset_copy / "archetypes/succulent.yaml").write_text("key: [unclosed", encoding="utf-8")
    before = loaded_version()

    with pytest.raises(DatasetError):
        load_care_data(dataset_copy)

    assert loaded_version() == before


@pytest.mark.django_db
def test_without_a_dataset_migrate_carries_on(tmp_path: Path, caplog: Any) -> None:
    with override_settings(CARE_DATA_DIR=tmp_path):
        load_care_data_after_migrate()

    assert "No care dataset" in caplog.text


@pytest.mark.django_db
def test_the_command_loads_reloads_and_reports_problems(dataset_copy: Path, capsys: Any) -> None:
    call_command("load_care_data")
    call_command("load_care_data", "--force")
    (dataset_copy / "dataset.yaml").write_text("version: soon\n", encoding="utf-8")

    with pytest.raises(CommandError, match="version must look like"):
        call_command("load_care_data", "--path", str(dataset_copy))

    output = capsys.readouterr().out
    assert "is already loaded" in output
    assert "Loaded care dataset" in output
