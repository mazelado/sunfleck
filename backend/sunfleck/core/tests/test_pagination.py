"""The lists that grow with use can be paged (code review 1.0, Q6)."""

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from sunfleck.accounts.models import Household, Role
from sunfleck.ai.models import Conversation
from sunfleck.core.pagination import MAX_LIST_LIMIT
from sunfleck.garden.models import Harvest, SeedPacket
from sunfleck.plants.models import Plant, Wish
from sunfleck.plants.tests.factories import PlantFactory

ClientAs = Callable[[Role], Client]

pytestmark = pytest.mark.django_db


def wishes(household: Household, plant: Plant, n: int) -> str:
    for number in range(n):
        Wish.objects.create(household=household, name=f"Wish {number:02}")
    return "/api/v1/wishlist"


def seeds(household: Household, plant: Plant, n: int) -> str:
    for number in range(n):
        SeedPacket.objects.create(household=household, name="Basil", variety=f"{number % 2}")
    return "/api/v1/seeds"


def harvests(household: Household, plant: Plant, n: int) -> str:
    for number in range(n):
        Harvest.objects.create(plant=plant, harvested_on=date(2026, 4, 1 + number % 3))
    return f"/api/v1/plants/{plant.pk}/harvests"


def conversations(household: Household, plant: Plant, n: int) -> str:
    for number in range(n):
        Conversation.objects.create(plant=plant, title=f"Q{number}", updated_at=timezone.now())
    return f"/api/v1/plants/{plant.pk}/conversations"


LISTS = [wishes, seeds, harvests, conversations]


@pytest.fixture
def plant(household: Household) -> Plant:
    return PlantFactory.create(household=household)


@pytest.mark.parametrize("make", LISTS, ids=lambda make: make.__name__)
def test_a_list_is_whole_by_default_and_can_be_paged(
    client_as: ClientAs, household: Household, plant: Plant, make: Callable[..., str]
) -> None:
    client = client_as(Role.VIEWER)
    url = make(household, plant, 7)

    whole = client.get(url).json()
    pages = [client.get(url, {"limit": 3, "offset": offset}).json() for offset in (0, 3, 6)]

    assert (len(whole["items"]), whole["count"]) == (7, 7)
    assert [page["count"] for page in pages] == [7, 7, 7]
    assert [len(page["items"]) for page in pages] == [3, 3, 1]
    # The pages together are the whole list, in the same order, without overlaps.
    paged_ids = [item["id"] for page in pages for item in page["items"]]
    assert paged_ids == [item["id"] for item in whole["items"]]


@pytest.mark.parametrize("make", LISTS, ids=lambda make: make.__name__)
@pytest.mark.parametrize("limit", [0, MAX_LIST_LIMIT + 1])
def test_a_page_is_at_most_the_maximum(
    client_as: ClientAs, household: Household, plant: Plant, make: Callable[..., str], limit: int
) -> None:
    url = make(household, plant, 1)

    assert client_as(Role.VIEWER).get(url, {"limit": limit}).status_code == 422


@pytest.mark.parametrize("make", LISTS, ids=lambda make: make.__name__)
def test_listing_takes_the_same_queries_however_long_the_list(
    client_as: ClientAs,
    household: Household,
    plant: Plant,
    make: Callable[..., str],
    django_assert_max_num_queries: Any,
) -> None:
    client = client_as(Role.VIEWER)
    url = make(household, plant, 3)
    with django_assert_max_num_queries(9) as few:
        client.get(url)
    make(household, plant, 30)

    with django_assert_max_num_queries(len(few.captured_queries)):
        response = client.get(url)

    assert response.json()["count"] == 33
