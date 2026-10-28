"""The loaded plugins, and calling their hooks.

Hooks are called one plugin at a time, so that one plugin's exception doesn't keep the others
from running: it's logged, recorded for the Admin, and that plugin's answer is left out.
"""

import logging
from dataclasses import dataclass
from importlib import import_module
from typing import Any

import pluggy

from sunfleck.accounts.models import Household
from sunfleck.plugins import hookspecs
from sunfleck.plugins.discovery import Problem, discover
from sunfleck.plugins.info import PluginInfo

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Answer:
    plugin_id: str
    result: Any


class Registry:
    def __init__(self) -> None:
        self.manager = pluggy.PluginManager(hookspecs.PROJECT)
        self.manager.add_hookspecs(hookspecs)
        self.plugins: dict[str, PluginInfo] = {}
        self.problems: list[Problem] = []

    def add(self, info: PluginInfo, hooks: object | None = None) -> None:
        """Add a plugin, with the object (usually a module) holding its hook implementations.

        Raises:
            pluggy.PluginValidationError: If a hook doesn't match its specification.
        """
        if hooks is not None:
            self.manager.register(hooks, name=info.id)
            try:
                self.manager.check_pending()
            except pluggy.PluginValidationError:
                self.manager.unregister(name=info.id)
                raise
        self.plugins[info.id] = info

    def remove(self, plugin_id: str) -> None:
        self.plugins.pop(plugin_id, None)
        if self.manager.has_plugin(plugin_id):
            self.manager.unregister(name=plugin_id)

    def load_installed(self) -> None:
        """Add the installed plugins (see discovery.py); report those that can't be added."""
        discovered = discover()
        self.problems = list(discovered.problems)
        for info in discovered.plugins:
            try:
                self.add(info, import_module(info.hooks) if info.hooks else None)
            except Exception as exc:  # a broken plugin must never stop the app
                logger.exception("Plugin %s couldn't be loaded", info.id)
                self.problems.append(Problem(info.name, f"Couldn't be loaded: {exc}"))

    def implementers(self, hook: str) -> list[str]:
        """The plugins implementing a hook, in the order they were added."""
        caller = getattr(self.manager.hook, hook)
        names = {impl.plugin_name for impl in caller.get_hookimpls()}
        return [plugin_id for plugin_id in self.plugins if plugin_id in names]

    def _call_one(self, hook: str, plugin_id: str, **kwargs: Any) -> list[Any]:
        others = [plugin for name, plugin in self.manager.list_name_plugin() if name != plugin_id]
        caller = self.manager.subset_hook_caller(hook, remove_plugins=others)
        return list(caller(**kwargs))

    def call(
        self, hook: str, household: Household, expect: type | None = None, **kwargs: Any
    ) -> list[Answer]:
        """Call a hook of every plugin that's on for the household, with its settings.

        With `expect`, answers of another type are left out and reported as the plugin's error.
        """
        from sunfleck.plugins import services  # services imports this module

        implementers = self.implementers(hook)
        if not implementers:
            return []
        states = services.states(household, implementers)
        answers: list[Answer] = []
        for plugin_id in implementers:
            state = states[plugin_id]
            if not state.enabled:
                continue
            try:
                results = self._call_one(hook, plugin_id, settings=state.settings, **kwargs)
            except Exception as exc:  # a broken plugin must never stop the app
                logger.exception("Plugin %s failed in %s", plugin_id, hook)
                services.record_error(household, plugin_id, hook, exc)
                continue
            for result in results:
                if expect is not None and not isinstance(result, expect):
                    error = TypeError(f"expected {expect.__name__}, got {type(result).__name__}")
                    services.record_error(household, plugin_id, hook, error)
                elif result:
                    answers.append(Answer(plugin_id, result))
        return answers

    def call_at_startup(self, hook: str, plugin_id: str, **kwargs: Any) -> list[Any]:
        """Call one plugin's hook regardless of households, e.g. `register_api` at startup.

        A failure is logged and reported with the plugins that couldn't be loaded.
        """
        try:
            return [result for result in self._call_one(hook, plugin_id, **kwargs) if result]
        except Exception as exc:  # a broken plugin must never stop the app
            logger.exception("Plugin %s failed in %s", plugin_id, hook)
            self.problems.append(Problem(self.plugins[plugin_id].name, f"{hook}: {exc}"))
            return []


registry = Registry()
