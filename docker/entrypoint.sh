#!/bin/sh
# Container entry point. Usage: web (default) | worker | manage <command> | any other command.
set -e

data_dir="${SUNFLECK_DATA_DIR:-/data}"
if [ ! -w "$data_dir" ]; then
  echo "Error: $data_dir isn't writable by user ID $(id -u), which Sunfleck runs as." >&2
  echo "If $data_dir is a folder on your computer, fix it with: sudo chown $(id -u) <folder>" >&2
  exit 1
fi

case "$1" in
  web)
    python manage.py migrate --noinput
    # The timeout covers the slowest request Sunfleck makes while someone waits: an AI model
    # that has to load first (up to 2 x 120 s). Gunicorn's own default, 30 s, cut it off.
    exec gunicorn sunfleck.config.wsgi \
      --bind 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-2}" \
      --timeout "${WEB_TIMEOUT:-250}" \
      --access-logfile - \
      --no-control-socket
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
