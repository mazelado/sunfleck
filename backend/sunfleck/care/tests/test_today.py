import json
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from typing import Any

import pytest
import time_machine
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.care import schedules
from sunfleck.care.models import CareEvent, CareSchedule, Feedback, ScheduleMode
from sunfleck.care.schedules import ScheduleData
from sunfleck.care.services import CareError, CareEventData, log_care_for_plants
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.models import Location
from sunfleck.places.tests.factories import LocationFactory, WindowFactory
from sunfleck.plants.models import Plant, PlantLight, PlantStatus
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.taxonomy.models import CareArchetype, Taxon

ClientAs = Callable[[Role], Client]
NOW = datetime(2026, 4, 15, 10, tzinfo=UTC)
TODAY = date(2026, 4, 15)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def frozen_time() -> Iterator[None]:
    with time_machine.travel(NOW, tick=False):
        yield


@pytest.fixture
def living_room(household: Household) -> Location:
    return LocationFactory.create(site__household=household)


def plant_in(location: Location | None, nickname: str = "Monty", **fields: Any) -> Plant:
    household = location.site.household if location else fields.pop("household")
    return PlantFactory.create(
        household=household,
        location=location,
        nickname=nickname,
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
        **fields,
    )


def every(plant: Plant, key: str, days: int, last_done: date | None = None) -> CareSchedule:
    """A fixed schedule, optionally with the care last done on `last_done` (at noon UTC)."""
    if last_done:
        CareEventFactory.create(
            plant=plant,
            care_type=builtin(key),
            performed_at=datetime(last_done.year, last_done.month, last_done.day, 12, tzinfo=UTC),
        )
    return schedules.create_schedule(plant, ScheduleData(builtin(key).pk, ScheduleMode.FIXED, days))


def is_current(schedule: CareSchedule) -> bool:
    schedule.refresh_from_db()
    return schedule.calculated_on is not None


# --- Keeping schedules up to date -------------------------------------------------------------


def test_schedules_are_marked_out_of_date_when_what_they_depend_on_changes(
    living_room: Location,
) -> None:
    plant = plant_in(living_room)
    schedule = schedules.create_schedule(
        plant, ScheduleData(builtin("water").pk, ScheduleMode.PREDICTED)
    )
    window = WindowFactory.create(location=living_room)
    changes: list[Callable[[], object]] = [
        plant.save,
        living_room.save,
        living_room.site.save,
        window.save,
        lambda: PlantLight.objects.create(plant=plant, light_source=window),
        window.delete,
        lambda: CareEventFactory.create(plant=plant),
        lambda: CareEvent.objects.filter(plant=plant).delete(),
        CareArchetype.objects.get(key="tropical_aroid").save,
    ]

    for change in changes:
        schedules.schedules_for(plant)
        assert is_current(schedule)
        change()
        assert not is_current(schedule), change

    # A plant's species, and through it, its species' care profile.
    plant.care_profile = None
    plant.taxon = Taxon.objects.get(scientific_name="Monstera deliciosa")
    plant.save()
    for change in [plant.taxon.save, CareArchetype.objects.get(key="tropical_aroid").save]:
        schedules.schedules_for(plant)
        change()
        assert not is_current(schedule)


def test_deleting_a_location_marks_its_plants_schedules_out_of_date(
    living_room: Location,
) -> None:
    plant = plant_in(living_room)
    schedule = every(plant, "rotate", 14)

    living_room.delete()

    assert not is_current(schedule)


def test_up_to_date_schedules_arent_recalculated(
    living_room: Location, django_assert_num_queries: Any
) -> None:
    plant = plant_in(living_room)
    every(plant, "rotate", 14)
    every(plant, "pest_check", 30)

    with django_assert_num_queries(1):  # just loading them
        schedules.schedules_for(plant)


def test_other_plants_schedules_stay_current(living_room: Location) -> None:
    monty = plant_in(living_room)
    fern = plant_in(LocationFactory.create(site=living_room.site, name="Bathroom"), "Fern")
    theirs = every(fern, "rotate", 14)

    monty.save()
    CareEventFactory.create(plant=monty)

    assert is_current(theirs)


# --- Snoozing ---------------------------------------------------------------------------------


def test_snoozing_puts_care_off(living_room: Location) -> None:
    schedule = every(plant_in(living_room), "rotate", 7, last_done=date(2026, 4, 5))
    assert schedule.due_on == date(2026, 4, 12)

    schedules.snooze(schedule, date(2026, 4, 17))

    assert schedule.due_on == date(2026, 4, 17)
    assert schedule.next_due == date(2026, 4, 12)
    schedules.snooze(schedule, None)
    assert schedule.due_on == date(2026, 4, 12)


