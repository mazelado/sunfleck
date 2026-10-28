"""The plugin API (version 1): everything a plugin may use from Sunfleck. See docs/plugins.md.

Importing this package doesn't import Django models, so a plugin's package can describe itself
(its PluginInfo) while Django is still starting up.
"""

from typing import TYPE_CHECKING

import pluggy

from sunfleck.plugins.info import API_VERSION, PluginInfo
from sunfleck.plugins.types import (
    Adjustment,
    Alert,
    CareContext,
    Conditions,
    Factor,
    PeriodicJob,
    Profile,
    SiteConditions,
)

if TYPE_CHECKING:
    from django.http import HttpRequest

    from sunfleck.accounts.models import Household, Membership
    from sunfleck.places.models import Site

__all__ = [
    "API_VERSION",
    "Adjustment",
    "Alert",
    "CareContext",
    "Conditions",
    "Factor",
    "PeriodicJob",
    "PluginInfo",
    "Profile",
    "SiteConditions",
    "hookimpl",
    "is_enabled",
    "mark_site_out_of_date",
    "require_enabled",
]

hookimpl = pluggy.HookimplMarker("sunfleck")


def is_enabled(household: "Household", plugin_id: str) -> bool:
    """Whether the household turned the plugin on."""
    from sunfleck.plugins import services

    return services.is_enabled(household, plugin_id)


def require_enabled(request: "HttpRequest", plugin_id: str) -> "Membership":
    """For a plugin's API endpoints: the signed-in member, if the plugin is on for their
    household.

    Raises:
        ApiError: 401 or 403 as for any endpoint; 404 if the plugin is off for the household.
    """
    from sunfleck.accounts.models import Role
    from sunfleck.accounts.permissions import require_role
    from sunfleck.core.errors import ApiError

    membership = require_role(request, Role.VIEWER)
    if not is_enabled(membership.household, plugin_id):
        raise ApiError(404, "plugin_not_enabled", "This plugin isn't turned on.")
    return membership


def mark_site_out_of_date(site: "Site") -> None:
    """Have the predictions of plants at a site recalculated, e.g. when its weather changed."""
    from sunfleck.care.signals import mark_out_of_date

    mark_out_of_date(location__site=site.pk)
