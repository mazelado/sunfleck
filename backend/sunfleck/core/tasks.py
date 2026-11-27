"""The background worker's heartbeat, for its health check (see core/healthcheck.py)."""

import threading
from typing import Any

from huey import signals
from huey.contrib.djhuey import on_startup, signal

from sunfleck.core.healthcheck import note_heartbeat

# Set when the worker starts. Jobs also run outside the worker, e.g. right away in tests;
# those don't say anything about it, so they don't touch the file.
_worker_started = threading.Event()


@on_startup()
def note_worker_started() -> None:
    _worker_started.set()
    note_heartbeat()


@signal(signals.SIGNAL_COMPLETE, signals.SIGNAL_ERROR)
def note_job_finished(signal_name: str, task: Any, *args: Any, **kwargs: Any) -> None:
    """A job that raised an error still shows that the worker is working."""
    if _worker_started.is_set():
        note_heartbeat()
