"""Sites, locations, and light sources.

All measurements are stored in metric units (°C, cm); the app converts them for display.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household


class Site(models.Model):
    """A physical place with plants, such as a home or an allotment.

    Weather, frost dates, daylight, and the time zone used for "today" all come from here.
    """

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="sites")
    name = models.CharField(_("name"), max_length=100)
    latitude = models.FloatField(
        _("latitude"), validators=[MinValueValidator(-90), MaxValueValidator(90)]
    )
    longitude = models.FloatField(
        _("longitude"), validators=[MinValueValidator(-180), MaxValueValidator(180)]
    )
    timezone = models.CharField(_("time zone"), max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("site")
        verbose_name_plural = _("sites")
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(latitude__gte=-90, latitude__lte=90), name="site_latitude_range"
            ),
            models.CheckConstraint(
                condition=Q(longitude__gte=-180, longitude__lte=180), name="site_longitude_range"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class LocationKind(models.TextChoices):
    INDOOR = "indoor", _("Indoor")
    OUTDOOR = "outdoor", _("Outdoor")


class Humidity(models.TextChoices):
    LOW = "low", _("Low")
    MEDIUM = "medium", _("Medium")
    HIGH = "high", _("High")


class Exposure(models.TextChoices):
    FULL_SUN = "full_sun", _("Full sun")
    PART_SHADE = "part_shade", _("Part shade")
    SHADE = "shade", _("Shade")


class Location(models.Model):
    """An area within a site where plants live: a room or shelf, or a bed or balcony."""

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="locations")
    name = models.CharField(_("name"), max_length=100)
    kind = models.CharField(_("kind"), max_length=16, choices=LocationKind.choices)
    # Indoor conditions (optional).
    temperature_min_c = models.FloatField(_("typical minimum temperature"), null=True, blank=True)
    temperature_max_c = models.FloatField(_("typical maximum temperature"), null=True, blank=True)
    humidity = models.CharField(_("humidity"), max_length=16, choices=Humidity.choices, blank=True)
    # Outdoor conditions (optional).
    exposure = models.CharField(
        _("sun exposure"), max_length=16, choices=Exposure.choices, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("location")
        verbose_name_plural = _("locations")
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(temperature_min_c__isnull=True)
                | Q(temperature_max_c__isnull=True)
                | Q(temperature_min_c__lte=models.F("temperature_max_c")),
                name="location_temperature_order",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.site} · {self.name}"


class Direction(models.TextChoices):
    NORTH = "N", _("North")
    NORTH_EAST = "NE", _("North-east")
    EAST = "E", _("East")
    SOUTH_EAST = "SE", _("South-east")
    SOUTH = "S", _("South")
    SOUTH_WEST = "SW", _("South-west")
    WEST = "W", _("West")
    NORTH_WEST = "NW", _("North-west")


class LightSourceKind(models.TextChoices):
    WINDOW = "window", _("Window")
    GROW_LIGHT = "grow_light", _("Grow light")


class LightSource(models.Model):
    """A window or grow light that lights an indoor location.

    Windows: the direction they face. How far each plant is from a window is stored per plant
    (see sunfleck.plants.models.PlantLight), since plants in one room sit at different spots.
    Grow lights: brightness at plant height (PPFD) and the daily on/off schedule.
    """

    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="light_sources")
    kind = models.CharField(_("kind"), max_length=16, choices=LightSourceKind.choices)
    name = models.CharField(_("name"), max_length=100, blank=True)
    # Windows.
    direction = models.CharField(
        _("direction it faces"), max_length=2, choices=Direction.choices, blank=True
    )
    # Grow lights.
    ppfd = models.PositiveIntegerField(
        _("PPFD at plant height (µmol/m²/s)"),
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(2500)],
    )
    on_time = models.TimeField(_("turns on at"), null=True, blank=True)
    off_time = models.TimeField(_("turns off at"), null=True, blank=True)
    enabled = models.BooleanField(_("in use"), default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("light source")
        verbose_name_plural = _("light sources")
        ordering = ["kind", "id"]

    def __str__(self) -> str:
        return self.name or self.get_kind_display()
