# Weather (Open-Meteo) for Sunfleck

A built-in [Sunfleck](../../README.md) plugin that brings in the weather from
[Open-Meteo](https://open-meteo.com), a free weather service that needs no account.

- **Today page:** each site's weather now, today's low and high, and rain.
- **Frost warnings:** when tonight's or the next two nights' low is at or below a temperature
  you choose (2 °C by default), for sites with outdoor locations.
- **Outdoor watering** (plants in outdoor locations with a predicted watering schedule): a
  soil water balance from the evapotranspiration and rain since the plant was last watered,
  and in the forecast (see [the formula](#the-water-balance)). Without evapotranspiration data
  (forecasts stored before Sunfleck 0.6), rules of thumb instead:
  - put off for two days after rain (5 mm by default, over yesterday and today);
  - put off when that much rain is forecast for tomorrow (can be turned off);
  - sooner in a hot spell: 3% sooner per °C that the next three days' highs are above the care
    profile's ideal maximum, up to 25% sooner. Cool weather isn't counted, because the care
    profile's seasonal intervals already allow for it.

Admins turn it on for their household in **Settings → Plugins**. It's off until then.
**Test** checks that Open-Meteo can be reached from your server.

## What it sends

To `api.open-meteo.com`, for each of the household's sites: **the site's latitude and longitude,
rounded to 2 decimals (about 1 km)**. Nothing else, and no account or key. The worker refreshes
each site's forecast once it's 3 hours old (it checks hourly); the Today page and plants'
schedules also fetch one if needed. See Open-Meteo's
[terms](https://open-meteo.com/en/terms): its free API is for non-commercial use.

**Test** asks for the weather at a fixed place (Greenwich, London), not at your sites.

If Open-Meteo can't be reached, the latest forecast is used for up to a day, and it isn't asked
again for 15 minutes. Admins see the error on the Plugins page.

## The water balance

A simplified version of the FAO-56 method
([Allen et al., 1998](https://www.fao.org/4/x0490e/x0490e00.htm)), for each outdoor plant:

1. **Water stored:** the soil holds what Sunfleck already counts for water amounts: the depth
   that may dry between waterings (a share of the pot's height from the care profile's "let
   dry", or of 30 cm of roots in the ground, at most 10 cm), times 20% of it as water a plant
   can use. 10 cm of soil holds 20 mm.
2. **Water used:** each day, Open-Meteo's reference evapotranspiration (ET₀, FAO-56
   Penman-Monteith, in mm) times the plant's water use, from its care profile's "let dry":
   1.0 for plants kept moist, 0.9 a quarter, 0.8 a third, 0.7 half, 0.5 mostly, 0.4 completely.
   (FAO-56 calls this the crop coefficient.)
3. **Rain:** each day's rain beyond the first 2 mm, which mostly wets leaves and evaporates,
   goes back into the soil, up to what it holds.
4. **Due:** counting from the day after the last watering (or from the forecast's first day,
   31 days back, if it was longer ago), measured days then forecast ones, the plant is due the
   day the water stored runs out, or the day after the forecast if it doesn't.
5. **Limits:** Sunfleck keeps that day between half and double the interval it works out
   otherwise, so one odd forecast can't go too far.

**Why?** on the plant's page shows the numbers: the water taken since watering, the rain, what
the soil holds, and the day it's dry. These are rough, like the rest of Sunfleck's estimates:
log how the soil felt when you water, and the schedule adapts.

## License

AGPL-3.0, like Sunfleck. Weather data by [Open-Meteo.com](https://open-meteo.com), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the Today page credits it.
