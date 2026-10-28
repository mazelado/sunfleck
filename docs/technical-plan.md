# Technical Plan (MVP, v0.1)

> **Status:** Approved (2026-10-27) · **Last updated:** 2026-10-26
>
> This document turns the MVP scope in [research.md](research.md#8-proposed-mvp-v01) into a
> concrete design: architecture, data model, care prediction, plugins, project layout,
> tooling, and the order in which we build things. Once approved, each major decision will be
> recorded as an Architecture Decision Record in `docs/adr/`, as the
> [style guide](STYLE_GUIDE.md#11-documentation) prescribes.

Contents:
1. [Decisions at a glance](#1-decisions-at-a-glance)
2. [Architecture](#2-architecture)
3. [Backend design](#3-backend-design)
4. [Data model](#4-data-model)
5. [Care data and prediction engine](#5-care-data-and-prediction-engine)
6. [Plugin system](#6-plugin-system)
7. [Frontend design](#7-frontend-design)
8. [Deployment](#8-deployment)
9. [Development environment](#9-development-environment)
10. [Testing strategy](#10-testing-strategy)
11. [Build order (milestones)](#11-build-order-milestones)
12. [Decisions needed](#12-decisions-needed)

---

## 1. Decisions at a glance

| Area | Choice | Why |
|---|---|---|
| Language | Python 3.12+ | The maintainer's strongest language; required by current Django |
| Web framework | **Django 6.1** (move to the next long-term support release when it ships) | Accounts, migrations, admin, multi-database support, and "apps" that double as plugins |
| API layer | **Django Ninja** | Typed request/response schemas (Pydantic), automatic OpenAPI docs |
| Authentication | **django-allauth** (headless mode) | Local accounts now; **OIDC** later is mostly configuration; supports MFA |
| Background jobs | **Huey** (SQLite storage by default; Redis optional) | Lightweight, built-in periodic tasks, no extra server needed |
| Database | **SQLite** default, **PostgreSQL** supported | Zero-setup default; Postgres for those who want it |
| Frontend | **React + TypeScript + Vite** | Large ecosystem, fast tooling |
| UI components | **Mantine** | Polished components, theming, dark mode, good accessibility |
| Server state | **TanStack Query** + **openapi-fetch** with types generated from the API | Caching and refetching for free; frontend types can't drift from the backend |
| i18n | Django's translation framework + **react-i18next** | Standard tools on each side |
| Mobile | **PWA** (installable web app) | One codebase; camera and notifications without app stores |
| Notifications | **Apprise** | One library covers about 100 services |
| Weather | **Open-Meteo** (built-in plugin) | Free for non-commercial use, no API key |
| Plant ID | **Pl@ntNet** (built-in plugin) | Free plan with 500 identifications/day |
| Plugin mechanism | Python **entry points** + **pluggy** hooks | Standard Python packaging; pluggy is pytest's proven plugin library |
| Packaging | **Docker** image (amd64 + arm64) on GitHub Container Registry | One-command install, runs on a Raspberry Pi |

## 2. Architecture

```mermaid
flowchart LR
    subgraph Phone["Phone / Browser"]
        PWA["React PWA<br/>(Mantine, TanStack Query)"]
    end

    subgraph Container["Docker image (same image, two processes)"]
        direction TB
        Web["Web process<br/>Django + Ninja API<br/>serves the built frontend"]
        Worker["Worker process<br/>Huey: reminders, weather refresh,<br/>schedule recalculation"]
        Core["Domain code<br/>(plants, care, prediction engine)"]
        Plugins["Plugins<br/>(weather, plant ID, ...)"]
        Web --> Core
        Worker --> Core
        Core <--> Plugins
    end

    DB[("SQLite or PostgreSQL")]
    Media[("Photos<br/>(/data/media)")]

    PWA -- "HTTPS JSON API<br/>(session cookie + CSRF)" --> Web
    Web --> DB
    Worker --> DB
    Web --> Media
    Plugins -. "optional, user-configured" .-> Ext["Open-Meteo, Pl@ntNet,<br/>Apprise targets, AI providers"]
```

Key points:
- **One deployable image.** The React app is compiled into static files that Django serves
  (via WhiteNoise). No separate frontend server in production.
- **Two processes** from the same image: the web server and the background worker. Docker
  Compose runs them as two services sharing one data volume.
- **The browser and API share one origin**, so authentication uses secure session cookies
  with CSRF protection. That's simpler and safer than storing tokens in the browser. Personal
  API tokens for third-party tools come later (roadmap v0.3).
- **The prediction engine is plain Python** with no Django imports, so it's fast to test and
  easy to reason about (see section 5).

## 3. Backend design

### Django apps
Each domain area is its own Django app under `backend/`, as the
[style guide](STYLE_GUIDE.md#project-structure-django) prescribes:

| App | Responsibility |
|---|---|
| `accounts` | Custom user model, households, memberships and roles, allauth integration |
| `places` | Sites (lat/lon, time zone), locations, light sources (windows, grow lights). Not named `sites`, to avoid clashing with Django's built-in `django.contrib.sites` app |
| `plants` | Plants, containers, photos |
| `taxonomy` | Species/genus reference data, search, and the care-archetype dataset loader |
| `care` | Care types, care events, schedules, due tasks, the "suggest a routine" service |
| `prediction` | The pure-Python care prediction engine (no models) |
| `notifications` | Notification channels (Apprise URLs), digests, delivery log |
| `pluginhost` | Plugin discovery, hook specifications, plugin settings (named so it isn't confused with the top-level `plugins/` folder of built-in plugins) |
| `dataio` | Export and import (JSON + photos zip) |
| `core` | Shared utilities: encryption of stored secrets, units, time zone helpers |

### Households and roles
Even though most instances will have a single household, we model it explicitly from day one.
Adding it later would mean rewriting every query.

- A **Household** owns all plant data (sites, plants, schedules).
- A **Membership** links a user to a household with a **role**:

| Role | Can |
|---|---|
| **Admin** | Everything, plus manage users, roles, household and plugin settings |
| **Gardener** | Add, edit, and archive sites, plants, and schedules; log care |
| **Viewer** | Read everything; no changes |

- In the MVP, the UI shows one household per instance. The data model already allows several,
  so "separate collections for separate people" is a future option rather than a rewrite.
- Every API endpoint resolves the current household and checks the role, using shared helpers,
  so permission checks can't be forgotten.

### Authentication
- **django-allauth in headless mode** provides sign-in, sign-out, password reset, email
  verification, and later MFA, through a JSON API that the React app calls.
- **OIDC** (roadmap v0.3) uses allauth's built-in OpenID Connect provider support. We plan for
  it now by keying users on email address and never assuming that a user has a password.
- A **first-run setup** screen creates the first Admin account. After that, open sign-up is
  **off** by default; Admins invite users.

### Background jobs (Huey)
| Job | When |
|---|---|
| Recalculate due dates for all schedules (`manage.py recalculate_schedules`) | Nightly. Schedules are also recalculated whenever they're read or changed, so they follow changes to plants, places and the care log without this job |
| Send reminders and daily digests | Every 15 minutes (checks who is due for a notification) |
| Refresh weather per site (plugin) | Every 1–3 hours |

Photo thumbnails are made during the upload instead: the browser has already shrunk the photo,
so it takes a fraction of a second.

Huey stores its queue in a separate SQLite file by default, so the default install needs no
Redis. Users with PostgreSQL or Redis can point Huey at Redis instead.

**As built (M9):** the worker is `manage.py run_huey` (`make dev` runs it; in Docker, the
`worker` command, a second Compose service from the same image that starts once the app is
healthy). Job times are in UTC: the nightly recalculation runs at 02:23, and plugins' jobs
(`register_periodic_jobs`, e.g. the weather refresh, hourly) run on their own cron schedules,
with their exceptions logged rather than stopping the worker. Tests run jobs immediately.

**Notifications as built (M9):** every 15 minutes, `notifications.send_due` looks at each person
with a channel in use. Their **daily digest** (default 08:00) and optional **evening reminder**
go out at their chosen times, in their own time zone (by default their household's first
site's), or up to 3 hours later if the worker was down. Neither is sent when nothing is due.
The digest lists today's and overdue tasks by location, plus frost warnings from plugins; the
reminder lists only what's still due. Each person gets one of each per day (a `NotificationLog`
row claims the day first, so two workers can't both send it); if every channel failed, it's
tried again on the next run within the window. Messages are written in the person's language.

> Django 6 added a built-in *tasks* API, but it doesn't include a production worker or
> periodic scheduling yet. Huey supports that API, so we can adopt it later without changing
> our job code much.

### Storing secrets
Plugin API keys and Apprise URLs (which often contain tokens) are **encrypted at rest** in the
database using Fernet (from the `cryptography` library), with a key from the
`SUNFLECK_ENCRYPTION_KEY` environment variable. Exports leave secrets out unless the user
explicitly asks to include them.

**As built (M9):** `sunfleck.core.crypto` encrypts with `MultiFernet`. `SUNFLECK_ENCRYPTION_KEY`
may hold several comma-separated keys: the first encrypts and all of them decrypt, so a key can
be replaced without losing anything. `manage.py encryption_key` prints a new one. Without the
variable, a key derived from `SECRET_KEY` (with HKDF) is used and a warning is logged, so a new
install works out of the box, but changing `SECRET_KEY` then makes stored secrets unreadable.
A channel whose URL can't be decrypted shows that as its error instead of failing silently.

### Configuration (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | *(required)* | Django cryptographic signing |
| `SUNFLECK_ENCRYPTION_KEY` | *(derived from `SECRET_KEY`)* | Encrypts stored secrets; recommended. Comma-separated to rotate keys |
| `SUNFLECK_PUBLIC_URL` | *(empty)* | The address people open Sunfleck at, e.g. `https://plants.example.com`; notifications link to it |
| `DATABASE_URL` | `sqlite:////data/db.sqlite3` | Database connection |
| `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` | `localhost` | Hostnames the app is served on |
| `TIME_ZONE` | `UTC` | Server default; each site has its own time zone |
| `EMAIL_URL` | *(empty)* | SMTP server for password resets and invitations, e.g. `smtp+tls://user:password@mail.example.com:587` (also `smtp://` and `smtps://`). Without it, emails are written to the log |
| `EMAIL_FROM` | `Sunfleck <sunfleck@localhost>` | Sender address for emails |
| `SUNFLECK_BEHIND_PROXY` | `false` | Trust `X-Forwarded-Proto`/`-Host` from a reverse proxy, so links in emails use the public `https://` address |
| `HUEY_REDIS_URL` | *(empty)* | Use Redis for the job queue instead of SQLite |
| `DEBUG` | `false` | Development mode only |

Sunfleck-specific settings use the `SUNFLECK_` prefix; standard Django settings keep their usual names.

## 4. Data model

The main models and their relationships. Field lists are abbreviated, and every model also
has `id`, `created_at` and `updated_at`.

```mermaid
erDiagram
    User ||--o{ Membership : has
    Household ||--o{ Membership : has
    Household ||--o{ Site : owns
    Household ||--o{ Plant : owns
    Household ||--o{ CareType : "defines custom"
    Site ||--o{ Location : contains
    Location ||--o{ LightSource : has
    Location ||--o{ Plant : holds
    Plant ||--o{ PlantLight : "is reached by"
    LightSource ||--o{ PlantLight : reaches
    Taxon ||--o{ Plant : "identifies (optional)"
    CareArchetype ||--o{ Taxon : "default care for"
    Plant ||--o{ Photo : has
    Plant ||--o{ CareEvent : logs
    Plant ||--o{ CareSchedule : has
    CareType ||--o{ CareEvent : "is type of"
    CareType ||--o{ CareSchedule : "is type of"
    CareSchedule ||--o{ ScheduleAdjustment : explains
    User ||--o{ NotificationChannel : configures
```

| Model | Key fields | Notes |
|---|---|---|
| **User** | email, display name, locale, unit system (metric/imperial) | Custom user model from day one (a Django best practice; very hard to change later) |
| **Household** | name | Owns all plant data |
| **Membership** | user, household, role (`admin` / `gardener` / `viewer`) | Unique per user + household |
| **Site** | household, name, latitude, longitude, time zone | A physical place; weather and frost data attach here. (No elevation field: Open-Meteo derives it from the coordinates.) |
| **Location** | site, name, kind (`indoor` / `outdoor`), typical temperature range (°C), humidity level, outdoor exposure (full sun / part shade / shade) | Indoor fields and outdoor fields are each optional depending on kind; fields that don't fit the kind are cleared |
| **LightSource** | location, kind (`window` / `grow_light`), name; windows: direction (N, NE, …); grow lights: PPFD (µmol/m²/s), on time, off time; enabled | Indoor locations only. A room can have several windows. Grow lights report their **DLI**. The app suggests typical PPFD values for people who don't know theirs |
| **CareArchetype** | key (e.g. `tropical_aroid`), name (per language), profile (the whole YAML profile: seasonal watering intervals, how dry to let the soil get, DLI range, humidity, temperature range, fertilizing, dormancy, status, sources) | Loaded from our CC BY-SA dataset (section 5); read-only in the app. Shown to people as a "care profile" |
| **Taxon** | scientific name, rank (genus/species), genus, family, common names (per language), older names (synonyms), note, care profile, search text | Reference data from the dataset; shared by all households. A plant whose species the dataset later drops keeps it |
| **Plant** | household, location (optional), nickname, species (taxon, optional), chosen care profile (optional), status (`active` / `dormant` / `gifted` / `deceased`), container diameter, container material, soil type, acquired on, cover photo, notes | An individual plant. Deleting its location keeps the plant. Its care profile is the chosen one, else its species' |
| **PlantLight** | plant, light source, distance from the window (cm) | Which of its location's windows and grow lights reach a plant. Plants in one room get different light, but share the room's fixtures: change a grow light's timer once and every plant under it follows |
| **Photo** | plant, image, thumbnail, width, height, taken at, caption | Stored as WebP (at most 2048 px, thumbnail 512 px). EXIF stripped; the date taken is read first. HEIC (iPhone) supported. Served through the API with a permission check |
| **CareType** | household (empty for built-ins), key (built-ins only), name, icon, affects-prediction flag, counts-as-watering flag | Built-ins: water, fertilize, repot, prune, mist, rotate, clean leaves, check for pests; the app translates their names by key. Households can add their own (marking kinds of watering, such as bottom watering, as watering), and rename or delete them until they've been used |
| **CareEvent** | plant, care type, performed at, performed by, notes, feedback (`too_dry` / `just_right` / `still_wet`, watering only), skipped flag | The care log. Feedback trains predictions. A plant's **timeline** shows its care events and photos together, newest first |
| **CareSchedule** | plant, care type, mode (`predicted` / `fixed`), interval for fixed schedules, origin (`suggested` / `manual`), in use, started on, snoozed until; the latest prediction: interval, next due date, factors, calculated on | One per plant per care type, and one for watering of any kind. Only watering and fertilizing can be predicted. A snooze puts off one due date: a new one (e.g. after the care is logged) ends it |
| **ScheduleAdjustment** | schedule, calculated at, interval, next due date, factors (JSON) | Recorded whenever a prediction changes: the history behind the "why", useful for debugging (shown in the Django admin) |
| **NotificationChannel** | user, label, Apprise URL (encrypted), service, enabled, last sent at, last error | One user can have several |
| **NotificationPreferences** | user, digest time, evening reminder time (optional), time zone | Times are in the person's time zone |
| **NotificationLog** | user, kind (digest/reminder), local date, status (sent/nothing due/failed), detail | One per person, kind and day: prevents duplicates; failed ones are retried |
| **PluginSetting** | plugin ID, household (optional), enabled, settings (JSON), secrets (encrypted) | Per plugin, optionally per household |

**Due tasks are derived, not stored.** "Today / Upcoming / Overdue" comes from each
schedule's next due date (or the day it's snoozed until, if later), counted in the plant's own
time zone. Completing a task creates a `CareEvent`, which marks the plant's schedules out of
date. This avoids keeping a separate task table in sync.

**Keeping predictions current.** Saving anything a prediction depends on (the plant, its light,
its location or site, its care log, its species or care profile) marks the affected schedules
out of date (Django signals, one cheap update each). Schedules are recalculated when read if
they're out of date or were last calculated on an earlier day, so the Today list only
recalculates what changed.

## 5. Care data and prediction engine

### The care archetype dataset
Lives in `data/care/`, licensed **CC BY-SA 4.0** with its own `LICENSE` file, separate from
the AGPL code (see [care-data-sources.md](care-data-sources.md)).

```
data/care/
├── LICENSE                 # CC BY-SA 4.0
├── README.md               # field reference, how to contribute, sources policy
├── dataset.yaml            # the dataset's version (bumped with every change)
├── schema/                 # JSON Schema that every file is validated against in CI
│   ├── archetype.schema.json
│   └── genera.schema.json
├── archetypes/             # 28 care profiles, one per file
│   ├── succulent.yaml
│   ├── tropical_aroid.yaml
│   └── ...
└── genera.yaml             # genera and common species → care profile, names, synonyms
```

Names and descriptions are stored per language (`name: {en: ...}`), so translations live in
the dataset too. Toxicity is left out for now: it will be added only with a citation per
plant, because a wrong "non-toxic" could hurt a pet.

Example archetype (values illustrative):

```yaml
key: tropical_aroid
name: Tropical aroid
examples: [Monstera, Philodendron, Epipremnum, Anthurium]
watering:
  interval_days: { spring: 7, summer: 6, autumn: 9, winter: 12 }
  let_dry: top_third          # how much soil should dry between waterings
light:
  dli_min: 6
  dli_ideal: 10
  dli_max: 20
humidity: medium_high
temperature_c: { min: 15, ideal_min: 18, ideal_max: 27, max: 32 }
fertilizing:
  interval_days: 30
  pause_months_north: [11, 12, 1, 2]   # mirrored automatically for the southern hemisphere
sources:
  - "General horticultural reference ... (citation)"
```

YAML is easy for non-programmers to edit and review. CI validates every file against the
schema. The dataset is loaded into the database after every `migrate` (so on every start of
the Docker image) when its version differs from the one loaded last; `manage.py
load_care_data` does it by hand.

### Taxonomy and search
- **Bundled (today):** the genera and common species in `genera.yaml`, written by hand with
  their common and older names. Search matches scientific, older and common names in any
  language, best matches first.
- **Bundled (later):** a larger index of genera and a few thousand common species, with common
  names in many languages, built from WCVP (CC BY) and Wikidata (CC0) by a script in
  `scripts/`, still small enough for a Raspberry Pi.
- **Online (optional, later):** search falls back to the free GBIF species API for anything
  not in the bundled index, and caches the result locally. This sends the search words to
  GBIF, so it'll be an opt-in plugin (M8).
- A species maps to an archetype through its genus (via `genera.yaml`), unless a species-level
  override exists. A plant with no species, or an unknown genus, picks an archetype directly
  ("Looks like a succulent").

### Suggested care routine
For care a plant has no schedule for yet, `care.schedules.suggest_routine()` proposes:
- **watering** and **fertilizing**, predicted from its care profile (so only when it has one,
  and only if the profile ever needs them: carnivorous plants aren't fertilized), recommended;
- reminders to **rotate** indoor plants every 14 days and **check for pests** every 30 days,
  offered but not recommended.

Each suggestion comes with its prediction and the factors behind it. The person accepts the
ones they want ("Water about every 8 days, fertilize monthly from March to October"), changing
any of them, all at once. They can switch a schedule between predicted and every-few-days,
pause it, or delete it later.

### Prediction engine
`backend/sunfleck/prediction/` is plain Python: it receives simple data objects and returns
results, with no database access. That makes it fast to test thoroughly, including with
property-based tests (Hypothesis) that check rules like "intervals always stay within sensible
bounds", "more light never means watering less often" and "fertilizing is never due in a pause
month".

```
inputs:  care profile, plant (pot, dormant or not), location (indoor/outdoor, light,
         temperature), date and hemisphere, when the care was last done, feedback,
         plugin-provided factors (e.g. weather, from M8)
output:  interval in days, next due date, list of factors that explain them
```

**Watering** (each factor is a small, separately tested function; its multiplier applies to
the interval, and factors under 2% are left out):

1. **Baseline:** the profile's interval for the current season. Seasons are meteorological
   (whole months: spring is March to May in the north) and follow the hemisphere of the site.
   A season with no interval (e.g. spring bulbs in summer) means no watering: it's due again
   when the next season with an interval starts.
2. **Light:** the plant's estimated DLI, from the windows and grow lights that reach it
   (window direction relative to the equator, falling off with distance: to about a third at
   1 m, which is also assumed when the distance isn't known; grow-light PPFD × hours) or from
   an outdoor location's exposure. It's compared with the profile's ideal DLI for that season,
   since the seasonal intervals already allow for darker winter days. Twice the light waters
   about 16% sooner (ratio^−0.25), within 0.8×–1.25×. Unknown light changes nothing, and the
   explanation says that adding windows or grow lights would refine it.
3. **Temperature:** an indoor location's typical temperature compared with the middle of the
   profile's ideal range: 2.5% sooner per °C warmer, within 0.8×–1.2×. Outdoor temperature comes
   from the weather plugin.
4. **Pot:** size compared with a typical 15 cm pot ((diameter/15)^0.35, within 0.8×–1.3×), and
   material (terracotta 0.85×, fabric 0.8×, wood 0.95×, in the ground 1.3×).
5. **Dormant plants** (status "dormant") are watered 1.5× less often.
6. **Learning from feedback:** each "still wet" lengthens the interval by 12.5% and each "too
   dry" shortens it by 10%, counting the last 10 answers, within 0.6×–1.6×, so that one unusual
   week doesn't swing the schedule.
7. **Plugin factors** (M8): for example, the weather plugin postpones outdoor watering after
   significant rain or before forecast rain, and raises frost alerts.
8. **Limits:** together, the factors stay within half and twice the season's interval (and
   1–180 days).

The next due date counts from the last watering (or from when the routine started, until
watering is logged). If that falls in a season without watering, it moves to when the season
ends.

**Fertilizing** follows the profile's interval, except in its pause months (mirrored for the
southern hemisphere): a date in a pause moves to the first month after it. Profiles without
fertilizing (carnivorous plants) and dormant plants have no due date.

Every factor produces an explanation that's stored in `ScheduleAdjustment` and shown in the
UI, for example: *"Watering moved 2 days later: cooler weather (−15%), lower winter light
(−10%)."*

Evapotranspiration-based outdoor watering and learning from the history of observed
intervals (beyond feedback) are on the v0.2/v0.3 roadmap.

## 6. Plugin system

### How plugins are found
A plugin is a normal Python package that declares an **entry point** in its `pyproject.toml`:

```toml
[project.entry-points."sunfleck.plugins"]
weather_openmeteo = "sunfleck_weather_openmeteo:plugin"
```

At startup, the app reads all installed entry points in that group, checks each plugin's
declared API version, and adds compatible plugins to Django's `INSTALLED_APPS`, so a plugin
can have its own models and migrations. **Built-in plugins use exactly the same mechanism**,
which proves the plugin API works.

### What a plugin declares

```python
plugin = PluginInfo(
    id="weather_openmeteo",
    name="Weather (Open-Meteo)",
    version="0.1.0",
    api_version="1",                         # plugin API version it was built for
    django_app="sunfleck_weather_openmeteo",
    settings_schema=WeatherSettings,         # Pydantic model, rendered as a form in the UI
    sends_data_to=["api.open-meteo.com: site latitude/longitude"],
)
```

### Hooks (MVP set)
Hooks are defined with **pluggy**. The app calls a hook and every enabled plugin that
implements it can respond.

| Hook | Purpose | Used by |
|---|---|---|
| `register_api(router)` | Add API endpoints under `/api/v1/plugins/<id>/` | Weather, plant ID |
| `register_periodic_jobs()` | Add background jobs | Weather refresh |
| `care_factors(context)` | Contribute factors to the prediction engine | Weather |
| `on_care_event_logged(event)` | React to a logged care event | (Examples, future) |
| `on_plant_created(plant)` | React to a new plant | (Future) |
| `identify_plant(images)` | Return species candidates from photos | Pl@ntNet |
| `search_taxa(query)` | Provide additional species search results | (Future: Trefle, Perenual) |
| `site_conditions(site)` | Provide current/forecast conditions for the dashboard | Weather |

Rules (from the [style guide](STYLE_GUIDE.md#8-plugins)): plugins fail gracefully, have their
own tables, and document what data they send.

**As built (M8)** — see [plugins.md](plugins.md) for plugin authors:
- The plugin API is the `sunfleck.plugins` package (version 1). `PluginInfo` also names the
  plugin's hooks module (imported once Django is ready) and its settings (a Pydantic model).
- **Plugins are turned on per household by an Admin** (Settings → Plugins), off by default,
  since most send data elsewhere; the page shows exactly what each sends. Settings are stored
  per household in `PluginSetting` and validated against the plugin's model. Secrets (API keys)
  came with the first plugin that needs them (Pl@ntNet, M10; see below).
- **Hooks are called one plugin at a time**, only for households that turned it on, with their
  settings. An exception is logged, kept as the plugin's latest error (shown on the Plugins
  page), and that plugin's answer is left out; the plugin stays on, since most failures (a
  service being down) are temporary. A plugin that can't be loaded at all is left out and
  listed on the page.
- `register_api` routers are mounted under `/api/v1/plugins/<id>/`; endpoints check access with
  `require_enabled`. `register_periodic_jobs` is defined now and run from M9.
- `search_taxa` will be added when its first plugin is; adding hooks doesn't break existing
  plugins.
- **Plant identification (M10):** `POST /api/v1/identify` takes 1 to 5 photos of a plant and
  passes them to the `identify_plant` hook as JPEG copies of at most 1280 px without metadata
  (so not where they were taken); Sunfleck keeps nothing. The candidates are matched to the care
  guide by scientific or older name, else by genus. When adding a plant, a photo can be
  identified and a candidate chosen as its species. Gardeners and Admins can identify plants.
- **Secret settings (M10):** plugin settings typed `SecretStr` (API keys) are stored encrypted
  in `PluginSetting.secrets` and never sent to the browser; an empty value keeps the stored one.
- **Built-in plugins** live in `plugins/`, each its own package installed by the backend from
  there (and into the Docker image as a regular package), so they go through exactly the same
  entry-point discovery as third-party ones.
- **Weather (Open-Meteo)**, the first: each site's weather on Today, frost warnings (sites with
  outdoor locations), and for outdoor watering: two days' wait after rain (or before forecast
  rain) and sooner watering in a hot spell (highs above the care profile's ideal maximum).
  Cool weather isn't counted, as the seasonal intervals already allow for it. Forecasts are
  fetched on demand when 3 hours old (M9 moves this to a background job), kept per site, and
  used for up to a day when Open-Meteo is down. It sends only each site's location, rounded to
  about 1 km.
- **Plant identification (Pl@ntNet)**, the second (M10): needs a free API key from
  my.plantnet.org (500 identifications a day), entered by an Admin and stored encrypted. It
  sends the photos to identify (without metadata), the person's language and the key, only when
  someone asks; it uses only the standard library. "Species not found" is an empty result; a
  rejected key, an exhausted quota or Pl@ntNet being down are explained to the person.

### Installing third-party plugins
For the MVP: install the package into the environment (`pip install ...`) and restart. For
Docker users, we'll document extending the image with a two-line `Dockerfile`. A plugin
directory or catalog is a v1.0 goal. **UI plugins** (plugins adding screens to the React
app) are also v1.0; until then, plugins contribute data the core UI already knows how to
show (settings forms, dashboard conditions, identification results).

## 7. Frontend design

### Libraries
| Need | Library |
|---|---|
| Framework / build | React + TypeScript (strict) + Vite |
| UI components and theming | Mantine (light/dark themes, design tokens) |
| Routing | React Router |
| Server state | TanStack Query |
| API client | `openapi-fetch` with types generated by `openapi-typescript` from the backend's OpenAPI schema |
| Forms | Mantine Form (with Zod validation where useful) |
| Translations | react-i18next |
| PWA | vite-plugin-pwa (app manifest, service worker, "install" prompt) |
| Icons | Tabler Icons (Mantine's companion icon set) |
| Map (pick site location) | Leaflet with OpenStreetMap tiles; manual lat/lon entry always available |
| Dates | Day.js (used by Mantine's date components) |

### Main screens (MVP)
1. **Today** (the home page): overdue and today's care grouped by location, one-tap "Done"
   with undo, a menu to skip, snooze (tomorrow, 3 days, a week) or log with details, and "Water
   all" for a location; then what's coming up in the next week, by day. (Snooze and skip are in
   a menu rather than swipe gestures, which are hard to discover and to use with a keyboard or
   screen reader.) Weather per site comes with the weather plugin (M8).
2. **Plants:** grid of photo cards with search and filters (location, status, needs care).
3. **Plant detail:** cover photo, care schedule with "why" explanations, care timeline
   (events and photos), quick actions (log care, add photo, give feedback).
4. **Add plant:** photo (optional identification) → species search or archetype pick → location
   → suggested routine to review → done.
5. **Sites and locations:** manage sites (map pick), locations, windows and grow lights.
6. **Settings:** profile, units, language, notification channels, household members and roles
   (Admin), plugins (Admin), export/import.

### Mobile and photo handling
- Designed for phones first (375px wide), then tablet and desktop layouts.
- Photos are taken with the phone's camera through the standard file input and **resized in
  the browser** before upload, which saves bandwidth and server storage.
- The PWA caches the app shell so it opens instantly. Full offline logging is a v1.0 goal.

## 8. Deployment

- **Dockerfile** (multi-stage): stage 1 builds the frontend with Node; stage 2 is a slim
  Python image with the backend, the built frontend, and the care dataset. Runs as a non-root
  user.
- **Images** for `linux/amd64` and `linux/arm64` (Raspberry Pi 4/5), built by GitHub Actions
  and published to GitHub Container Registry (`ghcr.io/mazelado/...`).
- **Web server:** Gunicorn serving Django; WhiteNoise serves static files; media files
  (photos) served by Django with permission checks.
- **Database migrations** run automatically on startup.
- **HTTPS:** handled by the user's reverse proxy (Caddy, Traefik, Nginx Proxy Manager), which is
  standard for self-hosting. Documented with examples.

Example `docker-compose.yml` for users:

```yaml
services:
  app:
    image: ghcr.io/mazelado/sunfleck:latest
    ports: ["8000:8000"]
    volumes: ["./data:/data"]
    env_file: .env
  worker:
    image: ghcr.io/mazelado/sunfleck:latest
    command: worker
    volumes: ["./data:/data"]
    env_file: .env
```

A PostgreSQL variant is provided as an optional Compose profile.

## 9. Development environment

### Repository layout

```
.
├── backend/
│   ├── pyproject.toml          # Python project, dependencies, Ruff/mypy/pytest config
│   ├── uv.lock
│   ├── manage.py
│   ├── config/                 # Django settings, URLs, WSGI, Huey config
│   ├── accounts/  places/  plants/  taxonomy/  care/  prediction/
│   ├── notifications/  pluginhost/  dataio/  core/
│   └── tests/                  # shared fixtures and factories (app tests live in each app)
├── plugins/
│   ├── weather-openmeteo/      # built-in plugin, its own small Python package
│   └── identify-plantnet/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                # generated types + API client
│       ├── components/         # shared UI components
│       ├── features/           # one folder per area: plants/, care/, sites/, settings/
│       ├── i18n/               # translation files
│       └── theme/              # Mantine theme and design tokens
├── data/care/                  # CC BY-SA 4.0 care dataset
├── docker/                     # Dockerfile, entrypoint script, compose examples
├── docs/                       # documentation and ADRs
├── scripts/                    # one-off tools (e.g. building the taxonomy index)
├── .github/                    # CI workflows, templates
├── Makefile                    # common commands: make dev, make test, make lint
└── .pre-commit-config.yaml
```

### Common commands
These will be set up in milestone 0. You'll mostly type `make <something>`:

| Command | Does |
|---|---|
| `make setup` | Install backend and frontend dependencies, set up pre-commit hooks |
| `make dev` | Run the Django dev server, the Vite dev server (with hot reload), and the worker together |
| `make test` | Run all backend and frontend tests |
| `make lint` | Run Ruff, mypy, ESLint, Prettier, and TypeScript checks |
| `make api-types` | Regenerate frontend API types from the backend schema |
| `make docker` | Build the production Docker image locally |

During development, the Vite dev server (port 5173) forwards `/api` requests to Django (port
8000), so the browser sees one origin, just like production.

### Requirements on your machine
- Python 3.12+ and **uv**
- Node.js (current LTS) and npm
- Git, Docker (for building and testing the image)
- An editor; VS Code with the Python, Pylance, Ruff, ESLint, and Prettier extensions works well

## 10. Testing strategy

| Layer | Tools | What we test |
|---|---|---|
| Prediction engine | pytest, **Hypothesis** (property-based) | Every factor, season/hemisphere logic, bounds, explanations, edge cases (DST, leap years, dormancy) |
| Services and models | pytest-django, factory_boy, time-machine (freezing time) | Business rules: suggesting routines, logging care, recalculating schedules, export/import round trip |
| API | Django Ninja test client | Every endpoint: success, validation errors, and **permission refusals per role** |
| Plugins | pytest, with HTTP calls mocked (respx/responses) | Hook behavior, failure isolation (a broken plugin doesn't break the app) |
| Frontend | Vitest, React Testing Library, **MSW** (mock API) | Components and screens from the user's point of view |
| End-to-end | Playwright | Sign in → add plant → accept routine → log watering → see next due date |
| Care dataset | JSON Schema validation in CI | Every archetype file is valid and complete |

**CI (GitHub Actions)** runs on every pull request: lint and type checks, backend tests on
SQLite **and** PostgreSQL, frontend tests, Playwright tests, dataset validation, and a Docker
build. Pull requests can't be merged unless CI passes (branch protection on `main`).

## 11. Build order (milestones)

Each milestone is a handful of small pull requests and ends with something you can run and
see. You'll review and merge each PR, and the steps get explained as we go.

| # | Milestone | You'll be able to... |
|---|---|---|
| **M0** | **Scaffolding:** repo layout, Django + React "hello world", Ruff/mypy/ESLint/Prettier, pre-commit, CI, Dockerfile, `Makefile` | Run `make dev`, see a page, and see CI checks on PRs |
| **M1** | **Accounts:** custom user, households, roles, allauth headless, first-run setup, sign-in screens | Create the admin account, sign in, invite a user |
| **M2** | **Sites and locations:** sites with map picker, indoor/outdoor locations, windows and grow lights | Describe your home and garden |
| **M3** | **Plants and photos:** plant CRUD, photo upload with resizing and thumbnails, plant grid and detail | Add your plants with photos |
| **M4** | **Care logging:** care types, events, timeline, one-tap logging, feedback | Log watering and see the history |
| **M5** | **Care data:** archetype schema and first ~30 archetypes, genus mappings, taxonomy index, species search | Search "Monstera" and see its care profile |
| **M6** | **Prediction and routines:** prediction engine, suggested routine, schedules, "why" explanations | Accept a suggested routine and see due dates |
| **M7** | **Today dashboard:** due/overdue/upcoming, complete/snooze/skip, bulk actions | Use the app daily |
| **M8** | **Plugin system + weather plugin:** discovery, hooks, settings UI, Open-Meteo, frost alerts, rain postponement | See weather and weather-adjusted outdoor schedules |
| **M9** | **Notifications:** Huey worker, Apprise channels, reminders, daily digest | Get a reminder on your phone |
| **M10** | **Plant identification plugin:** Pl@ntNet | Identify a plant from a photo when adding it |
| **M11** | **Release polish:** export/import, PWA install, translations setup, docs, accessibility pass, v0.1.0 release | Install it from the published Docker image |

Milestones M5 (dataset content) and M2–M4 (app features) can proceed in parallel. Writing
archetypes is plant knowledge, not code, and a good way for non-programmers to contribute.

## 12. Decisions

Resolved on 2026-10-27:
- ~~Approve the plan?~~ Approved.
- ~~Internal code name?~~ The project is named **Sunfleck**: a brief patch of sunlight that
  reaches the forest floor through the canopy. Python package `sunfleck`, plugin entry-point
  group `sunfleck.plugins`, environment variable prefix `SUNFLECK_`, Docker image
  `ghcr.io/mazelado/sunfleck`.

Still open:
1. **Branch protection on `main`** (requires PRs and passing CI before merging). To be set up
   once CI exists in M0.
