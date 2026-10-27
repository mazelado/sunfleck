from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
import yaml
from django.conf import settings

from sunfleck.taxonomy.dataset import DatasetError, load_dataset

Edit = Callable[[Path], None]


def _edit_yaml(file: Path, change: Callable[[Any], None]) -> None:
    data = yaml.safe_load(file.read_text(encoding="utf-8"))
    change(data)
    file.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")


def _genus(data: dict[str, Any], name: str) -> dict[str, Any]:
    return next(entry for entry in data["genera"] if entry["genus"] == name)


# --- The real dataset -------------------------------------------------------------------------


def test_the_dataset_is_valid() -> None:
    dataset = load_dataset(settings.CARE_DATA_DIR)

    assert len(dataset.archetypes) >= 25
    assert len(dataset.genera) >= 150
    assert dataset.archetypes["tropical_aroid"]["name"]["en"] == "Tropical aroid"


def test_every_care_profile_is_used_by_a_genus() -> None:
    dataset = load_dataset(settings.CARE_DATA_DIR)

    used = {entry["archetype"] for entry in dataset.genera}

    assert set(dataset.archetypes) - used == set()


def test_well_known_plants_have_the_expected_profile() -> None:
    dataset = load_dataset(settings.CARE_DATA_DIR)
    profile = {entry["genus"]: entry["archetype"] for entry in dataset.genera}
    species = {
        s["name"]: s.get("archetype", entry["archetype"])
        for entry in dataset.genera
        for s in entry.get("species", [])
    }

    assert profile["Monstera"] == "tropical_aroid"
    assert profile["Echeveria"] == "succulent"
    assert species["Dracaena trifasciata"] == "low_light_tough"  # unlike other dracaenas
    assert species["Allium schoenoprasum"] == "leafy_herb"  # chives, not a bulb to admire


# --- Mistakes the checks catch ----------------------------------------------------------------


def _set(path: list[str], value: Any) -> Callable[[Any], None]:
    def change(data: Any) -> None:
        for key in path[:-1]:
            data = data[key]
        data[path[-1]] = value

    return change


@pytest.mark.parametrize(
    ("edit", "expected"),
    [
        (
            lambda root: _edit_yaml(
                root / "archetypes/succulent.yaml", _set(["humidity"], "soggy")
            ),
            "archetypes/succulent.yaml: humidity: 'soggy' is not one of",
        ),
        (
            lambda root: _edit_yaml(
                root / "archetypes/succulent.yaml", _set(["light", "dli_min"], 50)
            ),
            "archetypes/succulent.yaml: light: dli_min ≤ dli_ideal ≤ dli_max must hold",
        ),
        (
            lambda root: _edit_yaml(
                root / "archetypes/succulent.yaml", _set(["temperature_c", "max"], 0)
            ),
            "temperature_c: min ≤ ideal_min ≤ ideal_max ≤ max must hold",
        ),
        (
            lambda root: _edit_yaml(root / "archetypes/succulent.yaml", _set(["key"], "cactus")),
            "key must match the file name (succulent)",
        ),
        (
            lambda root: _edit_yaml(
                root / "genera.yaml",
                lambda data: _genus(data, "Monstera").update(archetype="jungle"),
            ),
            "Monstera: unknown care profile 'jungle'",
        ),
        (
            lambda root: _edit_yaml(
                root / "genera.yaml",
                lambda data: _genus(data, "Ficus")["species"][0].update(name="Monstera lyrata"),
            ),
            "Monstera lyrata doesn't belong to the genus Ficus",
        ),
        (
            lambda root: _edit_yaml(
                root / "genera.yaml",
                lambda data: _genus(data, "Ficus").update(synonyms=["Monstera"]),
            ),
            "Monstera appears twice (genus Monstera and synonym of Ficus)",
        ),
        (
            lambda root: _edit_yaml(
                root / "genera.yaml",
                lambda data: _genus(data, "Monstera").update(archetype="succulent"),
            ),
            "archetypes/tropical_aroid.yaml: example Monstera isn't a genus with this profile",
        ),
        (
            lambda root: _edit_yaml(root / "dataset.yaml", _set(["version"], "latest")),
            "dataset.yaml: version must look like 2026.10.0",
        ),
        (
            lambda root: (root / "archetypes/succulent.yaml").write_text("key: [unclosed"),
            "archetypes/succulent.yaml: can't be read",
        ),
    ],
)
def test_mistakes_are_reported_with_the_file(dataset_copy: Path, edit: Edit, expected: str) -> None:
    edit(dataset_copy)

    with pytest.raises(DatasetError) as exc_info:
        load_dataset(dataset_copy)

    assert any(expected in problem for problem in exc_info.value.problems), exc_info.value.problems


def test_every_problem_is_reported_at_once(dataset_copy: Path) -> None:
    _edit_yaml(dataset_copy / "archetypes/succulent.yaml", _set(["humidity"], "soggy"))
    _edit_yaml(dataset_copy / "dataset.yaml", _set(["version"], "latest"))

    with pytest.raises(DatasetError) as exc_info:
        load_dataset(dataset_copy)

    assert len(exc_info.value.problems) == 2
    assert "2 problem(s)" in str(exc_info.value)
