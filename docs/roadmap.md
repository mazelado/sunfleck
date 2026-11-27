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
- **2.0** marks the end of the next theme, [depth when you want it](#towards-20-depth-when-you-want-it),
  as 1.0 did for "mature and beautiful". Its parts ship in 1.x releases, and nothing planned
  for it breaks the API, the plugin interface or upgrades.

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
| 1.1 | Kalanchoe |
| 1.2 | Lavender |
| 1.3 | Monstera |
| 1.4 | Nasturtium |
| 1.5 | Orchid |
| 1.6 | Peony |
| 2.0 | Quince |

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
| **1.0 Jasmine** | [Mature and beautiful](#jasmine-mature-and-beautiful-released) | Released 2026-11-14 |
| **1.1 Kalanchoe** | [Care details](#kalanchoe-care-details-released) | Released 2026-11-20 |
| **1.2 Lavender** | [Trust](#lavender-trust-released) | Released 2026-11-26 |
| **1.3 Monstera** | [Simple by default](#monstera-simple-by-default-released) | Released 2026-11-27 |
| **1.4 Nasturtium** | [Sensors, to look at](#nasturtium-sensors-to-look-at-planned) | Planned |
| **1.5 Orchid** | [Fertilizer](#orchid-fertilizer-planned) | Planned |
| **1.6 Peony** | [Sensors that inform](#peony-sensors-that-inform-planned) | Planned |
| **2.0 Quince** | [Depth when you want it, complete](#quince-depth-when-you-want-it-complete-planned) | Planned |

Not yet scheduled: [more integrations](#more-integrations), split from Fuchsia,
[more gardening](#more-gardening), split from Gardenia, and
[more collector features](#more-collector-features), split from Hibiscus, and
[more platform](#more-platform), split from Jasmine, to keep each release smaller. Each goes into a release when there's room, or when someone needs it.

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

- Sensor readings from Home Assistant are now planned: see
  [Nasturtium](#nasturtium-sensors-to-look-at-planned) and
  [Peony](#peony-sensors-that-inform-planned). Reading MQTT directly, without Home
  Assistant, stays here.
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
- Toxicity to people moved to [Monstera](#monstera-simple-by-default-released) (1.3).

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

- A supplies inventory for soil and pots, with optional reminders to restock. (Fertilizers
  are planned in [Orchid](#orchid-fertilizer-planned).)
- Statistics for the whole household. (A plant's own watering history is planned in
  [Lavender](#lavender-trust-released).)
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

### Jasmine: mature and beautiful (released)

Making what Sunfleck already does solid and beautiful, rather than adding more.

- **A design pass across the whole app:** typography, spacing, colour, illustrations for empty
  pages, and gentle motion, in light and dark themes. One of Sunfleck's goals is to be
  beautiful as well as useful. It starts from a few directions mocked up on the Today and
  plant pages; the one chosen is then applied everywhere.
- **Cropping photos:** choose the crop and zoom of a profile picture or a plant photo before
  saving it (#67). The README screenshots are made again after the design pass (#101).
- **A usability test:** a few people from real households do the core tasks cold and fill in
  the System Usability Scale, and a heuristic review rates the problems, to compare with 0.7's
  click counts (#97). The test script, forms and heuristic review come with the release; the
  sessions are run by the maintainer, and what they find is fixed before 1.0.
- **A security review and a deep code quality review**, together, once the features for 1.0
  are in, so they look at the code that ships. Their findings are rated and fixed before the
  release:
  - security: access between households and roles, authentication and sessions, uploads,
    secrets, what plugins can reach, and dependencies;
  - code quality: correctness, dead and duplicated code, complexity, consistency with the
    style guide, error handling, and gaps in the tests, across the backend, the frontend and
    the built-in plugins.
- **Stability:** the API and the plugin interface are declared stable, with how they may
  change from 1.0 on, and upgrades are guaranteed from any 0.x release with a backup.

### Kalanchoe: care details (released)

Small additions from using 1.0, to the care that's logged and the profile.

- **How much water was given**, recorded when logging a watering, in the person's units and
  pre-filled with the amount Sunfleck suggests (#222).
- **Re-framing a profile picture** after it's saved, as plant photos can be (#221).

### Towards 2.0: depth when you want it

The theme of the releases from 1.2 to 2.0. Sunfleck stays simple for someone who only wants to
know what to water today, and lets someone who wants more go deeper at their own pace, and
learn as they go: from "needs more light" to how much light, in which unit, and why.

How it's built, so that more depth doesn't make the app harder:

- **No basic and advanced modes.** Everyone in a household sees the same app and the same
  data. A mode would hide things people need, and give every page two versions to keep working.
- **Whole areas are turned on per household.** Two switches, **Garden** (beds, seeds, sowing,
  harvest) and **Collection** (propagation, wishlist, labels). AI, weather and identification
  are plugins already.
- **Depth is on each card,** one tap away, as **Why?** is today. The advice is clear on its
  own: *what to do*, then *why*, then *the numbers*, then *your own measurements*.
- **Things appear when there's data for them.** No sensor, no sensor pages. A chart shows
  once there's care to chart.
- **Every explanation is true,** and says "estimated" where a value comes from a model
  rather than a measurement.
- **Sunfleck doesn't switch pumps or lights.** It tells Home Assistant what a plant needs,
  and automation is set up there.
- **English and Spanish.** Other languages are welcome, as contributions.

### Lavender: trust (released)

Checking that what Sunfleck already says is right, before it says more.

- **A second usability test, on phones,** with the 1.0 [test plan](usability-test.md). The
  fixes from the first round are in 1.0, but no one has checked that they work.
  [Round 2](usability-test.md#round-2-12) checks each of them, and adds tasks for the care
  history. Three people took part ([results](usability-test-results-1.2-round-2.md)); the
  problems it found that were rated major are fixed in 1.2, with most of the minor ones.
- **Care profiles checked against sources.** The eight used by the maintainer's own plants
  were checked first and shipped in 1.1 ([review](care-review-2026-11.md)); the other 22, and
  a new profile for busy Lizzies, are checked in [part 2](care-review-2026-11-part-2.md). Each
  value is checked against at least two sources, written in our own words, and cited; the
  maintainer approves the citations before a profile is marked `reviewed`. The sources are
  ones that can be read and cited (university extension services, botanical gardens, the RHS,
  books and papers) or copied under an open licence; never other apps' data, or data with a
  non-commercial or unclear licence (see [care data sources](care-data-sources.md)).
- **Toxicity to pets, for every plant.** 0.5 flagged the common houseplants first; the rest,
  including every outdoor and edible plant, were checked against the ASPCA's lists in the
  [toxicity review](toxicity-review-2026-11.md), with NC State and Pet Poison Helpline where the
  ASPCA has no entry: 63 flags, up from 29. The same rules: "known to be toxic" with its
  source, or "unknown", never "safe".
- **How well does Sunfleck predict?** For each plant, how often the soil was "just right"
  when it was watered, over time. It uses the answers already collected.
- **A plant's watering history:** when it was watered and how much (#222), next to what was
  predicted.

### Monstera: simple by default (released)

Sunfleck stays simple for someone with a few houseplants, and speaks Spanish.

- **Garden and Collection switches** for the household, set by an Admin under **Settings →
  Household → Parts of the app**. An area that's off leaves the navigation, the pages and the
  forms; its data is kept, and comes back with it. Households from before 1.3 keep both on.
- **"What do you grow?"** first in the step-by-step setup of a new household: outdoor and
  edible plants turn on Garden, a collection turns on Collection, and houseplants need neither.
- **Spanish,** for the whole app, its numbers ("3,6"), and the emails and notifications, with a
  glossary in [translating](translating.md#spanish) and a native speaker's review of gender
  agreement. In the care dataset, Spanish common names from Wikidata (CC0) for 109 plants
  ([proposal](spanish-care-data-2026-11.md)); a plant without one shows its scientific name, not
  its English one. Plant search ignores accents. The care profiles' and notes' Spanish is
  drafted, and goes in after a native speaker has read it.
- **Toxicity to people,** with the same rules as for pets: "known to be harmful" with its source,
  or "unknown", never "safe". It says how serious it is if eaten, and whether touching it is a
  problem. Checked against NC State's Plant Toolbox and the RHS's list in a
  [review](toxicity-people-review-2026-11.md): 101 plants. Food crops count only a part people
  might eat (a potato's green tubers, raw beans). Poison control centres, which the plan also
  named, are left for a later review.
- **Round 2 of the usability test, finished:** its last three problems were decided
  ([results](usability-test-results-1.2-round-2.md)): two left as they are, and one not
  reproduced on a real iPhone. That check found the tab bar and **Save** floating above the
  keyboard while typing, which is fixed.

### Nasturtium: sensors, to look at (planned)

How it's built is in [the plan](sensors-plan-2026-11.md), as decided.

- **A Home Assistant plugin** that reads a plant's soil moisture, and light, temperature and
  humidity where there's a sensor, from the entities chosen for it. Any sensor Home Assistant
  knows works.
- **The reading on the plant's page,** and a summary kept for each day. Home Assistant keeps
  the full history, so Sunfleck stays light on a Raspberry Pi.
- **Not used by the predictions yet.** A soil sensor reads differently in every pot and soil,
  so its readings are collected next to the "How was the soil?" answers first.

### Orchid: fertilizer (planned)

- **Your fertilizers:** each product with its N-P-K and how you dilute it, and which one was
  used when fertilizing is logged.
- **Why?** for fertilizing, as for watering: the season, the plant's growth and its profile.
- **Strength, not ratios:** the advice is about how strong and how often ("half strength,
  monthly while growing"), which matters more for potted plants than the N-P-K ratio. Sunfleck
  records the ratio and explains it, but doesn't recommend one per plant.

### Peony: sensors that inform (planned)

- **Readings calibrated by your own answers:** what a plant's sensor reads when its soil was
  too dry, just right or still wet.
- **A factor in Why?:** "the soil is still moist: wait", or "drier than usual: water sooner".
  As with every factor, it's shown, and reminders follow the new date.
- **"Needs water" for Home Assistant,** for each plant, to use in dashboards and automations
  there.
- **Measured light,** where there's a light sensor, next to the estimate from windows and
  grow lights.

### Quince: depth when you want it, complete (planned)

- **The same four steps on every card,** for water, light and fertilizer: what to do, why,
  the numbers, your measurements. Each step says what the next one adds.
- **A link for a plant sitter:** what to do each day while you're away, without an account.
  It can only log care, it expires, and an Admin can end it early.
- **A third usability check,** to compare with the first two.

### More platform

Split from Jasmine (1.0), not yet scheduled.

- **Frontend plugin slots**, so plugins can add to the interface (widgets, plant page tabs).
- A plugin catalog page and a plugin development guide.
- **Offline care logging**, synced when the connection is back.
- **One shared header for Plants, Seeds and Wishlist**, so the view switch stays in the same
  place on all three (#213).

## Done in the first release

Seasonal care (resting seasons, less water in winter, pauses in fertilizing, dormancy) was
once planned for later; it's part of 0.1 Azalea.
