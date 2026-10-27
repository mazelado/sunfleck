"""Helpers for reading settings from environment variables."""

import os
from typing import Any
from urllib.parse import unquote, urlsplit

_TRUE_VALUES = {"1", "true", "yes", "on"}
_FALSE_VALUES = {"0", "false", "no", "off", ""}


def env_str(name: str, default: str = "") -> str:
    """Return the environment variable `name`, or `default` if it isn't set."""
    return os.environ.get(name, default)


def env_bool(name: str, *, default: bool = False) -> bool:
    """Return the environment variable `name` interpreted as a boolean.

    Raises:
        ValueError: If the value isn't a recognized true or false word.
    """
    raw = os.environ.get(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in _TRUE_VALUES:
        return True
    if value in _FALSE_VALUES:
        return False
    raise ValueError(f"{name} must be true or false, got {raw!r}")


def env_list(name: str, default: list[str] | None = None) -> list[str]:
    """Return the comma-separated environment variable `name` as a list of strings."""
    raw = os.environ.get(name)
    if raw is None:
        return list(default or [])
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_email_url(url: str) -> dict[str, Any]:
    """Turn an email server URL into a Django mailer configuration (an entry of MAILERS).

    Supported forms (user and password are optional, and must be URL-encoded):
        smtp://user:password@host:25         plain SMTP
        smtp+tls://user:password@host:587    SMTP with STARTTLS
        smtps://user:password@host:465       SMTP over SSL

    Raises:
        ValueError: If the URL's scheme or host is missing or unsupported.
    """
    parts = urlsplit(url)
    defaults = {
        "smtp": (25, False, False),
        "smtp+tls": (587, True, False),
        "smtps": (465, False, True),
    }
    if parts.scheme not in defaults:
        raise ValueError(
            f"EMAIL_URL must start with smtp://, smtp+tls://, or smtps://, got {url!r}"
        )
    if not parts.hostname:
        raise ValueError("EMAIL_URL must include a host name")
    port, use_tls, use_ssl = defaults[parts.scheme]
    return {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": parts.hostname,
            "port": parts.port or port,
            "username": unquote(parts.username or ""),
            "password": unquote(parts.password or ""),
            "use_tls": use_tls,
            "use_ssl": use_ssl,
            "timeout": 15,
        },
    }
