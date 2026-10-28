"""Turning plugins on and off for a household, and their settings."""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.utils import timezone
from pydantic import BaseModel, ValidationError

from sunfleck.accounts.models import Household
from sunfleck.plugins.info import PluginInfo
from sunfleck.plugins.models import PluginSetting
from sunfleck.plugins.registry import registry

MAX_ERROR_LENGTH = 500


class PluginError(Exception):
    """A plugin setting was refused. `field` names the setting at fault, if any."""

    def __init__(self, code: str, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.field = field


@dataclass(frozen=True)
class State:
    """A plugin's state for a household."""

    info: PluginInfo
    enabled: bool
    settings: BaseModel | None
    last_error: str
    last_error_at: Any


def _settings(info: PluginInfo, raw: dict[str, Any]) -> BaseModel | None:
    if info.settings_schema is None:
        return None
    try:
        return info.settings_schema.model_validate(raw)
    except ValidationError:
        # Saved under an older version of the plugin: start again from its defaults.
        return info.settings_schema()


def _state(info: PluginInfo, row: PluginSetting | None) -> State:
    if row is None:
        return State(info, info.enabled_by_default, _settings(info, {}), "", None)
    return State(
        info, row.enabled, _settings(info, row.settings), row.last_error, row.last_error_at
    )


def states(household: Household, plugin_ids: Iterable[str] | None = None) -> dict[str, State]:
    """The state of each loaded plugin (or just `plugin_ids`) for the household."""
    ids = list(plugin_ids) if plugin_ids is not None else list(registry.plugins)
    rows = {
        row.plugin_id: row
        for row in PluginSetting.objects.filter(household=household, plugin_id__in=ids)
    }
    return {
        plugin_id: _state(registry.plugins[plugin_id], rows.get(plugin_id)) for plugin_id in ids
    }


def is_enabled(household: Household, plugin_id: str) -> bool:
    return plugin_id in registry.plugins and states(household, [plugin_id])[plugin_id].enabled


def update(household: Household, plugin_id: str, enabled: bool, settings: dict[str, Any]) -> State:
    """Turn a plugin on or off for the household and change its settings.

    Raises:
        PluginError: If there's no such plugin, or a setting is invalid.
    """
    info = registry.plugins.get(plugin_id)
    if info is None:
        raise PluginError("plugin_not_found", "This plugin isn't installed.")
    values: dict[str, Any] = {}
    if info.settings_schema is not None:
        try:
            values = info.settings_schema.model_validate(settings).model_dump(mode="json")
        except ValidationError as exc:
            error = exc.errors()[0]
            field = ".".join(str(part) for part in error["loc"]) or None
            raise PluginError("invalid_plugin_setting", error["msg"], field) from exc
    row, _ = PluginSetting.objects.update_or_create(
        household=household,
        plugin_id=plugin_id,
        defaults={"enabled": enabled, "settings": values, "last_error": "", "last_error_at": None},
    )
    return _state(info, row)


def record_error(household: Household, plugin_id: str, hook: str, exc: BaseException) -> None:
    """Remember a plugin's latest error, for its settings page."""
    message = f"{hook}: {type(exc).__name__}: {exc}"[:MAX_ERROR_LENGTH]
    PluginSetting.objects.update_or_create(
        household=household,
        plugin_id=plugin_id,
        defaults={"last_error": message, "last_error_at": timezone.now()},
        create_defaults={
            "enabled": registry.plugins[plugin_id].enabled_by_default,
            "last_error": message,
            "last_error_at": timezone.now(),
        },
    )
