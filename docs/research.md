# Market Research: Plant Care Apps

> **Status:** Draft for discussion · **Last updated:** 2026-10-26
>
> This document surveys existing plant care apps, both open source and commercial, to
> decide the **MVP** (minimum viable product: the smallest version worth releasing) and
> a **roadmap** for this project. Feature claims about commercial apps come mostly from
> their own marketing and app store listings, so treat them as claims rather than
> independently tested facts.

## 1. Project goals (recap)

- Self-hosted, free and open source (AGPL-3.0), written in Python.
- For **plant hobbyists and enthusiasts**: an individual or a household, not large organizations.
- **Indoor and outdoor** plants, so it must understand light (windows, grow lights),
  location (latitude/longitude), and weather.
- **Mobile-first** use: photos, quick care logging, reminders, notifications, AI help.
- **Lightweight** to host (a Raspberry Pi should be enough), but beautiful and pleasant to use.
- **Extensible** through add-ons (plugins).
- **Optional AI features**: the app must remain fully useful with AI turned off.

## 2. Apps studied

### 2.1 Open source / self-hosted

| App | Stack | License | Focus | Status |
|---|---|---|---|---|
| **HortusFox** | PHP (Asatru framework), Vue, MariaDB | MIT | Collaborative plant management for a household or group | Active. Pull requests disabled since 2026-04-15; AI-generated code explicitly rejected |
| **Plant-it** | Originally Java server + web UI; now Flutter Android app | GPL-3.0 | Care *logging* (deliberately gives no care advice) | Mature; development has slowed |
| **Home Assistant "plant" integration** (Olen/homeassistant-plant) | Python (HA custom component) | Open source | Sensor-based monitoring (moisture, light, temperature, conductivity) | Active community project |
| **Garden Party** | Ruby on Rails | MIT | Outdoor garden layout maps, planning, tasks | Smaller project |
| **Brinjel** (formerly QROP) | n/a | FLOSS | Market gardening: crop planning, rotations, seeds, harvests | Out of scope (commercial growers), but a useful reference for outdoor features |

### 2.2 Commercial (closed source)

| App | Focus | Pricing model |
|---|---|---|
| **Planta** | Personalized indoor care schedules, light meter, diagnosis ("Dr. Planta") | Freemium; roughly $8–10/month for premium |
| **Greg** | Precision watering based on plant, pot, window, and local climate | Freemium; about $30/year premium |
| **Blossom** | Identification, disease diagnosis, AI botanist, auto-reminders, water calculator | Subscription |
| **PictureThis** | Identification (claims 400k+ species), diagnosis, toxicity warnings | Subscription |
| **Gardenize** | Garden journal: photos, notes, garden areas, reminders, history | Freemium |
| **Planter** | Vegetable garden planning: square-foot grid, companion planting, frost-date calendar | Freemium |

## 3. Notes per app

### HortusFox
The closest open-source equivalent to what we're building, and the project that inspired this one.

- **Features:** plants with attributes, photos, notes and logs; custom locations (every plant
  belongs to a location); tasks (recurring, overdue); inventory of supplies; calendar;
  search; history; weather (OpenWeatherMap, needs your own API key); group chat; themes;
  admin dashboard; email reminders via cron jobs; backup/export; REST API; QR codes;
  plant identification via **Pl@ntNet** (needs your own API key).
- **Strengths:** broad feature set, multi-user, easy Docker install, a proven community.
- **Weaknesses / opportunities:**
  - Care tracking is mostly manual. Weather is displayed but doesn't drive any care decisions.
  - No grow light modeling and no sensor integration.
  - Requires MariaDB. There is no lightweight SQLite option.
  - No plugin system.
  - Closed to outside contributions as of April 2026.
- **Lesson:** "plants belong to locations" is a good, simple mental model. Self-hosters
  value backup/export, a REST API, and a one-command Docker install.

