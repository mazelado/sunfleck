from django.apps import AppConfig


class PlantsConfig(AppConfig):
    name = "sunfleck.plants"
    label = "plants"

    def ready(self) -> None:
        from sunfleck.plants import signals  # noqa: F401 - connects the signal handlers
