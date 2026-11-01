"""Turning plugins on and off for a household, and their settings.

Settings typed `SecretStr` (such as API keys) are stored encrypted, apart from the others, and
are never sent back to the browser: an empty value keeps the stored one.
"""

import logging
import typing
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from django.utils import timezone
from pydantic import BaseModel, SecretStr, ValidationError

from sunfleck.accounts.models import Household
from sunfleck.core.crypto import DecryptionError, decrypt, encrypt
from sunfleck.plugins.info import PluginInfo
from sunfleck.plugins.models import PluginSetting
from sunfleck.plugins.registry import registry
from sunfleck.plugins.types import SettingsCheck

logger = logging.getLogger(__name__)

MAX_ERROR_LENGTH = 500
CHECK_HOOK = "check_settings"


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
    # The secret settings that have a value.
    secrets_set: frozenset[str] = frozenset()


def secret_fields(schema: type[BaseModel] | None) -> set[str]:
    """The settings typed `SecretStr` (or `SecretStr | None`)."""
    if schema is None:
        return set()
    return {
        name
        for name, field in schema.model_fields.items()
        if field.annotation is SecretStr or SecretStr in typing.get_args(field.annotation)
    }


def _decrypted(info: PluginInfo, encrypted: dict[str, str]) -> dict[str, str]:
    values = {}
    for name, token in encrypted.items():
        try:
            values[name] = decrypt(token)
        except DecryptionError:
            logger.warning("Plugin %s's %s can't be decrypted; enter it again", info.id, name)
    return values


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
    secrets = _decrypted(info, row.secrets)
    return State(
        info,
        row.enabled,
        _settings(info, {**row.settings, **secrets}),
        row.last_error,
        row.last_error_at,
        frozenset(name for name, value in secrets.items() if value),
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


def _plugin(plugin_id: str) -> PluginInfo:
    info = registry.plugins.get(plugin_id)
    if info is None:
        raise PluginError("plugin_not_found", "This plugin isn't installed.")
    return info


def _validated(
    household: Household, info: PluginInfo, settings: dict[str, Any]
) -> BaseModel | None:
    """The settings from the plugin's form, validated.

    Raises:
        PluginError: If a setting is invalid.
    """
    if info.settings_schema is None:
        return None
    settings = {**settings}
    # A secret left empty keeps its stored value, since the browser never gets it.
    existing = PluginSetting.objects.filter(household=household, plugin_id=info.id).first()
    stored = _decrypted(info, existing.secrets) if existing else {}
    for name in secret_fields(info.settings_schema):
        if not settings.get(name) and stored.get(name):
            settings[name] = stored[name]
    try:
        return info.settings_schema.model_validate(settings)
    except ValidationError as exc:
        error = exc.errors()[0]
        field = ".".join(str(part) for part in error["loc"]) or None
        raise PluginError("invalid_plugin_setting", error["msg"], field) from exc


def update(household: Household, plugin_id: str, enabled: bool, settings: dict[str, Any]) -> State:
    """Turn a plugin on or off for the household and change its settings.

    Raises:
        PluginError: If there's no such plugin, or a setting is invalid.
    """
    info = _plugin(plugin_id)
    validated = _validated(household, info, settings)
    values: dict[str, Any] = {}
    secrets: dict[str, str] = {}
    if validated is not None:
        secret_names = secret_fields(info.settings_schema)
        values = validated.model_dump(mode="json", exclude=secret_names)
        for name in secret_names:
            secret = getattr(validated, name)
            if secret is not None and secret.get_secret_value():
                secrets[name] = encrypt(secret.get_secret_value())
    row, _ = PluginSetting.objects.update_or_create(
        household=household,
        plugin_id=plugin_id,
        defaults={
            "enabled": enabled,
            "settings": values,
            "secrets": secrets,
            "last_error": "",
            "last_error_at": None,
        },
    )
    # Plugins can change predictions (e.g. weather), so recalculate the household's.
    from sunfleck.care.signals import mark_out_of_date  # care imports the plugin registry

    mark_out_of_date(household=household)
    return _state(info, row)


def can_check(plugin_id: str) -> bool:
    """Whether the plugin can check its settings (it implements `check_settings`)."""
    return plugin_id in registry.implementers(CHECK_HOOK)


def check(household: Household, plugin_id: str, settings: dict[str, Any]) -> SettingsCheck:
    """Check that a plugin works with the settings from its form, which may not be saved yet,
    whether or not it's on. A failure is shown to the Admin, not kept as the plugin's error.

    Raises:
        PluginError: If there's no such plugin, it can't check its settings, or a setting is
            invalid.
    """
    info = _plugin(plugin_id)
    if not can_check(plugin_id):
        raise PluginError("plugin_cannot_check", "This plugin can't be tested.")
    validated = _validated(household, info, settings)
    try:
        results = registry.call_plugin(CHECK_HOOK, plugin_id, settings=validated)
    except Exception as exc:  # a broken plugin must never stop the app
        logger.exception("Plugin %s failed in %s", plugin_id, CHECK_HOOK)
        return SettingsCheck("failed", f"{type(exc).__name__}: {exc}"[:MAX_ERROR_LENGTH])
    result = results[0] if results else None
    if not isinstance(result, SettingsCheck):
        return SettingsCheck("failed", f"expected SettingsCheck, got {type(result).__name__}")
    return result


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
