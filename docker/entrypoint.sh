#!/bin/sh
# Container entry point. Usage: web (default) | worker | manage <command> | any other command.
set -e

# Everything in the data folder must be writable, not only the folder: a file left by a command
# run as root (e.g. the job queue) otherwise fails later, and only in the worker's log.
data_dir="${SUNFLECK_DATA_DIR:-/data}"
owner="$(id -u):$(id -g)"
if [ ! -w "$data_dir" ]; then
  not_writable="$data_dir"
else
  not_writable=$(find "$data_dir" ! -writable -print -quit 2>/dev/null || true)
fi
if [ -n "$not_writable" ]; then
  echo "Error: $not_writable isn't writable by user ID $(id -u), which Sunfleck runs as." >&2
  echo "Give everything in $data_dir back to Sunfleck. In the folder with compose.yaml, run:" >&2
  echo "  docker compose run --rm -u root --entrypoint chown sunfleck -R $owner $data_dir" >&2
  echo "If $data_dir is a folder on your computer instead: sudo chown -R $owner <folder>" >&2
  exit 1
fi

case "$1" in
  web)
    python manage.py migrate --noinput
    # One line per request is mostly health checks and app files, so it's off unless asked for.
    access_log=""
    case "${SUNFLECK_ACCESS_LOG:-false}" in
      true|1|yes) access_log="--access-logfile -" ;;
    esac
    # The timeout covers the slowest request Sunfleck makes while someone waits: an AI model
    # that has to load first (up to 2 x 120 s). Gunicorn's own default, 30 s, cut it off.
    exec gunicorn sunfleck.config.wsgi \
      --bind 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-2}" \
      --timeout "${WEB_TIMEOUT:-250}" \
      --no-control-socket \
      $access_log
    ;;
  worker)
    # Background jobs: reminders, weather, nightly recalculation. The web service runs the
    # database migrations, so start this one after it.
    exec python manage.py run_huey
    ;;
  manage)
    shift
    exec python manage.py "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
