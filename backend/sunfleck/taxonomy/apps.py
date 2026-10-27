from django.apps import AppConfig
from django.db.models.signals import post_migrate


class TaxonomyConfig(AppConfig):
    name = "sunfleck.taxonomy"
    label = "taxonomy"

    def ready(self) -> None:
        from sunfleck.taxonomy.signals import load_care_data_after_migrate

        post_migrate.connect(load_care_data_after_migrate, sender=self)
