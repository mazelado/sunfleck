"""`manage.py encryption_key`: print a new key for SUNFLECK_ENCRYPTION_KEY."""

from typing import Any

from django.core.management.base import BaseCommand

from sunfleck.core.crypto import generate_key


class Command(BaseCommand):
    help = "Print a new random key for SUNFLECK_ENCRYPTION_KEY."

    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write(generate_key())