### Plant-it
- **Features:** add plants (from a species database or custom), log events (watering,
  fertilizing, etc.), filter history, photos, reminders based on time since the last event,
  calendar of upcoming reminders, Gotify notifications (in the server version).
- **Philosophy:** the author deliberately *logs* activity instead of *prescribing* care,
  on the grounds that the grower knows best.
- **Lesson:** our app should support both styles. Advice-driven schedules should be easy
  to override or ignore, and "just log it" must be frictionless. Plant-it moved from a
  self-hosted server to an Android-only app, which suggests that a heavy server stack
  (Java + MySQL + Redis) was a burden for a solo maintainer. That supports keeping our
  stack light.

### Home Assistant plant integration
- **Features:** each plant is a device with sensors and per-plant thresholds; computes
  **DLI** (Daily Light Integral) and **VPD** (Vapour Pressure Deficit); problem detection;
  pulls species thresholds from **OpenPlantbook**.
- **Lesson:** many self-hosters already run Home Assistant and cheap soil sensors (Mi Flora,
  Zigbee sensors). Integrating with HA/MQTT, rather than talking to sensors directly, reaches
  that audience with little effort. DLI is the right metric for grow lights.

### Planta
- **Features:** care schedules and reminders (water, fertilize, mist, repot, clean) tailored
  to plant, environment and local weather; camera **light meter**; plant identification;
  **Dr. Planta** symptom diagnosis with treatment steps; recommendations of which plants
  suit a spot.
- **Lesson:** this is the polished UX benchmark. Its key ideas are *per-plant schedules
  that adapt* and *the light at a spot as a first-class concept*. Paywalls on the light
  meter and diagnosis are a common user complaint, which is an opening for a free app.

### Greg
- **Features:** "precision watering" that calculates *how much* and *when* to water from
  species, plant size, pot size and material, window distance and direction, and nearby
  heating/AC. It claims to use the FAO Penman–Monteith evapotranspiration model with local
  weather, and it learns when you water early or late.
- **Lesson:** the strongest idea in the market. Watering frequency depends on the
  environment, not just the species. We can approximate this openly. **Open-Meteo**
  provides reference evapotranspiration (ET₀) forecasts for free.

### Blossom and PictureThis
- **Features:** photo identification, photo-based disease diagnosis with causes and
  treatments, toxicity warnings (pets and children), automatic reminders, a water
  calculator, and a planting calendar for edibles (Blossom).
- **Lesson:** identification and diagnosis are table stakes for mobile users. Toxicity
  information matters to pet owners, but it must be presented carefully because wrong
  answers can cause harm.

### Gardenize
- **Features:** garden journal with photos and notes per plant, plants linked to one or more
  garden areas, reminders and to-do lists in a calendar, a drawing tool to annotate photos
  (for example, "bulbs planted here"), and a full history of the garden.
- **Lesson:** for outdoor gardeners, the **journal and photo timeline** is the core
  experience, more than strict schedules.

### Planter (and similar: VeggieLog, GrowWise)
- **Features:** square-foot garden grid, companion and antagonistic plants, a sowing and
  transplanting calendar driven by **local frost dates**, harvest logs.
- **Lesson:** outdoor edible gardening is a distinct use case with its own needs (beds,
  seasons, frost dates). It's valuable, but large, so it's a good roadmap item rather than MVP.

## 4. Feature matrix

Legend: ✅ has it · ◐ partial or limited · — doesn't have it · 💲 paid tier only

