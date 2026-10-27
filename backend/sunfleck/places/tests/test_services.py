from datetime import time

import pytest

from sunfleck.accounts.models import Household
from sunfleck.places import services
from sunfleck.places.models import LightSourceKind, LocationKind
from sunfleck.places.tests.factories import LocationFactory, SiteFactory, WindowFactory


def _site_data(**overrides: object) -> services.SiteData:
    fields: dict[str, object] = {
        "name": " Home ",
        "latitude": 52.3702157,
        "longitude": 4.8951679,
        "timezone": "Europe/Amsterdam",
        **overrides,
    }
    return services.SiteData(**fields)  # type: ignore[arg-type]


@pytest.mark.django_db
def test_create_site_trims_the_name_and_rounds_coordinates(household: Household) -> None:
    site = services.create_site(household, _site_data())

    assert site.name == "Home"
    assert (site.latitude, site.longitude) == (52.370216, 4.895168)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"timezone": "Mars/Olympus_Mons"}, "unknown_timezone"),
        ({"latitude": 91}, "invalid_latitude"),
        ({"longitude": -181}, "invalid_longitude"),
    ],
)
def test_create_site_rejects_invalid_values(
    household: Household, overrides: dict[str, object], code: str
) -> None:
    with pytest.raises(services.PlacesError) as exc_info:
        services.create_site(household, _site_data(**overrides))

    assert exc_info.value.code == code


@pytest.mark.django_db
def test_indoor_location_keeps_only_indoor_fields() -> None:
    location = services.create_location(
        SiteFactory.create(),
        services.LocationData(
            name="Kitchen",
            kind=LocationKind.INDOOR,
            temperature_min_c=16,
            temperature_max_c=24,
            humidity="medium",  # type: ignore[arg-type]
            exposure="full_sun",  # type: ignore[arg-type]
        ),
    )

    assert (location.temperature_min_c, location.temperature_max_c) == (16, 24)
    assert location.humidity == "medium"
    assert location.exposure == ""


@pytest.mark.django_db
def test_outdoor_location_keeps_only_outdoor_fields() -> None:
    location = services.create_location(
        SiteFactory.create(),
        services.LocationData(
            name="Balcony",
            kind=LocationKind.OUTDOOR,
            temperature_min_c=16,
            humidity="medium",  # type: ignore[arg-type]
            exposure="part_shade",  # type: ignore[arg-type]
        ),
    )

    assert location.temperature_min_c is None
    assert location.humidity == ""
    assert location.exposure == "part_shade"


@pytest.mark.django_db
def test_temperature_range_must_be_in_order() -> None:
    with pytest.raises(services.PlacesError) as exc_info:
        services.create_location(
            SiteFactory.create(),
            services.LocationData(
                name="Hall", kind=LocationKind.INDOOR, temperature_min_c=25, temperature_max_c=18
            ),
        )

    assert exc_info.value.code == "temperature_order"
    assert exc_info.value.field == "temperature_min_c"


@pytest.mark.django_db
def test_location_with_light_sources_cannot_become_outdoor() -> None:
    window = WindowFactory.create()

    with pytest.raises(services.PlacesError) as exc_info:
        services.update_location(
            window.location, services.LocationData(name="Porch", kind=LocationKind.OUTDOOR)
        )

    assert exc_info.value.code == "location_has_light_sources"


@pytest.mark.django_db
def test_window_requires_a_direction_and_drops_grow_light_fields() -> None:
    location = LocationFactory.create()

    with pytest.raises(services.PlacesError) as exc_info:
        services.create_light_source(
            location, services.LightSourceData(kind=LightSourceKind.WINDOW)
        )
    window = services.create_light_source(
        location,
        services.LightSourceData(
            kind=LightSourceKind.WINDOW,
            direction="SW",  # type: ignore[arg-type]
            distance_cm=50,
            ppfd=300,
        ),
    )

    assert exc_info.value.code == "direction_required"
    assert (window.direction, window.distance_cm, window.ppfd) == ("SW", 50, None)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("data", "code"),
    [
        ({"on_time": time(7), "off_time": time(19)}, "ppfd_required"),
        ({"ppfd": 200, "on_time": time(7)}, "schedule_required"),
        ({"ppfd": 200, "on_time": time(7), "off_time": time(7)}, "schedule_empty"),
    ],
)
def test_grow_light_needs_brightness_and_a_schedule(data: dict[str, object], code: str) -> None:
    with pytest.raises(services.PlacesError) as exc_info:
        services.create_light_source(
            LocationFactory.create(),
            services.LightSourceData(kind=LightSourceKind.GROW_LIGHT, **data),  # type: ignore[arg-type]
        )

    assert exc_info.value.code == code


@pytest.mark.django_db
def test_light_sources_only_belong_indoors() -> None:
    balcony = LocationFactory.create(kind=LocationKind.OUTDOOR)

    with pytest.raises(services.PlacesError) as exc_info:
        services.create_light_source(
            balcony,
            services.LightSourceData(kind=LightSourceKind.WINDOW, direction="S"),  # type: ignore[arg-type]
        )

    assert exc_info.value.code == "outdoor_location"


@pytest.mark.django_db
def test_switching_a_window_to_a_grow_light_clears_window_fields() -> None:
    window = WindowFactory.create()

    light = services.update_light_source(
        window,
        services.LightSourceData(
            kind=LightSourceKind.GROW_LIGHT, ppfd=150, on_time=time(6), off_time=time(20)
        ),
    )

    assert (light.direction, light.distance_cm) == ("", None)
    assert light.ppfd == 150
