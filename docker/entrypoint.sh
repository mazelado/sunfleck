#!/bin/sh
# Container entry point. Usage: web (default) | manage <command> | any other command.
set -e

case "$1" in
  web)
    python manage.py migrate --noinput
    exec gunicorn sunfleck.config.wsgi \
      --bind 0.0.0.0:8000 \
      --workers "${WEB_CONCURRENCY:-2}" \
      --access-logfile -
    ;;
  manage)
    shift
    exec python manage.py "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
