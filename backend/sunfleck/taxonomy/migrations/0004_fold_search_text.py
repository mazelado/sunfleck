import unicodedata
from typing import Any

from django.db import migrations


def fold(text: str) -> str:
    # A copy of sunfleck.taxonomy.models.fold as it was when this migration was written.
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def refold(apps: Any, schema_editor: Any) -> None:
    """Search names without accents ("arandano" finds "arándano"): the dataset's loader writes
    them folded from now on, but only when its version changes, so existing rows are refolded."""
    taxon = apps.get_model("taxonomy", "Taxon")
    for row in taxon.objects.only("pk", "search_text"):
        folded = fold(row.search_text)
        if folded != row.search_text:
            row.search_text = folded
            row.save(update_fields=["search_text"])


class Migration(migrations.Migration):
    dependencies = [
        ("taxonomy", "0003_taxon_crop"),
    ]

    operations = [
        migrations.RunPython(refold, migrations.RunPython.noop),
    ]
