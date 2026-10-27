"""`manage.py load_care_data`: load the care dataset now (it also loads after `migrate`)."""

from argparse import ArgumentParser
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from sunfleck.taxonomy.dataset import DatasetError
from sunfleck.taxonomy.loader import load_care_data


class Command(BaseCommand):
    help = "Check the care dataset and load it into the database."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--path", type=Path, default=None, help="Dataset folder (default: CARE_DATA_DIR)."
        )
        parser.add_argument(
            "--force", action="store_true", help="Load even if this version is already loaded."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        path = options["path"] or settings.CARE_DATA_DIR
        try:
            result = load_care_data(path, force=options["force"])
        except DatasetError as exc:
            raise CommandError(str(exc)) from exc
        if result.loaded:
            self.stdout.write(
                f"Loaded care dataset {result.version}: {result.archetypes} care profiles, "
                f"{result.taxa} genera and species."
            )
        else:
            self.stdout.write(f"Care dataset {result.version} is already loaded.")
