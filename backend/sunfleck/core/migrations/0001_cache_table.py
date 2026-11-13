"""The database table for the cache (settings.CACHES), where failed sign-ins are counted."""

from typing import Any

from django.core.management import call_command
from django.db import migrations


def create_cache_table(apps: Any, schema_editor: Any) -> None:
    # Does nothing when the cache isn't in the database (Redis), or the table exists.
    call_command("createcachetable", database=schema_editor.connection.alias, verbosity=0)


class Migration(migrations.Migration):
    dependencies: list[tuple[str, str]] = []

    operations = [migrations.RunPython(create_cache_table, migrations.RunPython.noop)]
