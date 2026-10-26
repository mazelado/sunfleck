# Care Data Sources and Licensing

> **Status:** Decided: Option C, dataset licensed CC BY-SA 4.0 · **Last updated:** 2026-10-26
>
> *This is a technical analysis, not legal advice. Before bundling any third-party data,
> confirm its license from the provider's own current terms, ideally in writing.*

## The question

Automatic care routines are a core MVP feature: you add a plant and the app suggests watering,
fertilizing, and light needs. That requires **care data per species**: watering needs, light,
humidity, temperature, toxicity, dormancy. Where can that data come from under terms that are
compatible with an AGPL-3.0 project that anyone can self-host?

## Why licensing matters here

The AGPL covers our **code**. Data has its own license. What matters is how we use the data:

| How we use the data | What we need |
|---|---|
| **Bundle it** in our repo or Docker image | A license that allows redistribution, including by people who sell hosting or support. In practice: **public domain / CC0, CC BY, CC BY-SA, ODbL**. "Non-commercial" (NC) licenses are **not acceptable**: they restrict what users of free software may do, which conflicts with AGPL freedoms. |
| **Fetch it at runtime** from an API, using the user's own account or key, stored only in that user's own instance | Only the API's terms of use matter, and it's the user's agreement with the provider. Much more flexible, but the feature then depends on that service staying online and free. |
| **Generate it** with an AI model in the user's own instance | No third-party data license involved, but accuracy must be reviewed and AI must stay optional. |

## Sources evaluated

| Source | Data license | Care fields | Fit |
|---|---|---|---|
| **WCVP / POWO** (Kew) | CC BY (per dataset metadata) | None. Taxonomy, accepted names, synonyms, native ranges | ✅ **Taxonomy backbone** (bundle or fetch) |
| **GBIF backbone** | CC BY / CC0 (per dataset) | None. Taxonomy, occurrences, images (licensed per image) | ✅ Taxonomy and images |
| **Wikidata** | CC0 | Common names in many languages, links, some traits | ✅ Common names (great for i18n) |
| **Wikipedia** | CC BY-SA | Descriptive text | ◐ Runtime links/excerpts only |
| **USDA PLANTS** | U.S. government data, generally public domain (verify the "Conditions of Use" page) | Shade tolerance, moisture use, drought tolerance, pH, hardiness. U.S. native and outdoor plants | ◐ Useful for **outdoor** plants; weak for houseplants |
| **Trefle** | No blanket license. Each value carries its upstream source's license; attribution required | Light and humidity on the Ellenberg scale (1–9), minimum temperature, size, toxicity | ◐ Runtime plugin. Ellenberg values describe wild habitats, so coverage of tropical houseplants is sparse |
| **Open Plantbook** | **Unclear.** Its builder has said informally that the data can be used "for any purpose", but there is no formal license | Min/max light (lux), soil moisture, temperature, humidity, conductivity | ◐ Good **runtime plugin** (free account). Ask the maintainer for a formal license before bundling anything |
| **Perenual** | Proprietary; free tier is non-commercial, limited to 100 requests/day and species IDs 1–3000 | Watering, sunlight, indoor/outdoor, toxicity, care level. The most complete care content | ◐ Optional **runtime plugin** with the user's own key. Never bundle |
| **Plantfolio common plants** (GitHub) | **CC BY-NC-SA 4.0** | ~950 plants: seasonal watering intervals, light, humidity, temperature, toxicity, hardiness zones | ❌ The ideal shape, but **NC prevents bundling**. We could ask the author about relicensing |
| **GrowSpot light dataset** | CC BY 4.0 | Species light tiers with lux boundaries; published light figures with sources | ✅ Can seed **light requirements** (with attribution) |
| **PFAF** (Plants For A Future) | Text claims CC BY 4.0 / share-alike; images NC. The terms page is inconsistent | Moisture, shade, hardiness, soil. Edible and useful outdoor plants | ◐ Outdoor/edible reference; verify terms first |
| **Permapeople** | Reportedly CC BY-SA 4.0, commercial use restricted (unverified) | Light, humidity, watering, toxicity. Garden/permaculture | ◐ Verify terms first |
| **OpenFarm** | Shut down April 2025. A community rescue recovered ~340 crop records as CC0 | Vegetable growing guides | ◐ Small CC0 seed set for edibles |
| **ASPCA toxic plant list** | Copyrighted website (facts themselves aren't copyrightable, but don't copy the compilation) | Toxicity to cats, dogs, horses | ◐ Link to it as a reference; don't scrape it |

## Conclusion

**No single source provides openly licensed, houseplant-quality care data that we can
bundle.** The most complete care data is either proprietary (Perenual), non-commercial
(Plantfolio), or has no formal license (Open Plantbook). The openly licensed sources cover
taxonomy and names well, but care data poorly. This is probably why most open-source plant
apps either just log care (Plant-it) or depend on a commercial API.

## Options

### Option A: Depend on a third-party care API (Perenual, Open Plantbook)
- **Scope:** small. Write an API client and map its fields.
- **Risk:** **high.** The core feature breaks if the service changes terms, adds a paywall,
  rate-limits us, or shuts down. OpenFarm shut down in 2025, and Trefle calls itself "beta".
  Every user must also sign up for an account before the core feature works.

