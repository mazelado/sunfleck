"""Care events: RESTRICT instead of PROTECT, so a household with its own care types can be
deleted. A household's own care types: different names, whatever the case.

Instances may already have two care types of one household with the same name (two requests
at the same moment): the later ones get a number, "Bottom water (2)", before the constraint.
"""

from typing import Any

import django.db.models.deletion
import django.db.models.functions.text
from django.db import migrations, models


MAX_NAME_LENGTH = 50


def number_duplicate_names(apps: Any, schema_editor: Any) -> None:
    care_type = apps.get_model("care", "CareType")
    taken: dict[int, set[str]] = {}
    for item in care_type.objects.filter(household__isnull=False).order_by("household_id", "id"):
        names = taken.setdefault(item.household_id, set())
        name, number = item.name, 1
        while name.lower() in names:
            number += 1
            suffix = f" ({number})"
            name = item.name[: MAX_NAME_LENGTH - len(suffix)] + suffix
        if name != item.name:
            item.name = name
            item.save(update_fields=["name"])
        names.add(name.lower())


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_avatar"),
        ("care", "0009_care_event_estimated"),
    ]

    operations = [
        migrations.RunPython(number_duplicate_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="careevent",
            name="care_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="events",
                to="care.caretype",
            ),
        ),
        migrations.AddConstraint(
            model_name="caretype",
            constraint=models.UniqueConstraint(
                models.F("household"),
                django.db.models.functions.text.Lower("name"),
                condition=models.Q(("household__isnull", False)),
                name="care_type_name_unique_per_household",
            ),
        ),
    ]
