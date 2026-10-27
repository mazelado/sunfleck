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
| Recalculate due dates for all active schedules | Nightly, per household time zone, and after any care event or settings change |
| Send reminders and daily digests | Every 15 minutes (checks who is due for a notification) |
| Refresh weather per site (plugin) | Every 1–3 hours |

Photo thumbnails are made during the upload instead: the browser has already shrunk the photo,
so it takes a fraction of a second.

Huey stores its queue in a separate SQLite file by default, so the default install needs no
Redis. Users with PostgreSQL or Redis can point Huey at Redis instead.

> Django 6 added a built-in *tasks* API, but it doesn't include a production worker or
> periodic scheduling yet. Huey supports that API, so we can adopt it later without changing
> our job code much.

### Storing secrets
Plugin API keys and Apprise URLs (which often contain tokens) are **encrypted at rest** in the
database using Fernet (from the `cryptography` library), with a key from the
`SUNFLECK_ENCRYPTION_KEY` environment variable. Exports leave secrets out unless the user
explicitly asks to include them.

### Configuration (environment variables)
| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | *(required)* | Django cryptographic signing |
| `SUNFLECK_ENCRYPTION_KEY` | *(required)* | Encrypts stored secrets |
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
| **CareArchetype** | key (e.g. `tropical_aroid`), name, seasonal watering intervals, DLI range, humidity, temperature range, fertilizing cadence, dormancy months, dataset version | Loaded from our CC BY-SA dataset (section 5); read-only in the app |
| **Taxon** | scientific name, rank (genus/species), genus, family, accepted name (for synonyms), common names (per language), archetype, source, external IDs (WCVP, GBIF, Wikidata) | Reference data; shared by all households |
| **Plant** | household, location (optional), nickname, taxon (optional), archetype override, status (`active` / `dormant` / `gifted` / `deceased`), container diameter, container material, soil type, acquired on, cover photo, notes | An individual plant. Deleting its location keeps the plant. Taxon and archetype override arrive with the care data (M5) |
| **PlantLight** | plant, light source, distance from the window (cm) | Which of its location's windows and grow lights reach a plant. Plants in one room get different light, but share the room's fixtures: change a grow light's timer once and every plant under it follows |
| **Photo** | plant, image, thumbnail, width, height, taken at, caption | Stored as WebP (at most 2048 px, thumbnail 512 px). EXIF stripped; the date taken is read first. HEIC (iPhone) supported. Served through the API with a permission check |
| **CareType** | household (empty for built-ins), key (built-ins only), name, icon, affects-prediction flag | Built-ins: water, fertilize, repot, prune, mist, rotate, clean leaves, check for pests; the app translates their names by key. Households can add their own, and rename or delete them until they've been used |
| **CareEvent** | plant, care type, performed at, performed by, notes, feedback (`too_dry` / `just_right` / `still_wet`, watering only), skipped flag | The care log. Feedback trains predictions. A plant's **timeline** shows its care events and photos together, newest first |
| **CareSchedule** | plant, care type, mode (`fixed` / `predicted`), base interval days, current interval days, next due date, snoozed until, origin (`suggested` / `manual`), enabled | One per plant per care type |
| **ScheduleAdjustment** | schedule, calculated at, factors (JSON), resulting interval | The "why" behind each prediction; also useful for debugging |
| **NotificationChannel** | user, Apprise URL (encrypted), label, enabled, digest time, quiet hours | One user can have several |
| **NotificationLog** | user, schedule, sent at, channel, status | Prevents duplicate reminders |
| **PluginSetting** | plugin ID, household (optional), enabled, settings (JSON), secrets (encrypted) | Per plugin, optionally per household |

**Due tasks are derived, not stored.** "Today / Upcoming / Overdue" is a query over
`CareSchedule.next_due_date` (respecting `snoozed_until`). Completing a task creates a
`CareEvent`, which triggers recalculation. This avoids keeping a separate task table in sync.

## 5. Care data and prediction engine

### The care archetype dataset
Lives in `data/care/`, licensed **CC BY-SA 4.0** with its own `LICENSE` file, separate from
the AGPL code (see [care-data-sources.md](care-data-sources.md)).

```
data/care/
├── LICENSE                 # CC BY-SA 4.0
├── README.md               # how to contribute, sources policy, attribution
├── schema.json             # JSON Schema that every file is validated against in CI
├── archetypes/
│   ├── succulent.yaml
│   ├── tropical_aroid.yaml
│   └── ...
└── genera.yaml             # genus → archetype mapping, with overrides and toxicity
```

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
schema. A management command (`load_care_data`) loads the dataset into the database on
startup when the dataset version changes.

### Taxonomy and search
- **Bundled:** a compact index of genera plus a few thousand common species (scientific names,
  synonyms, and common names in several languages). It's built from WCVP (CC BY) and Wikidata
  (CC0) by a script in `scripts/`, so it stays small enough for a Raspberry Pi.
- **Online (optional):** search falls back to the free GBIF species API for anything not in the
  bundled index, and caches the result locally.
- A species maps to an archetype through its genus (via `genera.yaml`), unless a species-level
  override exists. A plant with no species, or an unknown genus, picks an archetype directly
  ("Looks like a succulent").

### Suggested care routine
When a plant is added (or its location or species changes), `care.services.suggest_routine()`
proposes schedules for watering, fertilizing, and other relevant care types from the
archetype, adjusted for the location. The user sees the proposal ("Water about every 8 days,
fertilize monthly from March to October") and accepts it, edits it, or skips it.

### Prediction engine
`backend/prediction/` is plain Python: it receives simple data objects and returns results,
with no database access. That makes it fast to test thoroughly, including with property-based
tests (Hypothesis) that check rules like "intervals always stay within sensible bounds".

```
inputs:  archetype, plant (container, status), location (indoor/outdoor, light, temperature),
         date and hemisphere, recent care events with feedback,
         plugin-provided factors (e.g. weather)
output:  interval in days, next due date, list of factors with plain-language explanations
```

Calculation for the MVP (each factor is a small, separately tested function):

1. **Baseline:** the archetype's interval for the current season. Seasons are derived from the
   date *and* hemisphere (from the site latitude).
2. **Light factor:** estimated DLI for the plant, from the windows and grow lights that reach
   it (window direction and the plant's distance from it; grow-light PPFD × hours), compared
   with the archetype's ideal. More light means more frequent
   watering, within limits.
3. **Temperature factor:** indoor temperature setting, or outdoor forecast (via the weather
   plugin).
4. **Container factor:** small and terracotta pots dry faster than large or plastic ones.
5. **Plugin factors:** for example, the weather plugin postpones outdoor watering after
   significant rain or before forecast rain, and raises frost alerts.
6. **Learning from feedback:** "still wet" lengthens the interval and "too dry" shortens it,
   using exponential smoothing so that one unusual week doesn't swing the schedule.
7. **Clamp:** the result always stays within the archetype's allowed range.

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

Rules (from the [style guide](STYLE_GUIDE.md#8-plugins)): plugins fail gracefully (exceptions
are caught and logged, and the plugin is disabled, never crashing the app), have their own
tables, and document what data they send.

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
1. **Today:** due and overdue tasks grouped by location, one-tap "Done", swipe to snooze or skip,
   weather strip per site, "water everything in this location".
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
│   ├── weather_openmeteo/      # built-in plugin, its own small Python package
│   └── identify_plantnet/
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
