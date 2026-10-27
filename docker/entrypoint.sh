#!/bin/sh
# Container entry point. Usage: web (default) | manage <command> | any other command.
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
    exec gunicorn sunfleck.config.wsgi \
      --bind 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-2}" \
      --access-logfile - \
      --no-control-socket
    ;;
  manage)
    shift
    exec python manage.py "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
