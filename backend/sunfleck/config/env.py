"""Helpers for reading settings from environment variables."""

import os

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
