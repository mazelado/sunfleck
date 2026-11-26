import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from sunfleck.accounts.models import Household, Role, User


@pytest.mark.django_db
def test_email_is_stored_trimmed_and_lowercase() -> None:
    user = User.objects.create_user("  Fern@Example.COM ", "pw")

    assert user.email == "fern@example.com"


@pytest.mark.django_db
def test_create_superuser_can_use_the_admin_site() -> None:
    user = User.objects.create_superuser("admin@example.com", "pw")

    assert user.is_staff
    assert user.is_superuser


def test_create_user_requires_an_email() -> None:
    with pytest.raises(ValueError, match="email"):
        User.objects.create_user("", "pw")


def test_names_fall_back_to_email() -> None:
    user = User(email="fern@example.com")

    assert user.get_full_name() == "fern@example.com"
    assert user.get_short_name() == "fern@example.com"
    assert str(user) == "fern@example.com"


@pytest.mark.parametrize(
    ("role", "other", "expected"),
    [
        (Role.ADMIN, Role.GARDENER, True),
        (Role.ADMIN, Role.ADMIN, True),
        (Role.GARDENER, Role.VIEWER, True),
        (Role.GARDENER, Role.ADMIN, False),
        (Role.VIEWER, Role.GARDENER, False),
    ],
)
def test_role_includes_lower_roles(role: Role, other: Role, expected: bool) -> None:
    assert role.includes(other) is expected


@pytest.mark.django_db
def test_new_households_start_with_garden_and_collection_off() -> None:
    household = Household.objects.create(name="Home")

    assert (household.garden, household.collection) == (False, False)


@pytest.mark.django_db(transaction=True)
def test_households_from_before_the_switches_keep_every_area() -> None:
    before = [("accounts", "0003_avatar_source")]
    executor = MigrationExecutor(connection)
    executor.migrate(before)
    old = executor.loader.project_state(before).apps
    household = old.get_model("accounts", "Household").objects.create(name="Home")

    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(executor.loader.graph.leaf_nodes())

    upgraded = Household.objects.get(pk=household.pk)
    assert (upgraded.garden, upgraded.collection) == (True, True)
