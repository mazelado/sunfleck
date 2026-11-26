# Care profile review: November 2026

The first check of Sunfleck's care profiles against published sources, for the 1.2 Lavender
release ([roadmap](roadmap.md#lavender-trust-released)). It covers the six profiles used by the
maintainer's plants. **Approved and applied on 2026-11-16** (dataset 2026.11.4): every change
proposed below, with the decisions at the end. The eight profiles involved, including two new
ones, are now marked `reviewed`.

- **Plants:** aloe vera, avocado, bromeliad (*Guzmania*), dragon tree (*Dracaena marginata*),
  flaming Katy (*Kalanchoe blossfeldiana*), golden pothos, lavender, moth orchid, rosemary
- **Profiles:** `tropical_aroid`, `indoor_tree`, `succulent`, `epiphytic_orchid`, `bromeliad`,
  `mediterranean_herb`
- **Checked:** 2026-11-15, against the pages listed under [Sources](#sources), read in full.
  Every value below is in our own words; no text or table was copied.

**How to read the tables:** *Now* is the value in the dataset, *Sources* is what they say
(converted to the dataset's units), and *Proposed* is the value to use. ✓ means the sources
support the current value, **change** means they don't, and *not sourced* means no source
gives a number for it.

## How light was checked

Sources give light in three ways, converted like this:

- **Purdue's DLI table** ([P1](#sources)) rates greenhouse crops by daily light integral
  (DLI): the level for *minimum acceptable*, *good* and *high* quality. The proposals use
  *good* as `dli_min`, the middle of *high* as `dli_ideal`, and the top of *high* as
  `dli_max`. Greenhouse values seldom go above 25, so the table stops at 30.
- **Foot-candles** (UF/IFAS, AOS) are converted with Purdue's factor for sunlight: 1 fc ≈
  0.2 µmol/m²/s ([P1](#sources), Table 1), so 150 fc for 12 hours a day is about
  1.3 mol/m²/day.
- **Descriptions** ("bright, indirect light", "full sun") back a value but don't set one.

Only `dli_ideal` changes what Sunfleck does: the light check compares a spot with it, and so
does the watering prediction. `dli_min` and `dli_max` are only shown.

## Summary

| Profile | Changes proposed | Agrees with the sources | Not sourced |
|---|---|---|---|
| `tropical_aroid` | `let_dry`, `dli_max` | light ideal, temperatures, humidity, fertilizing | watering intervals |
| `indoor_tree` | Light is too high for *Dracaena* (decision 1) | temperatures, `let_dry`, fertilizing | watering intervals |
| `succulent` | none | all checked fields | watering intervals, `max` temperature |
| `epiphytic_orchid` | `dli_max`, winter watering | temperatures, humidity, fertilizing, `let_dry` | |
| `bromeliad` | `dli_min`, `dli_max`, `min` temperature | watering, humidity, fertilizing | |
| `mediterranean_herb` | `dli_min` | most fields; the two plants disagree on some (decision 4) | `dli_max` |

## tropical_aroid (golden pothos)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | Water when the soil is dry (PSU); let it dry between waterings (NCSU); does better "a little on the dry side" (UF2) | **change** to `top_half` |
| `interval_days` | 7 / 6 / 9 / 12 | No source gives days; water less in autumn and winter (PSU) | keep, *not sourced* |
| `dli_ideal` | 10 | Pothos isn't in P1. Two other aroids there, *Aglaonema* and *Dieffenbachia*: good from 6, high 8–14 | ✓ 10 |
| `dli_min` | 6 | As above: good from 6. Indoors it keeps its colour from 150 fc (≈1.3 mol at 12 h) and survives 50 fc (UF2) | ✓ 6 |
| `dli_max` | 20 | Aroids in P1 top out at 14 | **change** to 14 |
| `humidity` | `medium_high` | Raise humidity with a humidifier or pebble tray (NCSU); grown at 60–100% (UF2) | ✓ |
| `temperature_c` | 13 / 18–27 / 32 | 60–80 °F, 16–27 °C (PSU); 70–80 °F indoors (UF2); damage after hours at 33–40 °F; growth suffers above 95 °F, 35 °C (UF2) | ✓ |
| `fertilizing.interval_days` | 30 | Every 2 weeks, monthly in winter (PSU); every other month, none in winter (NCSU) | ✓ 30, sources disagree |
| `pause_months_north` | Nov–Feb | NCSU: none in winter; PSU: monthly in winter | ✓, sources disagree |

## indoor_tree (dragon tree, avocado)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_third` | *Dracaena marginata*: dry between waterings, but not severely (NCSU-D). Avocado: neither soaking nor completely dry (RHS-A) | ✓ |
| `interval_days` | 9 / 7 / 10 / 14 | No source gives days; avocado: less in winter (RHS-A) | keep, *not sourced* |
| `dli_ideal` | 14 | *Dracaena*: good from 6, high 8–14 (P1). *Ficus benjamina*, the profile's first example: good 12–16, high from 18. Avocado: full sun (NCSU-P) | **decision 1** |
| `dli_min` / `dli_max` | 8 / 25 | As above | **decision 1** |
| `humidity` | `medium` | Avocado likes humid air: mist it or use a pebble tray (RHS-A) | ✓ for *Dracaena*, see decision 2 |
| `temperature_c` | 12 / 18–27 / 32 | *Dracaena*: 70–80 °F indoors, shipped at 55–65 °F (UF3). Avocado: 13–18 °C in winter (RHS-A) | ✓ |
| `fertilizing` | 30 days, pause Nov–Feb | *D. marginata*: little fertilizer, spring to autumn (NCSU-D). Avocado: also every 6–8 weeks in winter (RHS-A) | ✓ for *Dracaena*, see decision 2 |

## succulent (aloe vera, flaming Katy)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `completely` | Let the soil dry completely (UMN, NCSU-AV, RHS-U); flaming Katy: dry out between waterings, then water deeply (NCSU-K) | ✓ |
| `interval_days` | 14 / 10 / 18 / 28 | In winter, only enough to stop it shrivelling (UMN); very sparingly when dormant (RHS-AV) | keep, *not sourced* |
| `dli_ideal` | 18 | *Kalanchoe*: good 6–8, high 10–22; *Sedum*: good 12–16, high from 18 (P1). Aloe: full to partial sun (NCSU-AV, PSU-AV) | ✓ |
| `dli_min` / `dli_max` | 10 / 35 | As above | ✓ |
| `humidity` | `low` | Suited to dry indoor air (UMN); doesn't need humidity, and misting risks rot (RHS-U); *Kalanchoe* likes it fairly dry (ILL-K) | ✓ |
| `temperature_c` | 5 / 15–27 / 35 | Aloe: 13–27 °C (RHS-U), survives cold but not freezing, 1–5 °C (RHS-AV); flaming Katy: 60 °F at night, 70 °F by day (NCSU-K) | ✓; `max` *not sourced* |
| `fertilizing` | 60 days, pause Oct–Feb | 3–4 times in the bright months (UMN); monthly May–Aug (RHS-AV); spring and late summer (RHS-U) | ✓ |

Flaming Katy grows best in less light than the other succulents (P1), and prolonged direct sun
can scorch it (NCSU-K). The profile's ideal still falls inside its *high* range, so it stays.

## epiphytic_orchid (moth orchid)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `mostly` | Water again only when nearly dry; never let it dry out completely (AOS, RHS-O) | ✓ |
| `interval_days` | 7 / 6 / 8 / 12 | Weekly in the growing season, slightly less in winter (RHS-O) | **change** winter to 10 |
| `dli_ideal` | 7 | *Phalaenopsis*: minimum 2, good 4, high 6–10 (P1). Under lights, growth from 2,000 lux, good from 10,000 lux (AOS) | ✓ |
| `dli_min` | 4 | As above | ✓ |
| `dli_max` | 12 | As above | **change** to 10 |
| `humidity` | `medium_high` | 50–80% (AOS) | ✓ |
| `temperature_c` | 15 / 18–28 / 32 | Nights above 60 °F, days 75–85 °F, at most 90–95 °F; 55 °F nights for a few weeks help it flower (AOS). 16–19 °C at night, 19–30 °C by day (RHS-O) | ✓ |
| `fertilizing` | 14 days, pause Dec–Jan | Twice a month when growing (AOS); lightly and regularly, sparingly if at all in winter (RHS-O) | ✓ |

## bromeliad (*Guzmania*)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `top_half` | Compost damp in summer, dry between waterings in winter; keep the central cup filled (RHS-B) | ✓ |
| `interval_days` | 10 / 7 / 10 / 14 | Once every week or two (UF1) | ✓ |
| `dli_ideal` | 9 | Bromeliads: minimum 4, good 6, high 8–14 (P1); bright light without direct sun (UF1, RHS-B) | ✓ |
| `dli_min` | 5 | As above | **change** to 6 |
| `dli_max` | 16 | As above | **change** to 14 |
| `humidity` | `medium_high` | Likes humid air, such as a bathroom (RHS-B) | ✓ |
| `temperature_c` | 13 / 18–27 / 32 | At least 10 °C in winter; about 21 °C in summer (RHS-B); empty the cup below 40 °F (UF1) | **change** `min` to 10 |
| `fertilizing` | 60 days, pause Nov–Feb | Every 1–2 months at a third to half strength, little or none in winter; rarely needed indoors (UF1) | ✓ |

## mediterranean_herb (lavender, rosemary)

| Field | Now | Sources | Proposed |
|---|---|---|---|
| `let_dry` | `mostly` | Lavender in pots: water once or twice a week in hot weather, when the compost starts to dry (RHS-L). Rosemary indoors: don't let it dry out completely (ILL-H) | ✓ |
| `interval_days` | 7 / 5 / 9 / 14 | Lavender: once or twice a week in hot summers (RHS-L) | ✓ |
| `dli_ideal` | 22 | Lavender and thyme: minimum 8–10, good 12–16, high 18–30 (P1) | ✓ |
| `dli_min` | 15 | As above | **change** to 12 |
| `dli_max` | 40 | P1 stops at 30, since greenhouses seldom go higher; outdoors in full sun can | keep, *not sourced* |
| `humidity` | `low` | Rosemary dislikes humid conditions (NCSU-R); indoors, rosemary likes a cool, sunny spot with humid air (ILL-R) | **decision 4** |
| `temperature_c` | −10 / 15–28 / 35 | Rosemary: hardy in most of the UK (RHS-R), not reliably hardy in USDA zone 6 or colder (ILL-R); indoor herbs: 60–70 °F (ILL-H) | ✓ |
| `fertilizing` | 60 days, pause Oct–Mar | Rosemary: regular feeding gives the best leaves (ILL-R); lavender: prefers poor soil (RHS-L) | **decision 4** |

## Decisions for the maintainer

1. **Dragon trees need half the light of the profile's ideal.** Purdue rates *Dracaena* with
   *Aglaonema*, *Dieffenbachia* and bromeliads (ideal about 10), while *Ficus benjamina*, in
   the same profile, needs about 18. Today, a dragon tree in a spot of 7 mol/m²/day is shown
   as "a bit low", though Purdue rates that as good. Options:
   - **A. Move *Dracaena* to its own profile** (shade-tolerant foliage: ideal 10, drier soil,
     medium humidity). Scope: a new profile file and genus mapping. Risk: low; plants follow
     their species.
   - **B. Lower the whole `indoor_tree` profile** to ideal 10. Scope: two numbers. Risk:
     Ficus and avocados would be told they get enough light when they don't.
   - **Recommendation: A.** It fits what the sources say about both groups.
2. **Avocado differs from *Dracaena* in humidity and winter feeding** (RHS-A). With decision
   1A, `indoor_tree` would hold the brighter trees, and could become `medium_high` humidity
   and feed lightly in winter. Not urgent: avocados grown from seed usually decline indoors
   after a few years anyway (RHS-A).
3. **Watering intervals in days have no source** for most profiles. Sources say *when* to
   water (how dry the soil is), not how often; the days are starting estimates that each
   plant's feedback corrects. Should a profile be marked `reviewed` with its intervals noted
   as estimates, or stay `draft` until a source gives days?
4. **Rosemary and lavender disagree** on humidity indoors and on feeding. Keep one profile and
   note the difference in the profile's notes (smaller change), or give rosemary its own
   profile (more accurate, and another profile to maintain)?

### Decided (2026-11-16)

1. **A:** *Dracaena* has its own profile, `dracaena`: ideal light 10 (good from 6, at most
   14), medium humidity, the soil a little dry between waterings, and a note on fluoride
   (P1, UF3, NCSU-D). The snake plant keeps `low_light_tough`.
2. **Avocado stays in `indoor_tree`**, now the profile for brighter trees: light 10 / 16 / 25
   (*Ficus* and *Schefflera* in P1; full sun for avocado, NCSU-P) and `medium_high` humidity
   (low humidity dries and shrivels *Ficus* leaves, UF4; avocados like humid air, RHS-A). Its
   winter feeding (every 6–8 weeks, RHS-A) can't be said in the dataset's fields yet, which
   only pause feeding or don't.
3. **Reviewed, with day counts as estimates.** A comment above each reviewed profile's
   `interval_days` says so, and the dataset README says it for every reviewed profile.
4. **Rosemary has its own profile**, `rosemary`, for *Salvia rosmarinus*: the soil only half
   dry, medium humidity, ideal 15–24 °C, monthly feeding (ILL-R, ILL-H, NCSU-R, RHS-R), and
   the herbs' light from P1. A profile's examples may now name a species, since no genus has
   this profile. Lavender, sage and the other herbs keep `mediterranean_herb`.

## Teaching notes found on the way

Things the sources say that would make good "why" or "next step" text later:

- Pothos kept in low light keeps going, but loses its variegation and grows smaller leaves (UF2).
- A bromeliad's central cup should hold water, be emptied and refilled every month or two,
  and never get fertilizer (UF1, RHS-B).
- A moth orchid flowers again after a few weeks of nights near 55 °F (13 °C) in autumn (AOS,
  NCSU-O).
- Flaming Katy flowers again after about six weeks of long nights (ILL-K).
- Water orchids without fertilizer every fourth time, to wash out salts (RHS-O).

## Sources

All accessed on 2026-11-15. Copyrighted pages: read, cited and written in our own words.

| Key | Source |
|---|---|
| P1 | Torres, A.P. and R.G. Lopez. *Measuring Daily Light Integral in a Greenhouse* (HO-238-W). Purdue Extension. <https://www.extension.purdue.edu/extmedia/ho/ho-238-w.pdf> |
| UF1 | Park Brown, S. *Bromeliads at a Glance* (ENH1071/EP337). UF/IFAS Extension. <https://ask.ifas.ufl.edu/publication/EP337> |
| UF2 | McConnell, D.B., J. Chen, R.J. Henny and K.C. Everitt. *Cultural Guidelines for Commercial Production of Interiorscape Epipremnum* (ENH894/EP151). UF/IFAS Extension. <https://ask.ifas.ufl.edu/publication/EP151> |
| UF3 | McConnell, D.B., J. Chen, R.J. Henny and K.C. Everitt. *Cultural Guidelines for Commercial Production of Interiorscape Dracaena* (ENH892/EP149). UF/IFAS Extension. <https://ask.ifas.ufl.edu/publication/EP149> |
| PSU | *Pothos as a Houseplant*. Penn State Extension. <https://extension.psu.edu/pothos-as-a-houseplant> |
| PSU-AV | *Aloe, a Hardy Houseplant*. Penn State Extension. <https://extension.psu.edu/aloe-a-hardy-houseplant> |
| NCSU | *Epipremnum aureum*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/epipremnum-aureum/> |
| NCSU-D | *Dracaena marginata*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/dracaena-marginata/> |
| NCSU-P | *Persea americana*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/persea-americana/> |
| NCSU-AV | *Aloe vera*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/aloe-vera/> |
| NCSU-K | *Kalanchoe blossfeldiana*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/kalanchoe-blossfeldiana/> |
| NCSU-O | *Phalaenopsis*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/phalaenopsis/> |
| NCSU-R | *Salvia rosmarinus*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/salvia-rosmarinus/> |
| UMN | *Cacti and succulents*. University of Minnesota Extension. <https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/cacti-and-succulents> |
| ILL-K | *A nontraditional holiday plant: Kalanchoe* (2025). Illinois Extension. <https://extension.illinois.edu/blogs/good-growing/2025-12-19-nontraditional-holiday-plant-kalanchoe> |
| ILL-R | *Rosemary*. Illinois Extension. <https://extension.illinois.edu/herbs/rosemary> |
| ILL-H | *Herbs all winter: grow them indoors* (2021). Illinois Extension. <https://extension.illinois.edu/blogs/flowers-fruits-and-frass/2021-01-08-herbs-all-winter-grow-them-indoors> |
| AOS | *Phalaenopsis Culture Sheet*. American Orchid Society. <https://www.aos.org/orchid-care/care-sheets/phalaenopsis-culture-sheet> |
| RHS-O | *How to grow Phalaenopsis (moth orchids)*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/phalaenopsis/growing-guide> |
| RHS-B | *How to grow bromeliads*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/bromeliads/growing-guide> |
| RHS-A | *How to grow avocados*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/avocado/growing-guide> |
| RHS-AV | *Aloe vera*. Royal Horticultural Society plant details. <https://www.rhs.org.uk/plants/981/aloe-vera/details> |
| RHS-U | *Houseplants for sunlight* (RHS Urban Show 2024). Royal Horticultural Society. <https://www.rhs.org.uk/shows-events/rhs-urban-show/houseplant-profiles/houseplants-for-sunlight> |
| RHS-L | *How to grow lavender*. Royal Horticultural Society. <https://www.rhs.org.uk/plants/lavender/growing-guide> |
| RHS-R | *How to grow rosemary*. Royal Horticultural Society. <https://www.rhs.org.uk/herbs/rosemary/grow-your-own> |
| UF4 | Chen, J., D.B. McConnell, R.J. Henny and K.C. Everitt. *Cultural Guidelines for Commercial Production of Interiorscape Ficus* (ENH879/EP136). UF/IFAS Extension. <https://ask.ifas.ufl.edu/publication/EP136> |
| NCSU-L | *Lavandula angustifolia*. NC State Extension Plant Toolbox. <https://plants.ces.ncsu.edu/plants/lavandula-angustifolia/> |

**Couldn't be read from this session:** Clemson HGIC (blocked by its firewall), Missouri
Botanical Garden and the Bromeliad Society International (no response). None of the proposals
rely on them.
