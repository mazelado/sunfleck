from collections.abc import Iterator
from datetime import datetime

import pytest
from huey.contrib.djhuey import HUEY

from sunfleck.plugins import PeriodicJob, PluginInfo, hookimpl
from sunfleck.plugins.jobs import register_jobs, schedule
from sunfleck.plugins.registry import registry


def utc(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    """A time in UTC, as Huey's schedules take it (without a time zone)."""
    return datetime(year, month, day, hour, minute)  # noqa: DTZ001


def due_at(when: datetime) -> list[str]:
    return [task.name for task in HUEY.read_periodic(when)]


def test_schedules_are_cron_expressions_in_utc() -> None:
    every_two_hours = schedule("15 */2 * * *")

    assert every_two_hours(utc(2026, 4, 15, 14, 15))
    assert not every_two_hours(utc(2026, 4, 15, 15, 15))
    assert not every_two_hours(utc(2026, 4, 15, 14, 16))


@pytest.mark.parametrize("cron", ["* * * *", "61 * * * *", "every hour"])
def test_invalid_schedules_are_refused(cron: str) -> None:
    with pytest.raises(ValueError):  # noqa: PT011 - the message varies
        schedule(cron)


class Tidy:
    def __init__(self) -> None:
        self.runs = 0

    def tidy(self) -> None:
        self.runs += 1

    def broken(self) -> None:
        raise RuntimeError("the shed is locked")

    @hookimpl
    def register_periodic_jobs(self) -> list[object]:
        return [
            PeriodicJob("tidy", "5 3 * * *", self.tidy),
            PeriodicJob("broken", "6 3 * * *", self.broken),
            PeriodicJob("never", "every hour", self.tidy),
            "not a job",
        ]


@pytest.fixture
def tidy() -> Iterator[Tidy]:
    hooks = Tidy()
    registry.add(PluginInfo("tidy", "Tidy", "1", "1"), hooks)
    problems_before = list(registry.problems)
    yield hooks
    registry.remove("tidy")
    registry.problems = problems_before


def test_plugins_jobs_run_on_their_schedule(tidy: Tidy) -> None:
    names = register_jobs(registry)

    assert {"plugins.tidy.tidy", "plugins.tidy.broken"} <= set(names)
    assert "plugins.tidy.tidy" in due_at(utc(2026, 4, 15, 3, 5))
    assert "plugins.tidy.tidy" not in due_at(utc(2026, 4, 15, 3, 6))
    # Invalid jobs are reported with the plugins that couldn't be loaded.
    assert [p.message for p in registry.problems if p.source == "Tidy"] == [
        "register_periodic_jobs: expected 5 cron fields, got 2: 'every hour'",
        "register_periodic_jobs: expected a PeriodicJob, got str",
    ]


def test_a_failing_job_is_logged_not_raised(tidy: Tidy, caplog: pytest.LogCaptureFixture) -> None:
    register_jobs(registry)
    [broken] = [t for t in HUEY.read_periodic(utc(2026, 4, 15, 3, 6)) if "tidy" in t.name]
    [tidy_job] = [t for t in HUEY.read_periodic(utc(2026, 4, 15, 3, 5)) if "tidy" in t.name]

    HUEY.execute(broken)
    HUEY.execute(tidy_job)

    assert tidy.runs == 1
    assert "Plugin tidy's job broken failed" in caplog.text
