"""Finding installed plugins: Python packages with a `sunfleck.plugins` entry point.

Runs while Django's settings load (to add plugins' Django apps), so it must not import Django
models. A plugin that can't be loaded is left out and reported, never stopping the app.
"""

import logging
import re
from dataclasses import dataclass, field
from functools import cache
from importlib.metadata import entry_points

from sunfleck.plugins.info import API_VERSION, PluginInfo

logger = logging.getLogger(__name__)

ENTRY_POINT_GROUP = "sunfleck.plugins"
VALID_ID = re.compile(r"^[a-z][a-z0-9_]{1,62}$")


@dataclass(frozen=True)
class Problem:
    """A plugin that couldn't be loaded, and why."""

    source: str
    message: str


@dataclass(frozen=True)
class Discovered:
    plugins: list[PluginInfo] = field(default_factory=list)
    problems: list[Problem] = field(default_factory=list)


def _check(info: object, source: str) -> PluginInfo | Problem:
    if not isinstance(info, PluginInfo):
        return Problem(source, "The entry point isn't a PluginInfo.")
    if not VALID_ID.match(info.id):
        return Problem(source, f"Invalid plugin id {info.id!r}.")
    if not info.is_compatible():
        return Problem(
            source,
            f"{info.name} {info.version} needs plugin API {info.api_version}; "
            f"this version of Sunfleck has {API_VERSION}.",
        )
    return info


@cache
def discover() -> Discovered:
    """The installed plugins that can be loaded, and problems with the others."""
    found = Discovered()
    for entry_point in entry_points(group=ENTRY_POINT_GROUP):
        source = f"{entry_point.name} ({entry_point.value})"
        try:
            checked = _check(entry_point.load(), source)
        except Exception as exc:  # a broken plugin must never stop the app
            checked = Problem(source, f"Couldn't be loaded: {exc}")
        if isinstance(checked, Problem):
            logger.error("Plugin %s skipped: %s", checked.source, checked.message)
            found.problems.append(checked)
        elif any(other.id == checked.id for other in found.plugins):
            found.problems.append(Problem(source, f"Another plugin already has id {checked.id}."))
        else:
            found.plugins.append(checked)
    return found


def plugin_apps() -> list[str]:
    """The Django apps of the installed plugins, for INSTALLED_APPS."""
    return [info.django_app for info in discover().plugins if info.django_app]
