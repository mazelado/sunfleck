"""Each household's choices for each plugin."""

from django.db import models
from django.utils.translation import gettext_lazy as _

from sunfleck.accounts.models import Household


class PluginSetting(models.Model):
    """Whether a plugin is on for a household, its settings, and its latest error.

    Without a row, a plugin is on only if it says so (`enabled_by_default`), with its default
    settings.
    """

    household = models.ForeignKey(
        Household, on_delete=models.CASCADE, related_name="plugin_settings"
    )
    plugin_id = models.CharField(_("plugin"), max_length=64)
    enabled = models.BooleanField(_("on"), default=False)
    settings = models.JSONField(_("settings"), default=dict, blank=True)
    # Secret settings (e.g. API keys), each encrypted (see sunfleck.core.crypto).
    secrets = models.JSONField(_("secrets"), default=dict, blank=True)
    # The latest exception from one of the plugin's hooks, for the Admin to see.
    last_error = models.TextField(_("latest error"), blank=True)
    last_error_at = models.DateTimeField(_("latest error at"), null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("plugin setting")
        verbose_name_plural = _("plugin settings")
        ordering = ["household_id", "plugin_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "plugin_id"], name="plugin_setting_unique_per_household"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.plugin_id} · {self.household}"
