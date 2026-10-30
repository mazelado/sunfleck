from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def mark_out_of_date(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """Water amounts are now worked out from the soil that dried (much less in big pots):
    recalculate every schedule when it's next read, rather than waiting for the nightly job."""
    apps.get_model("care", "CareSchedule").objects.update(calculated_on=None)


class Migration(migrations.Migration):
    dependencies = [("care", "0007_schedule_routine")]

    operations = [migrations.RunPython(mark_out_of_date, migrations.RunPython.noop)]
