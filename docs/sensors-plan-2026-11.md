# Sensors, to look at (1.4 Nasturtium): a plan to decide on

This plan was for the maintainer to decide on before any code was written; the decisions are [at the end](#decided-2026-11-27). 1.4 adds the first
thing to the plugin API since 1.0, and anything added there must stay for all of 1.x. So the
choices below are hard to undo once they ship.

What the [roadmap](roadmap.md#nasturtium-sensors-to-look-at-planned) promises for 1.4:

- **A Home Assistant plugin** that reads a plant's soil moisture, and its light, temperature
  and humidity where there's a sensor, from the entities chosen for it. Any sensor Home
  Assistant knows works.
- **The reading on the plant's page,** and a summary kept for each day. Home Assistant keeps
  the full history, so Sunfleck stays light on a Raspberry Pi.
- **Not used by the predictions yet.** Readings are collected next to the "How was the soil?"
  answers first, so that 1.6 Peony can calibrate them.

What is **not** in 1.4: readings in **Why?** or in the predictions, "needs water" sent back to
Home Assistant, and measured light next to the estimate (all Peony); MQTT without Home
Assistant ([more integrations](roadmap.md#more-integrations)).

## What the plan has to fit

- **The frontend has no plugin slots** ([more platform](roadmap.md#more-platform)). Every
  page that shows a plugin's data today (weather on Today, identifying a plant, AI) is
  Sunfleck's own page, fed by a hook. No frontend file names a plugin.
- **The plugin API is stable** ([stability.md](stability.md#the-plugin-interface-plugin-api-version-1)).
  New hooks and new optional fields may be added; nothing may be removed or changed until 2.0.
- **Everything is exportable** (CLAUDE.md: every model is covered by export and import).
- **External services stay off until an Admin turns them on,** and `sends_data_to` lists
  what each plugin sends.
- **A Raspberry Pi with an SD card:** few writes, no new server, no new dependency without a
  reason.
- **Things appear when there's data for them:** no sensor, no sensor card.

## Decisions

### 1. Who owns sensors: Sunfleck, or the plugin?

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Sunfleck owns sensors** (which entity is chosen for which plant, the latest reading, the daily summary, the plant page's card, export). The plugin API gets two new hooks to list sensors and read them; the Home Assistant plugin implements them. | Medium: core models, API, UI and two hooks | Two hooks to keep for all of 1.x, so their shape must be right (decision 2). Any later source (MQTT, a Bluetooth bridge) fits the same hooks |
| B | **The plugin owns everything:** its own tables and endpoints (`/api/v1/plugins/homeassistant/...`), and a card on the plant page that calls them | Smaller backend, no new hooks | The first frontend file to name a plugin. Its data isn't in exports. Peony needs readings in Sunfleck's own care code, so they'd move into core then anyway |
| C | **Home Assistant built into Sunfleck,** not a plugin | Like A without hooks | Goes against the roadmap ("a Home Assistant plugin") and the rule that outside services are plugins |

**Recommended: A.** It's how weather, identification and AI already work: Sunfleck owns the
page and the data, the plugin answers a hook. Peony then builds on Sunfleck's own models.

### 2. The hooks' shape

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Sunfleck asks** (pull): `sensor_choices(settings)` lists the sensors a plugin can read, and `read_sensors(sensor_ids, settings)` returns their current readings. Sunfleck's worker asks on a schedule, and the plant page asks for the list when someone chooses a sensor | Two hooks, plain types | Small: plugins stay stateless, errors go through the registry as for every hook |
| B | **The plugin tells** (push): a new function `record_reading(plant, kind, value, at)` that plugins call from their own periodic job | One function | A function that writes Sunfleck's data, which plugins may otherwise not do ([plugins.md](plugins.md#4-models-and-settings-storage)). Each plugin must know which plant uses which entity |

**Recommended: A.** The new types, all part of plugin API version 1:

```python
@dataclass(frozen=True)
class SensorChoice:
    """A sensor a plugin can read, for an Editor to choose for a plant."""
    id: str            # the plugin's own id for it, e.g. a Home Assistant entity id
    name: str          # shown when choosing, e.g. "Monstera soil moisture"
    kind: str          # "soil_moisture", "illuminance", "temperature" or "humidity"

@dataclass(frozen=True)
class SensorReading:
    """A sensor's current value, in Sunfleck's unit for its kind (%, lx, °C, %)."""
    id: str
    value: float | None  # None while the sensor is unavailable
    measured_at: datetime
```

`kind` is a string in the hooks and in the HTTP API, not a fixed list, so a kind added later
(conductivity, for 1.5 Orchid) is an addition, not a change. The app shows a kind it doesn't
know by its name, as it does for factor codes.

### 3. How readings are collected

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Every 15 minutes**, the worker reads each chosen sensor once (one request per plugin and household, however many plants share it), keeps the latest reading, and adds it to that day's summary | One periodic job, two small tables | About 100 small writes per sensor a day. Days the worker is down have gaps |
| B | **Read live** when a plant page opens, and once a night build yesterday's summary from Home Assistant's history | Fewer writes | The page waits on Home Assistant, and shows nothing when it's unreachable. Home Assistant keeps 10 days of history by default, and not at all for entities left out of its recorder. Only Home Assistant has a history API, so a second plugin couldn't do the same |
| C | Like A, every hour | Fewer writes | The reading next to a soil answer can be an hour old (decision 5) |

**Recommended: A.** 100 writes a day per sensor is light, even on an SD card, and it works
for any plugin that can read a sensor's current value.

### 4. What the daily summary keeps

For each plant's sensor and each day (in the plant's time zone): the lowest, highest and
average value, the last value, and how many readings there were. That's enough for a small
chart (lowest to highest, a line for the average) and for Peony's calibration. Full history
stays in Home Assistant.

How long to keep summaries:

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Keep every day,** like care history: one row per sensor per day is about 1,500 rows a year for four sensors | None | None worth noting |
| B | Keep a year | A cleanup job | Peony's calibration loses older seasons |

**Recommended: A.**

### 5. Readings next to the "How was the soil?" answers

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Kept with the care:** when watering is logged with an answer, the plant's latest soil moisture reading (if it's under an hour old) is stored with that care event | One small table, filled when care is logged | None: no request to Home Assistant while logging, since it uses the stored reading |
| B | Worked out later, from the daily summary | Nothing now | A day's lowest or average value isn't the value before watering: Peony's calibration would be guesswork |

**Recommended: A.** It's what Peony needs, and cheap to keep from the start.

### 6. Choosing sensors for a plant

- On the plant's page, an Editor opens **Sensors**, and chooses an entity for each kind from
  the ones the plugin lists for it. A plant has at most one sensor of each kind.
- One entity can be chosen for several plants, e.g. a room's temperature and humidity sensor.
  It's still read once.
- The **Sensors** card shows only when a sensor plugin is on for the household; an Editor sees
  **Add a sensor**, and everyone sees the readings once there are some.

| | Option | Scope | Risk |
|---|---|---|---|
| **A** | **Chosen per plant** (above) | Smallest | Ten plants on one shelf: ten times choosing the air sensor |
| B | Soil per plant, air (temperature, humidity, light) per place, used by every plant there | Places get a sensors card too | Two places to look; a light sensor next to one plant isn't the light at the other end of the room |

**Recommended: A in 1.4.** A "use for the other plants here" shortcut can follow if the first
households ask for it.

### 7. The Home Assistant plugin

- **Settings:** the server's address (`http://homeassistant.local:8123`) and a long-lived
  access token (a `SecretStr` bound to the address, as for the OpenAI plugin's key). **Test**
  checks both with `GET /api/`.
- **Listing sensors:** `GET /api/states`, keeping `sensor.` entities whose `device_class` is
  `moisture`, `illuminance`, `temperature` or `humidity`. A moisture entity is offered as soil
  moisture, since that's what plant sensors (Mi Flora, Zigbee soil sensors) report.
- **Reading:** `GET /api/states/<entity>` for each chosen entity, or one `GET /api/states` when
  there are many. Values are converted to Sunfleck's units (°F to °C). `unavailable` and
  `unknown` are read as no value.
- **Only the standard library** (`urllib`, as the other built-in plugins): no new dependency,
  no WebSocket.
- **Sends:** to the server the Admin sets, only the access token and the entity ids to read.
  Nothing about plants or the household leaves Sunfleck.
- Off until an Admin turns it on, like every plugin that talks to a server.

## Export and import

Chosen sensors, daily summaries and readings kept with care are exported, as new optional
lists, so the format version stays 1 and older exports still import. A sensor's id belongs to
the plugin: after an import into another Sunfleck with the same Home Assistant, it keeps
working; with another server, the plant shows the sensor as not found.

## The work, as pull requests

Each under about 400 hand-written lines, in this order:

1. **The hooks and their types** in the plugin API (`SensorChoice`, `SensorReading`,
   `sensor_choices`, `read_sensors`), documented in [plugins.md](plugins.md), with the
   stability baseline. No user-visible change.
2. **The models:** a plant's chosen sensors, the latest reading, the daily summary and the
   reading kept with care; in export and import, with tests that older exports still import.
3. **Collecting:** the 15-minute job, the daily summary, the reading kept when watering is
   logged.
4. **The API:** listing sensors to choose from, choosing and removing a sensor for a plant
   (Editors), a plant's readings and summaries (everyone in the household), with isolation
   tests.
5. **The Home Assistant plugin** (`plugins/homeassistant`, named as in question 2), with tests against a fake
   server, and its README.
6. **The plant page's Sensors card:** the latest reading ("42% · 10 min ago"), choosing
   sensors, and the last 30 days as a small chart drawn with SVG, as the schedule history is
   (no chart library). English and Spanish, accessibility test, user guide.

Then the release (1.4.0 Nasturtium) as for 1.3.

## Questions for the maintainer

1. Decisions 1 to 7: the recommended options, or others?
2. The plugin's name: **"Sensors (Home Assistant)"** with the id `sensors_homeassistant`, next
   to "Weather (Open-Meteo)"? Or **"Home Assistant"**, leaving room for Peony's "needs water"
   in the same plugin? The id can't change once released; the recommendation is
   `homeassistant`, named "Home Assistant", since Peony adds to it.
3. Is there a Home Assistant with a plant sensor to try the plugin against before the release,
   as the iPhone was for 1.3? Tests use a fake server; a real one would catch what they miss.

### Decided (2026-11-27)

1. **Decisions 1 to 7: as recommended** (option A each time). Sunfleck owns sensors, and asks
   plugins through `sensor_choices` and `read_sensors`; readings every 15 minutes, with a
   daily summary kept for every day; the soil reading kept with each watering that has an
   answer; sensors chosen per plant.
2. **The plugin is "Home Assistant"**, id `homeassistant`, in `plugins/homeassistant`.
3. **A real Home Assistant, without a plant sensor yet.** Before the release, the plugin is
   tried against it for connecting, **Test**, and listing and reading whatever temperature or
   humidity entities it has (e.g. from the weather integration or a phone). Soil moisture is
   checked against the fake server only, and the release notes say so.
