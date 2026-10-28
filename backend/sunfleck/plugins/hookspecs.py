"""The hooks plugins can implement (plugin API version 1).

Each hook a plugin implements is called only for households that turned the plugin on (except
`register_api` and `register_periodic_jobs`, which run once at startup), and receives that
household's settings for the plugin as `settings` (None for plugins without settings). A hook
may leave out arguments it doesn't need. If a hook raises an exception, it's logged and shown
on the plugin's settings page, and the app carries on without it.
"""

from typing import TYPE_CHECKING

import pluggy
from pydantic import BaseModel

from sunfleck.plugins.types import Adjustment, CareContext, PeriodicJob, SiteConditions

if TYPE_CHECKING:
    from ninja import Router

    from sunfleck.care.models import CareEvent
    from sunfleck.places.models import Site
    from sunfleck.plants.models import Plant

PROJECT = "sunfleck"
hookspec = pluggy.HookspecMarker(PROJECT)


@hookspec
def register_api(router: "Router") -> None:
    """Add API endpoints, served under /api/v1/plugins/<plugin id>/.

    Endpoints must check that the plugin is on for the household (`require_enabled`).
    """


@hookspec
def register_periodic_jobs() -> list[PeriodicJob]:  # type: ignore[empty-body]
    """Background jobs to run on a schedule (from M9, when the worker exists)."""


@hookspec
def care_factors(context: CareContext, settings: BaseModel | None) -> list[Adjustment]:  # type: ignore[empty-body]
    """Factors for a plant's predicted watering, e.g. postponing it after rain."""


@hookspec
def site_conditions(site: "Site", settings: BaseModel | None) -> SiteConditions | None:
    """Current conditions and today's forecast at a site, shown on the Today page."""


@hookspec
def on_care_event_logged(event: "CareEvent", settings: BaseModel | None) -> None:
    """Called after care is logged."""


@hookspec
def on_plant_created(plant: "Plant", settings: BaseModel | None) -> None:
    """Called after a plant is added."""
