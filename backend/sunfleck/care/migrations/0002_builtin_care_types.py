from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor

# The care types every household starts with: (key, name, icon, affects predictions). The app
# shows the names in the person's language, by key. Change them with a new migration.
BUILTIN_CARE_TYPES = [
    ("water", "Water", "droplet", True),
    ("fertilize", "Fertilize", "flask", True),
    ("repot", "Repot", "bucket", True),
    ("prune", "Prune", "scissors", False),
    ("mist", "Mist", "spray", False),
    ("rotate", "Rotate", "rotate", False),
    ("clean_leaves", "Clean leaves", "sparkles", False),
    ("pest_check", "Check for pests", "bug", False),
]


def add_builtin_care_types(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    care_type = apps.get_model("care", "CareType")
    for key, name, icon, affects_prediction in BUILTIN_CARE_TYPES:
        care_type.objects.update_or_create(
            household=None,
            key=key,
            defaults={"name": name, "icon": icon, "affects_prediction": affects_prediction},
        )


def remove_builtin_care_types(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    apps.get_model("care", "CareType").objects.filter(household=None).delete()


class Migration(migrations.Migration):
    dependencies = [("care", "0001_initial")]

    operations = [migrations.RunPython(add_builtin_care_types, remove_builtin_care_types)]
