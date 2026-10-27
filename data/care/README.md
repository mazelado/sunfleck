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
| `examples` | Genera that typify the profile. Each must be in `genera.yaml` with this profile |
| `watering.interval_days` | Typical days between waterings in spring, summer, autumn and winter, for a plant in an average pot and spot. `null` means only in long dry spells, or not at all while dormant. Sunfleck adjusts this for light, temperature, pot size, weather and feedback |
| `watering.let_dry` | How much soil should dry first: `keep_moist`, `top_quarter`, `top_third`, `top_half`, `mostly`, `completely` |
| `light.dli_min`, `dli_ideal`, `dli_max` | Daily light integral in mol/m²/day: roughly 2–6 is low light, 6–12 bright indirect light, 15+ direct sun |
| `light.outdoor_exposure` | For outdoor use: `full_sun`, `part_shade`, `shade` |
| `humidity` | `low`, `medium`, `medium_high`, `high` |
| `temperature_c` | `min` it survives, the `ideal_min`–`ideal_max` range, and the `max` it tolerates, in °C |
| `fertilizing` | `interval_days` while growing, and `pause_months_north` when not to feed. `null` means never fertilize |
| `dormancy_months_north` | Months of rest, if any |
| `status` | `draft` (written from general knowledge) or `reviewed` (checked against the cited sources) |
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

## Contributing

This is a great place to help without writing code.

1. **Write values yourself.** Don't copy text or tables from websites or books: facts can't
   be copyrighted, but someone's compilation can. Read several sources, then write your own
   values.
2. **Cite your sources** in `sources`: a book, an extension service page, a botanical garden
   guide. When values have been checked against them, set `status: reviewed`.
3. **Bump the version** in `dataset.yaml`, e.g. `2026.10.0` → `2026.10.1`.
4. Run the checks (`make test`), or let the pull request's checks run them.

Today every profile is a `draft`: sensible starting values written from general horticultural
knowledge. Sunfleck learns from each plant's care history, so the starting values only need to
be reasonable, but citations and reviews make them better for everyone.

Common names in other languages are welcome too: add them under their language code (`de`,
`fr`, `nl`, ...).
