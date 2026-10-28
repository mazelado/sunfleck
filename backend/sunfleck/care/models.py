"""Care types (watering, fertilizing, ...), the care log, and care schedules."""

from datetime import date

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
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
    # Whether this is a kind of watering (the built-in "Water", or e.g. "Bottom water"): it
    # updates when a plant was last watered, and can carry soil feedback.
    counts_as_watering = models.BooleanField(_("counts as watering"), default=False)
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


class ScheduleMode(models.TextChoices):
    PREDICTED = "predicted", _("Predicted")
    FIXED = "fixed", _("Every few days")


class ScheduleOrigin(models.TextChoices):
    SUGGESTED = "suggested", _("Suggested")
    MANUAL = "manual", _("Added by hand")


class CareSchedule(models.Model):
    """When a plant needs a kind of care: predicted from its care profile and conditions, or
    every so many days. One per plant and care type.

    The latest prediction is kept here so that due care can be found with a query; each
    change is recorded as a ScheduleAdjustment.
    """

    plant = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name="schedules")
    care_type = models.ForeignKey(CareType, on_delete=models.CASCADE, related_name="schedules")
    mode = models.CharField(_("mode"), max_length=16, choices=ScheduleMode.choices)
    # Fixed schedules only.
    fixed_interval_days = models.PositiveSmallIntegerField(
        _("every (days)"),
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
    )
    origin = models.CharField(_("origin"), max_length=16, choices=ScheduleOrigin.choices)
    enabled = models.BooleanField(_("in use"), default=True)
    # Until the care is first logged, it's due counting from this day.
    started_on = models.DateField(_("started on"))
    # The latest prediction. No interval or due date: not needed for now (e.g. a resting
    # season, a pause in fertilizing, or the schedule isn't in use).
    interval_days = models.PositiveSmallIntegerField(null=True, blank=True)
    next_due = models.DateField(null=True, blank=True)
    factors = models.JSONField(default=list, blank=True)
    # Empty when something the prediction depends on changed: it's recalculated when next read.
    calculated_on = models.DateField(null=True, blank=True)
    # Put off until this day. A new due date (e.g. after the care is logged) ends the snooze.
    snoozed_until = models.DateField(_("snoozed until"), null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("care schedule")
        verbose_name_plural = _("care schedules")
        ordering = ["plant_id", "care_type_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["plant", "care_type"], name="care_schedule_unique_per_plant"
            ),
            models.CheckConstraint(
                condition=~Q(mode="fixed") | Q(fixed_interval_days__isnull=False),
                name="care_schedule_fixed_has_interval",
            ),
        ]
        indexes = [models.Index(fields=["next_due"], name="care_schedule_next_due")]

    def __str__(self) -> str:
        return f"{self.care_type} · {self.plant}"

    @property
    def due_on(self) -> date | None:
        """When the care is due, after any snooze; None if it isn't (or it's paused)."""
        if not self.enabled or self.next_due is None:
            return None
        if self.snoozed_until and self.snoozed_until > self.next_due:
            return self.snoozed_until
        return self.next_due


class ScheduleAdjustment(models.Model):
    """A change in a schedule's prediction, with the factors behind it: the "why", and a
    history for working out why a prediction changed."""

    schedule = models.ForeignKey(CareSchedule, on_delete=models.CASCADE, related_name="adjustments")
    calculated_at = models.DateTimeField()
    interval_days = models.PositiveSmallIntegerField(null=True, blank=True)
    next_due = models.DateField(null=True, blank=True)
    factors = models.JSONField(default=list, blank=True)

    class Meta:
        verbose_name = _("schedule adjustment")
        verbose_name_plural = _("schedule adjustments")
        ordering = ["-calculated_at", "-id"]

    def __str__(self) -> str:
        return f"{self.schedule} ({self.calculated_at:%Y-%m-%d})"
