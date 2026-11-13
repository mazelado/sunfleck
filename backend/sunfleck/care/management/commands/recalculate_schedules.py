"""`manage.py recalculate_schedules`: bring every care schedule's prediction up to date.

Schedules are also recalculated whenever they're read, and the worker recalculates each site's
schedules shortly after its day begins; this does them all now.
"""

from typing import Any

from django.core.management.base import BaseCommand

from sunfleck.care.schedules import recalculate_all


class Command(BaseCommand):
    help = "Recalculate when care is next due for every schedule."

    def handle(self, *args: Any, **options: Any) -> None:
        count = recalculate_all()
        self.stdout.write(f"Recalculated {count} care schedules.")
