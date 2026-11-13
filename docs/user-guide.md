# Using Sunfleck

Sunfleck keeps track of your plants and tells you when they need care. Its predictions take
into account each plant's type, where it grows, its light, its pot, the season and, outdoors,
the weather, and they get better as you tell it how the soil was.

- [Getting started](#getting-started)
- [Places: homes, rooms and light](#places-homes-rooms-and-light)
- [Plants](#plants)
- [Seeds](#seeds)
- [Harvests](#harvests)
- [Care, and when it's due](#care-and-when-its-due)
- [The Today page](#the-today-page)
- [Notifications](#notifications)
- [Your household](#your-household)
- [Plugins](#plugins)
- [Export and import](#export-and-import)

## Getting started

Until your household has a plant, **Today** shows these steps, ticks off each one that's done,
and has a button for the next.

1. **Add your home or garden** (Places → Add a home or garden), with where it is on a map.
   That sets its time zone, seasons and, with the weather plugin, its weather.
2. **Add rooms and spots** to it: rooms, shelves or garden beds, with their windows and grow
   lights.
3. **Add plants** (Plants → Add a plant): a photo, the species, and where it lives. A place,
   a room, or a window or grow light that isn't there yet can be added from the plant's
   form, without losing what you've typed.
4. **Accept its suggested routine** on the plant's page: when to water, fertilize and so on.
5. Each day, the **Today** page lists what needs care. Tap the check mark when it's done.

The main pages, **Today**, **Plants**, **Places** and the **Care guide**, are in the tab bar
at the bottom on a phone, and at the top on a wider screen. **Settings** (the gear at the top
right) has your household and inviting people, reminders, care types and, for Admins, plugins
and export. Your profile and signing out are in the account menu, beside it.

## Places: homes, rooms and light

- A **site** is a place with an address: home, an allotment, an office. Its position on the
  map gives its time zone, its hemisphere (so seasons are right), and its weather. It's only
  sent elsewhere by plugins an Admin turns on. (The map itself is loaded from
  OpenStreetMap, which sees the area shown while you pick the spot; you can type the
  coordinates instead.)
- A **room or spot** is where plants live in a site: a room, a shelf, a bed or a balcony,
  **indoor** or **outdoor**. Indoors, give its
  temperature range and humidity if you know them; outdoors, how much sun it gets.
- **Frost dates**: a site's typical last frost in spring and first in autumn, for sowing and
  planting out. With the weather plugin, Sunfleck estimates them from 20 years of past
  weather; or enter them on the site's page (only the day and month count).
- A **garden bed** is an outdoor spot marked as a raised bed or a bed in the ground. A
  raised bed dries out sooner, so its plants are watered a little more often. With its width
  and length, the watering amount also says how much water the whole bed needs.
- **Light** indoors comes from **windows** (with the direction they face) and **grow
  lights** (with their brightness and when they're on). Each plant says which reach it, and
  how far it is from each window and below each grow light. Sunfleck estimates how much light
  each plant gets, which changes with the season, and uses it to predict watering.
- **A grow light's brightness** is measured at a distance below it: about 30 cm for the
  typical figures to choose from. If you enter its exact brightness, say where it was
  measured too, as on its box or spec sheet ("600 at 45 cm"). A plant nearer the light gets
  more, and one further away less. Without a distance, a plant is taken to be where the
  brightness was measured.
- **Is it bright enough?** A plant's page says, under **Light check**, whether it gets enough
  light now, and suggests moving it or adding a grow light when it's too dim. Below, it
  compares the light at its spot with what it likes in each season. A
  room's page shows each window's light through the year. Light is the day's total
  (DLI, in mol/m²/day), estimated for a typical day.

## Plants

- A plant has a **name**, a **species** (search by common, scientific or older names) and a
  **care profile**, which comes with its species. Choose another care profile if it needs
  different care, or if you don't know the species. The **Care guide** describes each profile.
- **No care profile for its species?** If an Admin turned on an AI plugin, **Suggest with AI**
  asks which of the built-in care profiles fits it best, and why. It only suggests: check the
  profile in the Care guide, then use it or choose another.
- **What's wrong?** On a plant's page, if an Admin turned on an AI plugin: take or choose a
  photo that shows the problem, and add a few words if you like ("lower leaves turning yellow
  since last week"). The AI looks at it together with the plant's care, place and recent
  history, and suggests likely causes and what to do, and says when to act soon. They're
  suggestions: check them against the plant. The photo can be kept on the plant, with your
  words as its caption, to compare later.
- **Ask about this plant**: on a plant's page, if an Admin turned on an AI plugin, **Ask
  about** a plant starts a conversation with the AI, which knows the plant's species, place,
  pot, schedules and recent care. Ask follow-up questions in the same conversation. Each one
  is kept under **Questions** on the plant's page, for everyone in the household to read; the
  newest are sent with each question, so start a new one for a different topic. Answers are
  suggestions.
- **Identify it from a photo** when adding it, if an Admin turned on the Pl@ntNet plugin:
  pick one of the suggestions to set its species.
- Add its **pot** (width, and height if you like; material) and **soil**: plants in small or
  terracotta pots dry out sooner. With the pot's size, the plant's watering schedule also says
  roughly how much water to give each time. Without a height, a standard pot (about as tall as
  it is wide) is assumed.
- **When it was last cared for**: adding a plant asks roughly when it was last watered and
  fertilized, so its first due dates and care bars start from there. A rough answer is
  enough; it's shown in its history as "Estimated when added". For a plant added before, log
  its last watering with **Log with details** and set the date.
- **Photos**: add as many as you like; the first becomes the plant's cover. Photos are made
  smaller and stripped of their location data when uploaded. Open a photo and choose **Crop**
  to pick the part its thumbnails and the plant's cover show: drag the photo under the frame
  and zoom with the slider (or pinch, or the arrow keys). The whole photo is always kept, so
  you can change the crop later, or choose **Show the whole photo**.
- **Status**: Active, Dormant, Propagating, Given away, or Died. Only active, dormant and
  propagating plants need care.
- **Propagation**: **Propagate** on a plant's page adds the cuttings, divisions, offsets or
  seedlings you've taken as plants of their own: with its species, care profile and (unless
  you choose another) its room and lights, named after it ("Monty (cutting 2)"). They're
  marked **Propagating**: watered as usual, but not fertilized until they've taken. Then set
  each one's status to Active. Each shows the plant it was grown from, and the parent lists
  them.
- **Labels**: each plant's page shows its QR code. Scanning it with a phone opens that page
  (after signing in). **Print a label** there, or **Print QR labels** in the Plants page's **⋯** menu (or
  on a room's page, for the plants there), prints a sheet of them in three sizes, with
  or without the species. On Chrome for Android, **Write to an NFC tag** puts the plant's
  address on a tag, so tapping it opens the page. Labels link to `SUNFLECK_PUBLIC_URL` if
  it's set, else to the address you're using: print them from an address your phone can
  reach.
- **Finding a plant**: the Plants page shows every plant as a card that says in words what it
  needs next ("Water today", "Fertilize in 5 days"), in red when it's overdue and orange when
  it's due today, and "Low light" when its spot is too dark for it. Search by name above the
  cards. **Filter** narrows them down by room, status, or plants without a care routine;
  the filters in use show as chips under the search field, and tapping a chip removes it.
- **Moving plants**: on a room's page, **Move plants here** moves plants from elsewhere
  (those without a room are listed first). Then choose, on each plant's page, which of
  the new room's windows and grow lights reach it; its schedules adjust.

## Wishlist

- **Wishlist** (in the Plants page's **⋯** menu) lists plants you'd like to have: a name, the species if
  you know it, where to get it (a link) and notes. On a species' page in the Care guide,
  **Add to the wishlist** adds it in one tap.
- **Got it** opens the new plant's form with its name and species filled in; when you save
  the plant, it comes off the wishlist. Exports include the wishlist.

## Seeds

**Seeds** (in the Plants page's **⋯** menu) lists the seeds you have: their species, variety, how many,
and the year to sow them by. Seeds past that year are marked, since they may not come up.

The **sowing calendar** on the same page turns them into dates: when to sow (indoors or
outdoors), plant out and harvest each one, from the place's frost dates and the species'
timing in the Care guide. It lists what to do now, in the next four weeks, and later; Today
mentions what to sow or plant out now. When you've sown some, tap **Sown**: the seedlings are
added as a plant, of their species, so you can care for them and see when to plant them out.
Seeds need their species for the calendar, and the place needs its frost dates (see
[Places](#places-homes-rooms-and-light)).

## Harvests

Vegetables, herbs and fruit have a **Harvests** card on their page: **Log a harvest** with the
day and, if you counted or weighed it, how much (grams, kilograms, ounces, pounds, pieces or
bunches). The card adds up the year so far in your units ("In 2026: 3.6 lb · 12 pieces") and
lists the latest harvests. Exports include them.

## Care, and when it's due

- **At a glance**: each plant's card says what it needs next, in words. A plant's page shows
  rings for water, fertilizer and light. Water and fertilizer run down until the care is
  due, and turn orange when it's due today and red when it's overdue; light is full when the
  spot gets what the plant likes at this time of year.
- **Logging care**: tap **Water**, **Fertilize** or **More care** on a plant's page, or the
  check mark on Today. To add notes or log care you did earlier, use **Log with details**.
  The **timeline** on the plant's page shows everything, with its photos.
- **Care types**: water, fertilize, repot, prune, mist, rotate, clean leaves and check for
  pests are built in. Add your own under **Care types**, e.g. "Bottom water" (which you can
  mark as a kind of watering), or with **Add a care type** while logging care or adding a
  schedule.
- **Schedules** say when each kind of care is due:
  - **Predicted** (watering and fertilizing): Sunfleck works out the interval from the care
    profile, the season, the light, the temperature, the humidity indoors, the pot and,
    outdoors, recent and forecast rain and heat. **Why?** on the plant's page shows what it
    took into account.
  - **Humidity indoors**: dry air dries the soil sooner. Set a room's humidity if you
    know it. If you don't, and the weather plugin is on, Sunfleck estimates it in cold
    weather: heated winter air is dry, often 20–30%. The room's page shows the estimate.
  - **Every few days**: a fixed interval, for anything else, or if you prefer it.
- **Soil feedback**: when you water, say whether the soil was **Too dry**, **Just right** or
  **Still wet**. Sunfleck adjusts that plant's watering from your last few answers.
- **Your routine**: if you keep watering a plant clearly more or less often than its schedule
  (three times in a row), its page offers to match the schedule to how you water. It only
  changes if you accept, and you can go back to Sunfleck's own estimate at any time.
- **Snooze or skip**: on Today, the ⋯ menu skips a task this time, or snoozes it for a day,
  three days or a week.

## The Today page

Today lists what's due or overdue, grouped by room, then what's coming up this week. Each
site's weather is shown at the top, with frost warnings, when the weather plugin is on. If
some plants have no schedules yet, Today says so and links to them: to the plant when there's
one, or to the plant list showing only those. In the plant list, they're marked **No routine
yet**.

## Notifications

Under **Notifications**, each person chooses where theirs go and when:

- **This device**: **Get notifications on this device** sends them as notifications from
  Sunfleck itself, with no other app. Do it on each phone or computer you want them on. On
  iPhone and iPad, add Sunfleck to the Home Screen first and turn them on from there. The
  device then shows in the list like the channels below, where you can test, rename or pause
  it.
- **Channels**: ntfy, Telegram, email, Discord, Signal and many more, as an
  [Apprise address](https://github.com/caronc/apprise/wiki). Add one, then **Send a test**.
  The easiest is [ntfy](https://ntfy.sh): install its app, subscribe to a topic name nobody
  would guess, and add `ntfy://ntfy.sh/that-topic`. If your topic needs an access token, or you
  run your own ntfy server, put the token in front of the server's name:
  `ntfys://tk_yourtoken@ntfy.example.com/that-topic` (`ntfys://` sends it over HTTPS; ntfy.sh
  always is). A token that doesn't start with `tk_` goes at the end instead:
  `ntfys://ntfy.example.com/that-topic?token=yourtoken`.
- **When**: a **daily digest** of what needs care (and frost warnings), at the time you choose,
  in your time zone, and optionally an **evening reminder** of what's still not done. Nothing
  is sent on days with nothing to do.
- **Calendar**: **Get a calendar address** to see the next two weeks of care in Google
  Calendar, Apple Calendar or another calendar app (add it there as a calendar "from URL" or
  "subscription"). The address is shown only once, and anyone who has it can see your plants'
  care, so keep it to yourself; **New address** stops the old one. Calendar apps check for
  changes every few hours (Google about once a day), so use it to plan the week, and the digest
  to be reminded.

## Your household

Everyone in a household shares its places and plants. Admins invite people from
**Household**, with one of three roles:

| Role | Can |
|---|---|
| **Viewer** | See everything, and set up their own notifications |
| **Gardener** | Also add and change places, plants, schedules and care |
| **Admin** | Also invite people, change roles, and manage plugins and exports |

Under **Profile**, everyone sets their name, a profile picture (only their household sees it),
language, units (metric, or imperial: inches and °F), and password. After choosing a picture,
move and zoom it to frame it in the circle, then save.

## Plugins

Admins turn plugins on under **Plugins**. They're off until then, because they send data to
outside services: each one says exactly what it sends. **Test** checks a plugin's settings
before you save them, for example that an API key is accepted. Plugins that are off are folded
away: open one with the arrow next to its name, or just turn it on.

- **Weather (Open-Meteo)**: weather on Today, frost warnings, frost dates, and outdoor watering
  that follows how much water the weather took from the soil since watering, and the rain. It sends each site's location, rounded to about
  1 km.
- **Plant identification (Pl@ntNet)**: identifying plants from photos. It needs a free API key
  from [my.plantnet.org](https://my.plantnet.org), and sends only the photos you identify.
- **AI (OpenAI-compatible)**: suggestions from an AI model, through OpenAI or a model you run
  yourself with Ollama or LM Studio (then nothing leaves your network). It's only asked when
  you ask for a suggestion, and you review every suggestion before it's used. **What's
  wrong?** needs a model that can look at photos. See its
  [setup guide](../plugins/ai-openai/README.md).
- **AI (Claude)**: the same, through Anthropic's Claude models, with your own API key from
  [console.anthropic.com](https://console.anthropic.com). Claude Sonnet by default. See its
  [setup guide](../plugins/ai-anthropic/README.md).

## Export and import

Admins can download everything in the household as a ZIP file under **Export and import**: a
backup, or a way to move to another server. Import it into a new household there. Passwords,
profile pictures, notification addresses and API keys aren't included, so people set those up again; the page
lists anything else that needs doing after an import. Questions to the AI are included with
their plants.
