from django.db import migrations, models


class Migration(migrations.Migration):
    """Households from before 1.3 saw every area, so they keep them all; new ones start with
    them off, until an Admin (or setup) turns them on."""

    dependencies = [
        ("accounts", "0003_avatar_source"),
    ]

    operations = [
        migrations.AddField(
            model_name="household",
            name="collection",
            field=models.BooleanField(
                default=True,
                help_text="Propagation, the wishlist and labels.",
                verbose_name="collection",
            ),
        ),
        migrations.AddField(
            model_name="household",
            name="garden",
            field=models.BooleanField(
                default=True, help_text="Seeds, sowing and harvests.", verbose_name="garden"
            ),
        ),
        migrations.AlterField(
            model_name="household",
            name="collection",
            field=models.BooleanField(
                default=False,
                help_text="Propagation, the wishlist and labels.",
                verbose_name="collection",
            ),
        ),
        migrations.AlterField(
            model_name="household",
            name="garden",
            field=models.BooleanField(
                default=False, help_text="Seeds, sowing and harvests.", verbose_name="garden"
            ),
        ),
    ]
