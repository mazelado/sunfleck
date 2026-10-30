# Changelog

What's changed in each release of Sunfleck. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/): new features raise the minor version, fixes the
patch version. Each minor version has a plant name, in alphabetical order (see the
[roadmap](docs/roadmap.md)). Before upgrading, read the notes of every version since yours, and
make a backup ([how to upgrade](docs/install.md#upgrading)).

## [Unreleased]

### Added

- **About Sunfleck**, in the account menu: which version is running, with its release notes,
  the version of the care data, the licences and the source code, and credits.
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

[Unreleased]: https://github.com/mazelado/sunfleck/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/mazelado/sunfleck/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mazelado/sunfleck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mazelado/sunfleck/releases/tag/v0.1.0
