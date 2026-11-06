"""`manage.py stability_baseline`: record the API and plugin interface (docs/stability.md)."""

from typing import Any

from django.core.management.base import BaseCommand

from sunfleck.core import stability


class Command(BaseCommand):
    help = "Record the HTTP API and the plugin interface as the baselines for the stability tests."

    def handle(self, *args: Any, **options: Any) -> None:
        stability.write_baselines()
        self.stdout.write(
            f"Wrote {stability.API_BASELINE.name} and {stability.PLUGINS_BASELINE.name}."
        )
