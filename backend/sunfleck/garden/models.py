"""The garden: seeds the household has, for the sowing calendar, and harvests."""

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household, User
from sunfleck.plants.models import Plant
from sunfleck.taxonomy.models import Taxon


class SeedPacket(models.Model):
    """Seeds the household has: a packet, or seeds saved from a plant."""

    household = models.ForeignKey(Household, on_delete=models.CASCADE, related_name="seeds")
    # The species, for its crop timing (when to sow and plant out).
    taxon = models.ForeignKey(
        Taxon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name=_("species"),
    )
    name = models.CharField(_("name"), max_length=100)
    variety = models.CharField(_("variety"), max_length=100, blank=True)
    quantity = models.CharField(_("how many"), max_length=50, blank=True)
    # The last year to sow them in, as printed on the packet.
    sow_by = models.PositiveSmallIntegerField(_("sow by"), null=True, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("seed packet")
        verbose_name_plural = _("seed packets")
        ordering = ["name", "variety"]

    def __str__(self) -> str:
        return f"{self.name} ({self.variety})" if self.variety else self.name

    @property
    def display_name(self) -> str:
        """The name with its variety, as people say it: Tomato 'Gardener's Delight'."""
        return f"{self.name} '{self.variety}'" if self.variety else self.name


class HarvestUnit(models.TextChoices):
    GRAMS = "g", _("grams")
    KILOGRAMS = "kg", _("kilograms")
    OUNCES = "oz", _("ounces")
    POUNDS = "lb", _("pounds")
    PIECES = "pieces", _("pieces")
    BUNCHES = "bunches", _("bunches")


# Grams in each unit of weight, to add harvests up.
GRAMS_PER_UNIT = {"g": 1.0, "kg": 1000.0, "oz": 28.349523125, "lb": 453.59237}


class Harvest(models.Model):
    """What was picked from a plant, and when."""

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="harvests")
    harvested_on = models.DateField(_("harvested on"))
    # How much, if it was counted or weighed.
    amount = models.DecimalField(
        _("amount"),
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    unit = models.CharField(_("unit"), max_length=16, choices=HarvestUnit.choices, blank=True)
    notes = models.TextField(_("notes"), blank=True)
    logged_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("harvest")
        verbose_name_plural = _("harvests")
        ordering = ["-harvested_on", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__isnull=True) | ~Q(unit=""), name="harvest_amount_has_unit"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.plant} · {self.harvested_on}"
