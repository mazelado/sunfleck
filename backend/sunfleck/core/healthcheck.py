"""The Docker image's health check, for both of its roles.

Docker runs ``python -m sunfleck.core.healthcheck`` in each container every 30 seconds:

- In the web server's container, it asks the server's health endpoint, which also checks the
  database.
- In the background worker's container, there's no web server to ask. Instead, the worker notes
  the time in a file whenever it starts and whenever it finishes a job. Some job runs at least
  every 15 minutes (sending due notifications), so a note older than ``MAX_AGE_SECONDS`` means
  the worker has stopped working: its scheduler, its job queue or its threads.

This module doesn't load Django, so the check stays quick and light on a Raspberry Pi.
"""

import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HEALTH_URL = "http://127.0.0.1:8000/api/v1/health"
# Twice the longest time between the worker's periodic jobs (a test checks this), so a long
# job, or a slow start of the hour, doesn't make a working worker look unhealthy.
MAX_AGE_SECONDS = 30 * 60
WORKER_COMMAND = b"run_huey"


def heartbeat_file() -> Path:
    """The file the worker touches. It's in the container's own temporary folder, not in the
    data folder that the web server's container shares."""
    return Path(tempfile.gettempdir()) / "sunfleck-worker-heartbeat"


def note_heartbeat() -> None:
    heartbeat_file().touch()


def heartbeat_age(now: float | None = None) -> float | None:
    """Seconds since the worker's last heartbeat, or None if it hasn't noted one."""
    try:
        noted = heartbeat_file().stat().st_mtime
    except FileNotFoundError:
        return None
    return (time.time() if now is None else now) - noted


def is_worker_container(proc: Path = Path("/proc")) -> bool:
    """Whether the background worker runs here (the image runs either it or the web server)."""
    for cmdline in proc.glob("[0-9]*/cmdline"):
        try:
            if WORKER_COMMAND in cmdline.read_bytes().split(b"\0"):
                return True
        except OSError:  # the process ended while we looked
            continue
    return False


def check_worker() -> str | None:
    """None if the worker is working, otherwise what's wrong."""
    age = heartbeat_age()
    if age is None:
        return "The worker hasn't started yet."
    if age > MAX_AGE_SECONDS:
        return f"The worker hasn't finished a job for {age / 60:.0f} minutes."
    return None


def check_web() -> str | None:
    """None if the web server answers that it's healthy, otherwise what's wrong."""
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=4):
            return None
    except OSError as exc:  # includes URLError, and HTTPError for a 503
        return f"The web server didn't answer {HEALTH_URL}: {exc}"


def main() -> int:
    problem = check_worker() if is_worker_container() else check_web()
    if problem:
        sys.stdout.write(f"{problem}\n")  # Docker keeps it with the check's result
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
