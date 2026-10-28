"""Encrypting secrets stored in the database, such as notification URLs (which often contain
tokens) and plugins' API keys.

Uses Fernet (from `cryptography`) with the keys in SUNFLECK_ENCRYPTION_KEY: comma-separated,
the first one encrypts and all of them decrypt, so a key can be replaced without losing
anything. Without it, a key is derived from SECRET_KEY; changing SECRET_KEY then makes stored
secrets unreadable, so setting SUNFLECK_ENCRYPTION_KEY is recommended.
"""

import base64
import logging
from functools import cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings

logger = logging.getLogger(__name__)


class DecryptionError(Exception):
    """A stored secret can't be decrypted: the key it was encrypted with is gone."""


def derived_key(secret_key: str) -> bytes:
    """A Fernet key derived from Django's SECRET_KEY."""
    raw = HKDF(
        algorithm=hashes.SHA256(), length=32, salt=None, info=b"sunfleck stored secrets"
    ).derive(secret_key.encode())
    return base64.urlsafe_b64encode(raw)


@cache
def _fernet() -> MultiFernet:
    keys = [key.strip() for key in settings.ENCRYPTION_KEYS if key.strip()]
    if not keys:
        logger.warning(
            "SUNFLECK_ENCRYPTION_KEY isn't set, so stored secrets are encrypted with a key "
            "derived from SECRET_KEY. Set it to keep them readable if SECRET_KEY changes."
        )
        return MultiFernet([Fernet(derived_key(settings.SECRET_KEY))])
    return MultiFernet([Fernet(key.encode()) for key in keys])


def encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def decrypt(token: str) -> str:
    """
    Raises:
        DecryptionError: If none of the keys can decrypt it.
    """
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionError("This secret was encrypted with a key that's no longer set.") from exc


def generate_key() -> str:
    """A new random key, for SUNFLECK_ENCRYPTION_KEY."""
    return Fernet.generate_key().decode()
