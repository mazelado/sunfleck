"""Remove a photo's files once its database row is gone, however it was deleted (the photo
itself, its plant, or the whole household)."""

from typing import Any

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from sunfleck.plants.models import Photo


@receiver(post_delete, sender=Photo)
def delete_photo_files(sender: type[Photo], instance: Photo, **kwargs: Any) -> None:
    names = [field.name for field in (instance.image, instance.thumbnail) if field.name]
    storage = instance.image.storage

    def delete_files() -> None:
        for name in names:
            storage.delete(name)

    # Only after the transaction commits, so a rolled-back delete keeps its files.
    transaction.on_commit(delete_files)
