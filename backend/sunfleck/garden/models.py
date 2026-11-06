"""The garden: seeds the household has, for the sowing calendar."""

from django.db import models
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household
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
