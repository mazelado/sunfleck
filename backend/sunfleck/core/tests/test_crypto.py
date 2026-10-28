from collections.abc import Iterator

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.test import override_settings

from sunfleck.core import crypto


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
