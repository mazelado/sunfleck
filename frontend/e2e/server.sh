#!/usr/bin/env bash
# Starts Sunfleck as in production (the built frontend, Gunicorn, no DEBUG) with an empty
# database, for the browser tests. Playwright runs it; build the frontend first.
set -euo pipefail
cd "$(dirname "$0")/../../backend"

SUNFLECK_DATA_DIR="$(mktemp -d)"
export SUNFLECK_DATA_DIR
export SECRET_KEY=only-for-browser-tests
trap 'rm -rf "$SUNFLECK_DATA_DIR"' EXIT

uv run --quiet python manage.py migrate --verbosity 0
uv run --quiet python manage.py collectstatic --noinput --verbosity 0
# Not exec: the trap above removes the data when Playwright stops the server.
uv run --quiet gunicorn sunfleck.config.wsgi --bind 127.0.0.1:8400 --workers 2
