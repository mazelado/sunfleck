from datetime import UTC, datetime, timedelta

import pytest
import time_machine

from sunfleck.accounts.models import Household
from sunfleck.accounts.tests.factories import HouseholdFactory, UserFactory
from sunfleck.care import services
from sunfleck.care.models import CareType
from sunfleck.care.tests.factories import CareEventFactory, builtin
from sunfleck.places.tests.factories import LocationFactory, SiteFactory
from sunfleck.plants.tests.factories import PlantFactory

NOW = datetime(2026, 6, 1, 9, tzinfo=UTC)


@pytest.mark.django_db
def test_every_household_gets_the_builtin_care_types(household: Household) -> None:
    keys = [care_type.key for care_type in services.care_types_for(household)]

    assert keys == [
        "water",
        "fertilize",
        "repot",
        "prune",
        "mist",
        "rotate",
        "clean_leaves",
        "pest_check",
    ]
    assert builtin("water").affects_prediction


@pytest.mark.django_db
def test_households_see_only_their_own_custom_types(household: Household) -> None:
    ours = services.create_care_type(household, services.CareTypeData(" Bottom water ", "droplet"))
    theirs = services.create_care_type(HouseholdFactory.create(), services.CareTypeData("Harvest"))

    visible = services.care_types_for(household)

    assert ours.name == "Bottom water"
    assert ours in visible
    assert theirs not in visible


@pytest.mark.django_db
@pytest.mark.parametrize("name", ["water", "Bottom water"])
def test_care_type_names_must_be_unique(household: Household, name: str) -> None:
    services.create_care_type(household, services.CareTypeData("Bottom water"))

    with pytest.raises(services.CareError) as exc_info:
        services.create_care_type(household, services.CareTypeData(name.upper()))

    assert (exc_info.value.code, exc_info.value.field) == ("care_type_exists", "name")


@pytest.mark.django_db
def test_builtin_types_cant_be_changed_or_deleted() -> None:
    water = builtin("water")

    with pytest.raises(services.CareError) as renamed:
        services.update_care_type(water, services.CareTypeData("Drink"))
    with pytest.raises(services.CareError) as deleted:
        services.delete_care_type(water)

    assert renamed.value.code == deleted.value.code == "builtin_care_type"


@pytest.mark.django_db
def test_custom_types_can_be_renamed_and_deleted_until_used(household: Household) -> None:
    harvest = services.create_care_type(household, services.CareTypeData("Harvest"))
    services.update_care_type(harvest, services.CareTypeData("Pick", "scissors"))
    used = services.create_care_type(household, services.CareTypeData("Feed fish"))
    CareEventFactory.create(care_type=used, plant__household=household)

    services.delete_care_type(harvest)
    with pytest.raises(services.CareError) as exc_info:
        services.delete_care_type(used)

    assert not CareType.objects.filter(pk=harvest.pk).exists()
    assert exc_info.value.code == "care_type_in_use"


@pytest.mark.django_db
@time_machine.travel(NOW, tick=False)
def test_care_is_logged_now_by_default() -> None:
    plant = PlantFactory.create()
    user = UserFactory.create()

    event = services.log_care(
        plant,
        services.CareEventData(
            care_type_id=builtin("water").pk,
            notes=" Bottom watered ",
            feedback="too_dry",  # type: ignore[arg-type]
        ),
        user,
    )

    assert (event.performed_at, event.performed_by) == (NOW, user)
    assert (event.notes, event.feedback, event.skipped) == ("Bottom watered", "too_dry", False)


@pytest.mark.django_db
@time_machine.travel(NOW, tick=False)
@pytest.mark.parametrize(
    ("data", "code", "field"),
    [
        ({"performed_at": NOW + timedelta(hours=1)}, "care_in_future", "performed_at"),
        ({"feedback": "still_wet", "key": "fertilize"}, "feedback_only_for_watering", "feedback"),
        ({"key": "other household"}, "care_type_not_found", "care_type_id"),
    ],
)
def test_care_log_rules(data: dict[str, object], code: str, field: str) -> None:
    plant = PlantFactory.create()
    key = data.pop("key", "water")
    if key == "other household":
        care_type = services.create_care_type(
            HouseholdFactory.create(), services.CareTypeData("Theirs")
        )
    else:
        care_type = builtin(str(key))

    with pytest.raises(services.CareError) as exc_info:
        services.log_care(
            plant,
            services.CareEventData(care_type_id=care_type.pk, **data),  # type: ignore[arg-type]
            None,
        )

    assert (exc_info.value.code, exc_info.value.field) == (code, field)


@pytest.mark.django_db
def test_a_few_minutes_of_clock_difference_is_allowed() -> None:
    soon = datetime.now(UTC) + timedelta(minutes=2)

    event = services.log_care(
        PlantFactory.create(),
        services.CareEventData(care_type_id=builtin("water").pk, performed_at=soon),
        None,
    )

    assert event.performed_at == soon


@pytest.mark.django_db
def test_logged_care_can_be_corrected() -> None:
    event = CareEventFactory.create()

    services.update_care_event(
        event,
        services.CareEventData(
            care_type_id=builtin("water").pk,
            performed_at=datetime(2026, 4, 30, 18, tzinfo=UTC),
            feedback="still_wet",  # type: ignore[arg-type]
            skipped=True,
        ),
    )

    event.refresh_from_db()
    assert event.performed_at == datetime(2026, 4, 30, 18, tzinfo=UTC)
    assert (event.feedback, event.skipped) == ("still_wet", True)


@pytest.mark.django_db
def test_a_time_without_a_zone_is_local_time_at_the_plants_site() -> None:
    site = SiteFactory.create(timezone="Europe/Amsterdam")
    plant = PlantFactory.create(
        household=site.household, location=LocationFactory.create(site=site)
    )

    event = services.log_care(
        plant,
        services.CareEventData(
            care_type_id=builtin("water").pk,
            performed_at=datetime(2026, 5, 1, 12),  # noqa: DTZ001 - naive on purpose
        ),
        None,
    )

    assert event.performed_at == datetime(2026, 5, 1, 10, tzinfo=UTC)


@pytest.mark.django_db
def test_only_watering_types_take_soil_feedback(household: Household) -> None:
    plant = PlantFactory.create(household=household)
    bottom = services.create_care_type(
        household, services.CareTypeData("Bottom water", counts_as_watering=True)
    )
    harvest = services.create_care_type(household, services.CareTypeData("Harvest"))

    event = services.log_care(
        plant,
        services.CareEventData(care_type_id=bottom.pk, feedback="too_dry"),  # type: ignore[arg-type]
        None,
    )
    with pytest.raises(services.CareError) as exc_info:
        services.log_care(
            plant,
            services.CareEventData(care_type_id=harvest.pk, feedback="too_dry"),  # type: ignore[arg-type]
            None,
        )

    assert event.feedback == "too_dry"
    assert exc_info.value.code == "feedback_only_for_watering"


@pytest.mark.django_db
def test_only_builtin_water_counts_as_watering() -> None:
    watering = CareType.objects.filter(household=None, counts_as_watering=True)

    assert [care_type.key for care_type in watering] == ["water"]
