# Care profile review: November 2026, part 2

The second check of Sunfleck's care profiles against published sources, for the 1.2 Lavender
release ([roadmap](roadmap.md#lavender-trust-planned)). It covers the 22 profiles still marked
`draft` after [part 1](care-review-2026-11.md). **Proposed, not yet approved:** nothing in the
dataset changes until the maintainer has approved the citations and answered the
[decisions](#decisions-for-the-maintainer). Then the changes are applied, the profiles are
marked `reviewed`, and the dataset version is bumped.

- **Profiles:** `air_plant`, `bedding_annual`, `begonia_gesneriad`, `bog_carnivore`, `citrus`,
  `desert_cactus`, `easy_foliage`, `forest_cactus`, `fruiting_vegetable`,
  `humid_tropical_foliage`, `indoor_palm`, `leafy_herb`, `leafy_vegetable`, `low_light_tough`,
  `root_vegetable`, `semi_succulent_epiphyte`, `shade_perennial`, `spring_bulb`,
  `sun_perennial`, `temperate_shrub`, `tropical_fern`, `tropical_pitcher_plant`
- **Checked:** 2026-11-20, against the pages listed under [Sources](#sources), read in full.
  Every value below is in our own words; no text or table was copied.

**How to read the tables:** the same as in part 1. *Now* is the value in the dataset,
*Sources* is what they say (converted to the dataset's units), and *Proposed* is the value to
use. ✓ means the sources support the current value, **change** means they don't, and *not
sourced* means no source gives a number for it. *Described* means sources describe it in words
("bright, indirect light", "full sun") that back the value but don't set a number.

## How values were checked

- **Light** uses Purdue's DLI table ([P1](#sources)) as in part 1: *good* as `dli_min`, a
  value inside *high* as `dli_ideal`, and the top of *high* as `dli_max`. P1 covers about half
  of these profiles' example genera; the others have only descriptions. P1 is for greenhouse
  crops and stops at 30 mol/m²/day, so outdoor `dli_max` values above 30 stay *not sourced*.
- **Hardiness** for outdoor plants comes from the USDA zones the NC State Plant Toolbox lists:
  the lowest zone's lower bound in °C (zone 3 starts at −40 °C, zone 6 at −23 °C, zone 7 at
  −18 °C). Only `dli_ideal` and the ideal temperatures change what Sunfleck predicts; `min`,
  `max`, `dli_min` and `dli_max` are only shown.
- **Watering days** have no source for most profiles, as in part 1. Three do have them:
  `air_plant`, `forest_cactus` and `low_light_tough`, where sources say how often.
- **Outdoor watering** is mostly set by the soil water balance and the weather, so the days
  matter for plants in containers, which is what the profiles describe.

## Summary

| Profile | Changes proposed | Agrees with the sources | Not sourced |
|---|---|---|---|
| `air_plant` | watering days, `min` and `max` temperature | `let_dry`, light ideal, humidity | `dli_min`/`dli_max` |
| `bedding_annual` | `dli_min`; busy Lizzie's light (decision 1) | watering, temperature, feeding | `dli_max`, humidity |
| `begonia_gesneriad` | light, `min` temperature, feeding pause | `let_dry`, humidity, ideal temperature | watering days, `max` |
| `bog_carnivore` | add `part_shade` | watering, humidity, `min`, no feeding, dormancy | light numbers |
| `citrus` | `let_dry`, humidity, `min` temperature | ideal temperature, feeding (sources disagree) | light numbers, watering days |
| `desert_cactus` | none | all checked fields | light numbers, `max` |
| `easy_foliage` | `dli_min`, feeding | `let_dry`, light ideal, humidity, temperature | watering days |
| `forest_cactus` | light | watering days, `let_dry`, humidity, temperature, feeding | |
| `fruiting_vegetable` | `dli_min` | `let_dry`, light ideal, temperature, feeding | `dli_max`, `min` |
| `humid_tropical_foliage` | `dli_max`, feeding pause | `let_dry`, light ideal, humidity, temperature | watering days |
| `indoor_palm` | none | `let_dry`, humidity, temperature, feeding | light numbers, watering days |
| `leafy_herb` | feeding interval | `let_dry`, exposure | light numbers, humidity |
| `leafy_vegetable` | feeding interval | `let_dry`, exposure, ideal temperature | light numbers, `min`, `max` |
| `low_light_tough` | ideal temperature; *Aspidistra* (decision 3) | watering days, `let_dry`, humidity, feeding | light numbers |
| `root_vegetable` | none | `let_dry`, exposure | light numbers, temperature, feeding (decision 4) |
| `semi_succulent_epiphyte` | `let_dry`, `min` temperature, feeding interval | humidity, ideal temperature | light numbers, watering days |
| `shade_perennial` | `dli_min`, humidity; feeding (decision 2) | `let_dry`, light ideal, `min`, dormancy | |
| `spring_bulb` | `min` temperature | watering, exposure, `ideal_max`, feeding months, dormancy | light numbers |
| `sun_perennial` | `dli_min`, add `part_shade`; feeding (decision 2) | `let_dry`, light ideal, `min`, dormancy | `dli_max` |
| `temperate_shrub` | `dli_min` | `let_dry`, light ideal, exposure, `min` | feeding |
| `tropical_fern` | `let_dry`, `dli_min`, `dli_ideal` | humidity, temperature, feeding | |
| `tropical_pitcher_plant` | none | `let_dry`, humidity, temperature; no feeding (sources disagree) | light numbers |

## Indoor profiles

### air_plant (*Tillandsia*)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `completely` | Let them dry off between waterings, never keep them wet (RHS-AIR) | ✓ |
| `interval_days` | 7 / 5 / 7 / 10 | Immerse two to three times a week from spring to autumn, more often when hot and dry, less when cool (RHS-AIR); at least once a week (NCSU-T) | **change** to 4 / 3 / 4 / 7 |
| `dli_ideal` | 10 | Not in P1; bromeliads there: good 6, high 8–14. Bright, diffused light (RHS-AIR); high light to flower, and the sunniest window isn't too much (NCSU-T) | ✓ |
| `dli_min` / `dli_max` | 5 / 20 | As above; sources disagree about direct sun | keep, *not sourced* |
| `humidity` | `medium` | Dries out faster in low humidity, which needs more watering rather than a humid room (RHS-AIR) | ✓ |
| `temperature_c` | 10 / 15–30 / 35 | Best not below 12 °C; up to 30 °C if the air is humid (RHS-AIR) | **change** `min` to 12, `max` to 30, `ideal_max` to 27 to stay below it |
| `fertilizing` | 30 days, pause Nov–Feb | An occasional overnight soak with orchid fertilizer in summer (RHS-AIR) | ✓ |

### begonia_gesneriad (begonias, Cape primrose)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Moist but well drained (NCSU-BEG, RHS-BEG); cane begonias shouldn't dry out completely (RHS-BEG); African violets when the surface is dry (RHS-AFV) | ✓ |
| `interval_days` | 6 / 5 / 7 / 10 | Water regularly from March; in winter only when the compost is dry (RHS-STR) | keep, *not sourced* |
| `dli_ideal` | 8 | *Streptocarpus*: good 6, high 8–14; *Begonia* (Rieger) and *Sinningia*: good 6–8, high 10–16 (P1) | **change** to 10, inside all three |
| `dli_min` / `dli_max` | 4 / 14 | As above | **change** to 6 / 16 |
| `humidity` | `medium_high` | Partial shade and humid air; rex begonias need over 75% (NCSU-BEG); good humidity (RHS-BEG); African violets dislike dry air (RHS-AFV) | ✓ |
| `temperature_c` | 15 / 18–24 / 29 | Not below 55 °F, 13 °C (NCSU-BEG); winter minimum 13 °C, cane begonias 15–22 °C (RHS-BEG); 18–24 °C by day (RHS-AFV); *Streptocarpus* survives 7–10 °C (RHS-STR) | **change** `min` to 13; ideal ✓; `max` *not sourced* |
| `fertilizing` | 21 days, pause Dec–Jan | Fortnightly from March to September, none in autumn and winter (RHS-STR); every 3–4 weeks in spring and summer (RHS-AFV) | interval ✓; **change** pause to Oct–Feb |

### citrus

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Keep the compost just moist in summer and let the surface dry a little in winter (RHS-CIT); keep it moist (UMN-CIT); don't let it dry out (NCSU-CIT) | **change** to `top_quarter` |
| `interval_days` | 7 / 4 / 8 / 14 | Check daily in summer; err on the dry side in winter (RHS-CIT) | keep, *not sourced* |
| `dli_*` | 20 / 30 / 45 | Full sun (NCSU-CIT); some direct sun every day (UMN-CIT) | keep, *described* |
| `humidity` | `medium` | Humid conditions (NCSU-CIT); humidity matters, especially in heated rooms (RHS-CIT) | **change** to `medium_high` |
| `temperature_c` | 3 / 15–29 / 35 | Some lemons to 5 °C, kumquats 7 °C, limes and grapefruit 10 °C, calamondins 13 °C (RHS-CIT); 18 °C by day, a few degrees cooler at night (UMN-CIT) | **change** `min` to 5; ideal ✓; `max` *not sourced* |
| `fertilizing` | 21 days, pause Nov–Feb | All year, with a winter feed from November to mid-March (RHS-CIT); only while growing, April to September (UMN-CIT) | ✓, sources disagree |

### desert_cactus (*Mammillaria*, *Opuntia* and others)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `completely` | Dry out completely between waterings (UMN, NCSU-MAM) | ✓ |
| `interval_days` | 21 / 14 / 28 / 45 | In winter, only enough to stop shrivelling (UMN, RHS-CAC); none while dormant (NCSU-MAM) | keep, *not sourced* |
| `dli_*` | 15 / 25 / 45 | Full sun (NCSU-MAM); a bright, sunny window (UMN) | keep, *described* |
| `humidity` | `low` | Fine at 10–30% (UMN); low humidity (RHS-CAC) | ✓ |
| `temperature_c` | 5 / 18–30 / 38 | 21–27 °C while growing, 7–13 °C while dormant (NCSU-MAM); winter nights 8–10 °C (RHS-CAC) | ✓; `max` *not sourced* |
| `fertilizing` | 60 days, pause Oct–Mar | Once or twice a year in late spring or summer (UMN); monthly April to September (RHS-CAC) | ✓, between the two |
| `dormancy_months_north` | Nov–Feb | A rest from November to early March (RHS-CAC) | ✓ |

### easy_foliage (spider plant, tradescantia, pilea, ivy)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Spider plant just lightly moist (RHS-SPI); tradescantia dries between waterings (NCSU-TRA); pilea and ivy when the top few cm are dry (RHS-PIL, RHS-IVY) | ✓ |
| `interval_days` | 8 / 6 / 9 / 12 | Less in winter (NCSU-CHL, RHS-SPI, RHS-PIL) | keep, *not sourced* |
| `dli_ideal` | 9 | *Hedera*: good 6, high 8–30 (P1); bright indirect light, no direct sun for spider plant and pilea (NCSU-CHL, RHS-SPI, RHS-PIL) | ✓ |
| `dli_min` / `dli_max` | 4 / 18 | As above | **change** `dli_min` to 6; `dli_max` ✓ |
| `humidity` | `medium` | Medium humidity (NCSU-CHL); doesn't need high humidity (RHS-SPI); dry home air is fine (RHS-PIL) | ✓ |
| `temperature_c` | 10 / 16–26 / 30 | Spider plant above 7 °C (NCSU-CHL); pilea above 10 °C (RHS-PIL); tradescantia 18–24 °C (NCSU-TRA) | ✓ |
| `fertilizing` | 30 days, pause Nov–Feb | Every month or two, April to September (RHS-PIL); every other month, April to September, if at all (RHS-SPI); ivy seldom (RHS-IVY) | **change** to 60 days, pause Oct–Mar |

### forest_cactus (Christmas cactus, *Epiphyllum*)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_half` | When it's nearly dry (NCSU-SCH); let it dry between waterings (UMN-HOL); when it begins to dry, never completely (RHS-EPI) | ✓ |
| `interval_days` | 10 / 7 / 10 / 14 | About every 1–2 weeks (NCSU-SCH); less while resting (RHS-XC, RHS-EPI) | ✓, sourced |
| `dli_ideal` | 8 | *Schlumbergera*: good 6–8, high 10–30, which needs cool temperatures from 18 (P1); bright light, never direct sun (NCSU-SCH, RHS-XC); part shade outdoors (UMN-HOL) | **change** to 12, the low end of *high*, as sources warn against direct sun |
| `dli_min` / `dli_max` | 5 / 14 | As above | **change** to 6 / 18 |
| `humidity` | `medium_high` | High humidity (NCSU-SCH, UMN-HOL); moderate to high (RHS-EPI) | ✓ |
| `temperature_c` | 10 / 16–24 / 30 | *Epiphyllum* dies below 10 °C (RHS-EPI); 21–27 °C while growing (NCSU-SCH); 18–21 °C by day (UMN-HOL); dislikes very high temperatures (RHS-XC) | ✓ |
| `fertilizing` | 30 days, pause Oct–Jan | Monthly from June to August (UMN-HOL); sparingly every two weeks, early spring to autumn (RHS-EPI) | ✓ |

### humid_tropical_foliage (calathea, prayer plant, alocasia, fittonia)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Evenly moist in summer, surface dry in winter (RHS-CAL, NCSU-MAR); alocasia when the top 5 cm are dry (RHS-ALO); fittonia kept moist (RHS-FIT) | ✓ |
| `interval_days` | 5 / 4 / 6 / 8 | Less in winter (RHS-CAL, NCSU-MAR, RHS-ALO) | keep, *not sourced* |
| `dli_ideal` | 7 | *Maranta*: good 4, high 6–10 (P1); bright, no direct sun (RHS-CAL, RHS-ALO, RHS-FIT) | ✓ |
| `dli_min` / `dli_max` | 4 / 12 | As above | `dli_min` ✓; **change** `dli_max` to 10 |
| `humidity` | `high` | High humidity (NCSU-MAR, RHS-CAL, RHS-FIT); medium to high (RHS-ALO) | ✓ |
| `temperature_c` | 16 / 18–26 / 30 | 16–21 °C (RHS-CAL); above 16 °C while growing, above 10 °C at rest (RHS-ALO); thrives above 17 °C (RHS-FIT) | ✓; calatheas like a narrower range |
| `fertilizing` | 30 days, pause Nov–Feb | Monthly April to September, none October to March (RHS-CAL); April to October (RHS-ALO) | interval ✓; **change** pause to Oct–Mar |

### indoor_palm (parlour, kentia and lady palms)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | When the surface is dry (RHS-CHA); slightly dry between waterings (NCSU-CHA); never dry in summer, a little dry in winter (RHS-PALM) | ✓ |
| `interval_days` | 8 / 6 / 9 / 12 | Less in winter (RHS-CHA, NCSU-RHA) | keep, *not sourced* |
| `dli_*` | 4 / 8 / 15 | Bright indirect light; parlour, kentia and lady palms cope with quite low light (RHS-PALM, NCSU-CHA, NCSU-HOW, NCSU-RHA) | keep, *described* |
| `humidity` | `medium` | Low to medium (NCSU-CHA, NCSU-RHA); no need for high humidity, but misting stops brown tips (RHS-CHA) | ✓ |
| `temperature_c` | 12 / 18–27 / 32 | Winter nights at least 10–13 °C, 16 °C for parlour and kentia palms (RHS-PALM); 20–27 °C while growing (RHS-CHA); lady palm inside below 10 °C (NCSU-RHA); kentia takes up to 38 °C (NCSU-HOW) | ✓ |
| `fertilizing` | 30 days, pause Nov–Feb | Monthly spring to autumn (RHS-CHA); fortnightly April to mid-September (RHS-PALM); none in winter (NCSU-CHA) | ✓ |

### low_light_tough (ZZ plant, snake plant, cast iron plant)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `completely` | ZZ only when completely dry (NCSU-ZZ); snake plant only once dried out (RHS-SAN, NCSU-SAN); cast iron plant moist, not completely dry (RHS-ASP) | ✓, see decision 3 |
| `interval_days` | 21 / 14 / 21 / 30 | ZZ twice a month in summer, monthly in winter (NCSU-ZZ); snake plant every 1–2 months in winter (NCSU-SAN) | ✓, sourced |
| `dli_*` | 2 / 6 / 15 | Very low to bright indirect light; direct sun scorches (NCSU-ZZ, RHS-SAN, RHS-ASP) | keep, *described* |
| `humidity` | `low` | Never mist (RHS-SAN); low humidity (NCSU-SAN); dry air is fine (RHS-ASP) | ✓ |
| `temperature_c` | 10 / 18–27 / 32 | Snake plant 15–24 °C (RHS-SAN), tolerates about 10 °C (NCSU-SAN); cast iron plant 5–20 °C (RHS-ASP) | `min` ✓; **change** ideal to 15–24 |
| `fertilizing` | 60 days, pause Oct–Feb | ZZ once or twice a year (NCSU-ZZ); monthly April to September (RHS-SAN, RHS-ASP) | ✓, between the two |

### semi_succulent_epiphyte (hoya, peperomia)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `mostly` | Hoya moist in summer, fairly dry in winter (RHS-HOY), dry between waterings (NCSU-HOY); peperomia partly dry (RHS-PEP) | **change** to `top_half` |
| `interval_days` | 12 / 9 / 14 / 21 | Less in winter (RHS-HOY, RHS-PEP) | keep, *not sourced* |
| `dli_*` | 6 / 12 / 20 | Bright indirect light; hot summer sun scorches; winter sun is welcome (NCSU-HOY, RHS-HOY, RHS-PEP, NCSU-PEP) | keep, *described* |
| `humidity` | `medium` | Hoya likes humid air (NCSU-HOY, RHS-HOY); most peperomias are fine in normal home air (RHS-PEP, NCSU-PEP) | ✓, sources differ by genus |
| `temperature_c` | 12 / 18–27 / 32 | Hoya 16–24 °C, winter nights at least 10 °C (RHS-HOY, NCSU-HOY); peperomia 18–30 °C (RHS-PEP) | **change** `min` to 10; ideal ✓ |
| `fertilizing` | 30 days, pause Nov–Feb | Hoya every couple of weeks in spring and summer, monthly in winter (RHS-HOY); peperomia fortnightly April to October (RHS-PEP) | **change** interval to 14; pause ✓ |

### tropical_fern (Boston fern, maidenhair, bird's nest)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `keep_moist` | Never let it dry out (NCSU-NEP, RHS-FERN), but water again only when the surface starts to feel dry (UMN-FERN) | **change** to `top_quarter`, which fits both |
| `interval_days` | 4 / 3 / 5 / 7 | Less in winter (NCSU-NEP) | keep, *not sourced* |
| `dli_ideal` | 6 | *Pteris* and *Adiantum*: good 4, high 6–10; *Nephrolepis*: good 6, high 8–14 (P1); medium light, poor growth in low light (UMN-FERN) | **change** to 8, inside both |
| `dli_min` / `dli_max` | 3 / 10 | As above | **change** `dli_min` to 4; `dli_max` ✓ |
| `humidity` | `high` | High humidity (NCSU-NEP, UMN-FERN) | ✓ |
| `temperature_c` | 13 / 18–24 / 29 | Boston fern 16–21 °C (NCSU-NEP); away from cold draughts (RHS-FERN) | ✓; Boston fern likes it a little cooler |
| `fertilizing` | 30 days, pause Nov–Feb | Only while it's growing new fronds (UMN-FERN) | ✓ |

### tropical_pitcher_plant (*Nepenthes*)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `keep_moist` | Moist but well drained (NCSU-NPT); water from below while growing (RHS-CARN) | ✓ |
| `dli_*` | 6 / 10 / 16 | Bright light (NCSU-NPT); tropical carnivores want lower light than the bog kinds (RHS-CARN) | keep, *described* |
| `humidity` | `high` | Warm and humid (NCSU-NPT, RHS-CARN) | ✓ |
| `temperature_c` | 15 / 21–29 / 32 | Lowland kinds 21–35 °C; highland kinds 24–29 °C by day, about 16 °C at night (NCSU-NPT) | ✓ |
| `fertilizing` | none | Organic fertilizer while growing if it catches no insects (NCSU-NPT); carnivorous plants need none (RHS-CARN) | ✓, sources disagree |

## Indoor or outdoor

### bog_carnivore (Venus flytrap, pitcher plants, sundews)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `keep_moist` | Never let it dry out (NCSU-DIO); moist to wet, but not standing in water all the time (NCSU-SAR); stand in a saucer of rainwater while growing (RHS-CARN) | ✓ |
| `interval_days` | 2 / 1 / 2 / 7 | In winter, water when the compost starts to dry (RHS-CARN) | keep, *not sourced* |
| `dli_*` | 15 / 25 / 40 | Full sun to partial shade (NCSU-DIO, NCSU-SAR, RHS-CARN); indoors bright, not direct sun through glass (RHS-CARN) | keep, *described* |
| `outdoor_exposure` | `full_sun` | Full sun to partial shade (NCSU-DIO, NCSU-SAR, RHS-CARN) | **change** to add `part_shade` |
| `humidity` | `high` | High humidity (NCSU-DIO) | ✓ |
| `temperature_c` | −5 / 18–32 / 38 | *Sarracenia purpurea* to about −15 °C, *S. leucophylla* to about −5 °C (RHS-CARN); flytrap hardy in zone 7 (NCSU-DIO) | `min` ✓; others *not sourced* |
| `fertilizing` | none | Never fertilize (NCSU-DIO, NCSU-SAR, RHS-CARN) | ✓ |
| `dormancy_months_north` | Nov–Feb | Dormant from autumn to spring (NCSU-SAR); rest in winter (RHS-CARN) | ✓ |

### leafy_herb (basil, parsley, coriander, mint)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Indoors, when it's dry 1 cm down; never soggy, never wilting (UMN-HERB); parsley moist (RHS-PAR) | ✓ |
| `interval_days` | 4 / 2 / 4 / 7 | Containers may need water daily in hot weather (UMN-HERB) | keep, *not sourced* |
| `dli_*` | 12 / 17 / 30 | At least 6 hours of sun; indoors about 12 hours under lights (UMN-HERB) | keep, *described* |
| `outdoor_exposure` | full sun, part shade | Basil full sun to part shade (NCSU-BAS); parsley and mint either (RHS-PAR, RHS-MIN) | ✓ |
| `temperature_c` | 7 / 16–26 / 32 | Basil outdoors once nights stay above 10 °C (RHS-BAS); parsley, coriander, dill and chives tolerate cool soil (UMN-HERB) | ✓, see [noted for later](#noted-for-later) |
| `fertilizing` | 21 days, pause Nov–Feb | Lightly: half strength every six weeks in containers (UMN-HERB) | **change** interval to 42 |

## Outdoor profiles

### bedding_annual (petunia, marigold, busy Lizzie, pelargonium, nasturtium)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Busy Lizzies need moist soil (UMN-IMP, RHS-IMP); petunias and marigolds cope with drought better than with wet soil (UMN-PET, UMN-MAR) | ✓, sources differ by genus |
| `interval_days` | 3 / 2 / 3 / 7 | Containers may need water daily in summer (UMN-PET, RHS-ANN); beds weekly (UMN-PET) | ✓ for containers |
| `dli_ideal` | 25 | *Petunia*, *Tagetes*: good 12–16, high 18–30; zonal *Pelargonium*: high 14–30; *Impatiens*: good 6–8, high 10–22 (P1) | ✓; busy Lizzie, see decision 1 |
| `dli_min` / `dli_max` | 15 / 45 | As above | **change** `dli_min` to 12; `dli_max` *not sourced* |
| `outdoor_exposure` | full sun, part shade | Full sun for petunias and marigolds (UMN-PET, UMN-MAR); shade for busy Lizzies (UMN-IMP, RHS-IMP) | ✓ |
| `temperature_c` | 5 / 15–27 / 32 | Planted out after the last frost (UMN-PET, UMN-IMP); marigolds grown at 18–24 °C (UMN-MAR) | ✓; `max` *not sourced* |
| `fertilizing` | 14 days, all year | Containers every 2 weeks from July (UMN-PET); pelargoniums every 10–14 days (RHS-PEL); borders need none (RHS-ANN, RHS-NAS) | ✓ for containers |

### fruiting_vegetable (tomato, pepper, squash, beans)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Evenly moist; uneven watering splits fruit (RHS-TOM); water when it's dry 5 cm down (UMN-WAT) | ✓ |
| `interval_days` | 3 / 2 / 3 / 7 | Containers daily in hot weather (RHS-TOM); beds once or twice a week (UMN-WAT) | ✓ for containers |
| `dli_ideal` | 30 | Tomato and pepper: good 14–20, high 22–30 (P1) | ✓ |
| `dli_min` / `dli_max` | 20 / 50 | As above | **change** `dli_min` to 14; `dli_max` *not sourced* |
| `temperature_c` | 10 / 18–29 / 35 | Tomatoes ripen best at 20–25 °C and suffer in long spells above 29 °C by day; beans drop flowers above 35 °C (UMN-HEAT); peppers at 15 °C or more (RHS-PEPR) | ✓; `min` *not sourced* |
| `fertilizing` | 14 days, all year | Every 10–14 days once fruit swells (RHS-TOM); weekly once flowering (RHS-PEPR) | ✓ |

### leafy_vegetable (lettuce, spinach, cabbage, rocket)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `keep_moist` | Consistently moist, or it bolts (RHS-LET); a thirsty crop (RHS-SPN) | ✓ |
| `interval_days` | 3 / 2 / 3 / 5 | Containers daily in summer (RHS-LET) | ✓ for containers |
| `dli_*` | 12 / 17 / 25 | Sun, with light shade in midsummer (RHS-LET, RHS-SPN) | keep, *described* |
| `temperature_c` | 2 / 10–21 / 27 | Best at 10–21 °C (UMN-COOL); spinach 15–20 °C, bolts when hot and dry (RHS-SPN) | ideal ✓; `min`, `max` *not sourced* |
| `fertilizing` | 21 days, all year | None in the ground; fortnightly in containers in summer (RHS-LET) | **change** interval to 14 |

### root_vegetable (carrot, radish, beetroot)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Carrots seldom need water (RHS-CAR); radishes evenly moist (RHS-RAD); beetroot fairly moist, not too much (RHS-BEE) | ✓, between them |
| `interval_days` | 4 / 3 / 5 / 10 | Carrots a soak every two weeks in long dry spells (RHS-CAR) | keep, *not sourced* |
| `outdoor_exposure` | full sun, part shade | Sun; light shade for radishes in midsummer (RHS-RAD, RHS-BEE) | ✓ |
| `temperature_c`, `fertilizing` | | Not given by the sources read | *not sourced*, see decision 4 |

### shade_perennial (hosta, heuchera, hellebore, astilbe)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_quarter` | Moist, about 2.5 cm of water a week (UMN-HOS); slightly damp 15 cm down (RHS-HOS); astilbe rich, moist soil (RHS-AST); hellebores neither dry nor wet (RHS-HEL) | ✓ |
| `dli_ideal` | 10 | *Hosta*: good 6, high 8–30; *Heuchera*: good 6–8, high 10–18 (P1); dappled shade (NCSU-HOS, RHS-HEU, RHS-HEL) | ✓ |
| `dli_min` / `dli_max` | 5 / 20 | As above | **change** `dli_min` to 6; `dli_max` ✓ |
| `humidity` | `medium_high` | Most heucheras like fairly dry air (NCSU-HEU); nothing supports high humidity | **change** to `medium` |
| `temperature_c` | −25 / 10–24 / 30 | Hosta and heuchera hardy to zone 3, −40 °C (NCSU-HOS, NCSU-HEU) | `min` ✓, on the safe side; others *not sourced* |
| `fertilizing` | 60 days, pause Aug–Feb | Seldom needed in borders (RHS-HEU, RHS-HEL, RHS-PER) | see decision 2 |
| `dormancy_months_north` | Dec–Feb | Hostas need a few months below 4 °C (NCSU-HOS) | ✓ |

### spring_bulb (tulip, daffodil, hyacinth, crocus)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `interval_days` | 7 / – / 21 / – | Plenty of water while growing and for six weeks after flowering (RHS-BUL); none when rain keeps the ground damp (RHS-TUL); dry summers suit tulips (NCSU-TUL) | ✓ |
| `dli_*` | 15 / 25 / 40 | Full sun (NCSU-TUL, RHS-TUL); sun to part shade (NCSU-NAR, RHS-DAF) | keep, *described* |
| `temperature_c` | −20 / 5–20 / 27 | Tulips hardy to zone 3, daffodils to zone 4, −34 °C (NCSU-TUL, NCSU-NAR); tulips flower less once the soil reaches 21 °C (NCSU-TUL) | **change** `min` to −30; `ideal_max` ✓ |
| `fertilizing` | 30 days, pause Jun–Jan | High-potassium feed from when shoots appear until the leaves die down (RHS-BUL, RHS-DAF) | months ✓; interval *not sourced* |
| `dormancy_months_north` | Jun–Aug | Dormant once the leaves die down (RHS-BUL) | ✓ |

### sun_perennial (coneflower, black-eyed Susan, daylily, catmint)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Coneflowers and daylilies tolerate drought once established (NCSU-ECH, RHS-HEM); rudbeckias like moisture in summer, not wet soil in winter (RHS-RUD) | ✓ |
| `dli_ideal` | 30 | *Echinacea*, *Rudbeckia*, *Hemerocallis*: good 12–16, high 18–30 (P1) | ✓ |
| `dli_min` / `dli_max` | 20 / 50 | As above | **change** `dli_min` to 12; `dli_max` *not sourced* |
| `outdoor_exposure` | `full_sun` | Full sun to part shade (NCSU-ECH, NCSU-RUD, UMN-DAY, RHS-HEM) | **change** to add `part_shade` |
| `temperature_c` | −20 / 12–28 / 35 | Coneflower and rudbeckia hardy to zone 3 (NCSU-ECH, NCSU-RUD) | `min` ✓, on the safe side |
| `fertilizing` | 60 days, pause Aug–Feb | Most perennials need none (RHS-PER) | see decision 2 |

### temperate_shrub (hydrangea, rose, box, rhododendron, camellia)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Established roses rarely need water, weekly in dry summers (RHS-ROS); box only in long dry spells, never completely dry (RHS-BOX); rhododendrons regularly in dry spells from July (RHS-RHO) | ✓ |
| `dli_ideal` | 25 | *Hydrangea*: good 8–10, high 12–30; miniature roses: good 10–12, high 14–30 (P1) | ✓ |
| `dli_min` / `dli_max` | 15 / 45 | As above | **change** `dli_min` to 10; `dli_max` *not sourced* |
| `outdoor_exposure` | full sun, part shade | Hydrangeas light shade, no afternoon sun (NCSU-HYD, RHS-HYD); rhododendrons and camellias dappled shade (RHS-RHO, RHS-CAM) | ✓ |
| `temperature_c` | −20 / 10–25 / 32 | Bigleaf hydrangea hardy to zone 6, −23 °C (NCSU-HYD) | `min` ✓ |
| `fertilizing` | 60 days, pause Aug–Feb | Camellias in containers in early spring (RHS-CAM); no other source read | *not sourced* |

## Decisions for the maintainer

1. **Busy Lizzie (*Impatiens walleriana*) is a shade plant in a sun profile.** P1 rates
   *Impatiens* at good 6–8 and high 10–22, and UMN-IMP and RHS-IMP say it needs shade, while
   `bedding_annual` has an ideal of 25 and full sun. In a shady bed it would be shown as "too
   dark". Options:
   - **A. A species override to a new `shade_bedding` profile** (ideal light 16, part shade or
     shade, moist soil), for *I. walleriana* only. New Guinea impatiens and SunPatiens, which
     take sun, keep `bedding_annual`. Scope: a new profile file and one species line. Risk:
     low; only busy Lizzies change.
   - **B. A note on `bedding_annual`.** Scope: one line. Risk: the light check stays wrong
     for busy Lizzies.
   - **Recommendation: A.** It mirrors part 1's *Dracaena* decision.
2. **Most border perennials need no feeding.** RHS-PER, RHS-HEU and RHS-HEL say so, but
   `shade_perennial` and `sun_perennial` give a reminder every 60 days from March to July.
   Options:
   - **A. `fertilizing: null`**, with a note: "in poor soil, a balanced fertilizer in
     spring". Scope: two profiles. Risk: someone with poor soil gets no reminder, but the note
     tells them.
   - **B. Keep the reminders.** Scope: none. Risk: two or three reminders a year that the
     sources say aren't needed.
   - **C. A single spring feed**, which the dataset can't say yet (it only pauses feeding or
     doesn't). Scope: a schema and engine change. Risk: medium, for a small gain.
   - **Recommendation: A.** `temperate_shrub` stays as it is until a source covers it.
3. ***Aspidistra* likes moister soil than the rest of `low_light_tough`.** RHS-ASP says to
   keep it moist and not let it dry out completely; NCSU-ASP calls it drought tolerant.
   Options:
   - **A. Keep it, with a note** ("cast iron plants like a little more water than ZZ and
     snake plants"). Scope: one line. Risk: low, since it tolerates drought.
   - **B. Move it to `easy_foliage`** (`top_third`). Scope: one genus line. Risk: that profile
     expects more light than *Aspidistra* needs, so the light check would call a dim spot
     "too dark".
   - **Recommendation: A.**
4. **Reviewed with gaps.** In part 1, profiles were marked `reviewed` with watering days noted
   as estimates. Here, some fields have no source at all: light numbers for 12 profiles
   (described only), `root_vegetable`'s temperatures and feeding, and several `min` and `max`
   values. Options:
   - **A. Mark them `reviewed`, with a comment on each unsourced field**, as part 1 did for
     watering days. Scope: comments in the files. Risk: `reviewed` means "checked" rather
     than "every value sourced".
   - **B. Keep a profile `draft` while any field that changes predictions** (`dli_ideal`,
     ideal temperatures) **is unsourced.** Scope: about half these profiles stay drafts. Risk:
     slower progress, but clearer meaning.
   - **Recommendation: A**, consistent with part 1, and add to the dataset README that
     `reviewed` fields can be *described* rather than measured.

## Noted for later

Not decisions now, but things the sources show about how the profiles are grouped:

- **Basil is a warm-season herb; parsley, coriander, dill and chives are cool-season**
  (UMN-HERB, RHS-BAS). They share `leafy_herb`, so basil's 10 °C night minimum outdoors
  isn't shown.
- **Peas and strawberries** are in `fruiting_vegetable`, but peas are a cool-season crop and
  strawberries are perennials. Their crop timings already differ in `genera.yaml`.
- **Highland and lowland *Nepenthes*** want different nights (NCSU-NPT). One profile is
  enough while highland kinds are rare as houseplants.
- **Calathea and fittonia** want warmer, steadier temperatures than alocasia, which rests in
  winter (RHS-CAL, RHS-FIT, RHS-ALO).

## Teaching notes found on the way

- Christmas cacti flower after about six weeks of long nights or nights near 13 °C, and need
  two rests a year, in autumn and after flowering (UMN-HOL, RHS-XC, NCSU-SCH).
- *Epiphyllum* flowers after a winter at 11–14 °C (RHS-EPI).
- Spider plants make plantlets after three weeks of nights longer than 12 hours (NCSU-CHL).
- Air plants shouldn't be watered when it's below 12 °C, since they stay wet too long
  (RHS-AIR).
- Pale, dull spider plant leaves usually mean it needs water; yellow ones, more light
  (RHS-SPI).
- Uneven watering splits tomatoes, carrots, radishes and beetroot (RHS-TOM, RHS-CAR, RHS-RAD,
  RHS-BEE); dry spells make lettuce and spinach bolt (RHS-LET, RHS-SPN).
- Tomatoes suffer in long spells above 29 °C by day and 21 °C at night, and can drop their
  flowers (UMN-HEAT).
- Hostas scorch in sun; gold kinds colour best with 2–3 hours of morning sun (UMN-HOS).

## Sources

All accessed on 2026-11-20. Copyrighted pages: read, cited and written in our own words. P1
and UMN are the same sources as in [part 1](care-review-2026-11.md#sources).

| Key | Source |
|---|---|
| P1 | Torres, A.P. and R.G. Lopez. *Measuring Daily Light Integral in a Greenhouse* (HO-238-W). Purdue Extension. <https://www.extension.purdue.edu/extmedia/ho/ho-238-w.pdf> |
| UMN | *Cacti and succulents*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/cacti-and-succulents> |
| UMN-CIT | *Growing citrus indoors*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-citrus-indoors> |
| UMN-HOL | *Holiday cacti*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/holiday-cacti> |
| UMN-FERN | *Growing tropical ferns indoors*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/tropical-ferns> |
| UMN-HERB | *Growing herbs in home gardens*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-herbs> |
| UMN-HOS | *Hostas*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-hostas-in-minnesota> |
| UMN-PET | *Growing petunias*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-petunias> |
| UMN-MAR | *Marigolds*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/marigolds> |
| UMN-IMP | *Impatiens*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/impatiens> |
| UMN-DAY | *Daylilies*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/daylilies> |
| UMN-WAT | *Watering the vegetable garden*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/watering-the-vegetable-garden> |
| UMN-COOL | *Growing cool-season crops*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/yard-and-garden-problems/non-pest-issues-in-cool-season-crops> |
| UMN-HEAT | *How excessive heat affects the vegetable garden*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/yard-and-garden-problems/how-excessive-heat-affects-the-vegetable-garden> |
| NCSU-T | *Tillandsia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/tillandsia/> |
| NCSU-BEG | *Begonia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/begonia/> |
| NCSU-DIO | *Dionaea muscipula*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/dionaea-muscipula/> |
| NCSU-SAR | *Sarracenia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/sarracenia/> |
| NCSU-CIT | *Citrus*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/citrus/> |
| NCSU-MAM | *Mammillaria*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/mammillaria/> |
| NCSU-CHL | *Chlorophytum comosum*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/chlorophytum-comosum/> |
| NCSU-TRA | *Tradescantia zebrina*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/tradescantia-zebrina/> |
| NCSU-SCH | *Schlumbergera*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/schlumbergera/> |
| NCSU-MAR | *Maranta leuconeura*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/maranta-leuconeura/> |
| NCSU-CHA | *Chamaedorea elegans*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/chamaedorea-elegans/> |
| NCSU-HOW | *Howea forsteriana*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/howea-forsteriana/> |
| NCSU-RHA | *Rhapis excelsa*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/rhapis-excelsa/> |
| NCSU-ZZ | *Zamioculcas zamiifolia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/zamioculcas-zamiifolia/> |
| NCSU-SAN | *Dracaena trifasciata*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/dracaena-trifasciata/> |
| NCSU-ASP | *Aspidistra elatior*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/aspidistra-elatior/> |
| NCSU-HOY | *Hoya carnosa*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/hoya-carnosa/> |
| NCSU-PEP | *Peperomia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/peperomia/> |
| NCSU-NEP | *Nephrolepis exaltata*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/nephrolepis-exaltata/> |
| NCSU-NPT | *Nepenthes*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/nepenthes/> |
| NCSU-BAS | *Ocimum basilicum*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/ocimum-basilicum/> |
| NCSU-HOS | *Hosta*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/hosta/> |
| NCSU-HEU | *Heuchera*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/heuchera/> |
| NCSU-ECH | *Echinacea purpurea*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/echinacea-purpurea/> |
| NCSU-RUD | *Rudbeckia hirta*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/rudbeckia-hirta/> |
| NCSU-HYD | *Hydrangea macrophylla*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/hydrangea-macrophylla/> |
| NCSU-TUL | *Tulipa*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/tulipa/> |
| NCSU-NAR | *Narcissus*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/narcissus/> |
| RHS-AIR | *Air plants*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/houseplants/air-plants> |
| RHS-CARN | *How to grow carnivorous plants*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/carnivorous/growing-guide> |
| RHS-CAC | *How to grow cacti and succulents*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/cacti-succulents/houseplants/growing-guide> |
| RHS-EPI | *How to grow epiphyllum cacti*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/epiphyllum/growing-guide> |
| RHS-XC | *How to grow Christmas cactus*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/christmas-cactus/growing-guide> |
| RHS-CAL | *How to grow calatheas*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/calathea/growing-guide> |
| RHS-ALO | *How to grow alocasias*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/alocasia/growing-guide> |
| RHS-FIT | *How to grow fittonia*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/fittonia/how-to-grow-fittonia> |
| RHS-PALM | *Palms indoors*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/trees/indoor-palms> |
| RHS-CHA | *How to grow chamaedorea*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/chamaedorea/growing-guide> |
| RHS-ASP | *How to grow aspidistras*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/aspidistra/how-to-grow-aspidistras> |
| RHS-SAN | *How to grow sansevierias*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/sansevieria/growing-guide> |
| RHS-PEP | *How to grow peperomia*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/peperomia/how-to-grow-peperomia> |
| RHS-PIL | *How to grow pilea*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/pilea/how-to-grow-pilea> |
| RHS-SPI | *How to grow spider plants*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/spider-plants/growing-guide> |
| RHS-IVY | *How to grow ivy indoors*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/ivy/ivy-as-a-houseplant> |
| RHS-HOY | *How to grow hoya*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/hoya/growing-guide> |
| RHS-BEG | *Begonias as houseplants*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/begonias/houseplants> |
| RHS-AFV | *How to grow African violets*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/african-violets/growing-guide> |
| RHS-STR | *Streptocarpus*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/streptocarpus/growing-guide> |
| RHS-FERN | *Tender ferns*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/ferns/tender-ferns-houseplants> |
| RHS-CIT | *How to grow citrus*. Royal Horticultural Society. <https://www.rhs.org.uk/fruit/citrus/grow-your-own> |
| RHS-ANN | *How to grow annuals and biennials*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/annuals-biennials/growing-guide> |
| RHS-IMP | *How to grow Impatiens*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/impatiens/growing-guide> |
| RHS-NAS | *How to grow annual nasturtiums*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/nasturtiums/annual-nasturtiums/how-to-grow-annual-nasturtiums> |
| RHS-PEL | *How to grow pelargoniums*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/pelargonium/growing-guide> |
| RHS-HOS | *How to grow hostas*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/hosta/growing-guide> |
| RHS-HEU | *How to grow heuchera*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/heuchera/growing-guide> |
| RHS-HEL | *How to grow hellebores*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/hellebore/growing-guide> |
| RHS-AST | *How to grow astilbe*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/astilbe/growing-guide> |
| RHS-PER | *How to grow perennial plants*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/perennials/growing-guide> |
| RHS-RUD | *How to grow Rudbeckia*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/rudbeckia/growing-guide> |
| RHS-HEM | *How to grow hemerocallis*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/hemerocallis/growing-guide> |
| RHS-TUL | *How to grow tulips*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/tulip/growing-guide> |
| RHS-DAF | *How to grow daffodils*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/daffodils/growing-guide> |
| RHS-BUL | *How to grow bulbs*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/types/bulbs/growing-guide> |
| RHS-HYD | *How to grow shrubby hydrangeas*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/hydrangea/shrubby/growing-guide> |
| RHS-ROS | *How to grow roses*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/roses/growing-guide> |
| RHS-BOX | *How to grow box*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/box/growing-guide> |
| RHS-RHO | *How to grow rhododendrons*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/rhododendron/growing-guide> |
| RHS-CAM | *How to grow camellias*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/camellia/growing-guide> |
| RHS-TOM | *How to grow tomatoes*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/tomatoes/grow-your-own> |
| RHS-PEPR | *How to grow sweet peppers*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/peppers/grow-your-own> |
| RHS-LET | *How to grow lettuces*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/lettuce/grow-your-own> |
| RHS-SPN | *How to grow spinach*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/spinach/grow-your-own> |
| RHS-CAR | *How to grow carrots*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/carrots/grow-your-own> |
| RHS-RAD | *How to grow radishes*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/radishes/grow-your-own> |
| RHS-BEE | *How to grow beetroot*. Royal Horticultural Society. <https://www.rhs.org.uk/vegetables/beetroot/grow-your-own> |
| RHS-BAS | *How to grow basil*. Royal Horticultural Society. <https://www.rhs.org.uk/herbs/basil/grow-your-own> |
| RHS-PAR | *How to grow parsley*. Royal Horticultural Society. <https://www.rhs.org.uk/herbs/parsley/grow-your-own> |
| RHS-MIN | *How to grow mint*. Royal Horticultural Society. <https://www.rhs.org.uk/herbs/mint/grow-your-own> |

**Not found:** the NC State Plant Toolbox has no page for *Calathea*, *Petunia* or
*Epiphyllum* at the URLs tried, and its *Alocasia* and *Streptocarpus* pages list only light
and soil. The RHS has no growing guide for *Tillandsia*, *Nepenthes* or *Zamioculcas*; air
plants and carnivorous plants are covered by its group pages above.
