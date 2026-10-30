# Changelog

What's changed in each release of Sunfleck. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/): new features raise the minor version, fixes the
patch version. Each minor version has a plant name, in alphabetical order (see the
[roadmap](docs/roadmap.md)). Before upgrading, read the notes of every version since yours, and
make a backup ([how to upgrade](docs/install.md#upgrading)).

## [Unreleased]

### Added

- **Move plants here** on a location's page: move plants from elsewhere, those without a
  location first. Their schedules adjust to the new location.

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

[Unreleased]: https://github.com/mazelado/sunfleck/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mazelado/sunfleck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mazelado/sunfleck/releases/tag/v0.1.0
