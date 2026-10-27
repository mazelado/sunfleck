"""Settings used by the test suite and the type checker.

Provides safe defaults for the variables that production requires, then speeds up tests.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-only-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")

from sunfleck.config.settings import *  # noqa: F403

# Hashing passwords properly is deliberately slow; tests don't need that.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Tests don't run collectstatic, so there are no collected files to serve or look up.
STATIC_ROOT = None
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
