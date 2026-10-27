"""Django settings for Sunfleck.

All deployment-specific values come from environment variables, so the same code runs in
development, tests, and production. See docs/technical-plan.md (section 3, Configuration).
"""

from pathlib import Path
from typing import Any

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from sunfleck.config.env import env_bool, env_list, env_str

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(env_str("SUNFLECK_DATA_DIR", str(BASE_DIR / "data")))

DEBUG = env_bool("DEBUG", default=False)

SECRET_KEY = env_str("SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("The SECRET_KEY environment variable must be set.")
    SECRET_KEY = "django-insecure-development-only"  # noqa: S105 - only used with DEBUG on

# localhost is always allowed so that health checks from inside the container keep working.
ALLOWED_HOSTS = [*env_list("ALLOWED_HOSTS"), "localhost", "127.0.0.1"]
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "ninja",
    "sunfleck.core",
    "sunfleck.accounts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "sunfleck.config.urls"
WSGI_APPLICATION = "sunfleck.config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database ---------------------------------------------------------------------------------
# SQLite by default (a single file in the data directory); set DATABASE_URL for PostgreSQL,
# e.g. postgres://user:password@host:5432/sunfleck

DATABASES: dict[str, Any] = {
    "default": dj_database_url.parse(
        env_str("DATABASE_URL", f"sqlite:///{DATA_DIR / 'db.sqlite3'}"),
        conn_max_age=600,
        conn_health_checks=True,
    )
}
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    # Write-ahead logging and immediate transactions let the web server and the background
    # worker share one SQLite file without "database is locked" errors.
    DATABASES["default"]["OPTIONS"] = {
        "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
        "transaction_mode": "IMMEDIATE",
        "timeout": 20,
    }
    if DATABASES["default"]["NAME"] != ":memory:":
        # SQLite creates the database file but not its folder.
        Path(DATABASES["default"]["NAME"]).parent.mkdir(parents=True, exist_ok=True)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Accounts ---------------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalization ---------------------------------------------------------------------

LANGUAGE_CODE = "en"
TIME_ZONE = env_str("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# --- Static files -----------------------------------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT: Path | None = Path(env_str("SUNFLECK_STATIC_ROOT", str(DATA_DIR / "static")))
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
MEDIA_ROOT = DATA_DIR / "media"

# --- Frontend ---------------------------------------------------------------------------------
# The built React app (frontend/dist). WhiteNoise serves its files from the site root, and
# every other non-API URL returns its index.html (see sunfleck.core.views.frontend_index).

FRONTEND_DIR = Path(env_str("SUNFLECK_FRONTEND_DIR", str(BASE_DIR.parent / "frontend" / "dist")))
if FRONTEND_DIR.is_dir():
    WHITENOISE_ROOT = FRONTEND_DIR
# Files with a content hash in their name can be cached by browsers forever: Vite's assets
# ("/assets/index-Bx3k2_aZ.js") and Django's collected static files ("base.1a2b3c4d5e6f.css").
WHITENOISE_IMMUTABLE_FILE_TEST = r"^/assets/.+-[\w-]{8,}\.\w+$|\.[0-9a-f]{12}\.\w+$"

# --- Logging ----------------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env_str("LOG_LEVEL", "INFO")},
}
