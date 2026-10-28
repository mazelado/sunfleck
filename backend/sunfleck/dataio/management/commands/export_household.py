"""Write a household's export (a ZIP file), e.g. for backups or very large households."""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from sunfleck.accounts.models import Household
from sunfleck.dataio import exporter


def household_from(options: dict[str, Any]) -> Household:
    households = Household.objects.order_by("pk")
    if options["household"] is not None:
        households = households.filter(pk=options["household"])
    found = list(households[:2])
    if len(found) != 1:
        raise CommandError(
            "No such household." if not found else "There are several households: use --household."
        )
    return found[0]


class Command(BaseCommand):
    help = "Export a household's data to a ZIP file."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("path", help="The ZIP file to write.")
        parser.add_argument("--household", type=int, help="Its id, if there are several.")

    def handle(self, *args: Any, **options: Any) -> None:
        household = household_from(options)
        with open(options["path"], "wb") as out:
            data = exporter.write(household, out)
        photos = sum(len(plant.photos) for plant in data.plants)
        self.stdout.write(
            f"Exported {household.name}: {len(data.plants)} plants, {photos} photos "
            f"to {options['path']}."
        )
