"""Reading and checking the care dataset (data/care, CC BY-SA 4.0).

The dataset is plain YAML so that plant enthusiasts can edit it. This module checks it
thoroughly, so mistakes are caught by the test suite rather than in someone's garden.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator

VERSION_PATTERN = re.compile(r"^\d{4}\.\d{1,2}\.\d+$")


class DatasetError(Exception):
    """The dataset has problems; `problems` lists each one, naming the file."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__(
            f"The care dataset has {len(problems)} problem(s):\n" + "\n".join(problems)
        )
        self.problems = problems


@dataclass(frozen=True)
class Dataset:
    version: str
    # Care profiles by key, as in archetypes/<key>.yaml.
    archetypes: dict[str, dict[str, Any]]
    # The entries of genera.yaml, each with its species.
    genera: list[dict[str, Any]]


def load_dataset(path: Path) -> Dataset:
    """Read the dataset in `path` and check it.

    Raises:
        DatasetError: Listing every problem found, not just the first.
    """
    problems: list[str] = []
    manifest = _read_yaml(path / "dataset.yaml", path, problems)
    version = str(manifest.get("version", "")) if isinstance(manifest, dict) else ""
    if not VERSION_PATTERN.match(version):
        problems.append("dataset.yaml: version must look like 2026.10.0")

    archetype_schema = _validator(path / "schema" / "archetype.schema.json")
    archetypes: dict[str, dict[str, Any]] = {}
    archetype_files = sorted((path / "archetypes").glob("*.yaml"))
    for file in archetype_files:
        data = _read_yaml(file, path, problems)
        if not _matches_schema(archetype_schema, data, _name(file, path), problems):
            continue
        if data["key"] != file.stem:
            problems.append(f"{_name(file, path)}: key must match the file name ({file.stem})")
        problems += [f"{_name(file, path)}: {problem}" for problem in _check_archetype(data)]
        archetypes[data["key"]] = data

    genera_file = path / "genera.yaml"
    genera_data = _read_yaml(genera_file, path, problems)
    genera: list[dict[str, Any]] = []
    if _matches_schema(
        _validator(path / "schema" / "genera.schema.json"), genera_data, "genera.yaml", problems
    ):
        genera = genera_data["genera"]
        # Refer to every profile file, even one with its own problems, so that a typo in one
        # profile doesn't also produce an error for each genus that uses it.
        known = {file.stem for file in archetype_files}
        problems += [f"genera.yaml: {problem}" for problem in _check_genera(genera, known)]

    problems += _check_examples(archetypes, genera)
    if problems:
        raise DatasetError(problems)
    return Dataset(version=version, archetypes=archetypes, genera=genera)


def _name(file: Path, root: Path) -> str:
    return str(file.relative_to(root))


def _read_yaml(file: Path, root: Path, problems: list[str]) -> Any:
    try:
        return yaml.safe_load(file.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        problems.append(f"{_name(file, root)}: can't be read: {exc}")
        return None


def _validator(schema_file: Path) -> Draft202012Validator:
    return Draft202012Validator(json.loads(schema_file.read_text(encoding="utf-8")))


def _matches_schema(
    validator: Draft202012Validator, data: Any, file: str, problems: list[str]
) -> bool:
    errors = sorted(validator.iter_errors(data), key=lambda error: list(error.path))
    for error in errors:
        where = "/".join(str(part) for part in error.path) or "(top level)"
        problems.append(f"{file}: {where}: {error.message}")
    return not errors


def _check_archetype(data: dict[str, Any]) -> list[str]:
    problems = []
    light = data["light"]
    if not light["dli_min"] <= light["dli_ideal"] <= light["dli_max"]:
        problems.append("light: dli_min ≤ dli_ideal ≤ dli_max must hold")
    temperature = data["temperature_c"]
    order = [temperature[key] for key in ("min", "ideal_min", "ideal_max", "max")]
    if order != sorted(order):
        problems.append("temperature_c: min ≤ ideal_min ≤ ideal_max ≤ max must hold")
    return problems


def _check_genera(genera: list[dict[str, Any]], archetypes: set[str]) -> list[str]:
    problems = []
    seen: dict[str, str] = {}

    def claim(name: str, owner: str) -> None:
        if name in seen:
            problems.append(f"{name} appears twice ({seen[name]} and {owner})")
        seen[name] = owner

    for entry in genera:
        genus = entry["genus"]
        claim(genus, f"genus {genus}")
        for synonym in entry.get("synonyms", []):
            claim(synonym, f"synonym of {genus}")
        for key in [entry["archetype"]] + [
            s["archetype"] for s in entry.get("species", []) if "archetype" in s
        ]:
            if key not in archetypes:
                problems.append(f"{genus}: unknown care profile {key!r}")
        for species in entry.get("species", []):
            name = species["name"]
            claim(name, f"species of {genus}")
            if name.split(" ")[0] != genus:
                problems.append(f"{name} doesn't belong to the genus {genus}")
            for synonym in species.get("synonyms", []):
                claim(synonym, f"synonym of {name}")
    return problems


def _check_examples(
    archetypes: dict[str, dict[str, Any]], genera: list[dict[str, Any]]
) -> list[str]:
    """Each profile's examples must be genera that use that profile."""
    profile_of = {entry["genus"]: entry["archetype"] for entry in genera}
    problems = []
    for key, data in archetypes.items():
        for genus in data["examples"]:
            if profile_of.get(genus) != key:
                problems.append(
                    f"archetypes/{key}.yaml: example {genus} isn't a genus with this profile"
                )
    return problems
