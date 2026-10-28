from django.apps import AppConfig


class PluginsConfig(AppConfig):
    name = "sunfleck.plugins"
    label = "plugins"

    def ready(self) -> None:
        from sunfleck.plugins.registry import registry

        registry.load_installed()
