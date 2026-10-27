import io
from collections.abc import Callable
from datetime import UTC, datetime, time
from typing import Any

import pytest
import time_machine
from django.core.files.storage import default_storage
from PIL import ExifTags

from sunfleck.accounts.models import Household
from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.places import services as places_services
from sunfleck.places.models import LightSource, LightSourceKind, Location
from sunfleck.places.tests.factories import LocationFactory, SiteFactory, WindowFactory
from sunfleck.plants import services
from sunfleck.plants.models import Photo, Plant
from sunfleck.plants.tests.factories import PlantFactory, image_bytes


@pytest.fixture
def location(household: Household) -> Location:
    return LocationFactory.create(site__household=household)


@pytest.fixture
def grow_light(location: Location) -> LightSource:
    return LightSource.objects.create(
        location=location,
        kind=LightSourceKind.GROW_LIGHT,
        ppfd=200,
        on_time=time(7),
        off_time=time(19),
    )


def _data(**overrides: Any) -> services.PlantData:
    return services.PlantData(**{"nickname": " Monty ", **overrides})


def _light(light: LightSource, distance_cm: int | None = None) -> services.PlantLightData:
    return services.PlantLightData(light_source_id=light.pk, distance_cm=distance_cm)


def _upload(plant: Plant, **image: Any) -> Photo:
    data = image_bytes(**image)
    return services.add_photo(plant, io.BytesIO(data), len(data))


# --- Plants -----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_plant_gets_the_lights_that_reach_it(
    household: Household, location: Location, grow_light: LightSource
) -> None:
    window = WindowFactory.create(location=location)

    plant = services.create_plant(
        household,
        _data(
            location_id=location.pk,
            light_sources=[_light(window, 120), _light(grow_light, 30)],
        ),
    )

    assert plant.nickname == "Monty"
    distances = {link.light_source_id: link.distance_cm for link in plant.light_links.all()}
    # Distance only means something for windows.
    assert distances == {window.pk: 120, grow_light.pk: None}


@pytest.mark.django_db
def test_plant_can_be_added_without_a_location(household: Household) -> None:
    plant = services.create_plant(household, _data())

    assert plant.location is None
    assert plant.status == "active"


@pytest.mark.django_db
def test_lights_must_come_from_the_plants_location(
    household: Household, location: Location
) -> None:
    other_room = LocationFactory.create(site=location.site, name="Kitchen")
    kitchen_window = WindowFactory.create(location=other_room)

    with pytest.raises(services.PlantsError) as exc_info:
        services.create_plant(
            household, _data(location_id=location.pk, light_sources=[_light(kitchen_window)])
        )

    assert exc_info.value.code == "light_source_not_in_location"
    assert exc_info.value.field == "light_sources"
    assert not Plant.objects.exists()


@pytest.mark.django_db
def test_plant_without_a_location_has_no_lights(household: Household) -> None:
    window = WindowFactory.create(location__site__household=household)

    with pytest.raises(services.PlantsError) as exc_info:
        services.create_plant(household, _data(light_sources=[_light(window)]))

    assert exc_info.value.code == "light_source_not_in_location"


@pytest.mark.django_db
def test_each_light_can_be_added_once(household: Household, location: Location) -> None:
    window = WindowFactory.create(location=location)

    with pytest.raises(services.PlantsError) as exc_info:
        services.create_plant(
            household,
            _data(location_id=location.pk, light_sources=[_light(window), _light(window)]),
        )

    assert exc_info.value.code == "duplicate_light_source"


@pytest.mark.django_db
def test_location_must_belong_to_the_household(household: Household) -> None:
    elsewhere = LocationFactory.create(site__household=HouseholdFactory.create())

    with pytest.raises(services.PlantsError) as exc_info:
        services.create_plant(household, _data(location_id=elsewhere.pk))

    assert (exc_info.value.code, exc_info.value.field) == ("location_not_found", "location_id")


@pytest.mark.django_db
def test_moving_a_plant_replaces_its_lights(
    household: Household, location: Location, grow_light: LightSource
) -> None:
    plant = services.create_plant(
        household, _data(location_id=location.pk, light_sources=[_light(grow_light)])
    )
    office = LocationFactory.create(site=location.site, name="Office")
    office_window = WindowFactory.create(location=office)

    services.update_plant(
        plant,
        _data(nickname="Monty", location_id=office.pk, light_sources=[_light(office_window, 50)]),
    )

    assert plant.location == office
    assert [(link.light_source, link.distance_cm) for link in plant.light_links.all()] == [
        (office_window, 50)
    ]


@pytest.mark.django_db
def test_deleting_a_location_keeps_its_plants(household: Household, location: Location) -> None:
    plant = PlantFactory.create(household=household, location=location)

    location.delete()

    plant.refresh_from_db()
    assert plant.location is None