| Feature | HortusFox | Plant-it | HA plant | Planta | Greg | Blossom / PictureThis | Gardenize | Planter |
|---|---|---|---|---|---|---|---|---|
| Plant collection + photos | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ | ✅ | ◐ |
| Locations / rooms / areas | ✅ | — | — | ✅ | ✅ | — | ✅ | ✅ |
| Care log (water, fertilize…) | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ◐ |
| Recurring reminders | ✅ | ✅ | ◐ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adaptive schedules (env/weather) | — | — | — | ◐💲 | ✅💲 | ◐ | — | ◐ |
| Weather display | ✅ | — | — | ◐ | ◐ | — | — | — |
| Frost dates / seasonal calendar | — | — | — | — | — | ◐ | — | ✅ |
| Light modeling (windows/grow lights/DLI) | — | — | ✅ (sensors) | ✅💲 (light meter) | ✅ | — | — | — |
| Sensor integration | — | — | ✅ | — | — | — | — | — |
| Plant identification | ✅ (Pl@ntNet) | — | — | ✅ | ✅ | ✅ | ✅ | — |
| Disease / problem diagnosis | — | — | ◐ (thresholds) | ✅💲 | — | ✅💲 | — | — |
| Toxicity info | — | — | — | ◐ | ◐ | ✅ | — | — |
| Species care database | — | ✅ | ✅ (OpenPlantbook) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-user / household | ✅ | — | ✅ | ◐ | — | — | ◐ | — |
| Inventory (supplies) | ✅ | — | — | — | — | — | — | — |
| Garden layout map | — | — | — | — | — | — | ◐ | ✅ |
| Notifications (push/email/etc.) | ✅ (email) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Backup / export | ✅ | ◐ | ✅ | — | — | — | ◐ | — |
| API | ✅ | ◐ | ✅ | — | — | — | — | — |
| Plugins / add-ons | — | — | (HA ecosystem) | — | — | — | — | — |
| Self-hosted | ✅ | ◐ | ✅ | — | — | — | — | — |

## 5. External services and data sources

Every external service should be **optional and pluggable**. Users bring their own API keys,
and the app works without any of them.

### Plant identification
| Provider | Notes |
|---|---|
| **Pl@ntNet API** | Free plan with 500 identifications/day; used by HortusFox. Best default. |
| **Kindwise (plant.id)** | 100 free trial credits, then about €0.01–0.05 per identification. Also offers health/disease assessment. Good optional plugin. |
| **Vision-capable LLM** | Any configured AI provider (below) can attempt identification and diagnosis from a photo. Less reliable for species ID than dedicated models, but it can explain its reasoning. |

