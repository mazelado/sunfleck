#!/usr/bin/env bash
# Starts Sunfleck as in production with the demo household (see the demo_household command),
# for the README's screenshots. Playwright runs it; build the frontend first.
set -euo pipefail
cd "$(dirname "$0")/../../backend"

SUNFLECK_DATA_DIR="$(mktemp -d)"
export SUNFLECK_DATA_DIR
export SECRET_KEY=only-for-screenshots
trap 'rm -rf "$SUNFLECK_DATA_DIR"' EXIT

uv run --quiet python manage.py migrate --verbosity 0
uv run --quiet python manage.py collectstatic --noinput --verbosity 0
uv run --quiet python manage.py demo_household --photos ../docs/screenshots/photos
# Not exec: the trap above removes the data when Playwright stops the server.
uv run --quiet gunicorn sunfleck.config.wsgi --bind 127.0.0.1:8401 --workers 2
