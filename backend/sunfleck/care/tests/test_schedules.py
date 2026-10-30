from collections.abc import Iterator
from datetime import UTC, date, datetime, time

import pytest
import time_machine
from django.core.management import call_command

from sunfleck.accounts.models import Household
from sunfleck.care import schedules
from sunfleck.care.models import CareSchedule, CareType, ScheduleAdjustment, ScheduleMode
from sunfleck.care.schedules import ScheduleData
from sunfleck.care.services import CareError, CareTypeData, create_care_type, delete_care_type
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.models import LightSource, Location, LocationKind
from sunfleck.places.tests.factories import LocationFactory, WindowFactory
from sunfleck.plants.models import Plant, PlantLight, PlantStatus
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.prediction.light import Window
from sunfleck.taxonomy.models import CareArchetype

# Mid-April in Amsterdam (the factories' site): spring, when tropical aroids want water about
# every 7 days and feeding every 30.
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


@pytest.fixture
def monty(household: Household, living_room: Location) -> Plant:
    return PlantFactory.create(
        household=household,
        location=living_room,
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
    )


def predicted(care_type: CareType) -> ScheduleData:
    return ScheduleData(care_type.pk, ScheduleMode.PREDICTED)


def every(care_type: CareType, days: int) -> ScheduleData:
    return ScheduleData(care_type.pk, ScheduleMode.FIXED, days)


def codes(schedule: CareSchedule) -> list[str]:
    return [factor["code"] for factor in schedule.factors]


# --- Inputs -----------------------------------------------------------------------------------


def test_conditions_of_an_indoor_plant(monty: Plant, living_room: Location) -> None:
    living_room.temperature_min_c = 18
    living_room.temperature_max_c = 24
    living_room.save()
    window = WindowFactory.create(location=living_room, direction="E")
    lamp = LightSource.objects.create(
        location=living_room, kind="grow_light", ppfd=200, on_time=time(7), off_time=time(19)
    )
    switched_off = WindowFactory.create(location=living_room, direction="S", enabled=False)
    for light, distance in [(window, 50), (lamp, None), (switched_off, 10)]:
        PlantLight.objects.create(plant=monty, light_source=light, distance_cm=distance)
    monty.container_diameter_cm = 12
    monty.container_height_cm = 10
    monty.container_material = "terracotta"
    monty.status = PlantStatus.DORMANT

    conditions = schedules.conditions_for(monty)

    assert conditions.indoor is True
    assert conditions.latitude == 52.37
    assert conditions.windows == (Window("E", 50),)
    [grow_light] = conditions.grow_lights
    assert grow_light.dli == pytest.approx(8.64)
    assert (conditions.temperature_min_c, conditions.temperature_max_c) == (18, 24)
    assert (conditions.pot_diameter_cm, conditions.pot_height_cm) == (12, 10)
    assert conditions.pot_material == "terracotta"
    assert conditions.dormant is True


def test_conditions_of_an_outdoor_plant(monty: Plant, living_room: Location) -> None:
    living_room.kind = LocationKind.OUTDOOR
    living_room.exposure = "part_shade"
    living_room.save()

    conditions = schedules.conditions_for(monty)

    assert (conditions.indoor, conditions.exposure, conditions.windows) == (
        False,
        "part_shade",
        (),
    )


def test_conditions_of_a_plant_without_a_location(household: Household) -> None:
    plant = PlantFactory.create(household=household, container_material="")

    conditions = schedules.conditions_for(plant)

    assert (conditions.indoor, conditions.latitude, conditions.pot_material) == (None, None, None)


def test_history_counts_any_watering_and_skips(monty: Plant, household: Household) -> None:
    bottom = create_care_type(household, CareTypeData("Bottom water", counts_as_watering=True))
    CareEventFactory.create(plant=monty, performed_at=datetime(2026, 4, 1, 9, tzinfo=UTC))
    CareEventFactory.create(
        plant=monty,
        care_type=bottom,
        performed_at=datetime(2026, 4, 8, 9, tzinfo=UTC),
        feedback="too_dry",
    )
    # Late in the evening in Amsterdam, already the next day there.
    CareEventFactory.create(
        plant=monty,
        performed_at=datetime(2026, 4, 12, 22, 30, tzinfo=UTC),
        skipped=True,
        feedback="still_wet",
    )
    CareEventFactory.create(
        plant=monty,
        care_type=builtin("fertilize"),
        performed_at=datetime(2026, 4, 14, 9, tzinfo=UTC),
    )

    history = schedules.history_for(monty, builtin("water"), date(2026, 3, 1))

    assert history.last_done == date(2026, 4, 13)
    assert history.feedback == ["too_dry", "still_wet"]
    assert history.started_on == date(2026, 3, 1)