def test_logging_the_care_ends_the_snooze(living_room: Location) -> None:
    plant = plant_in(living_room)
    schedule = every(plant, "rotate", 7, last_done=date(2026, 4, 5))
    schedules.snooze(schedule, date(2026, 4, 17))

    CareEventFactory.create(plant=plant, care_type=builtin("rotate"), performed_at=NOW)
    [schedule] = schedules.schedules_for(plant)

    assert (schedule.snoozed_until, schedule.due_on) == (None, date(2026, 4, 22))


def test_a_snooze_ends_on_the_day_it_was_put_off_to(living_room: Location) -> None:
    schedule = every(plant_in(living_room), "rotate", 7, last_done=date(2026, 4, 5))
    schedules.snooze(schedule, date(2026, 4, 16))

    with time_machine.travel(datetime(2026, 4, 16, 10, tzinfo=UTC), tick=False):
        [task] = schedules.due_tasks(schedule.plant.household)

    assert (task.due_on, task.days_until) == (date(2026, 4, 16), 0)


@pytest.mark.parametrize(
    ("until", "code"),
    [
        (TODAY, "invalid_snooze"),
        (date(2026, 6, 15), "invalid_snooze"),  # more than two months ahead
    ],
)
def test_snoozes_are_within_two_months(living_room: Location, until: date, code: str) -> None:
    schedule = every(plant_in(living_room), "rotate", 7)

    with pytest.raises(CareError) as error:
        schedules.snooze(schedule, until)

    assert (error.value.code, error.value.field) == (code, "until")


def test_care_that_isnt_due_cant_be_snoozed(living_room: Location) -> None:
    schedule = every(plant_in(living_room), "rotate", 7)
    schedules.update_schedule(
        schedule, ScheduleData(schedule.care_type_id, ScheduleMode.FIXED, 7, enabled=False)
    )

    with pytest.raises(CareError) as error:
        schedules.snooze(schedule, date(2026, 4, 20))

    assert error.value.code == "nothing_to_snooze"


# --- Due care ---------------------------------------------------------------------------------


def test_due_care_soonest_first(household: Household, living_room: Location) -> None:
    bathroom = LocationFactory.create(site=living_room.site, name="Bathroom")
    monty = plant_in(living_room)
    fern = plant_in(bathroom, "Fern")
    every(monty, "rotate", 7, last_done=date(2026, 4, 5))  # 3 days overdue
    every(fern, "pest_check", 10, last_done=date(2026, 4, 5))  # today
    every(monty, "pest_check", 10, last_done=date(2026, 4, 5))  # today
    every(fern, "rotate", 14, last_done=date(2026, 4, 8))  # in 7 days
    every(fern, "mist", 9, last_done=date(2026, 4, 15))  # in 9 days: too far ahead
    paused = every(monty, "mist", 1)
    schedules.update_schedule(
        paused, ScheduleData(paused.care_type_id, ScheduleMode.FIXED, 1, enabled=False)
    )

    tasks = schedules.due_tasks(household)

    assert [
        (t.schedule.plant.nickname, t.schedule.care_type.key, t.due_on, t.days_until) for t in tasks
    ] == [
        ("Monty", "rotate", date(2026, 4, 12), -3),
        # The same day: by location, then plant.
        ("Fern", "pest_check", TODAY, 0),
        ("Monty", "pest_check", TODAY, 0),
        ("Fern", "rotate", date(2026, 4, 22), 7),
    ]
    assert [t.schedule.care_type.key for t in schedules.due_tasks(household, 0)] == [
        "rotate",
        "pest_check",
        "pest_check",
    ]


def test_plants_given_away_or_that_died_have_no_due_care(
    household: Household, living_room: Location
) -> None:
    for status in [PlantStatus.GIFTED, PlantStatus.DECEASED]:
        every(plant_in(living_room, status=status), "rotate", 1)
    every(plant_in(living_room, "Dormant", status=PlantStatus.DORMANT), "rotate", 1)

    assert [t.schedule.plant.nickname for t in schedules.due_tasks(household)] == ["Dormant"]


def test_today_is_each_plants_own(household: Household, living_room: Location) -> None:
    sydney = LocationFactory.create(
        site__household=household,
        site__latitude=-33.87,
        site__longitude=151.21,
        site__timezone="Australia/Sydney",
    )
    every(plant_in(living_room, "Amsterdam"), "rotate", 5, last_done=date(2026, 4, 10))
    every(plant_in(sydney, "Sydney"), "rotate", 5, last_done=date(2026, 4, 10))

    # 22:00 in Amsterdam, but already 06:00 the next day in Sydney.
    with time_machine.travel(datetime(2026, 4, 15, 20, tzinfo=UTC), tick=False):
        tasks = schedules.due_tasks(household)

    assert [(t.schedule.plant.nickname, t.days_until) for t in tasks] == [
        ("Sydney", -1),
        ("Amsterdam", 0),
    ]


