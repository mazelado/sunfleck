from collections.abc import Callable, Iterator

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.test import override_settings

from sunfleck.accounts.models import Membership, Role
from sunfleck.core import crypto
from sunfleck.notifications.models import NotificationChannel, PushKey
from sunfleck.plugins.models import PluginSetting


@pytest.fixture(autouse=True)
def fresh_keys() -> Iterator[None]:
    crypto._fernet.cache_clear()
    yield
    crypto._fernet.cache_clear()


def test_secrets_are_encrypted_and_decrypted() -> None:
    token = crypto.encrypt("ntfy://ntfy.sh/my-secret-topic")

    assert "my-secret-topic" not in token
    assert crypto.decrypt(token) == "ntfy://ntfy.sh/my-secret-topic"


def test_without_a_key_one_is_derived_from_the_secret_key(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with override_settings(ENCRYPTION_KEYS=[], SECRET_KEY="one secret"):
        token = crypto.encrypt("hello")
        assert Fernet(crypto.derived_key("one secret")).decrypt(token.encode()) == b"hello"
    assert "SUNFLECK_ENCRYPTION_KEY isn't set" in caplog.text


def test_keys_can_be_replaced_without_losing_secrets() -> None:
    old, new = crypto.generate_key(), crypto.generate_key()
    with override_settings(ENCRYPTION_KEYS=[old]):
        token = crypto.encrypt("hello")
    crypto._fernet.cache_clear()

    with override_settings(ENCRYPTION_KEYS=[new, old]):
        assert crypto.decrypt(token) == "hello"
        assert Fernet(new.encode()).decrypt(crypto.encrypt("hi").encode()) == b"hi"


def test_a_secret_from_a_lost_key_cant_be_read() -> None:
    with override_settings(ENCRYPTION_KEYS=[crypto.generate_key()]):
        token = crypto.encrypt("hello")
    crypto._fernet.cache_clear()

    with (
        override_settings(ENCRYPTION_KEYS=[crypto.generate_key()]),
        pytest.raises(crypto.DecryptionError),
    ):
        crypto.decrypt(token)


def test_the_command_prints_a_new_key(capsys: pytest.CaptureFixture[str]) -> None:
    call_command("encryption_key")

    Fernet(capsys.readouterr().out.strip().encode())  # a valid key


def test_secrets_from_before_the_key_was_set_stay_readable() -> None:
    with override_settings(ENCRYPTION_KEYS=[]):
        token = crypto.encrypt("hello")
    crypto._fernet.cache_clear()

    key = crypto.generate_key()
    with override_settings(ENCRYPTION_KEYS=[key]):
        assert crypto.decrypt(token) == "hello"
        # New secrets use the key that was set.
        assert Fernet(key.encode()).decrypt(crypto.encrypt("hi").encode()) == b"hi"


@pytest.mark.django_db
def test_reencrypting_moves_every_secret_to_the_first_key(
    member_of: Callable[[Role], Membership], capsys: pytest.CaptureFixture[str]
) -> None:
    member = member_of(Role.ADMIN)
    old, new = crypto.generate_key(), crypto.generate_key()
    with override_settings(ENCRYPTION_KEYS=[old]):
        channel = NotificationChannel.objects.create(
            user=member.user, label="Phone", url_encrypted=crypto.encrypt("ntfy://ntfy.sh/x")
        )
        PushKey.objects.create(private_key_encrypted=crypto.encrypt("PEM"), public_key="pub")
        setting = PluginSetting.objects.create(
            household=member.household,
            plugin_id="ai_openai",
            secrets={"api_key": crypto.encrypt("sk-1"), "lost": Fernet.generate_key().decode()},
        )
    crypto._fernet.cache_clear()

    with override_settings(ENCRYPTION_KEYS=[new, old]):
        call_command("reencrypt_secrets")

    channel.refresh_from_db()
    setting.refresh_from_db()
    only_new = Fernet(new.encode())
    assert only_new.decrypt(channel.url_encrypted.encode()) == b"ntfy://ntfy.sh/x"
    assert only_new.decrypt(PushKey.objects.get().private_key_encrypted.encode()) == b"PEM"
    assert only_new.decrypt(setting.secrets["api_key"].encode()) == b"sk-1"
    # What no key can read is left as it was, and reported.
    out = capsys.readouterr()
    assert "3 secrets encrypted again" in out.out
    assert "1 couldn't be read" in out.out
    assert "ai_openai's lost" in out.err
