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
| **0.4 Dahlia** | [Smarter care](#smarter-care) | Next |
| **0.5 Echinacea** | [AI providers and care data](#ai-providers-and-care-data) | Planned |
| **0.6 Fuchsia** | [Integrations](#integrations) | Planned |
| **0.7 Gardenia** | [Outdoor and edible gardening](#outdoor-and-edible-gardening) | Planned |
| **0.8 Hibiscus** | [Collector features](#collector-features) | Planned |
| **0.9 Iris** | [AI assistant](#ai-assistant) | Planned |
| **1.0 Jasmine** | [Mature and beautiful](#mature-and-beautiful) | Planned |

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

### Smarter care

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

### AI providers and care data

Optional plugins: off until an Admin turns them on, and each says exactly what it sends.

- **AI provider plugins:** OpenAI-compatible first (which also covers local models through
  Ollama), then Anthropic's own API.
- **AI care profile suggestions** for unusual plants that match no built-in profile, always
  reviewed before they're used.
- **Care data provider plugins:** Open Plantbook, Perenual, Trefle. Each has its own terms and
  API key, so they stay plugins: their data isn't copied into Sunfleck's CC BY-SA dataset.
- **Toxicity flags** (pets and children) in the dataset, each with its sources. They only ever
  say "known to be toxic" (with the source) or "unknown", never "safe".

### Integrations

- **Home Assistant / MQTT** sensor readings (soil moisture, light, temperature, humidity), and
  reminders triggered by sensor thresholds.
- **Weather-adaptive outdoor watering** from Open-Meteo's evapotranspiration (ET₀) and rainfall,
  with a documented formula.
- **Web Push** notifications, and an **iCal** feed of care.
- **OIDC single sign-on** (Authentik, Keycloak, Authelia, Pocket ID and others).
- **Import from HortusFox and Plant-it.**
- **Public API documentation** and personal API tokens.

### Outdoor and edible gardening

- Garden beds and a simple **garden map**.
- **Frost dates** from the location; a sowing, transplanting and harvest calendar.
- A harvest log, and a seed inventory.
- Companion planting hints (as a plugin with its own data).

### Collector features

- **Propagation and lineage:** cuttings, divisions and seedlings ("this plant came from that
  one").
- A supplies inventory (soil, fertilizer, pots), with optional reminders to restock.
- **QR and NFC labels** that open the plant's page.
- Statistics and charts, and a growth time-lapse from photos.
- A wishlist of plants wanted.

### AI assistant

- **Photo diagnosis:** "what's wrong with my plant?", with likely causes and next steps,
  clearly labelled as suggestions.
- **Ask about this plant:** a chat with the plant's history and conditions as context.

### Mature and beautiful

- **A design pass across the whole app:** typography, spacing, colour, illustrations for empty
  pages, and gentle motion, in light and dark themes. One of Sunfleck's goals is to be
  beautiful as well as useful.
- **Cropping photos:** choose the crop and zoom of a profile picture before saving it (#67).
- **Frontend plugin slots**, so plugins can add to the interface (widgets, plant page tabs).
- A plugin catalog page and a plugin development guide.
- **Offline care logging**, synced when the connection is back.
- A security review, a stable API and plugin interface, and upgrade guarantees.

## Done in the first release

Seasonal care (resting seasons, less water in winter, pauses in fertilizing, dormancy) was
once planned for later; it's part of 0.1 Azalea.
