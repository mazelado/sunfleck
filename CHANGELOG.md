# Changelog

What's changed in each release of Sunfleck. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Before upgrading, read the notes of every version
since yours, and make a backup ([how to upgrade](docs/install.md#upgrading)).

## [Unreleased]

## [0.1.0] - 2026-10-28

The first release.

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

[Unreleased]: https://github.com/mazelado/sunfleck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mazelado/sunfleck/releases/tag/v0.1.0