@pytest.mark.django_db
def test_turning_a_window_into_a_grow_light_clears_plant_distances(
    household: Household, location: Location
) -> None:
    window = WindowFactory.create(location=location)
    plant = services.create_plant(
        household, _data(location_id=location.pk, light_sources=[_light(window, 80)])
    )

    places_services.update_light_source(
        window,
        places_services.LightSourceData(
            kind=LightSourceKind.GROW_LIGHT, ppfd=150, on_time=time(6), off_time=time(20)
        ),
    )

    assert plant.light_links.get().distance_cm is None


# --- Photos -----------------------------------------------------------------------------------


@pytest.mark.django_db
def test_first_photo_becomes_the_cover_photo() -> None:
    plant = PlantFactory.create()

    first = _upload(plant)
    second = _upload(plant)

    plant.refresh_from_db()
    assert plant.cover_photo == first
    assert str(second.image.name).startswith(f"photos/{plant.household_id}/")
    assert default_storage.exists(str(second.thumbnail.name))


@pytest.mark.django_db
def test_photo_date_uses_the_sites_time_zone() -> None:
    site = SiteFactory.create(timezone="Europe/Amsterdam")
    plant = PlantFactory.create(
        household=site.household, location=LocationFactory.create(site=site)
    )

    photo = _upload(plant, exif_details={ExifTags.Base.DateTimeOriginal: "2026:05:01 12:00:00"})

    # Amsterdam is two hours ahead of UTC in May.
    assert photo.taken_at == datetime(2026, 5, 1, 10, tzinfo=UTC)


@pytest.mark.django_db
@time_machine.travel(datetime(2026, 6, 1, 9, tzinfo=UTC), tick=False)
def test_photo_without_a_date_is_dated_now() -> None:
    photo = _upload(PlantFactory.create())

    assert photo.taken_at == datetime(2026, 6, 1, 9, tzinfo=UTC)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("upload", "code"),
    [
        (
            lambda plant: services.add_photo(plant, io.BytesIO(b"x"), 21 * 1024 * 1024),
            "photo_too_large",
        ),
        (lambda plant: services.add_photo(plant, io.BytesIO(b"x"), 1), "invalid_image"),
        (
            lambda plant: services.add_photo(plant, io.BytesIO(image_bytes()), 1, "x" * 201),
            "caption_too_long",
        ),
    ],
)
def test_unusable_photos_are_refused(upload: Callable[[Plant], Photo], code: str) -> None:
    plant = PlantFactory.create()

    with pytest.raises(services.PlantsError) as exc_info:
        upload(plant)

    assert exc_info.value.code == code
    assert not Photo.objects.exists()


@pytest.mark.django_db
def test_deleting_the_cover_photo_picks_the_newest_remaining_one(
    django_capture_on_commit_callbacks: Any,
) -> None:
    plant = PlantFactory.create()
    oldest = _upload(plant, exif_details={ExifTags.Base.DateTimeOriginal: "2024:01:01 00:00:00"})
    newest = _upload(plant, exif_details={ExifTags.Base.DateTimeOriginal: "2025:01:01 00:00:00"})
    services.set_cover_photo(plant, oldest.pk)

    with django_capture_on_commit_callbacks(execute=True):
        services.delete_photo(oldest)

    plant.refresh_from_db()
    assert plant.cover_photo == newest
    assert not default_storage.exists(str(oldest.image.name))
    assert not default_storage.exists(str(oldest.thumbnail.name))


@pytest.mark.django_db
def test_deleting_a_plant_deletes_its_photo_files(django_capture_on_commit_callbacks: Any) -> None:
    plant = PlantFactory.create()
    photo = _upload(plant)

    with django_capture_on_commit_callbacks(execute=True):
        plant.delete()

    assert not default_storage.exists(str(photo.image.name))


@pytest.mark.django_db
def test_cover_photo_must_be_the_plants_own() -> None:
    plant = PlantFactory.create()
    someone_elses = _upload(PlantFactory.create(household=plant.household))

    with pytest.raises(services.PlantsError) as exc_info:
        services.set_cover_photo(plant, someone_elses.pk)

    assert exc_info.value.code == "photo_not_found"


@pytest.mark.django_db
def test_caption_is_trimmed() -> None:
    photo = _upload(PlantFactory.create())

    services.update_photo(photo, "  First leaf  ")

    photo.refresh_from_db()
    assert photo.caption == "First leaf"


@pytest.mark.django_db
def test_failed_photo_save_leaves_no_files_behind(monkeypatch: pytest.MonkeyPatch) -> None:
    plant = PlantFactory.create()
    saved: list[str] = []
    original_save = default_storage.save

    def remember_save(name: str, *args: Any, **kwargs: Any) -> str:
        saved.append(original_save(name, *args, **kwargs))
        return saved[-1]

    def fail(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(default_storage, "save", remember_save)
    monkeypatch.setattr(Photo, "save", fail)

    with pytest.raises(RuntimeError):
        _upload(plant)

    assert len(saved) == 2
    assert not any(default_storage.exists(name) for name in saved)
