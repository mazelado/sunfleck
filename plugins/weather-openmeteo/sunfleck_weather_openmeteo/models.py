"""The latest weather for each site."""

from django.db import models
from sunfleck.places.models import Site


class SiteWeather(models.Model):
    """The latest forecast for a site from Open-Meteo, and when it was fetched.

    `data` is the forecast as `weather.Forecast.to_json` stores it: current conditions and a
    day-by-day forecast, from a few days ago to a week ahead.
    """

    site = models.OneToOneField(Site, on_delete=models.CASCADE, related_name="openmeteo_weather")
    data = models.JSONField(default=dict)
    fetched_at = models.DateTimeField(null=True, blank=True)
    # The latest failed fetch, so a service that's down isn't asked again straight away.
    failed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "site weather"
        verbose_name_plural = "site weather"

    def __str__(self) -> str:
        return f"Weather · {self.site}"
