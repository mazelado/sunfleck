"""Deleting households, and names two requests can't both take (code review 1.0, Q4, Q15)."""

import io
from collections.abc import Callable
from typing import Any

import pytest
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.models import QuerySet
from django.db.models.deletion import RestrictedError

from sunfleck.accounts.models import Household, Role
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.care import services
from sunfleck.care.models import CareEvent, CareType
from sunfleck.care.services import CareError, CareTypeData
from sunfleck.dataio import exporter, importer
from sunfleck.plants.models import Plant
from sunfleck.plants.tests.factories import PlantFactory


@pytest.mark.django_db
def test_a_household_with_its_own_care_types_can_be_deleted() -> None:
    household = HouseholdFactory.create()
    plant = PlantFactory.create(household=household)
    mist = CareType.objects.create(household=household, name="Mist twice")
    CareEvent.objects.create(plant=plant, care_type=mist, performed_at="2026-04-01T10:00Z")

    household.delete()

    assert not CareType.objects.filter(pk=mist.pk).exists()
    assert not CareEvent.objects.filter(plant_id=plant.pk).exists()


@pytest.mark.django_db
def test_a_care_type_in_use_still_cant_be_deleted_on_its_own() -> None:
    household = HouseholdFactory.create()
    mist = CareType.objects.create(household=household, name="Mist twice")
    CareEvent.objects.create(
        plant=PlantFactory.create(household=household),
        care_type=mist,
        performed_at="2026-04-01T10:00Z",
    )

    with pytest.raises(RestrictedError):
        mist.delete()
    with pytest.raises(CareError):
        services.delete_care_type(mist)


@pytest.mark.django_db
def test_two_care_types_with_the_same_name_are_refused_by_the_database() -> None:
    household = HouseholdFactory.create()
    CareType.objects.create(household=household, name="Bottom water")

    with pytest.raises(IntegrityError), transaction.atomic():
        CareType.objects.create(household=household, name="bottom WATER")
    # Other households may use the name.
    CareType.objects.create(household=HouseholdFactory.create(), name="Bottom water")


@pytest.mark.django_db
def test_a_second_care_type_made_at_the_same_moment_gets_the_usual_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    household = HouseholdFactory.create()
    services.create_care_type(household, CareTypeData("Bottom water"))
    # As if the second request had checked before the first one saved.
    monkeypatch.setattr(QuerySet, "exists", lambda self: False)

    with pytest.raises(CareError) as error:
        services.create_care_type(household, CareTypeData("Bottom water"))

    assert (error.value.code, error.value.field) == ("care_type_exists", "name")


@pytest.mark.django_db(transaction=True)
def test_upgrading_numbers_names_that_were_taken_twice() -> None:
    executor = MigrationExecutor(connection)
    before = [("care", "0009_care_event_estimated")]
    after = [("care", "0010_care_type_names_unique_restrict_events")]
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    household = old.get_model("accounts", "Household").objects.create(name="Home")
    care_type = old.get_model("care", "CareType")
    for name in ("Bottom water", "bottom water", "Bottom water", "Mist"):
        care_type.objects.create(household=household, name=name)

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(after)
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())

    names = list(
        CareType.objects.filter(household_id=household.pk)
        .order_by("pk")
        .values_list("name", flat=True)
    )
    assert names == ["Bottom water", "bottom water (2)", "Bottom water (3)", "Mist"]


@pytest.mark.django_db
def test_an_import_checks_the_household_is_empty_inside_its_transaction(
    member_of: Callable[[Role], Any], household: Household, monkeypatch: pytest.MonkeyPatch
) -> None:
    exported = io.BytesIO()
    exporter.write(HouseholdFactory.create(name="Elsewhere"), exported)
    real_is_empty = importer.is_empty
    checks: list[bool] = []

    def another_import_meanwhile(target: Household) -> bool:
        if not checks:
            # The first check finds it empty; then another import fills it.
            Plant.objects.create(household=target, nickname="From the other import")
            checks.append(True)
            return True
        checks.append(real_is_empty(target))
        return checks[-1]

    monkeypatch.setattr(importer, "is_empty", another_import_meanwhile)

    with pytest.raises(importer.DataImportError) as error:
        importer.import_into(household, io.BytesIO(exported.getvalue()))

    assert error.value.code == "household_not_empty"
    assert checks == [True, False]


@pytest.mark.django_db
def test_exporting_makes_the_same_number_of_queries_for_5_and_25_plants(
    django_assert_num_queries: Any,
) -> None:
    from django.db import connection as db
    from django.test.utils import CaptureQueriesContext
    from django.utils import timezone

    from sunfleck.ai.models import Conversation, Message
    from sunfleck.care import schedules
    from sunfleck.care.models import ScheduleMode
    from sunfleck.care.schedules import ScheduleData
    from sunfleck.care.tests.factories import builtin
    from sunfleck.garden.models import Harvest

    def household_with(plants: int) -> Household:
        household = HouseholdFactory.create()
        for number in range(plants):
            plant = PlantFactory.create(household=household, nickname=f"Plant {number}")
            CareEvent.objects.create(
                plant=plant, care_type=builtin("water"), performed_at=timezone.now()
            )
            Harvest.objects.create(plant=plant, harvested_on="2026-04-01")
            conversation = Conversation.objects.create(
                plant=plant, title="Why?", updated_at=timezone.now()
            )
            Message.objects.create(
                conversation=conversation, role="question", text="Why?", created_at=timezone.now()
            )
            schedules.create_schedule(
                plant, ScheduleData(builtin("rotate").pk, ScheduleMode.FIXED, 14)
            )
        return household

    counts = []
    for plants in (5, 25):
        household = household_with(plants)
        with CaptureQueriesContext(db) as queries:
            data = exporter.build(household)
        assert len(data.plants) == plants
        assert all(plant.conversations[0].messages for plant in data.plants)
        counts.append(len(queries))

    assert counts[0] == counts[1]