def test_history_remembers_the_last_ten_answers_oldest_first(monty: Plant) -> None:
    for day in range(1, 13):
        CareEventFactory.create(
            plant=monty,
            performed_at=datetime(2026, 3, day, 9, tzinfo=UTC),
            feedback="too_dry" if day <= 6 else "still_wet",
        )

    history = schedules.history_for(monty, builtin("water"), TODAY)

    assert history.feedback == ["too_dry"] * 4 + ["still_wet"] * 6


def test_fertilizing_history_has_no_feedback(monty: Plant) -> None:
    CareEventFactory.create(plant=monty, feedback="too_dry")

    history = schedules.history_for(monty, builtin("fertilize"), TODAY)

    assert (history.last_done, history.feedback) == (None, [])


# --- Predictions ------------------------------------------------------------------------------


def test_a_new_watering_schedule_is_predicted_and_explained(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, predicted(builtin("water")))

    assert schedule.started_on == TODAY
    assert schedule.interval_days == 7
    assert schedule.next_due == date(2026, 4, 22)
    assert schedule.calculated_on == TODAY
    assert schedule.factors == [
        {"code": "season", "multiplier": 1.0, "details": {"season": "spring", "days": 7}},
        {"code": "no_light_info", "multiplier": 1.0, "details": {"indoor": True}},
        {"code": "no_pot_size", "multiplier": 1.0, "details": {}},
        {"code": "not_logged", "multiplier": 1.0, "details": {"since": "2026-04-15"}},
    ]
    assert schedule.adjustments.count() == 1


def test_logged_care_moves_the_due_date(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, predicted(builtin("water")))
    CareEventFactory.create(plant=monty, performed_at=NOW)

    [schedule] = schedules.schedules_for(monty)

    assert schedule.next_due == date(2026, 4, 22)
    assert "not_logged" not in codes(schedule)
    assert schedule.adjustments.count() == 2


def test_an_unchanged_prediction_isnt_recorded_again(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, every(builtin("rotate"), 14))

    schedules.schedules_for(monty)
    with time_machine.travel(datetime(2026, 4, 16, 10, tzinfo=UTC), tick=False):
        [schedule] = schedules.schedules_for(monty)

    assert schedule.calculated_on == date(2026, 4, 16)
    assert schedule.adjustments.count() == 1


def test_changes_to_the_plant_are_picked_up_when_read(monty: Plant) -> None:
    schedules.create_schedule(monty, predicted(builtin("water")))
    monty.container_diameter_cm = 8
    monty.container_material = "terracotta"
    monty.save()

    [schedule] = schedules.schedules_for(monty)

    assert schedule.interval_days == 5
    latest = ScheduleAdjustment.objects.filter(schedule=schedule).first()
    assert latest is not None
    assert latest.interval_days == 5
    # Monty is a tropical aroid (let the top third dry): the top third of its 8 cm pot.
    [amount] = [f for f in schedule.factors if f["code"] == "water_amount"]
    assert amount["details"] == {"litres": 0.02, "pot_litres": 0.3, "height_known": False}


def test_fertilizing_waits_out_the_winter(monty: Plant) -> None:
    with time_machine.travel(datetime(2026, 12, 1, 10, tzinfo=UTC), tick=False):
        schedule = schedules.create_schedule(monty, predicted(builtin("fertilize")))

    assert schedule.interval_days == 30
    assert schedule.next_due == date(2027, 3, 1)
    assert "fertilize_pause" in codes(schedule)


def test_a_schedule_whose_profile_is_gone_has_no_due_date(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, predicted(builtin("water")))
    monty.care_profile = None
    monty.save()

    schedules.recalculate(schedule)

    assert (schedule.interval_days, schedule.next_due, codes(schedule)) == (
        None,
        None,
        ["no_care_profile"],
    )


def test_recalculate_all(monty: Plant, household: Household) -> None:
    schedules.create_schedule(monty, predicted(builtin("water")))
    schedules.create_schedule(monty, every(builtin("rotate"), 14))
    other = PlantFactory.create(household=household)
    schedules.create_schedule(other, every(builtin("pest_check"), 30))

    assert schedules.recalculate_all() == 3


def test_the_recalculate_command(monty: Plant, capsys: pytest.CaptureFixture[str]) -> None:
    schedules.create_schedule(monty, every(builtin("rotate"), 14))

    call_command("recalculate_schedules")

    assert capsys.readouterr().out == "Recalculated 1 care schedules.\n"


# --- The suggested routine --------------------------------------------------------------------


def suggested(plant: Plant) -> list[tuple[str, str, int | None, bool]]:
    return [
        (s.care_type.key, s.mode, s.fixed_interval_days, s.recommended)
        for s in schedules.suggest_routine(plant)
    ]


def test_the_suggested_routine_for_an_indoor_plant(monty: Plant) -> None:
    assert suggested(monty) == [
        ("water", "predicted", None, True),
        ("fertilize", "predicted", None, True),
        ("rotate", "fixed", 14, False),
        ("pest_check", "fixed", 30, False),
    ]
    water = schedules.suggest_routine(monty)[0].prediction
    assert (water.interval_days, water.next_due) == (7, date(2026, 4, 22))


