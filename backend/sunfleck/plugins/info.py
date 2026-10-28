"""What a plugin declares about itself. Plain Python: it's read while Django is starting up."""

from dataclasses import dataclass, field

from pydantic import BaseModel

# The plugin API's version. A plugin built for another major version isn't loaded.
API_VERSION = "1"


@dataclass(frozen=True)
class PluginInfo:
    """A plugin's description, which its package exposes through the `sunfleck.plugins` entry
    point group (see docs/plugins.md)."""

    id: str
    name: str
    version: str
    # The plugin API version the plugin was built for, e.g. "1".
    api_version: str
    description: str = ""
    # A Django app to install, for the plugin's own models and migrations.
    django_app: str | None = None
    # The module with the plugin's hook implementations, imported once Django is ready.
    hooks: str | None = None
    # The plugin's settings, which Admins change in the app; a form is made from the model.
    settings_schema: type[BaseModel] | None = None
    # Every outside service the plugin sends data to, and what it sends.
    sends_data_to: tuple[str, ...] = field(default_factory=tuple)
    # Plugins that send data elsewhere should stay off until an Admin turns them on.
    enabled_by_default: bool = False

    def is_compatible(self) -> bool:
        return self.api_version.split(".")[0] == API_VERSION
