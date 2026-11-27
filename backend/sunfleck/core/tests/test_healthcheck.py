import os
import time
import urllib.error
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from email.message import Message
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from django.utils.module_loading import autodiscover_modules
from huey.contrib.djhuey import HUEY

from sunfleck.core import healthcheck, tasks
from sunfleck.places.tasks import estimate_frost_dates


@pytest.fixture
def heartbeat(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "sunfleck-worker-heartbeat"
    monkeypatch.setattr(healthcheck, "heartbeat_file", lambda: path)
    yield path
    tasks._worker_started.clear()


def _age(path: Path, seconds: float) -> None:
    then = time.time() - seconds
    os.utime(path, (then, then))


# --- The worker's container ---------------------------------------------------------------------


def test_a_worker_that_has_not_started_is_unhealthy(heartbeat: Path) -> None:
    assert healthcheck.check_worker() == "The worker hasn't started yet."


def test_a_worker_that_finished_a_job_recently_is_healthy(heartbeat: Path) -> None:
    healthcheck.note_heartbeat()
    _age(heartbeat, healthcheck.MAX_AGE_SECONDS - 60)

    assert healthcheck.check_worker() is None


def test_a_worker_that_has_not_finished_a_job_for_too_long_is_unhealthy(heartbeat: Path) -> None:
    healthcheck.note_heartbeat()
    _age(heartbeat, 45 * 60 + 10)

    assert healthcheck.check_worker() == "The worker hasn't finished a job for 45 minutes."


def test_the_worker_notes_a_heartbeat_when_it_starts_and_after_each_job(heartbeat: Path) -> None:
    tasks.note_worker_started()
    assert heartbeat.exists()

    _age(heartbeat, 3600)
    tasks.note_job_finished("complete", MagicMock())

    assert healthcheck.heartbeat_age() is not None
    assert healthcheck.heartbeat_age() < 60  # type: ignore[operator]  # just checked


@pytest.mark.django_db
def test_a_job_the_worker_runs_notes_a_heartbeat(heartbeat: Path) -> None:
    tasks.note_worker_started()
    _age(heartbeat, 3600)

    estimate_frost_dates()  # run right away in tests, with the same signals as in the worker

    assert healthcheck.check_worker() is None


@pytest.mark.django_db
def test_jobs_outside_the_worker_note_nothing(heartbeat: Path) -> None:
    estimate_frost_dates()

    assert not heartbeat.exists()


def test_some_job_runs_often_enough_to_keep_a_working_worker_healthy() -> None:
    autodiscover_modules("tasks")  # as the worker does when it starts
    # Every minute of a day, the time since the last minute some periodic job was due.
    start = datetime(2026, 1, 5, tzinfo=UTC)
    longest_gap = gap = timedelta()
    for minute in range(24 * 60):
        gap = timedelta() if HUEY.read_periodic(start + timedelta(minutes=minute)) else gap
        gap += timedelta(minutes=1)
        longest_gap = max(longest_gap, gap)

    assert longest_gap.total_seconds() <= healthcheck.MAX_AGE_SECONDS / 2


def test_the_worker_container_is_recognised_by_its_command(tmp_path: Path) -> None:
    (tmp_path / "1").mkdir()
    (tmp_path / "1" / "cmdline").write_bytes(b"/bin/sh\0/app/entrypoint.sh\0worker\0")
    (tmp_path / "self").mkdir()
    (tmp_path / "self" / "cmdline").write_bytes(b"python\0manage.py\0run_huey\0")
    assert not healthcheck.is_worker_container(tmp_path)

    (tmp_path / "7").mkdir()
    (tmp_path / "7" / "cmdline").write_bytes(b"python\0manage.py\0run_huey\0")
    assert healthcheck.is_worker_container(tmp_path)


# --- The web server's container -----------------------------------------------------------------


def test_a_web_server_that_answers_is_healthy() -> None:
    with patch("sunfleck.core.healthcheck.urllib.request.urlopen") as urlopen:
        assert healthcheck.check_web() is None

    urlopen.assert_called_once_with(healthcheck.HEALTH_URL, timeout=4)


@pytest.mark.parametrize(
    "error",
    [
        urllib.error.URLError(ConnectionRefusedError(111, "Connection refused")),
        urllib.error.HTTPError(healthcheck.HEALTH_URL, 503, "Service Unavailable", Message(), None),
        TimeoutError("timed out"),
    ],
)
def test_a_web_server_that_does_not_answer_well_is_unhealthy(error: OSError) -> None:
    with patch("sunfleck.core.healthcheck.urllib.request.urlopen", side_effect=error):
        problem = healthcheck.check_web()

    assert problem is not None
    assert problem.startswith(f"The web server didn't answer {healthcheck.HEALTH_URL}")


# --- Both -----------------------------------------------------------------------------------------


@pytest.mark.parametrize(("worker", "web_problem", "status"), [(False, None, 0), (False, "x", 1)])
def test_main_checks_the_web_server_outside_the_worker(
    worker: bool, web_problem: str | None, status: int, capsys: pytest.CaptureFixture[str]
) -> None:
    with (
        patch.object(healthcheck, "is_worker_container", return_value=worker),
        patch.object(healthcheck, "check_web", return_value=web_problem),
    ):
        assert healthcheck.main() == status

    assert capsys.readouterr().out == ("x\n" if web_problem else "")


def test_main_checks_the_worker_in_its_container(
    heartbeat: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    with patch.object(healthcheck, "is_worker_container", return_value=True):
        assert healthcheck.main() == 1
        healthcheck.note_heartbeat()
        assert healthcheck.main() == 0

    assert capsys.readouterr().out == "The worker hasn't started yet.\n"
