from typing import Any

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = "sunfleck.accounts"
    label = "accounts"

    def ready(self) -> None:
        from django.db.models.signals import post_delete

        from sunfleck.accounts.models import User

        post_delete.connect(_delete_avatar, sender=User, dispatch_uid="accounts_delete_avatar")


def _delete_avatar(sender: type, instance: Any, **kwargs: Any) -> None:
    """Profile pictures go with their account."""
    if instance.avatar:
        instance.avatar.delete(save=False)
