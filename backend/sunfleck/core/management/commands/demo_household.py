"""Fill an empty Sunfleck with a demo household, for screenshots and trying it out.

    python manage.py demo_household --photos ../docs/screenshots/photos

Makes the first account (ada@example.com, unless given), a home with two rooms and their
windows, five plants with photos and care history, and today's weather (with the weather
plugin on, from a stored forecast, so nothing is fetched). Only on an empty database.
"""

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.utils import timezone

from sunfleck.accounts.services import complete_setup
from sunfleck.care import schedules
from sunfleck.care.models import CareType, ScheduleMode
from sunfleck.care.services import CareEventData, log_care
from sunfleck.places import services as places
from sunfleck.places.models import Direction, LightSourceKind, LocationKind
from sunfleck.plants import services as plants
from sunfleck.plugins import services as plugin_services
from sunfleck.plugins.registry import registry
from sunfleck.taxonomy.models import Taxon

PASSWORD = "a long and unusual passphrase"  # noqa: S105 - a demo account, said so in --help
TIMEZONE = "Europe/Amsterdam"

# When each plant was last watered, from its own predicted interval, so the same plants need
# water in every season (the browser tests rely on it): due today, due in a few days, or
# watered recently.
DUE, SOON, WATERED = "due", "soon", "watered"
SOON_DAYS = 4
WATERED_DAYS_AGO = 2
FERTILIZED_DAYS_AGO = 10

# (nickname, species or genus, care profile if neither is known, room, photo, watering)
PLANTS: list[tuple[str, str | None, str | None, str, str, str]] = [
    ("Golden pothos", "Epipremnum aureum", None, "Living room", "golden-pothos.webp", DUE),
    ("Flaming Katy", "Kalanchoe blossfeldiana", None, "Living room", "flaming-katy.webp", WATERED),
    ("Dragon tree", "Dracaena marginata", None, "Living room", "dracaena.webp", DUE),
    ("Aloe", "Aloe vera", None, "Kitchen", "aloe-vera.webp", SOON),
    ("Avocado seedling", "Persea americana", None, "Kitchen", "avocado-seedling.webp", DUE),
]


class Command(BaseCommand):
    help = (
        "Fill an empty Sunfleck with a demo household (ada@example.com, password "
        f"'{PASSWORD}'), for screenshots and trying it out."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--photos", type=Path, required=True, help="Folder of plant photos.")
        parser.add_argument("--email", default="ada@example.com")

    def handle(self, *args: Any, **options: Any) -> None:
        photos: Path = options["photos"]
        if not photos.is_dir():
            raise CommandError(f"No photos folder at {photos}")
        user = complete_setup(
            email=options["email"],
            password=PASSWORD,
            display_name="Ada",
            household_name="Fern Gully",
        )
        household = user.memberships.get().household
        site = places.create_site(
            household, places.SiteData("Home", latitude=52.37, longitude=4.89, timezone=TIMEZONE)
        )
        rooms = {}
        for name, direction in (("Living room", Direction.SOUTH), ("Kitchen", Direction.EAST)):
            room = places.create_location(site, places.LocationData(name, LocationKind.INDOOR))
            window = places.create_light_source(
                room, places.LightSourceData(LightSourceKind.WINDOW, "Window", direction)
            )
            rooms[name] = (room, window)
        places.create_location(site, places.LocationData("Balcony", LocationKind.OUTDOOR))
        self._weather(household, site)

        water = CareType.objects.get(household=None, key="water")
        fertilize = CareType.objects.get(household=None, key="fertilize")
        now = timezone.now()
        for nickname, species, profile, room_name, photo, watering in PLANTS:
            room, window = rooms[room_name]
            taxon = Taxon.objects.filter(scientific_name=species).first() if species else None
            plant = plants.create_plant(
                household,
                plants.PlantData(
                    nickname=nickname,
                    location_id=room.pk,
                    taxon_id=taxon.pk if taxon else None,
                    care_profile_key=profile,
                    container_diameter_cm=14,
                    light_sources=[plants.PlantLightData(window.pk, distance_cm=100)],
                ),
            )
            with (photos / photo).open("rb") as file:
                plants.add_photo(plant, file, (photos / photo).stat().st_size)
            for care_type in (water, fertilize):
                schedule = schedules.create_schedule(
                    plant, schedules.ScheduleData(care_type.pk, ScheduleMode.PREDICTED)
                )
                if care_type == water:
                    days_ago = _watered_days_ago(watering, schedule.interval_days)
                else:
                    days_ago = FERTILIZED_DAYS_AGO
                log_care(
                    plant,
                    CareEventData(care_type.pk, performed_at=now - timedelta(days=days_ago)),
                    user,
                )
                schedules.recalculate(schedule)
        self.stdout.write(f"Made the demo household; sign in as {user.email}.")

    def _weather(self, household: Any, site: Any) -> None:
        """Turn the weather plugin on, with a stored forecast so nothing is fetched."""
        if "weather_openmeteo" not in registry.plugins:
            return
        from sunfleck_weather_openmeteo.models import SiteWeather

        plugin_services.update(household, "weather_openmeteo", True, {})
        today = timezone.now().astimezone(ZoneInfo(TIMEZONE)).date()
        days = []
        for offset in range(-3, 7):
            day: date = today + timedelta(days=offset)
            days.append(
                {
                    "date": day.isoformat(),
                    "min_c": 7.0 if offset != 1 else 1.0,  # frost likely tomorrow night
                    "max_c": 16.0,
                    "precipitation_mm": 2.4 if offset == 0 else 0.0,
                    "weather_code": 61 if offset == 0 else 2,
                    "dew_point_c": 6.0,
                    "et0_mm": 1.5,
                }
            )
        SiteWeather.objects.update_or_create(
            site=site,
            defaults={
                "data": {"temperature_c": 13.0, "weather_code": 61, "days": days},
                "fetched_at": datetime.now(tz=ZoneInfo("UTC")),
            },
        )


def _watered_days_ago(watering: str, interval_days: int | None) -> int:
    """How long ago to have watered, so the plant is due today, soon, or not for a while."""
    interval = interval_days or 14  # no watering now (a resting season): any will do
    if watering == DUE:
        return interval
    if watering == SOON:
        return max(interval - SOON_DAYS, 1)
    return WATERED_DAYS_AGO
