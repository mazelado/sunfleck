# Weather (Open-Meteo) for Sunfleck

A built-in [Sunfleck](../../README.md) plugin that brings in the weather from
[Open-Meteo](https://open-meteo.com), a free weather service that needs no account.

- **Today page:** each site's weather now, today's low and high, and rain.
- **Frost warnings:** when tonight's or the next two nights' low is at or below a temperature
  you choose (2 °C by default), for sites with outdoor locations.
- **Outdoor watering** (plants in outdoor locations with a predicted watering schedule):
  - put off for two days after rain (5 mm by default, over yesterday and today);
  - put off when that much rain is forecast for tomorrow (can be turned off);
  - sooner in a hot spell: 3% sooner per °C that the next three days' highs are above the care
    profile's ideal maximum, up to 25% sooner. Cool weather isn't counted, because the care
    profile's seasonal intervals already allow for it.

Admins turn it on for their household in **Settings → Plugins**. It's off until then.

## What it sends

To `api.open-meteo.com`, for each of the household's sites: **the site's latitude and longitude,
rounded to 2 decimals (about 1 km)**. Nothing else, and no account or key. The worker refreshes
each site's forecast once it's 3 hours old (it checks hourly); the Today page and plants'
schedules also fetch one if needed. See Open-Meteo's
[terms](https://open-meteo.com/en/terms): its free API is for non-commercial use.

If Open-Meteo can't be reached, the latest forecast is used for up to a day, and it isn't asked
again for 15 minutes. Admins see the error on the Plugins page.

## License

AGPL-3.0, like Sunfleck. Weather data by [Open-Meteo.com](https://open-meteo.com), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the Today page credits it.
