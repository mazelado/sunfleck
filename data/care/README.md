# Sunfleck care dataset

Typical care for groups of plants ("care profiles"), and which genera and species belong to
each. Sunfleck uses it to suggest care routines and to predict when plants need care. It
works offline, with no account and no AI.

Licensed **[CC BY-SA 4.0](LICENSE)**, separately from the app's AGPL-3.0 code, so other
projects can reuse it: credit "Sunfleck care dataset contributors" and share improvements
under the same license. Why we write our own data rather than copy it is explained in
[docs/care-data-sources.md](../../docs/care-data-sources.md).

## What's here

| Path | Contents |
|---|---|
| `dataset.yaml` | The dataset's version. **Bump it with every change**: Sunfleck reloads the data when the version changes |
| `archetypes/*.yaml` | One care profile per file, named after its `key` |
| `genera.yaml` | Genera and common species, each linked to a care profile, with common names and older names (synonyms) |
| `schema/*.json` | [JSON Schema](https://json-schema.org/) that the files must match. The test suite checks them on every pull request |

## Care profiles (`archetypes/*.yaml`)

| Field | Meaning |
|---|---|
| `key` | Stable identifier, e.g. `tropical_aroid`. Never change it once released: plants refer to it |
| `name`, `description`, `notes` | Text per language code (`en` is required). Sunfleck shows the person's language, or English |
| `setting` | `indoor`, `outdoor`, or `either` |
| `examples` | Genera that typify the profile, or a species when no genus has the profile (rosemary, in *Salvia*). Each must be in `genera.yaml` with this profile |
| `watering.interval_days` | Typical days between waterings in spring, summer, autumn and winter, for a plant in an average pot and spot. `null` means only in long dry spells, or not at all while dormant. Sunfleck adjusts this for light, temperature, pot size, weather and feedback |
| `watering.let_dry` | How much soil should dry first: `keep_moist`, `top_quarter`, `top_third`, `top_half`, `mostly`, `completely` |
| `light.dli_min`, `dli_ideal`, `dli_max` | Daily light integral in mol/m²/day: roughly 2–6 is low light, 6–12 bright indirect light, 15+ direct sun |
| `light.outdoor_exposure` | For outdoor use: `full_sun`, `part_shade`, `shade` |
| `humidity` | `low`, `medium`, `medium_high`, `high` |
| `temperature_c` | `min` it survives, the `ideal_min`–`ideal_max` range, and the `max` it tolerates, in °C |
| `fertilizing` | `interval_days` while growing, and `pause_months_north` when not to feed. `null` means never fertilize |
| `dormancy_months_north` | Months of rest, if any |
| `status` | `draft` (written from general knowledge) or `reviewed` (checked against the cited sources). In a reviewed profile, `watering.interval_days` are still starting estimates unless a comment says otherwise: sources say how dry the soil should be before watering, not how many days apart. A comment above a field also marks values the sources describe only in words, or don't give at all |
| `sources` | Where the values come from. At least one |

Months are numbers (1 = January) **for the northern hemisphere**; Sunfleck shifts them by six
months for gardens in the southern hemisphere.

## Genera and species (`genera.yaml`)

```yaml
- genus: Dracaena
  family: Asparagaceae
  archetype: indoor_tree          # the care profile for the genus
  common_names:
    en: [dragon tree, dracaena]   # most common first
  species:
    - name: Dracaena trifasciata
      common_names:
        en: [snake plant]
      synonyms: [Sansevieria trifasciata]   # older names people still search by
      archetype: low_light_tough  # only when a species differs from its genus
```

- A species gets its genus's care profile unless it names its own.
- Write hybrids with ×: `Mentha × piperita`.
- A genus can have a `note` explaining something surprising. For example, *Sansevieria* is
  now part of *Dracaena*, but keeps its own entry because snake plants need much drier care.
- Each scientific name, synonym or not, may appear only once.

### Toxicity to pets

A genus or species can say it's **known to be toxic** to cats and dogs, with the source:

```yaml
- genus: Example
  toxicity:
    cats: toxic
    dogs: toxic
    sources:
      - https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/<entry>
    note:
      en: Insoluble calcium oxalates   # optional: what the source names as the toxic part
```

- **Only "toxic", never "safe".** Without `toxicity`, a plant's toxicity is *unknown*, and
  Sunfleck says exactly that. Even where a source lists a plant as non-toxic, it isn't recorded:
  a wrong "safe" can hurt a pet; a missing "toxic" only leaves the person to check.
- **Every flag has a source**: the page of the source's own entry for that plant. Check each
  entry by hand. The facts can be used, but the lists themselves are copyrighted: cite their
  entries, don't copy them wholesale.
  - **First, the [ASPCA Animal Poison Control](https://www.aspca.org/pet-care/aspca-poison-control)
    list** for cats and dogs.
  - **Only where the ASPCA has no entry,** the plant's page at the
    [NC State Extension Plant Toolbox](https://plants.ces.ncsu.edu/) or
    [Pet Poison Helpline](https://www.petpoisonhelpline.com/), and only when it says the plant
    is toxic to pets, cats or dogs. A page about people only isn't enough. Where it says
    "pets", record cats and dogs, unless it names one of them.
- **Genus or species:** put the flag on the genus only when the source lists its common
  species. When species differ, put it on those species. A species without its own
  `toxicity` takes its genus's.

### Harm to people

A genus or species can say it's **known to be harmful to people**: how serious it is if eaten,
whether touching it is a problem, or both, with its sources.

```yaml
- genus: Example
  harmful_to_people:
    if_eaten: medium     # low, medium or high, as the source rates it
    skin: true           # touching it, or its sap, irritates skin or causes an allergy
    sources:
      - https://plants.ces.ncsu.edu/plants/<genus-species>/
    note:
      en: Calcium oxalate crystals   # optional: what the source names as the toxic part
```

- **The same rules as for pets:** only "harmful", never "safe"; every entry has a source;
  on the genus only when the source covers the genus. A species without its own
  `harmful_to_people` takes its genus's. It's separate from `toxicity`, so a species' own pet
  entry doesn't hide its genus's entry for people.
- **Sources:** the plant's page at the
  [NC State Extension Plant Toolbox](https://plants.ces.ncsu.edu/) (its poison severity and
  whether it causes contact dermatitis), and the RHS's
  [potentially harmful garden plants](https://www.rhs.org.uk/prevention-protection/potentially-harmful-garden-plants),
  whose categories A, B and C are recorded as high, medium ("toxic if eaten") and low
  ("harmful if eaten") where NC State has no rating. Record `skin` when either says so.
- **Food crops and herbs** record `if_eaten` only where a part people might eat is harmful,
  and the note says which part (potato's leaves and green tubers, raw beans); otherwise only
  `skin`, where a source says so.
- The November 2026 review explains each entry:
  [toxicity to people](../../docs/toxicity-people-review-2026-11.md).

### Crop timing

A genus or species grown from seed in a season can say **when to sow, plant out and harvest
it**, in weeks from the site's typical frost dates. Sunfleck turns these into dates for each
place, for the sowing calendar.

```yaml
- name: Solanum lycopersicum
  crop:
    steps:                        # in order
    - action: sow_indoors         # sow_indoors, sow_outdoors or plant_out
      after: last_frost           # last_frost (spring) or first_frost (autumn)
      weeks: [-8, -6]             # from 8 to 6 weeks before it (negative is before)
    - action: plant_out
      after: last_frost
      weeks: [1, 3]
    harvest_days: [60, 85]        # from the last step to the first harvest; none for flowers
```

- A species without its own takes its genus's.
- **Draft:** these were written from general gardening knowledge for temperate climates, like
  the timings printed on seed packets, and haven't yet been checked against the sources
  (e.g. the RHS's and university extension services' growing guides). Corrections with a
  source are welcome.
- Perennials planted once (herbs such as rosemary, strawberries, fruit trees) have none.

## Contributing

This is a great place to help without writing code.

1. **Write values yourself.** Don't copy text or tables from websites or books: facts can't
   be copyrighted, but someone's compilation can. Read several sources, then write your own
   values.
2. **Cite your sources** in `sources`: a book, an extension service page, a botanical garden
   guide. When values have been checked against them, set `status: reviewed`.
3. **Bump the version** in `dataset.yaml`, e.g. `2026.10.0` → `2026.10.1`.
4. Run the checks (`make test`), or let the pull request's checks run them.

Every profile has been checked against sources, in November 2026: see the reviews,
[part 1](../../docs/care-review-2026-11.md) and [part 2](../../docs/care-review-2026-11-part-2.md),
for each value and where it came from. Some values still have no source, and say so in a
comment: a citation for one is a welcome contribution. Sunfleck learns from each plant's care
history, so the starting values only need to be reasonable, but citations and reviews make
them better for everyone.

Common names in other languages are welcome too: add them under their language code (`de`,
`fr`, `nl`, ...). The Spanish ones (`es`) come from Wikidata, which is CC0
([how they were chosen](../../docs/spanish-care-data-2026-11.md)). A plant without names in the
person's language is shown by its scientific name, never with names in another language.
