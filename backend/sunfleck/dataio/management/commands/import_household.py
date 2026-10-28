"""Import an export into a household without places or plants yet."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from sunfleck.dataio import importer
from sunfleck.dataio.management.commands.export_household import household_from


class Command(BaseCommand):
    help = "Import an export (a ZIP file) into a household without places or plants yet."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("path", help="The export's ZIP file.")
        parser.add_argument("--household", type=int, help="Its id, if there are several.")

    def handle(self, *args: Any, **options: Any) -> None:
        household = household_from(options)
        try:
            with open(options["path"], "rb") as file:
                summary = importer.import_into(household, file)
        except importer.DataImportError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            f"Imported {summary.sites} sites, {summary.plants} plants, {summary.photos} photos "
            f"and {summary.care_events} care events into {household.name}."
        )
        for label, items in [
            ("Invite again", summary.members_to_invite),
            ("Species not in the care guide (left unset)", summary.unknown_species),
            ("Care profiles not in the care guide (left unset)", summary.unknown_care_profiles),
            ("Enter the API keys again for", summary.plugins_needing_keys),
            ("Plugins not installed", summary.plugins_not_installed),
        ]:
            if items:
                self.stdout.write(f"{label}: {', '.join(items)}")
