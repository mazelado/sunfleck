# Using Sunfleck

Sunfleck keeps track of your plants and tells you when they need care. Its predictions take
into account each plant's type, where it grows, its light, its pot, the season and, outdoors,
the weather, and they get better as you tell it how the soil was.

- [Getting started](#getting-started)
- [Places: sites, locations and light](#places-sites-locations-and-light)
- [Plants](#plants)
- [Care, and when it's due](#care-and-when-its-due)
- [The Today page](#the-today-page)
- [Notifications](#notifications)
- [Your household](#your-household)
- [Plugins](#plugins)
- [Export and import](#export-and-import)

## Getting started

1. **Add a place** (Places → Add a place): your home or garden, with its location on a map.
   The location sets its time zone, seasons and, with the weather plugin, its weather.
2. **Add locations** to it: rooms or garden beds, with their windows and grow lights.
3. **Add plants** (Plants → Add a plant): a photo, the species, and where it lives.
4. **Accept its suggested routine** on the plant's page: when to water, fertilize and so on.
5. Each day, the **Today** page lists what needs care. Tap the check mark when it's done.

Everything is in the account menu (your avatar at the top right).

## Places: sites, locations and light

- A **site** is a place with an address: home, an allotment, an office. Its position on the
  map gives its time zone, its hemisphere (so seasons are right), and its weather. It's only
  sent elsewhere by plugins an Admin turns on. (The map itself is loaded from
  OpenStreetMap, which sees the area shown while you pick the spot; you can type the
  coordinates instead.)
- A **location** is a room or a bed in a site: **indoor** or **outdoor**. Indoors, give its
  temperature range and humidity if you know them; outdoors, how much sun it gets.
- **Light** indoors comes from **windows** (with the direction they face) and **grow
  lights** (with their brightness and when they're on). Each plant says which reach it, and
  how far it is from a window. Sunfleck estimates how much light each plant gets, which
  changes with the season, and uses it to predict watering.

## Plants

- A plant has a **name**, a **species** (search by common, scientific or older names) and a
  **care profile**, which comes with its species. Choose another care profile if it needs
  different care, or if you don't know the species. The **Care guide** describes each profile.
- **Identify it from a photo** when adding it, if an Admin turned on the Pl@ntNet plugin:
  pick one of the suggestions to set its species.
- Add its **pot** (width, and height if you like; material) and **soil**: plants in small or
  terracotta pots dry out sooner. With the pot's size, the plant's watering schedule also says
  roughly how much water to give each time. Without a height, a standard pot (about as tall as
  it is wide) is assumed.
- **Photos**: add as many as you like; the first becomes the plant's cover. Photos are made
  smaller and stripped of their location data when uploaded.
- **Status**: Active, Dormant, Given away, or Died. Only active and dormant plants need care.

## Care, and when it's due

- **Logging care**: tap **Water**, **Fertilize** or **More care** on a plant's page, or the
  check mark on Today. To add notes or log care you did earlier, use **Log with details**.
  The **timeline** on the plant's page shows everything, with its photos.
- **Care types**: water, fertilize, repot, prune, mist, rotate, clean leaves and check for
  pests are built in. Add your own under **Care types**, e.g. "Bottom water" (which you can
  mark as a kind of watering).
- **Schedules** say when each kind of care is due:
  - **Predicted** (watering and fertilizing): Sunfleck works out the interval from the care
    profile, the season, the light, the temperature, the pot and, outdoors, recent and
    forecast rain and heat. **Why?** on the plant's page shows what it took into account.
  - **Every few days**: a fixed interval, for anything else, or if you prefer it.
- **Soil feedback**: when you water, say whether the soil was **Too dry**, **Just right** or
  **Still wet**. Sunfleck adjusts that plant's watering from your last few answers.
- **Snooze or skip**: on Today, the ⋯ menu skips a task this time, or snoozes it for a day,
  three days or a week.

## The Today page

Today lists what's due or overdue, grouped by location, then what's coming up this week. Each
site's weather is shown at the top, with frost warnings, when the weather plugin is on. If
some plants have no schedules yet, Today says so and links to them: to the plant when there's
one, or to the plant list showing only those. In the plant list, they're marked **No routine
yet**.

## Notifications

Under **Notifications**, each person chooses where theirs go and when:

- **Channels**: ntfy, Telegram, email, Discord, Signal and many more, as an
  [Apprise address](https://github.com/caronc/apprise/wiki). Add one, then **Send a test**.
  The easiest is [ntfy](https://ntfy.sh): install its app, subscribe to a topic name nobody
  would guess, and add `ntfy://ntfy.sh/that-topic`.
- **When**: a **daily digest** of what needs care (and frost warnings), at the time you choose,
  in your time zone, and optionally an **evening reminder** of what's still not done. Nothing
  is sent on days with nothing to do.

## Your household

Everyone in a household shares its places and plants. Admins invite people from
**Household**, with one of three roles:

| Role | Can |
|---|---|
| **Viewer** | See everything, and set up their own notifications |
| **Gardener** | Also add and change places, plants, schedules and care |
| **Admin** | Also invite people, change roles, and manage plugins and exports |

Under **Profile**, everyone sets their name, language, units (metric, or imperial: inches and
°F), and password.

## Plugins

Admins turn plugins on under **Plugins**. They're off until then, because they send data to
outside services: each one says exactly what it sends.

- **Weather (Open-Meteo)**: weather on Today, frost warnings, and outdoor watering that waits
  after rain and comes sooner in a heat wave. It sends each site's location, rounded to about
  1 km.
- **Plant identification (Pl@ntNet)**: identifying plants from photos. It needs a free API key
  from [my.plantnet.org](https://my.plantnet.org), and sends only the photos you identify.

## Export and import

Admins can download everything in the household as a ZIP file under **Export and import**: a
backup, or a way to move to another server. Import it into a new household there. Passwords,
notification addresses and API keys aren't included, so people set those up again; the page
lists anything else that needs doing after an import.
