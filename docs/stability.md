# Stability and upgrades

What stays the same from Sunfleck 1.0 on, what may change, and how changes are announced. It's
written for the people who run Sunfleck, for anyone writing a plugin or a client for its API,
and for its contributors, who keep these promises.

- [Versions](#versions)
- [Upgrading](#upgrading)
- [What's stable](#whats-stable)
- [What isn't](#what-isnt)
- [How things change](#how-things-change)
- [How the promises are checked](#how-the-promises-are-checked)

## Versions

Sunfleck follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

| Release | What it may contain | Example |
|---|---|---|
| **Patch** (1.0.1) | Bug and security fixes only | A digest sent at the wrong time |
| **Minor** (1.1.0) | New features and improvements; nothing that stops working | A new page, a new plugin hook, new fields in the API |
| **Major** (2.0.0) | Anything listed under [what's stable](#whats-stable) may change, after a deprecation (below) | Removing an API field, renaming a setting |

Each minor version also has a plant name (see the [roadmap](roadmap.md)). Every release's
changes are in the [changelog](../CHANGELOG.md), with anything deprecated, removed or needing
action before upgrading called out.

**Support:** the latest minor release gets bug and security fixes, as patch releases. Older
releases don't: upgrade to get fixes (see [SECURITY.md](../SECURITY.md)).

## Upgrading

- **From any earlier release to any later one with the same major version**, in one step:
  from 0.1 straight to 1.4, say. Database changes are applied when Sunfleck starts, and none
  are ever removed within a major version, so every older database can be brought up to date.
  0.x counts as part of 1.x for this.
- **To a new major version**, first upgrade to the last minor release of the version you're
  on (e.g. 1.9 before 2.0). The release notes say what to do, if anything.
- **Back to an older version:** not supported. Database changes can't be undone, so restore
  the backup made before upgrading (see [Backups](install.md#backups)).
- **Always make a backup first,** and read the release notes of every version since yours.

**Exports:** a household export can always be imported by the same or any later version of
Sunfleck, whatever version made it. An export from a newer version than the one importing it
is refused, with a message saying so.

## What's stable

From 1.0, within a major version:

### The HTTP API (`/api/v1/`)

The JSON API the app uses, described at `/api/v1/docs` and in `frontend/src/api/openapi.json`.

- **Endpoints** keep their address, method and meaning.
- **Responses** keep their fields, with the same type and meaning. New fields may be added at
  any time: clients should ignore fields they don't know.
- **Requests** accept what they accepted before. New fields are only ever optional.
- **Errors** keep their shape (`{"error": {"code", "message", "details"}}`) and their codes for
  the same problems. New codes may be added for new problems: clients should treat an unknown
  code like a generic error with that HTTP status. Messages are for people and may be
  reworded.
- **Permissions** may only get stricter for security reasons, and that's announced as such.

A breaking change means a new API version, `/api/v2/`, served alongside `/api/v1/` for at
least one minor release.

### The plugin interface (plugin API version 1)

What [docs/plugins.md](plugins.md) describes, and nothing else:

- everything `sunfleck.plugins` exports (`PluginInfo`, `hookimpl`, `require_enabled`,
  `is_enabled`, `mark_site_out_of_date`, and the types such as `AiTask` and `Adjustment`);
- the hooks, their arguments and what their answers mean;
- the fields of the Sunfleck objects hooks receive (such as a `Site` or a `Plant`), for
  reading;
- the `sunfleck.plugins` entry point group, and plugins' own settings and Django apps.

New hooks, new optional arguments, and new optional fields on the types may be added in any
minor release. Sunfleck only loads plugins built for its current plugin API version
(`api_version="1"`); a plugin for another version is left out, with the reason shown on the
Plugins page.

### Running it

- **Settings:** the environment variables in [install.md](install.md#all-settings) keep
  their names and meaning. A renamed setting keeps working under its old name, with a warning
  in the log, until the next major version.
- **Docker:** the `ghcr.io/mazelado/sunfleck` image and its tags (`1.4.2`, `1.4`, `latest`),
  the `web` and `worker` commands, port 8000, the `/data` volume and its layout, and the
  Compose file's service names.
- **Data:** a household's data, including photos, comes through every upgrade unchanged.
- **Databases:** SQLite and PostgreSQL are both supported throughout a major version.

## What isn't

These may change in any release, as the app improves:

- **The interface:** pages, layout, wording, and how many taps a task takes. Links to the main
  pages (`/plants/42`, the calendar feed, QR labels and NFC tags) keep working.
- **Care predictions:** the intervals Sunfleck suggests come from a model that will keep
  getting better, so they change, explained by **Why?** as now.
- **The care dataset** (species and care profiles): entries are added and corrected.
  A care profile's key, which plants and exports refer to, stays.
- **Anything not listed above:** Sunfleck's own Python modules and database tables, except
  as part of the plugin interface; the sign-in endpoints under `/_allauth/`, which follow
  django-allauth; the Django admin site; and the minimum Python, Node and database versions
  (raised in minor releases when older ones are no longer supported upstream, and announced).

## How things change

Nothing listed as stable is changed or removed without warning:

1. **Deprecated first,** in a minor release: the old way still works, the changelog's
   **Deprecated** section says what replaces it, and where possible a warning is logged when
   it's used.
2. **Kept for at least one more minor release.**
3. **Removed only in the next major version,** listed in that release's **Removed** section
   and its upgrade notes.

Security fixes are the one exception: if keeping something would leave people exposed, it
changes in a patch release, and the release notes say why and what to do.

## How the promises are checked

- **The API:** `backend/sunfleck/core/tests/test_stability.py` compares the API with
  `backend/sunfleck/core/stability/api-v1.json`, a record of every endpoint, request field
  and response field, with their types. The tests fail when any of them is removed or
  renamed, when a response field's type widens (e.g. it may now be null) or a request
  field's narrows, or when a request field becomes required. Additions are fine, but the
  tests also fail until they're recorded: run `make stability-baseline`, and check that
  the record's diff in the pull request only adds.
- **The plugin interface:** the same tests compare it with `plugins-v1.json` beside it:
  everything `sunfleck.plugins` exports, the fields of its types, every hook's arguments,
  and the fields of the objects hooks receive.
- **Upgrades:** the tests build the database from the very first migration, as an upgrade
  from 0.1 would, and exports from older versions are imported in
  `backend/sunfleck/dataio/tests/`.
