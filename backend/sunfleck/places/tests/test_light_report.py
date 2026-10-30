from collections.abc import Callable
from datetime import date, time

import pytest
from django.test import Client

from sunfleck.accounts.models import Household, Role
from sunfleck.places.light_report import plant_light_report
from sunfleck.places.models import LightSource, Location, LocationKind, Site
from sunfleck.places.tests.factories import LocationFactory, SiteFactory, WindowFactory
from sunfleck.plants.models import Plant, PlantLight
from sunfleck.plants.tests.factories import PlantFactory
from sunfleck.prediction.light import light_verdict
from sunfleck.prediction.seasons import Season
from sunfleck.taxonomy.models import CareArchetype

ClientAs = Callable[[Role], Client]
APRIL = date(2026, 4, 15)


@pytest.mark.parametrize(
    ("dli", "verdict"),
    [(4.0, "low"), (6.0, "a_bit_low"), (10.0, "good"), (15.0, "good"), (16.0, "bright")],
)
def test_light_verdicts_compare_with_what_the_plant_likes(dli: float, verdict: str) -> None:
    assert light_verdict(dli, 10.0) == verdict


@pytest.fixture
def site(household: Household) -> Site:
    return SiteFactory.create(household=household, latitude=52.37)


@pytest.fixture
def room(site: Site) -> Location:
    return LocationFactory.create(site=site, name="Living room")


@pytest.fixture
def monty(household: Household, room: Location) -> Plant:
    window = WindowFactory.create(location=room, name="Bay window", direction="S")
    grow = LightSource.objects.create(
        location=room,
        kind="grow_light",
        name="Shelf light",
        ppfd=150,
        on_time=time(8),
        off_time=time(20),
    )
    plant = PlantFactory.create(
        household=household,
        location=room,
        nickname="Monty",
        care_profile=CareArchetype.objects.get(key="tropical_aroid"),
    )
    PlantLight.objects.create(plant=plant, light_source=window, distance_cm=50)
    PlantLight.objects.create(plant=plant, light_source=grow)
    return plant


@pytest.mark.django_db
def test_a_plants_light_through_the_year(monty: Plant) -> None:
    report = plant_light_report(monty, APRIL)

    assert report is not None
    assert report.current_season == "spring"
    by_season = {season.season: season for season in report.seasons}
    assert list(by_season) == ["spring", "summer", "autumn", "winter"]
    # A south window gives less in winter; the grow light gives the same all year.
    assert (
        by_season[Season.WINTER].dli < by_season[Season.SPRING].dli < by_season[Season.SUMMER].dli
    )
    [window, grow] = sorted(report.sources, key=lambda source: source.source.name)
    assert window.source.name == "Bay window"
    assert window.dli[Season.WINTER] < window.dli[Season.SUMMER]
    assert len(set(grow.dli.values())) == 1
    assert by_season[Season.SPRING].dli == pytest.approx(
        window.dli[Season.SPRING] + grow.dli[Season.SPRING]
    )
    assert all(
        season.verdict in {"low", "a_bit_low", "good", "bright"} for season in report.seasons
    )


@pytest.mark.django_db
def test_lights_that_arent_in_use_dont_count(monty: Plant) -> None:
    LightSource.objects.filter(name="Shelf light").update(enabled=False)

    report = plant_light_report(monty, APRIL)

    assert report is not None
    assert [source.source.name for source in report.sources] == ["Bay window"]


@pytest.mark.django_db
def test_outdoors_the_light_comes_from_the_sun_exposure(household: Household, site: Site) -> None:
    rose = PlantFactory.create(
        household=household,
        location=LocationFactory.create(site=site, kind=LocationKind.OUTDOOR, exposure="full_sun"),
        care_profile=CareArchetype.objects.get(key="temperate_shrub"),
    )

    report = plant_light_report(rose, APRIL)

    assert report is not None
    assert report.sources == []
    assert {season.verdict for season in report.seasons} <= {"good", "bright"}


@pytest.mark.django_db
def test_no_report_without_what_it_needs(household: Household, room: Location) -> None:
    aroid = CareArchetype.objects.get(key="tropical_aroid")

    assert plant_light_report(PlantFactory.create(household=household), APRIL) is None
    unknown = PlantFactory.create(household=household, location=room, care_profile=aroid)
    assert plant_light_report(unknown, APRIL) is None  # no windows or lights
    no_profile = PlantFactory.create(household=household, location=room)
    assert plant_light_report(no_profile, APRIL) is None


@pytest.mark.django_db
def test_the_light_endpoints(client_as: ClientAs, monty: Plant, room: Location) -> None:
    viewer = client_as(Role.VIEWER)

    plant = viewer.get(f"/api/v1/plants/{monty.pk}/light").json()
    location = viewer.get(f"/api/v1/locations/{room.pk}/light").json()

    assert [season["season"] for season in plant["seasons"]] == [
        "spring",
        "summer",
        "autumn",
        "winter",
    ]
    window = next(source for source in plant["sources"] if source["kind"] == "window")
    assert window["distance_cm"] == 50
    assert set(window["dli"]) == {"spring", "summer", "autumn", "winter"}
    # On the location page, windows are shown at a typical distance.
    assert next(s for s in location if s["kind"] == "window")["distance_cm"] == 100
    assert next(s for s in location if s["kind"] == "grow_light")["dli"]["winter"] > 0