### Species and care data
| Source | Notes |
|---|---|
| **Trefle** | Botanical data (backed by Kew's POWO); appears active as of 2026. Strong on taxonomy, weak on houseplant care guidance. |
| **OpenPlantbook** | Free account; sensor thresholds per species (moisture, light, temperature). Used by Home Assistant. |
| **GBIF / Wikidata / Wikipedia** | Open data for taxonomy, common names, and descriptions. |
| **Perenual** | Commercial plant care API; free tier is non-commercial and limited (100 requests/day). Optional plugin only. |
| **User-defined care profiles** | Always available; the app's own built-in defaults per plant type (succulent, tropical, herb…). |

> **Licensing:** see [care-data-sources.md](care-data-sources.md) for the full analysis. In
> short, no openly licensed source has houseplant-quality care data we can bundle, so we
> plan to build our own open "care archetype" dataset and treat the APIs above as optional
> enhancements.

### Weather
| Provider | Notes |
|---|---|
| **Open-Meteo** | Free for non-commercial use, **no API key**, forecasts include ET₀ (evapotranspiration), precipitation, and temperatures. Open source and self-hostable. **Recommended default.** |
| **OpenWeatherMap** | Requires an API key; used by HortusFox. Possible alternative plugin. |

### Notifications
| Option | Notes |
|---|---|
| **Apprise** (Python library) | One integration covers about 100 services: email, ntfy, Gotify, Discord, Telegram, Pushover… **Recommended.** |
| **Web Push** | Native-feeling notifications on phones through the PWA. Supported on Android, and on iOS when the app is added to the home screen. |
| **iCal feed** | Lets users see care tasks in their existing calendar app. |

### AI providers
| Option | Notes |
|---|---|
| **OpenAI-compatible API** | One interface covers OpenAI and many hosted providers, plus **local models** through Ollama, LM Studio, or llama.cpp. Local models matter to privacy-minded self-hosters. |
| **Anthropic (Claude)** | Strong at reasoning and image understanding; can be a separate provider plugin. |

## 6. Key domain concepts

These emerged from the research and will shape the data model:

- **Site:** a physical place with a **latitude/longitude** and time zone, such as "Home" or
  "Allotment". Weather and frost dates attach here.
- **Location:** an area within a site. Either **indoor** (a room or shelf: window direction,
  distance from window, temperature and humidity range) or **outdoor** (a bed, balcony, or
  yard area: sun exposure, sheltered or exposed).
- **Light source:** a window (direction plus distance) or a **grow light** (PPFD intensity,
  photoperiod on/off schedule). The app can calculate **DLI** with
  `DLI = PPFD × hours × 0.0036`.
- **Plant:** an individual plant (not a species), with an optional linked **species**, a
  location, a container (pot size and material, soil type), an acquisition date, and a
  status (alive, dormant, gifted, deceased).
- **Care event:** something that happened, such as watered, fertilized, repotted, pruned,
  treated for pests, or a custom type. Each event can have notes and photos.
- **Care schedule:** a rule for when something should happen. It starts as a fixed interval
  ("every 7 days"). Later versions can adjust it from weather, season, sensor readings, and
  the plant's own history.
- **Reminder / task:** a concrete due item generated from a schedule, which you can
  complete, snooze, or skip.
- **Journal entry / photo:** the plant's timeline, which also lets you see growth over time.

## 7. Gaps we can fill

No existing open-source app combines:

1. **Indoor and outdoor** plants in one model, with light (windows, grow lights, DLI) and
   location (lat/lon, weather, frost) treated as first-class concepts.
2. **Weather- and environment-aware care**, the main paid feature of Greg and Planta,
   available for free and with transparent logic.
3. **Optional AI with local models**: identification, diagnosis, and Q&A that can run fully
   on your own hardware.
4. **A plugin system**, so the community can add providers, integrations, and features
   without forking.
5. **Lightweight hosting**: one container, SQLite by default, comfortable on a Raspberry Pi.
6. **A polished mobile experience** as an installable PWA, without app store gatekeeping.

## 8. Proposed MVP (v0.1)

The goal is **a beautiful, reliable daily-use app for logging care and getting reminders,
for indoor and outdoor plants, with a working plugin system proven by two built-in plugins.**

### Core
- [ ] **Accounts and permissions:** sign-in, a first-run setup wizard, and users with
  **roles**: *Admin* (manage users and settings), *Gardener* (add/edit plants and log care),
  *Viewer* (read-only). The user model is designed so that **OIDC** single sign-on can be
  added later without restructuring.
- [ ] **Sites and locations:** sites with lat/lon (picked on a map or entered manually);
  indoor and outdoor locations; window direction; grow lights with photoperiod.
- [ ] **Plants:** create, edit, and archive plants; species as free text with optional lookup;
  container info; status.
- [ ] **Photos:** upload from the phone camera, a per-plant photo timeline, and a cover photo.
- [ ] **Care log:** built-in care types plus custom ones; **one-tap "watered" from the
  dashboard**; backdating; notes.
- [ ] **Schedules and reminders:** an interval per plant per care type; a "Today / Upcoming /
  Overdue" dashboard; complete, snooze, or skip; "water all plants in this location".
- [ ] **Suggested care routine:** when you add a plant, the app proposes a complete care
  schedule (watering, fertilizing, light) from the plant's care profile and its location.
  You review it, then accept it with one tap. Uses our own open care archetype dataset (see
  [care-data-sources.md](care-data-sources.md)), so it works without AI or external accounts.
- [ ] **Care prediction (first version):** due dates are adjusted for season, light (window
  or grow light DLI), and, for outdoor plants, weather. Each prediction explains *why* it
  changed. Simple "soil was still wet / too dry" feedback tunes future predictions.
- [ ] **Notifications:** through Apprise (email, ntfy, Gotify, etc.), with a daily digest
  and/or per-task notifications, plus in-app notifications.
- [ ] **Data ownership:** full export (JSON + photos in a zip) and import; a documented
  backup procedure.

### Built-in plugins (to prove the plugin system)
- [ ] **Weather (Open-Meteo):** current conditions and forecast per site; **frost warnings**
  for outdoor plants; **"rain expected, skip outdoor watering"** suggestions.
- [ ] **Plant identification (Pl@ntNet):** identify a plant from a photo when adding it
  (the user provides their own API key).

### Platform
- [ ] Django + Django Ninja API, React + TypeScript frontend, served as one app.
- [ ] Mobile-first, responsive, **installable PWA**; light and dark themes.
- [ ] SQLite by default; PostgreSQL supported and tested in CI.
- [ ] A plugin system using Python entry points, with documented hooks (events like
  `care_event_logged`, plus the ability to register settings, API routes, and scheduled jobs).
- [ ] Translation-ready (i18n) from day one; English at launch.
- [ ] Single Docker image plus a `docker-compose.yml`; runs on ARM (Raspberry Pi).
- [ ] Unit and API tests (pytest), frontend tests (Vitest), CI with GitHub Actions.

### Deliberately *not* in the MVP
Garden maps, sensors, chat/LLM features, evapotranspiration-based watering math, OIDC,
inventory, propagation tracking, native apps, offline mode, UI plugins. They're on the
roadmap below. Keeping the MVP small is what gets it finished.

> **Decided (2026-10-26):** the MVP's "AI" focus is **predicting when plants need care**
> (water, fertilizer, light) and **suggesting a care routine** that sets up the schedule
> automatically. Chat-style features come later. See
> [care-data-sources.md](care-data-sources.md#how-this-feeds-care-prediction) for how
> prediction works.

## 9. Roadmap (after MVP)

Order and scope are open for discussion. Each phase is meant to be a usable release.

### v0.2: Smarter care and AI providers
- **Adaptive intervals** that learn from your actual care history ("you usually water
  this every 9 days, not 7: update the schedule?").
- **Grow light tools:** DLI calculator, light schedule recommendations, "is this spot bright
  enough?" estimates for windows.
- AI provider plugins: OpenAI-compatible (covers Ollama and other local models), Anthropic.
- **AI care profile suggestions** for unusual plants that don't match a built-in archetype
  (always reviewed by the user).
- Optional care data provider plugins: Open Plantbook, Perenual, Trefle.
- Toxicity flags (pets/children) with sources.

### Later: AI assistant
- **Photo diagnosis**: "what's wrong with my plant?", with likely causes and next steps,
  clearly labeled as suggestions.
- **Ask about this plant**: chat with the plant's history and conditions as context.

### v0.3: Integrations and environment-aware care
- **Home Assistant / MQTT** sensor readings (soil moisture, light, temperature, humidity);
  reminders triggered by sensor thresholds.
- **Weather-adaptive outdoor watering** using Open-Meteo ET₀ and rainfall (a transparent,
  documented formula).
- Seasonal adjustments (dormancy, reduced winter watering, fertilizing pauses).
- **Web Push** notifications; **iCal** feed of tasks.
- **OIDC single sign-on** (Authentik, Keycloak, Authelia, Pocket ID, etc.).
- **Import from HortusFox and Plant-it** to make migrating easy.
- Public REST API docs and personal API tokens.

### v0.4: Outdoor and edible gardening
- Garden beds and a simple **garden map / layout**.
- **Frost dates** from location; sowing, transplanting, and harvest calendar.
- Harvest log (yields), seeds inventory.
- Companion planting hints (as a plugin with its own data).

### v0.5: Collector features
- **Propagation and lineage** (cuttings, divisions, seedlings: "this plant came from that one").
- Supplies inventory (soil, fertilizer, pots), with optional reminders to restock.
- **QR / NFC labels** that open the plant page.
- Statistics and charts; growth time-lapse from photos.
- Wishlist / plants wanted.

### v1.0: Mature platform
- **Frontend plugin slots**, so add-ons can contribute UI (widgets, plant page tabs).
- Plugin catalog page and plugin development guide.
- Offline support for logging care without a connection, syncing later.
- Hardened security review, stable API versioning, upgrade guarantees.

## 10. Open questions

Resolved on 2026-10-26:
- ~~LLM feature in the MVP?~~ No. The MVP's AI focus is care prediction and suggested care
  routines; chat comes later.
- ~~Multi-user?~~ Users with roles (Admin / Gardener / Viewer) in the MVP; OIDC later.
- ~~Open-Meteo's non-commercial terms?~~ Acceptable: the project targets self-hosting.
- ~~Care data source?~~ Analyzed in [care-data-sources.md](care-data-sources.md).
  Recommendation: our own open care archetype dataset, plus optional providers.

Still open:
1. Data license for our own care dataset: CC0 or CC BY-SA 4.0?
2. Name and visual identity.

## Sources

- HortusFox: [GitHub repository](https://github.com/danielbrendel/hortusfox-web),
  [CONTRIBUTING.md](https://github.com/danielbrendel/hortusfox-web/blob/main/CONTRIBUTING.md),
  [LinuxLinks overview](https://www.linuxlinks.com/hortusfox-self-hosted-collaborative-plant-management-system/)
- Plant-it: [GitHub repository](https://github.com/MDeLuise/plant-it),
  [Cloudron forum](https://forum.cloudron.io/topic/11915/plant-it-a-self-hosted-gardening-companion-app),
  [Docker Hub](https://hub.docker.com/r/msdeluise/plant-it-backend)
- Home Assistant plant: [Olen/homeassistant-plant](https://github.com/Olen/homeassistant-plant)
- Garden Party: [LinuxLinks](https://www.linuxlinks.com/garden-party-manage-garden/) ·
  Brinjel: [YunoHost forum](https://forum.yunohost.org/t/do-you-know-brinjel-formerly-qrop-connaissez-vous-brinjel-ex-qrop/36465)
- Planta: [getplanta.com](https://getplanta.com/),
  [App Store](https://apps.apple.com/us/app/planta-plant-garden-care/id1410126781),
  [iMore review](https://www.imore.com/apps/planta-is-a-pricey-but-detailed-houseplant-care-iphone-app-for-indoor-gardeners)
- Greg: [App Store](https://apps.apple.com/app/id1512912236),
  [House Plant Journal](https://www.houseplantjournal.com/?p=1835),
  [TechCrunch](https://techcrunch.com/2023/11/16/the-best-techy-plant-gifts-for-green-thumbs-in-2023)
- Blossom / PictureThis: [Blossom App Store](https://apps.apple.com/app/1487453649),
  [TechRadar on PictureThis](https://www.techradar.com/computing/websites-apps/picturethis),
  [Livingetc comparison](https://www.livingetc.com/advice/best-plant-identifier-apps)
- Gardenize: [App Store](https://apps.apple.com/app/apple-store/id1118448120) ·
  Planter: [App Store](https://apps.apple.com/app/planter-garden-planner/id1542642210)
- Pl@ntNet: [pricing](https://my.plantnet.org/pricing), [quota docs](https://my.plantnet.org/doc/api/quota) ·
  Kindwise: [pricing](https://kindwise.com/pricing), [FAQ](https://www.kindwise.com/faq)
- Trefle: [data docs](https://docs.trefle.io/docs/advanced/understanding-the-data)
- Open-Meteo: [open-meteo.com](https://open-meteo.com/),
  [ET₀ announcement](https://openmeteo.substack.com/p/reference-evapotranspiration-for)