def test_plants_without_a_schedule_are_counted(household: Household, living_room: Location) -> None:
    every(plant_in(living_room), "rotate", 7)
    fern = plant_in(living_room, "Fern")
    plant_in(living_room, "Gone", status=PlantStatus.DECEASED)

    assert list(schedules.unscheduled_plants(household)) == [fern]


def test_with_several_plants_without_a_schedule_today_links_to_none(
    client_as: ClientAs, living_room: Location
) -> None:
    plant_in(living_room, "Fern")
    plant_in(living_room, "Ivy")

    body = client_as(Role.VIEWER).get("/api/v1/today").json()

    assert (body["unscheduled_plants"], body["unscheduled_plant_id"]) == (2, None)


# --- Care for many plants at once -------------------------------------------------------------


def test_watering_a_whole_room(household: Household, living_room: Location) -> None:
    monty, fern = plant_in(living_room), plant_in(living_room, "Fern")

    events = log_care_for_plants(
        household,
        [monty.pk, fern.pk, monty.pk],
        CareEventData(builtin("water").pk, feedback=Feedback.JUST_RIGHT),
        None,
    )

    assert [(e.plant.nickname, e.feedback) for e in events] == [
        ("Monty", "just_right"),
        ("Fern", "just_right"),
    ]


def test_care_for_many_plants_is_all_or_nothing(
    household: Household, living_room: Location
) -> None:
    monty = plant_in(living_room)
    theirs = PlantFactory.create()

    with pytest.raises(CareError) as error:
        log_care_for_plants(
            household, [monty.pk, theirs.pk], CareEventData(builtin("water").pk), None
        )

    assert (error.value.code, error.value.field) == ("plant_not_found", "plant_ids")
    assert not CareEvent.objects.exists()


# --- API --------------------------------------------------------------------------------------


def send(client: Client, method: str, url: str, data: Any = None) -> Any:
    return client.generic(method, url, json.dumps(data or {}), content_type="application/json")


def test_the_today_list(client_as: ClientAs, household: Household, living_room: Location) -> None:
    schedule = every(plant_in(living_room), "rotate", 7, last_done=date(2026, 4, 5))
    plant_in(living_room, "Fern")

    response = client_as(Role.VIEWER).get("/api/v1/today?days_ahead=3")

    assert response.status_code == 200
    body = response.json()
    # The only plant without a schedule: the app links straight to it.
    fern = Plant.objects.get(nickname="Fern")
    assert (body["unscheduled_plants"], body["unscheduled_plant_id"]) == (1, fern.pk)
    [task] = body["tasks"]
    assert task | {"care_type": task["care_type"]["key"]} == {
        "schedule_id": schedule.pk,
        "plant": {
            "id": schedule.plant_id,
            "nickname": "Monty",
            "cover_thumbnail_url": None,
            "location": {
                "id": living_room.pk,
                "name": "Living room",
                "kind": "indoor",
                "site_id": living_room.site_id,
                "site_name": "Home",
            },
        },
        "care_type": "rotate",
        "mode": "fixed",
        "interval_days": 7,
        "due_on": "2026-04-12",
        "days_until": -3,
        "snoozed_until": None,
    }


def test_snoozing_through_the_api(client_as: ClientAs, living_room: Location) -> None:
    schedule = every(plant_in(living_room), "rotate", 7, last_done=date(2026, 4, 5))
    url = f"/api/v1/care-schedules/{schedule.pk}/snooze"
    gardener = client_as(Role.GARDENER)

    snoozed = send(gardener, "PUT", url, {"until": "2026-04-16"})
    too_late = send(gardener, "PUT", url, {"until": "2026-07-01"})
    viewer = send(client_as(Role.VIEWER), "PUT", url, {"until": "2026-04-16"})

    assert (snoozed.json()["snoozed_until"], snoozed.json()["due_on"]) == (
        "2026-04-16",
        "2026-04-16",
    )
    assert too_late.status_code == 422
    assert too_late.json()["error"]["details"] == {"field": "until"}
    assert viewer.status_code == 403


def test_watering_a_room_through_the_api(
    client_as: ClientAs, household: Household, living_room: Location
) -> None:
    monty, fern = plant_in(living_room), plant_in(living_room, "Fern")
    gardener = client_as(Role.GARDENER)
    body = {"plant_ids": [monty.pk, fern.pk], "care_type_id": builtin("water").pk}

    logged = send(gardener, "POST", "/api/v1/care-events/bulk", body)
    refused = send(gardener, "POST", "/api/v1/care-events/bulk", {**body, "plant_ids": [999_999]})
    viewer = send(client_as(Role.VIEWER), "POST", "/api/v1/care-events/bulk", body)

    assert logged.status_code == 201
    assert [event["plant_id"] for event in logged.json()] == [monty.pk, fern.pk]
    assert refused.json()["error"]["code"] == "plant_not_found"
    assert viewer.status_code == 403
