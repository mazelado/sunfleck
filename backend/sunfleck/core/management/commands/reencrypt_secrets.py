"""`manage.py reencrypt_secrets`: encrypt every stored secret again with the first key of
SUNFLECK_ENCRYPTION_KEY, so the keys after it (and SECRET_KEY's) are no longer needed."""

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction

from sunfleck.core.crypto import DecryptionError, reencrypt
from sunfleck.notifications.models import NotificationChannel, PushKey
from sunfleck.plugins.models import PluginSetting


class Command(BaseCommand):
    help = (
        "Encrypt every stored secret again with the first key in SUNFLECK_ENCRYPTION_KEY, "
        "so older keys can be removed."
    )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        done = unreadable = 0

        def again(token: str, what: str) -> str:
            nonlocal done, unreadable
            try:
                new = reencrypt(token)
            except DecryptionError:
                unreadable += 1
                self.stderr.write(f"Can't be read with the current keys, left as it is: {what}")
                return token
            done += 1
            return new

        for channel in NotificationChannel.objects.select_for_update():
            channel.url_encrypted = again(
                channel.url_encrypted, f"notification channel {channel.pk}"
            )
            channel.save(update_fields=["url_encrypted"])
        for key in PushKey.objects.select_for_update():
            key.private_key_encrypted = again(key.private_key_encrypted, "the Web Push key")
            key.save(update_fields=["private_key_encrypted"])
        for setting in PluginSetting.objects.select_for_update().exclude(secrets={}):
            setting.secrets = {
                name: again(token, f"{setting.plugin_id}'s {name}")
                for name, token in setting.secrets.items()
            }
            setting.save(update_fields=["secrets"])

        self.stdout.write(f"{done} secrets encrypted again with the first key.")
        if unreadable:
            self.stdout.write(
                f"{unreadable} couldn't be read and were left as they are: enter them again in "
                "the app."
            )
