"""Plugins API: which plugins are installed, and turning them on and off for the household.

Only Admins can see and change plugins, since plugins may send data to outside services.
"""

from datetime import datetime
from typing import Any

from django.http import HttpRequest
from ninja import Router, Schema
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.plugins import services
from sunfleck.plugins.registry import registry

router = Router(tags=["plugins"], auth=django_auth)


class PluginOut(Schema):
    id: str
    name: str
    version: str
    description: str
    sends_data_to: list[str] = Field(description="Outside services it sends data to, and what.")
    enabled: bool
    settings: dict[str, Any] | None = Field(
        description="Secret settings (API keys) are never sent: they're empty here, and listed "
        "in `secrets_set` when they have a value."
    )
    secrets_set: list[str] = Field(description="Secret settings that have a value.")
    settings_schema: dict[str, Any] | None = Field(
        description="A JSON Schema of the settings, to make a form from."
    )
    last_error: str | None
    last_error_at: datetime | None
    can_check: bool = Field(description="Whether the plugin's settings can be tested.")


class ProblemOut(Schema):
    source: str
    message: str


class PluginsOut(Schema):
    plugins: list[PluginOut]
    problems: list[ProblemOut] = Field(description="Installed plugins that couldn't be loaded.")


class SettingsIn(Schema):
    settings: dict[str, Any] = Field(
        default_factory=dict, description="Leave a secret setting empty to use its saved value."
    )


class SettingsCheckOut(Schema):
    works: bool
    problem: str | None = Field(
        description="Why it doesn't work: `missing_settings`, `invalid_api_key`, "
        "`quota_exceeded`, `unavailable`, `invalid_answer` or `failed`."
    )
    details: str = Field(description="What the plugin found, shown as it is.")


class PluginIn(Schema):
    enabled: bool
    settings: dict[str, Any] = Field(
        default_factory=dict, description="Leave a secret setting empty to keep its value."
    )


def _settings_out(state: services.State) -> dict[str, Any] | None:
    if state.settings is None:
        return None
    secrets = services.secret_fields(state.info.settings_schema)
    return {
        **state.settings.model_dump(mode="json", exclude=secrets),
        **dict.fromkeys(secrets, ""),
    }


def _plugin_out(state: services.State) -> PluginOut:
    info = state.info
    return PluginOut(
        id=info.id,
        name=info.name,
        version=info.version,
        description=info.description,
        sends_data_to=list(info.sends_data_to),
        enabled=state.enabled,
        settings=_settings_out(state),
        secrets_set=sorted(state.secrets_set),
        settings_schema=info.settings_schema.model_json_schema() if info.settings_schema else None,
        last_error=state.last_error or None,
        last_error_at=state.last_error_at,
        can_check=services.can_check(info.id),
    )


def _api_error(exc: services.PluginError) -> ApiError:
    status = 404 if exc.code in ("plugin_not_found", "plugin_cannot_check") else 422
    return ApiError(status, exc.code, str(exc), {"field": exc.field} if exc.field else {})


@router.get("/plugins", response=PluginsOut)
def list_plugins(request: HttpRequest) -> PluginsOut:
    household = require_role(request, Role.ADMIN).household
    return PluginsOut(
        plugins=[_plugin_out(state) for state in services.states(household).values()],
        problems=[ProblemOut(source=p.source, message=p.message) for p in registry.problems],
    )


@router.put("/plugins/{plugin_id}", response=PluginOut)
def update_plugin(request: HttpRequest, plugin_id: str, data: PluginIn) -> PluginOut:
    """Turn a plugin on or off for the household, and change its settings."""
    household = require_role(request, Role.ADMIN).household
    try:
        state = services.update(household, plugin_id, data.enabled, data.settings)
    except services.PluginError as exc:
        raise _api_error(exc) from exc
    return _plugin_out(state)


@router.post("/plugins/{plugin_id}/check", response=SettingsCheckOut)
def check_plugin(request: HttpRequest, plugin_id: str, data: SettingsIn) -> SettingsCheckOut:
    """Test a plugin with the settings from its form, which needn't be saved, whether or not
    it's on. Nothing is saved."""
    household = require_role(request, Role.ADMIN).household
    try:
        found = services.check(household, plugin_id, data.settings)
    except services.PluginError as exc:
        raise _api_error(exc) from exc
    return SettingsCheckOut(
        works=found.problem is None, problem=found.problem, details=found.details
    )
