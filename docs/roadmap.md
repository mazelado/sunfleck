# Roadmap

Where Sunfleck is going after its first release. The order and scope are a plan, not a
promise: they change as we learn what matters most. Ideas and feedback are welcome in the
[issues](https://github.com/mazelado/sunfleck/issues).

- [Versions and release names](#versions-and-release-names)
- [Release plan](#release-plan)
- [Phases](#phases)

## Versions and release names

**Version numbers** follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- A release with **new features** raises the minor version (0.1 → 0.2).
- A release with **only fixes** raises the patch version (0.2.0 → 0.2.1).
- Before 1.0, a minor release may also change how things work. Anything you need to know or do
  is in the [changelog](../CHANGELOG.md) under that version.
- **1.0** is the first release with stable promises: a stable API and plugin interface, and
  upgrades that keep working.

**Release names:** each minor version has a plant name, in alphabetical order, kept by its
patch releases (0.2.0 and 0.2.1 are both Bougainvillea). The names after the next release are
proposals until each release starts.

| Version | Name |
|---|---|
| 0.1 | Azalea |
| 0.2 | Bougainvillea |
| 0.3 | Camellia |
| 0.4 | Dahlia |
| 0.5 | Echinacea |
| 0.6 | Fuchsia |
| 0.7 | Gardenia |
| 0.8 | Hibiscus |
| 0.9 | Iris |
| 1.0 | Jasmine |

**Phases** group the work by what it's for ("Smarter care"), not by a version number. A phase
ships in one release or a few, and when plans change, only the release plan below changes.

## Release plan

| Release | Phase | Status |
|---|---|---|
| **0.1 Azalea** | The first release (the MVP): see the [changelog](../CHANGELOG.md) | Released 2026-10-28 |
| **0.2 Bougainvillea** | How much water to give (#43), and fixes from using 0.1 (#41, #42) | Released 2026-10-30 |
| **0.3 Camellia** | [Easier everyday use](#camellia-easier-everyday-use-released) | Released 2026-10-30 |
| **0.4 Dahlia** | [Smarter care](#dahlia-smarter-care-released) | Released 2026-10-30 |
| **0.5 Echinacea** | [AI providers and toxicity](#echinacea-ai-providers-and-toxicity-released) | Released 2026-10-31 |
| **0.6 Fuchsia** | [Integrations](#fuchsia-integrations-released) | Released 2026-11-01 |
| **0.7 Gardenia** | [Outdoor and edible gardening](#gardenia-outdoor-and-edible-gardening-released) | Released 2026-11-06 |
| **0.8 Hibiscus** | [Collector features](#hibiscus-collector-features-released) | Released 2026-11-06 |
| **0.9 Iris** | [AI assistant](#iris-ai-assistant-released) | Released 2026-11-06 |
| **1.0 Jasmine** | [Mature and beautiful](#mature-and-beautiful) | Next |

Not yet scheduled: [more integrations](#more-integrations), split from Fuchsia,
[more gardening](#more-gardening), split from Gardenia, and
[more collector features](#more-collector-features), split from Hibiscus, to keep each release
smaller. Each goes into a release when there's room, or when someone needs it.

## Phases

### Bougainvillea: water amounts and first fixes (released)

- **How much water to give**, from the pot's size, with an optional pot height (#43).
- **iPhone zoom:** fields no longer make Safari zoom in (#41).
- **Plant identification:** it's clear that **Use** set the species (#42).

### Camellia: easier everyday use (released)

Getting around the app, and making it feel like yours.

- **Navigation:** the main pages one tap away (a bottom tab bar on phones), not in the account
  menu (#47).
- **Profile pictures** (#48).
- **Move plants into a location** from the location's page, not only add new ones (#45).
- **Plants without a care schedule:** mark them in the plant list, filter for them, and link
  straight to them from Today (#54).
- **End-to-end tests** in CI: a few browser tests of the main journeys at phone size (setup,
  adding a plant, logging care), so that changes to navigation can't break them unnoticed.

### Dahlia: smarter care (released)

Care that learns from you and shows what's going on.

- **Learning from your actual care**, not only from soil feedback. When you water less often,
  or give more water, than suggested, offer to adapt the schedule to you, or suggest an
  improvement, with the reasons. Always a suggestion you accept, never a silent change.
- **Care at a glance:** slim water, fertilizer and light bars on each plant that move as
  conditions change (#49).
- **Light tools:** "is this spot bright enough?" for a plant, and the light from each window
  and grow light through the year, on the plant and location pages.
- **Indoor humidity estimated** from the outdoor weather and the room's temperature, and used
  by the predictions (#44).
- **An About page:** which version is running, with its release notes, the licence and source
  code, and credits (#66).

### Echinacea: AI providers and toxicity (released)

Optional plugins: off until an Admin turns them on, and each says exactly what it sends.

- **An AI provider plugin** for OpenAI-compatible APIs, which also covers local models through
  Ollama or LM Studio. (Anthropic's own API moved to the AI assistant.)
- **AI care profile suggestions** for unusual plants that match no built-in profile: the AI
  picks the closest built-in profile, and you choose whether to use it.
- **Toxicity to pets** in the dataset, from the ASPCA's toxic plant list, for the common
  houseplant genera first. Each flag cites its source, and only ever says "known to be toxic"
  or "unknown", never "safe". (Toxicity to children moved to outdoor and edible gardening.)
- **When was it last cared for?** Adding a plant asks when it was last watered and
  fertilized, so its first due dates and care bars are right from the start (#76).

### Fuchsia: integrations (released)

- **Weather-adaptive outdoor watering** from Open-Meteo's evapotranspiration (ET₀) and rainfall,
  with a documented formula.
- **Web Push** notifications, and an **iCal** feed of care.
- **A Test button for each plugin** on the Plugins page, to check its settings work before
  saving them (#93).
- **New README screenshots**, with plant photos, made by a script so they can be made again
  after visual changes (#101).
- **Collapsible plugin cards**, so the Plugins page stays tidy: collapsed, a card still shows
  its name, whether it's on, any error, and that it sends data (#95).

### More integrations

Split from Fuchsia (0.6), not yet scheduled.

- **Home Assistant / MQTT** sensor readings (soil moisture, light, temperature, humidity), and
  reminders triggered by sensor thresholds.
- **OIDC single sign-on** (Authentik, Keycloak, Authelia, Pocket ID and others).
- **Import from HortusFox and Plant-it.**
- **Public API documentation** and personal API tokens.
- **A care data provider plugin: Open Plantbook** (moved from Echinacea, then from Fuchsia).
  Care data for plants the dataset doesn't cover, fetched with the person's own free account. Its data has no formal licence, so it stays a plugin and isn't copied into
  Sunfleck's CC BY-SA dataset. Perenual and Trefle could follow if there's a need: Perenual's
  free tier is non-commercial and limited to 100 requests a day, and Trefle is in beta.

### Gardenia: outdoor and edible gardening (released)

Growing food outside, and fewer clicks for everyday tasks.

- **Add a window or grow light from the plant form**, without leaving it (#98).
- **Measuring how easy Sunfleck is to use:** click counts for the core tasks, with budgets that
  the browser tests check, and a list of dead ends to fix (#97).
- **Garden beds:** an outdoor place with a size, for the plants grown in it.
- **Frost dates** from the location; a sowing, transplanting and harvest calendar.
- A harvest log, and a seed inventory.
- **Follow-ups from Fuchsia:** water amounts for plants in the ground from the soil water
  balance, not the weekly rule; Dracaena marginata and the avocado (Persea americana) in the
  dataset.
- **Fix:** the water and fertilizer bars update as soon as care is logged (#136).

### More gardening

Split from Gardenia (0.7), not yet scheduled.

- A simple **garden map** of the beds and what grows in them.
- Companion planting hints (as a plugin with its own data).
- **Toxicity to children** in the dataset, with the same rules as for pets: "known to be
  toxic" with its source, or "unknown", never "safe". It needs its own sources, such as poison
  control centres, since there's no single list like the ASPCA's.

### Hibiscus: collector features (released)

Growing more plants from the ones you have, and finding each one's page quickly.

- **The dead ends found by the click counts** (#97), first:
  - add a place and a room from the plant form, without losing it (#120);
  - add a care type where care is logged or scheduled, not only in Settings (#121);
  - Today shows a new household how to get started (#122).
- **Propagation and lineage:** a cutting, division, offset or seedling is a new plant with its
  parent and how it was made ("a cutting of Monty"). The parent's page lists its offspring.
- **QR and NFC labels** that open the plant's page: a printable sheet of QR labels for the
  plants chosen, and writing an NFC tag where the browser can (Chrome on Android).
- **A wishlist** of plants wanted.
- **Grow lights by distance:** the light a plant gets from a grow light depends on how far
  below it the plant is, as for windows (#144).

### More collector features

Split from Hibiscus (0.8), not yet scheduled.

- A supplies inventory (soil, fertilizer, pots), with optional reminders to restock.
- Statistics and charts.
- A growth time-lapse from photos.

### Iris: AI assistant (released)

Help from an AI model, only when it's asked for and only with an AI plugin an Admin turns on.

- **An AI provider plugin for Anthropic's API**, next to the OpenAI-compatible one, first, so
  the rest can be tried against it. Claude Sonnet by default; the model is a setting.
- **Photo diagnosis:** "what's wrong with my plant?" from a photo taken or picked for it (a
  close-up of the problem), with a few words if you like. Only that photo and the plant's
  details are sent, and only when asked. The answer gives likely causes and next steps,
  clearly labelled as suggestions, and the photo can be kept on the plant.
- **Ask about this plant:** a chat with the plant's history and conditions as context.
  Conversations are kept on the plant, for the household to read and continue.

### Mature and beautiful

- **A design pass across the whole app:** typography, spacing, colour, illustrations for empty
  pages, and gentle motion, in light and dark themes. One of Sunfleck's goals is to be
  beautiful as well as useful.
- **A usability test:** a few people from real households do the core tasks cold and fill in
  the System Usability Scale, and a heuristic review rates the problems, to compare with 0.7's
  click counts (#97).
- **Cropping photos:** choose the crop and zoom of a profile picture or a plant photo before
  saving it (#67). The README screenshots are made again after the design pass (#101).
- **Frontend plugin slots**, so plugins can add to the interface (widgets, plant page tabs).
- A plugin catalog page and a plugin development guide.
- **Offline care logging**, synced when the connection is back.
- A security review, a stable API and plugin interface, and upgrade guarantees.

## Done in the first release

Seasonal care (resting seasons, less water in winter, pauses in fertilizing, dormancy) was
once planned for later; it's part of 0.1 Azalea.