def test_outdoor_plants_arent_rotated(monty: Plant, living_room: Location) -> None:
    living_room.kind = LocationKind.OUTDOOR
    living_room.save()

    assert [key for key, *_ in suggested(monty)] == ["water", "fertilize", "pest_check"]


def test_carnivorous_plants_arent_fertilized(monty: Plant) -> None:
    monty.care_profile = CareArchetype.objects.get(key="bog_carnivore")

    assert [key for key, *_ in suggested(monty)] == ["water", "rotate", "pest_check"]


def test_without_a_care_profile_only_reminders_are_suggested(household: Household) -> None:
    plant = PlantFactory.create(household=household)

    assert [key for key, *_ in suggested(plant)] == ["pest_check"]


def test_care_already_scheduled_isnt_suggested_again(monty: Plant, household: Household) -> None:
    bottom = create_care_type(household, CareTypeData("Bottom water", counts_as_watering=True))
    schedules.create_schedule(monty, predicted(bottom))
    schedules.create_schedule(monty, every(builtin("rotate"), 7))

    assert [key for key, *_ in suggested(monty)] == ["fertilize", "pest_check"]


def test_accepting_the_routine(monty: Plant) -> None:
    added = schedules.accept_routine(
        monty, [predicted(builtin("water")), every(builtin("pest_check"), 21)]
    )

    assert [(s.care_type.key, s.origin, s.interval_days) for s in added] == [
        ("water", "suggested", 7),
        ("pest_check", "suggested", 21),
    ]


def test_a_routine_is_accepted_all_or_nothing(monty: Plant) -> None:
    with pytest.raises(CareError):
        schedules.accept_routine(monty, [predicted(builtin("water")), predicted(builtin("rotate"))])

    assert not monty.schedules.exists()


# --- Changing schedules -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("data", "code", "field"),
    [
        (lambda: predicted(builtin("rotate")), "cannot_predict", "mode"),
        (
            lambda: ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED),
            "interval_required",
            "fixed_interval_days",
        ),
        (lambda: ScheduleData(999_999, ScheduleMode.FIXED, 7), "care_type_not_found", None),
    ],
)
def test_invalid_schedules_are_refused(
    monty: Plant, data: object, code: str, field: str | None
) -> None:
    with pytest.raises(CareError) as error:
        schedules.create_schedule(monty, data())  # type: ignore[operator]

    assert error.value.code == code
    assert error.value.field == (field or "care_type_id")


def test_another_households_care_type_cant_be_scheduled(monty: Plant) -> None:
    theirs = create_care_type(PlantFactory.create().household, CareTypeData("Harvest"))

    with pytest.raises(CareError) as error:
        schedules.create_schedule(monty, every(theirs, 7))

    assert error.value.code == "care_type_not_found"


def test_one_schedule_per_care_type_and_one_for_watering(
    monty: Plant, household: Household
) -> None:
    schedules.create_schedule(monty, predicted(builtin("water")))
    bottom = create_care_type(household, CareTypeData("Bottom water", counts_as_watering=True))

    with pytest.raises(CareError) as again:
        schedules.create_schedule(monty, every(builtin("water"), 3))
    with pytest.raises(CareError) as other_watering:
        schedules.create_schedule(monty, every(bottom, 3))

    assert again.value.code == "schedule_exists"
    assert other_watering.value.code == "watering_scheduled"


def test_care_is_predicted_only_with_a_care_profile(household: Household) -> None:
    plant = PlantFactory.create(household=household)

    with pytest.raises(CareError) as error:
        schedules.create_schedule(plant, predicted(builtin("water")))

    assert (error.value.code, error.value.field) == ("no_care_profile", "mode")


def test_a_schedule_can_be_switched_to_fixed_and_back(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, predicted(builtin("water")))

    schedules.update_schedule(schedule, every(builtin("water"), 4))
    assert (schedule.mode, schedule.fixed_interval_days, schedule.interval_days) == (
        "fixed",
        4,
        4,
    )

    schedules.update_schedule(schedule, predicted(builtin("water")))
    assert (schedule.fixed_interval_days, schedule.interval_days) == (None, 7)


def test_a_schedule_not_in_use_is_never_due(monty: Plant) -> None:
    schedule = schedules.create_schedule(monty, predicted(builtin("water")))

    schedules.update_schedule(
        schedule, ScheduleData(schedule.care_type_id, ScheduleMode.PREDICTED, enabled=False)
    )

    assert (schedule.next_due, codes(schedule)) == (None, ["not_in_use"])


def test_deleting_a_care_type_deletes_its_unused_schedules(
    monty: Plant, household: Household
) -> None:
    harvest = create_care_type(household, CareTypeData("Harvest"))
    schedules.create_schedule(monty, every(harvest, 7))

    delete_care_type(harvest)

    assert not monty.schedules.exists()
