from django.apps import AppConfig


class CareConfig(AppConfig):
    name = "sunfleck.care"
    label = "care"

    def ready(self) -> None:
        from sunfleck.care import signals

        signals.connect()
