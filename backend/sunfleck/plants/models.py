"""Plants, the light that reaches each of them, and their photos.

All measurements are stored in metric units (cm); the app converts them for display.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household
from sunfleck.places.models import LightSource, Location
from sunfleck.taxonomy.models import CareArchetype, Taxon


class PlantStatus(models.TextChoices):
    ACTIVE = "active", _("Active")
    DORMANT = "dormant", _("Dormant")
    GIFTED = "gifted", _("Given away")
    DECEASED = "deceased", _("Died")


# Plants that are looked after: they get care, schedules and reminders.
CARED_FOR = [PlantStatus.ACTIVE, PlantStatus.DORMANT]


class ContainerMaterial(models.TextChoices):
    """What the plant grows in. Porous pots (terracotta, fabric) dry out faster."""

    PLASTIC = "plastic", _("Plastic")
    TERRACOTTA = "terracotta", _("Terracotta")
    GLAZED_CERAMIC = "glazed_ceramic", _("Glazed ceramic")
    FABRIC = "fabric", _("Fabric")
    METAL = "metal", _("Metal")
    WOOD = "wood", _("Wood")
    OTHER = "other", _("Other")
    IN_GROUND = "in_ground", _("In the ground")


class SoilType(models.TextChoices):
    POTTING_MIX = "potting_mix", _("Potting mix")
    AROID_MIX = "aroid_mix", _("Chunky aroid mix")
    CACTUS_MIX = "cactus_mix", _("Cactus and succulent mix")
    ORCHID_BARK = "orchid_bark", _("Orchid bark")
    SPHAGNUM = "sphagnum", _("Sphagnum moss")
    SEMI_HYDRO = "semi_hydro", _("Semi-hydro (LECA, pon)")
    WATER = "water", _("Water")
    GARDEN_SOIL = "garden_soil", _("Garden soil")
    OTHER = "other", _("Other")


class Plant(models.Model):
    """An individual plant."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="plants")
    # Deleting a location keeps its plants; they just have no location until they're moved.
    location = models.ForeignKey(
        Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="plants"
    )
    nickname = models.CharField(_("name"), max_length=100)
    taxon = models.ForeignKey(
        Taxon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plants",
        verbose_name=_("species"),
    )
    # The care profile chosen for this plant; without one, its species' profile applies.
    care_profile = models.ForeignKey(
        CareArchetype,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plants",
        verbose_name=_("care profile"),
    )
    status = models.CharField(
        _("status"), max_length=16, choices=PlantStatus.choices, default=PlantStatus.ACTIVE
    )
    container_diameter_cm = models.PositiveIntegerField(
        _("pot diameter (cm)"),
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(500)],
    )
    container_height_cm = models.PositiveIntegerField(
        _("pot height (cm)"),
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(500)],
    )
    container_material = models.CharField(
        _("pot material"), max_length=16, choices=ContainerMaterial.choices, blank=True
    )
    soil_type = models.CharField(_("soil"), max_length=16, choices=SoilType.choices, blank=True)
    acquired_on = models.DateField(_("acquired on"), null=True, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    cover_photo = models.ForeignKey(
        "Photo", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    light_sources = models.ManyToManyField(
        LightSource, through="PlantLight", related_name="plants", blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("plant")
        verbose_name_plural = _("plants")
        ordering = ["nickname", "id"]

    def __str__(self) -> str:
        return self.nickname

    @property
    def effective_care_profile(self) -> CareArchetype | None:
        """The chosen care profile, else the species' profile."""
        return self.care_profile or (self.taxon.archetype if self.taxon else None)


class PlantLight(models.Model):
    """A window or grow light that reaches a plant.

    The light source belongs to the plant's location and can reach several plants; how far
    each plant is from a window is stored here.
    """

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="light_links")
    light_source = models.ForeignKey(
        LightSource, on_delete=models.CASCADE, related_name="plant_links"
    )
    # Windows only.
    distance_cm = models.PositiveIntegerField(
        _("distance from the window (cm)"),
        null=True,
        blank=True,
        validators=[MaxValueValidator(10_000)],
    )

    class Meta:
        verbose_name = _("light reaching a plant")
        verbose_name_plural = _("light reaching plants")
        ordering = ["light_source__kind", "light_source_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["plant", "light_source"], name="plant_light_unique_per_plant"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.light_source} → {self.plant}"


def photo_path(photo: "Photo", filename: str) -> str:
    """Store each household's photos in its own folder: photos/<household id>/<file>."""
    return f"photos/{photo.plant.household_id}/{filename}"


class Photo(models.Model):
    """A photo of a plant, resized, with its metadata (EXIF) removed.

    Photos are private to the household, so they're served through the API with a permission
    check rather than as public media files.
    """

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(_("image"), upload_to=photo_path)
    thumbnail = models.ImageField(_("thumbnail"), upload_to=photo_path)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    taken_at = models.DateTimeField(_("taken at"))
    caption = models.CharField(_("caption"), max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("photo")
        verbose_name_plural = _("photos")
        ordering = ["-taken_at", "-id"]

    def __str__(self) -> str:
        return self.caption or f"{self.plant} ({self.taken_at:%Y-%m-%d})"
