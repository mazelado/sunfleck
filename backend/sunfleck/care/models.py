"""Care types (watering, fertilizing, ...) and the care log."""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household
from sunfleck.plants.models import Plant


class CareType(models.Model):
    """A kind of care. Built-in types (water, fertilize, ...) have a `key` and no household; a
    household can add its own, which have a name and no key."""

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, null=True, blank=True, related_name="care_types"
    )
    # Built-in types only. The app shows their names in the person's language using this key.
    key = models.SlugField(_("key"), max_length=32, blank=True)
    name = models.CharField(_("name"), max_length=50)
    # One of the icon names the app knows; it falls back to a generic icon for unknown ones.
    icon = models.CharField(_("icon"), max_length=32, default="sparkles")
    # Whether this care changes when other care is due (used by the prediction engine).
    affects_prediction = models.BooleanField(_("affects predictions"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("care type")
        verbose_name_plural = _("care types")
        # Built-ins first, in their defined order. (Databases disagree on where empty values
        # sort, so say it explicitly.)
        ordering = [models.F("household_id").asc(nulls_first=True), "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["key"],
                condition=Q(household__isnull=True),
                name="care_type_builtin_key_unique",
            ),
            models.CheckConstraint(
                condition=Q(household__isnull=True) | Q(key=""),
                name="care_type_custom_has_no_key",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_builtin(self) -> bool:
        return self.household_id is None


class Feedback(models.TextChoices):
    """How the soil was when watering, which tunes future watering predictions."""

    TOO_DRY = "too_dry", _("Too dry")
    JUST_RIGHT = "just_right", _("Just right")
    STILL_WET = "still_wet", _("Still wet")


class CareEvent(models.Model):
    """Care given to a plant (or skipped on purpose, e.g. the soil was still wet)."""

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="care_events")
    care_type = models.ForeignKey(CareType, on_delete=models.PROTECT, related_name="events")
    performed_at = models.DateTimeField(_("done at"))
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="care_events",
    )
    notes = models.TextField(_("notes"), blank=True)
    feedback = models.CharField(
        _("how was the soil?"), max_length=16, choices=Feedback.choices, blank=True
    )
    skipped = models.BooleanField(_("skipped"), default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("care event")
        verbose_name_plural = _("care events")
        ordering = ["-performed_at", "-id"]
        indexes = [models.Index(fields=["plant", "-performed_at"], name="care_event_plant_time")]

    def __str__(self) -> str:
        return f"{self.care_type} · {self.plant} ({self.performed_at:%Y-%m-%d})"
