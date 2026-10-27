"""WSGI entry point used by the production web server."""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sunfleck.config.settings")

application = get_wsgi_application()
