# Changelog

What's changed in each release of Sunfleck. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/): new features raise the minor version, fixes the
patch version. Each minor version has a plant name, in alphabetical order (see the
[roadmap](docs/roadmap.md)). Before upgrading, read the notes of every version since yours, and
make a backup ([how to upgrade](docs/install.md#upgrading)).

## [Unreleased]

### Added

- **Toxicity to pets**: 28 houseplant genera and species now carry a "known to be toxic to
  cats / dogs" flag, each linking to the specific ASPCA Animal Poison Control entry it comes
  from (#84). Everything else stays "unknown" rather than guessed as safe.
- **Suggest a care profile with AI**, for plants whose species has no care profile: with an AI
  plugin on, **Suggest with AI** on the plant form asks which built-in profile fits best, and
  why ("Hoyas grow on trees and like to dry out a little"). The AI can only choose one of the
  built-in profiles, so the care itself always comes from the reviewed dataset, and nothing
  changes until you use the suggestion.
- **AI plugin (OpenAI-compatible)**, off until an Admin turns it on: suggestions from an AI
  model through OpenAI, or a model you run yourself with Ollama or LM Studio. It's only asked
  when you ask for a suggestion, and every answer is checked before it's used. Plugins can
  offer other AI services through the new `complete_json` hook.
- **When was it last cared for?** Adding a plant asks roughly when it was last watered and
  fertilized (today, a few days ago, about a week ago, or don't know), so its first due dates
  and care bars start from there instead of from the day it was added (#76). The answer is
  kept in its history, marked "Estimated when added".

## [0.4.1] - 2026-10-30

**Dahlia.** Fixes from using 0.4: sensible water amounts for bigger pots, and what to add
when a plant's light isn't known.

### Changed

- **When a plant's light isn't known**, its page now says what to add (the windows or grow
  lights that reach it, or a location's sun exposure) instead of leaving the light check out.

### Fixed

- **Water amounts for bigger pots** were far too high: they were a share of the whole pot's
  volume, which grows with the cube of its width (2.8 gallons for a 15-inch pot). They're now
  the water to wet again the soil that dried since the last watering, at most the top 10 cm
  (4 in) or so: about 2 litres (half a gallon) for that pot. Small pots change little. Every
  plant's amount is updated when Sunfleck starts.

## [0.4.0] - 2026-10-30

**Dahlia.** Smarter care: humidity in the predictions, care at a glance, light through the
year, and schedules that learn from how you water. Also an About page.

### Added

- **About Sunfleck**, in the account menu: which version is running, with its release notes,
  the version of the care data, the licences and the source code, and credits.
- **Humidity in watering predictions**: indoors, dry air means watering sooner and damp air
  later. A location's own humidity setting is used; without one, and with the weather plugin
  on, it's estimated in cold weather from the outdoor dew point and the room's temperature
  (heated winter air is dry). The location's page shows the estimate, and **Why?** mentions
  when the air is dry for a plant that likes humid air.
- **Care at a glance**: slim water, fertilizer and light bars on each plant's card and page.
  Water and fertilizer run down until the care is due (red when it's due or overdue, grey
  while it rests); light shows how the plant's spot compares with what it likes at this time
  of year. Each bar is also said in words ("Water in 2 days", "Light: a bit low for this
  plant"), on the page and for screen readers.
- **Is this spot bright enough?** A plant's page compares the light at its spot with what it
  likes, season by season, with a tip when it's too dim or too bright, and says how much
  light each window or grow light gives it now. A location's page shows each window's light
  through the year (at 1 m from the glass) and each grow light's.
- **Learning from how you water**: when your last few waterings were all clearly further apart
  (or closer together) than a plant's schedule, its page offers to match the schedule to your
  routine, e.g. "You've been watering about every 9 days, but the schedule says every 6".
  Nothing changes unless you accept; **Why?** then says so, and you can go back to Sunfleck's
  own estimate. No suggestion when your soil feedback disagrees (e.g. watering less often, but
  the soil was too dry). "Not now" hides it for a month.

### Fixed

- On iPhones, the tab bar sat higher than needed: the space for the home indicator was counted
  twice.

## [0.3.0] - 2026-10-30

**Camellia.** Easier everyday use: the main pages one tap away, profile pictures, moving
plants between locations, and finding plants without a care routine.

### Added

- **Plants without a care routine** are marked "No routine yet" in the plant list, which can
  show only them. Today's notice links straight to the plant when there's one, or to that
  list.
- **Move plants here** on a location's page: move plants from elsewhere, those without a
  location first. Their schedules adjust to the new location.
- **Profile pictures:** choose one under Profile. It's shown in the header, the household's
  member list and the care history, only to your household. Not included in exports.

### Changed

- **Navigation:** the main pages (Today, Plants, Places, Care guide) are one tap away, in a tab
  bar at the bottom on phones and at the top on wider screens. The account menu keeps your
  settings, your household and signing out.

### Fixed

- After signing out, signing in again starts on Today. It sometimes returned to the page you
  signed out from instead.

## [0.2.0] - 2026-10-30

**Bougainvillea.** How much water to give, and the first fixes from using 0.1.

### Added

- **How much water to give**: each predicted watering says roughly how much, in your units:
  from the pot's size for plants in pots, or as a depth of water (like rain) in the ground.
- **Pot height** (optional), for a better estimate of how much soil a pot holds. It also
  refines when to water: shallow pots dry out sooner.

### Changed

- **Plant identification:** after you pick a suggestion with **Use**, the suggestions give way
  to what it set ("Species set to …"), with a link to see them again.

### Fixed

- On iPhones, the page no longer zooms in (and stays zoomed) when you tap into a field: text
  in fields is at least 16 px on touch screens.

## [0.1.0] - 2026-10-28

**Azalea.** The first release.

### Added

- **Places**: sites on a map, with their time zone and hemisphere; indoor and outdoor
  locations; windows and grow lights, and an estimate of the light each plant gets through
  the seasons.
- **Plants**: species search by common, scientific and older names; care profiles; pots and
  soil; photos, made smaller and stripped of their location data on upload; statuses.
- **Care**: one-tap logging, logging with details, a timeline per plant, built-in care types
  and a household's own.
- **Predicted care**: watering and fertilizing intervals worked out from the care profile,
  light, temperature, pot, season and weather, with an explanation, and adjusted from
  feedback on the soil. Fixed intervals for anything else. A suggested routine for new plants.
- **Today**: due and overdue care by location, snooze and skip, and the week ahead.
- **A care guide** with care profiles for over 300 genera and species.
- **Notifications** through Apprise (ntfy, Telegram, email, Discord, Signal and about 100
  more): a daily digest, an evening reminder and frost warnings, in each person's time zone.
- **Households**: invitations, and the Admin, Gardener and Viewer roles. Each person sets their
  language, units (metric or imperial) and notifications.
- **Plugins** (off until an Admin turns them on), with encrypted API keys:
  - Weather (Open-Meteo): weather on Today, frost warnings, and outdoor watering that follows
    rain and heat.
  - Plant identification (Pl@ntNet): identify a plant from a photo when adding it.
- **Export and import** of a household as a ZIP file, to back up or move to another server.
- **An installable app** (PWA) for phones and computers.
- **Translations**: set up for the app and the server, ready for contributions.
- **Docker image** for `linux/amd64` and `linux/arm64`, with SQLite by default, PostgreSQL and
  Redis optional, and a background worker.

[Unreleased]: https://github.com/mazelado/sunfleck/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/mazelado/sunfleck/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/mazelado/sunfleck/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mazelado/sunfleck/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mazelado/sunfleck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mazelado/sunfleck/releases/tag/v0.1.0
