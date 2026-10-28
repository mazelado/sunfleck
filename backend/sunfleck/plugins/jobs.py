"""Running plugins' background jobs (`register_periodic_jobs`) in the worker."""

import logging
from collections.abc import Callable

from huey import crontab
from huey.contrib.djhuey import db_periodic_task

from sunfleck.plugins.discovery import Problem
from sunfleck.plugins.registry import Registry
from sunfleck.plugins.types import PeriodicJob

logger = logging.getLogger(__name__)


def schedule(cron: str) -> Callable[..., bool]:
    """A Huey schedule from a five-field cron expression (minute hour day month weekday), UTC.

    Raises:
        ValueError: If it isn't one.
    """
    fields = cron.split()
    if len(fields) != 5:
        raise ValueError(f"expected 5 cron fields, got {len(fields)}: {cron!r}")
    minute, hour, day, month, day_of_week = fields
    return crontab(minute, hour, day, month, day_of_week, strict=True)  # type: ignore[no-any-return]


# The current job for each task name. Each name is registered with Huey once; its task runs
# whatever job has that name now, so registering again (e.g. in tests) doesn't clash.
_jobs: dict[str, tuple[str, PeriodicJob]] = {}


def _run(name: str) -> None:
    """Run a plugin's job, logging its exceptions rather than raising them."""
    plugin_id, job = _jobs[name]
    try:
        job.function()
    except Exception:  # a broken plugin must never stop the worker
        logger.exception("Plugin %s's job %s failed", plugin_id, job.name)


def _task(name: str) -> Callable[[], None]:
    def run_plugin_job() -> None:
        _run(name)

    return run_plugin_job


def register_jobs(registry: Registry) -> list[str]:
    """Schedule every plugin's periodic jobs; return their task names.

    Jobs that aren't PeriodicJobs, or whose schedule is invalid, are reported with the plugins
    that couldn't be loaded.
    """
    names = []
    for plugin_id in registry.implementers("register_periodic_jobs"):
        for answer in registry.call_at_startup("register_periodic_jobs", plugin_id):
            for job in answer:
                source = registry.plugins[plugin_id].name
                try:
                    if not isinstance(job, PeriodicJob):
                        raise TypeError(f"expected a PeriodicJob, got {type(job).__name__}")
                    when = schedule(job.cron)
                except (TypeError, ValueError) as exc:
                    registry.problems.append(Problem(source, f"register_periodic_jobs: {exc}"))
                    continue
                name = f"plugins.{plugin_id}.{job.name}"
                if name not in _jobs:
                    db_periodic_task(when, name=name)(_task(name))
                _jobs[name] = (plugin_id, job)
                names.append(name)
    return names