### Option B: AI-generated care profiles only
- **Scope:** small to medium. Write a prompt, a structured output schema, and a review screen.
- **Risk:** **medium-high.** The core feature only works if AI is configured, which breaks our
  "AI is optional" principle. Small local models may give wrong values, especially for
  toxicity.

### Option C (recommended): Our own open care dataset, plus optional providers
A layered approach, where each layer fills in what the one below lacks:

1. **Built-in care archetypes** (bundled, our own work, CC0 or CC BY-SA). There are around
   30–50 care "types": *succulent*, *cactus*, *tropical aroid*, *fern*, *epiphytic orchid*,
   *Mediterranean herb*, *annual vegetable*, *temperate shrub*, and so on. Each one has
   seasonal watering intervals, light range (as a DLI range), humidity, temperature,
   fertilizing cadence, and dormancy. Care needs are mostly shared within these groups, so
   **a small, hand-written table covers most plants reasonably well from day one.**
2. **Genus-level mappings** (bundled, our own work). For example, *Monstera → tropical aroid*,
   *Echeveria → succulent*, plus overrides where a genus differs. A few hundred genera cover
   nearly all common houseplants and garden plants. Toxicity flags are added here with a
   cited reference for each.
3. **Taxonomy from WCVP/GBIF and names from Wikidata** (open licenses). Lets users search by
   common or scientific name in many languages, and resolves synonyms so that renamed
   species still map to the right genus.
4. **Optional provider plugins** (runtime only, user's own key): Open Plantbook, Perenual,
   Trefle. When enabled, they refine the archetype values for a specific species.
5. **Optional AI suggestion** (runtime only): the AI proposes a care profile or picks an
   archetype for an unusual plant. The user reviews and confirms it.
6. **The plant's own history.** The prediction engine learns from what actually happens
   (see below), so the starting profile only needs to be *reasonable*, not perfect.

- **Scope:** medium. We write and maintain the archetype table and genus mappings. This is
  also a great first contribution area for plant enthusiasts who don't code.
- **Risk:** **low.** We control the license. The core feature works offline, without AI and
  without any account. External services can only make it better.

**Recommendation: Option C.** It's the only option where the core feature is guaranteed to
keep working, and it fits the "everything optional stays optional" principle. The dataset
should live in its own folder (or later its own repository) with its own data license, so
other projects can reuse it.

> **Decided (2026-10-26):** Option C. Our care dataset is licensed **CC BY-SA 4.0**, so anyone
> may reuse it with attribution, and improvements must be shared under the same license. It
> is kept separate from the AGPL-3.0 code, with its own `LICENSE` file in the dataset folder.

## How this feeds care prediction

The "AI" that predicts care needs doesn't have to be a large language model. For the MVP, it's
a transparent, testable engine:

```
predicted interval = archetype baseline
                     × season / dormancy factor
                     × light factor        (DLI from window direction or grow light schedule)
                     × temperature factor  (indoor setting, or outdoor weather)
                     × container factor    (pot size and material)
                     adjusted by weather   (outdoor: rainfall and evapotranspiration from Open-Meteo)
                     adjusted by history   (learned from the user's actual care log and feedback,
                                            e.g. "soil was still wet" / "too dry")
```

Every prediction can show *why* ("watering moved 2 days later: cooler weather and lower
light"), which builds trust and makes the logic easy to test. Machine learning models can be
added later as plugins, once real usage data exists.

## Next steps

1. ~~Decide the data license for our own dataset.~~ CC BY-SA 4.0.
2. Draft the archetype schema and the first ~30 archetypes, citing general horticultural
   references for each value (and writing every value ourselves, not copying).
3. Contact the **Open Plantbook** maintainer to ask for a formal data license.
4. Optionally, ask the **Plantfolio** author whether they would offer a CC BY-SA or CC0
   license.
5. Record the decision as an Architecture Decision Record (`docs/adr/`).

## Sources

- Kew data terms: [kew.org terms of use](https://www.kew.org/node/2426),
  [POWO about](https://powo.science.kew.org/about),
  [WCVP in Catalogue of Life](https://www.catalogueoflife.org/data/dataset/2232)
- Trefle: [terms](https://trefle.io/terms), [data provenance](https://docs.trefle.io/docs/advanced/data-provenance)
- Open Plantbook: [pyopenplantbook on PyPI](https://pypi.org/project/pyopenplantbook/),
  [HA community post](https://community.home-assistant.io/t/cloud-plant-db-with-api-for-plantcard/225207)
- Comparison of plant APIs by another open-source project:
  [PflanzenDex issue #599](https://github.com/PflanzenDex/PflanzenDex/issues/599)
- Plantfolio: [Luminoid/plantfolio-common-plants](https://github.com/Luminoid/plantfolio-common-plants)
- GrowSpot: [growspot-light-dataset](https://github.com/ranson0318-dot/growspot-light-dataset)
- PFAF: [copyright page](https://pfaf.org/User/cmspage.aspx?pageid=136)
- OpenFarm: [sunsetting announcement](https://farm.bot/blogs/news/sunsetting-openfarm),
  [crop data rescue](https://growingfruit.org/t/openfarms-crop-data-restored-in-website/81182)
