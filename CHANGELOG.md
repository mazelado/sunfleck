# Changelog

What's changed in each release of Sunfleck. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/): new features raise the minor version, fixes the
patch version. Each minor version has a plant name, in alphabetical order (see the
[roadmap](docs/roadmap.md)). Before upgrading, read the notes of every version since yours, and
make a backup ([how to upgrade](docs/install.md#upgrading)).

## [Unreleased]

### Fixed

- **A photo added from the top of a plant's page becomes its cover**: the camera button on the
  cover used to add the photo to its history only, leaving the old cover in place. Photos added
  from the gallery leave the cover as it is.
- **Plants, Seeds and Wishlist no longer jump**: the switch between them sat higher on Plants
  than on the other two.

## [1.0.0] - 2026-11-14

**Jasmine.** Sunfleck grows up: a new look across the whole app, in light and dark, built
around what people stumbled on in a usability test; step-by-step setup for a new household;
photo cropping; and a security review and a code quality review, with every finding fixed.
From 1.0 on, the API, the plugin interface, the settings and your data stay compatible
within a major version ([what's promised](docs/stability.md)).

**Before upgrading**, read [how to upgrade](docs/install.md#upgrading), make a backup, and
check these, which can change how your Sunfleck behaves:

- **Port 8000 is only reachable from the server itself.** If phones or computers on your
  network open `http://<server>:8000` directly, set `SUNFLECK_LISTEN_ADDRESS=0.0.0.0` in
  `.env`, and download the new `compose.yaml`.
- **Behind an HTTPS proxy, browsers are told to use only HTTPS for a year** (HSTS). Only set
  `SUNFLECK_BEHIND_PROXY=true` with HTTPS you'll keep.
- **Without `EMAIL_URL`, emails are no longer written to the log.** Admins copy invitation and
  password-reset links in the app.
- **API clients:** `/api/v1/wishlist`, `/api/v1/seeds` and a plant's `/conversations` answer
  `{"items": [...], "count": n}` instead of a plain list.

### Added

- **Step-by-step setup** (UI plan, part 12): a new household's **Getting started** button opens
  a short flow, one question per screen: where your plants live, the room or spot (with its
  window, on the same screen), which plant it is, and when it was last watered. Finishing adds
  the plant with its suggested routine and opens its page. Each step is saved as you go, and
  coming back starts at the first step not done. It takes 2 page changes, where adding a room
  with a window and then a plant took 7. Adding plants and places the usual way is unchanged.

- **Cropping photos** (#67): frame a new profile picture in a circle before saving it. Open
  a plant photo and choose **Crop** to pick the part its thumbnails and the plant's cover
  show. The whole photo is kept, so the crop can be changed later. Exports include crops,
  and older exports still import.

- **Stability guarantees** ([docs/stability.md](docs/stability.md)): from 1.0, the API under
  `/api/v1/`, the plugin interface, settings, the Docker image and your data stay compatible
  within a major version, and anything removed is deprecated first. Upgrades work from any
  earlier release in one step. Tests check that the API and the plugin interface keep
  everything they had.

### Changed

- **Plugins are listed by name** in Settings, so the two AI plugins sit together. Before,
  the order depended on how the plugins happened to be installed.
- **Easier to tap and to find your way** (UI plan, part 1): on phones and tablets, every
  button, menu item and choice is at least 44×44 pixels, as the style guide asks. Every page
  has the same header: a way back to the page it belongs to (Settings' pages now have one
  too), the title, its main action, and rarer actions in a "⋯" menu. Headings between cards
  are no longer small capitals, so they stand out from the labels inside the cards. Care
  that's overdue is red and care due today orange everywhere, rings included.
- **The Plants page** (UI plan, part 2) starts with the plants: the search field and one
  **Filter** button (room, status, without a care routine) in place of four rows of
  filters, with the filters in use shown as chips that remove them. Each card has a larger
  photo and says in words what the plant needs next ("Water today", "Fertilize in 5 days"),
  in place of three unlabelled rings, plus "Low light" when its spot is too dark. Print QR
  labels is in the page's "⋯" menu.
- **A plant's care in one card** (UI plan, part 3): the rings, the care buttons and the care
  schedule were three places saying when to water; now one **Care** card has a row per
  schedule with its ring, when it's due in words, how often (tap to change it) and a button
  named for the care. Its **⋯** menu puts care off in one tap (tomorrow, in 3 days, in a
  week), so putting care off from a plant's page takes 3 taps instead of 5. Other care,
  earlier care and a new schedule are under the rows.
- **A plant's page is shorter and calmer** (UI plan, part 4): light is one **Light** card
  (whether it gets enough now and what would help, then the windows and lamps that reach it,
  then each season under **Through the year**, in words such as "Bright" with the
  mol/m²/day dimmed beside them, also on a room's page). The care profile, pot, soil and
  notes are one **About** card, which also shows where a plant was grown from. Propagate,
  Print a label and Write to an NFC tag moved to the **⋯** menu at the top, so the
  Propagation and Label cards are gone. On wide screens the page has two columns, and the
  photo is shown at 4:3 instead of cropped to a strip.
- **A way back that stays in reach on phones** (UI plan, part 5): on a page inside another
  (a plant, a room, a setting), the top bar shows a back arrow to that page and the page's
  "⋯" menu, and the page's name once you've scrolled past it, as in a native app. The back
  arrow goes to the page it belongs to, also when a plant was opened from a QR label.
  Today, Plants, Places, the Care guide and Settings keep the logo bar.
- **Today** (UI plan, part 6): the done button and **Later** are 44 pixels, easy to hit; on a
  wide screen the list is narrower, so a plant's name and its buttons sit together; groups
  are named by room alone when you have one place ("Kitchen", not "Home · Kitchen"); and a
  finished row fades and folds away instead of the list jumping under your thumb (not when
  your system asks for less motion).
- **Forms** (UI plan, part 7): in the plant, room and place forms, **Save** and **Cancel**
  stay at the bottom of the screen (above the tab bar on phones) while you fill them in, so
  it's clear the form goes on. A plant's photo is a large "Add a photo" tile that shows the
  photo once chosen, and "When was it last watered?" is a row of one-tap choices. Forms are
  narrower on wide screens.
- **Places** (UI plan, part 8): with one home, the Places tab is that home's page, with its
  rooms and **Add a room or spot** right there, so adding a room with a window takes 7 taps
  over 3 pages instead of 8 over 4. Rooms and plants are listed as full-width rows that say
  what they are ("Indoor · South window", "No light source yet") with an arrow, and a room's
  **Edit** and **Print QR labels** are at the top.
- **Seeds and the wishlist are views of the Plants tab** (UI plan, part 9): "Plants · Seeds ·
  Wishlist" at the top of each, and the Plants tab stays lit on all three. Seeds moved to
  `/plants/seeds`; the old `/seeds` address still works.
- **The Care guide** (UI plan, part 10) lists care profiles as compact cards, two side by side
  on wider screens, each with its description in two lines, and **All · Indoor · Outdoor**
  above them in place of headings far apart.
- **Settings** (UI plan, part 11): each Settings card is one link with an arrow, to the page
  it describes. **Notifications** starts with **This device**, the whole answer for most
  people; ntfy, Telegram, email and the rest are folded under **Other ways**, and the page no
  longer opens by explaining Apprise. A plugin's switch says **Off** when it's off (it said
  **On** either way), and its version moved into its details.
- **Loading looks like the page** (UI plan, part 13): Today, Plants and a plant's page show
  their shape while they load, instead of a spinner. The sign-in and setup pages show
  Sunfleck's mark larger, with a line saying what it is. The README's screenshots are new.
- **A new look**: a cleaner, more modern design across the whole app, in light and dark mode.
  It uses the Plus Jakarta Sans typeface, which is bundled with Sunfleck, so no font service
  is contacted. Pages are soft grey-green with white cards, and headings are clearer. The
  green is brighter, and every text colour still meets WCAG AA contrast in both modes.
- **Today and plant pages**:
  - Today shows how many plants need care, beside its title.
  - Care that's due has a filled done button, and "Due today" stands out in orange.
  - A plant's page shows water, fertilizer and light as rings, still described in words.
- **Empty pages** have a small illustration: no plants or places yet, nothing on the wishlist,
  no seeds, no search results, and nothing to do today.
- **Deleting a window, grow light or harvest asks first**, as deleting a plant or a room does.
  Deleting a light also takes it away from the plants it reaches, with their distance from it.
- **Easier to read**: plugin and care profile names are no longer in capitals, and a place's
  page no longer shows its coordinates (only its time zone, when it isn't your device's).
- **Gentle motion**: cards rise into place as a page opens, and done buttons give a little
  when tapped. None of it shows if your device is set to reduce motion.
- **Plant cards show care as small rings**, like a plant's page, instead of thin bars.
- **Add a photo from the top of a plant's page**: a camera button on the cover photo, or
  **Add a photo** over the placeholder of a plant without one. The Photos card keeps its
  button too.

- **Easier everyday care**, from the 1.0 usability test:
  - **Put off care** from a plant's page: under **More care**, or with the alarm button
    beside a schedule. Pick tomorrow, 3 days, a week, or any day. On Today, the ⋯ button
    is now **Later**, with **Snooze until a day…**.
  - **Add earlier care**, beside a plant's care buttons, logs care for another day.
    The question after a watering now says which one it's about ("How was the soil when
    you watered yesterday?").
  - **Water all** names its room on Today ("Water all 2 in Living room"), and a room's
    page can water all its plants at once.
- **Easier setting up**, from the 1.0 usability test:
  - Rooms, shelves, beds and balconies are called **rooms and spots**, not "locations",
    and places are added with **Add a home or garden**.
  - **Adding a plant** asks for its room right after its name, uses its species' care
    profile without asking (choose another later, under **Edit**), and folds pot material,
    soil and notes under **More details**.
  - Leaving a plant, room or place form with unsaved changes asks first.
- **Settings** have their own page, behind the gear at the top, saying what each is for,
  with a shortcut to **Invite someone**. The account menu keeps your profile and signing
  out. On the household page, inviting someone comes first, in its own card.
- **Cropping is easier to find**: tap a plant's cover photo to open it, and **Crop** is
  offered right after adding a photo.
- **The light check says first** whether a plant gets enough light now, and what to do
  about it, before the numbers.

- **API: four lists can be paged** before the API is frozen in 1.0: `GET /api/v1/wishlist`,
  `/api/v1/seeds` and `/api/v1/plants/{id}/conversations` now answer
  `{"items": [...], "count": n}` instead of a plain list, and `/api/v1/plants/{id}/harvests`
  gains `count`. All four take `limit` (at most 500, the default) and `offset`. Clients that
  read these lists must read `items`; the app does.

- **Port 8000 is only reachable from the computer Sunfleck runs on**, in the Compose file: a
  reverse proxy on the same computer is then the only way in. **If you open
  `http://<server>:8000` from other devices**, set `SUNFLECK_LISTEN_ADDRESS=0.0.0.0` in `.env`
  and download the new `compose.yaml`.

- **Installing a plugin with Docker is documented**: a short `Dockerfile` that builds on
  Sunfleck's image ([plugins.md](docs/plugins.md#5-installing)).

### Fixed

- **On Today, a care row's ⋯ menu was hidden behind the rows below it**, so only its first
  item could be tapped. This came with the new look's card animation.
- **A digest or evening reminder set between 23:46 and 23:59 was never sent**: the worker
  checks every 15 minutes, and the next check was already the next day. It's now sent then,
  just after midnight.
- The message when your browser can't tell where you are (choosing a place) had too little
  contrast.
- **Searching for "bromeliad" found nothing** when adding a plant: each bromeliad genus
  (*Guzmania*, *Vriesea*, *Aechmea* and others) now has "bromeliad" as a common name, so it's
  found and gets the Bromeliad care profile.
- **Snoozed care came back early** whenever its due date moved: after editing the plant
  (its pot, light or room), or with every new forecast from the weather plugin. A snooze now
  lasts until the day it was put off to, or until the care is logged.
- **Setting `SUNFLECK_ENCRYPTION_KEY` on a Sunfleck that ran without it** made every stored
  secret unreadable: notification addresses, plugins' API keys, and the Web Push key, which
  broke every device's notifications. Secrets stored before the key was set now stay
  readable, and the new `manage.py reencrypt_secrets` moves them all to the first key, so an
  old key can be removed ([how to replace a key](docs/install.md#replacing-the-encryption-key)).
- **The day's first look at Today was slow**: every schedule was worked out again inside that
  request, about 15 database queries per plant (332 for 25 plants, where it's otherwise 7).
  The worker did it once a night at 02:23 UTC, which for sites far from UTC was the evening
  before or the late morning. It now runs every hour and recalculates the schedules of each
  site whose day has begun, so Today finds them done. When it hasn't (the worker is down),
  Today now reads what the plants share once instead of for each plant: 61 queries for those
  25 plants instead of 332, nearly all of them saving the new due dates.
- **A household that used a care type of its own couldn't be deleted** in the admin site. It
  now can; a care type that's in use still can't be deleted on its own.
- **Two care types with the same name** can no longer be made by two people at the same
  moment. Upgrading numbers any that already exist ("Bottom water (2)").
- **Two imports started at the same moment** can no longer both fill a household.
- **Exporting is quicker for large households**: a handful of database queries in all, rather
  than five for each plant, and photos are copied into the file without being held in memory
  whole.
- **The Claude plugin works with models released after it**: it used to ask only the models on
  its own list to think briefly and to retry declined questions on Anthropic's fallback
  model, so a newer model (such as Claude Fable 5.2) was slower, dearer and less reliable.
  It now asks every model, and asks again without an option a model doesn't take. It also
  leaves room for the thinking that the newest models always do, which could cut off the
  answer to a photo diagnosis.
- **When the AI plugin fails, the app says so**, instead of saying that no AI plugin is turned
  on. A diagnosis is shown even if its photo can't be kept.
- **The AI is told on which day care was given in the place's own time zone**: in Sydney, a
  plant watered on Monday morning was described as watered on Sunday.
- **Mistakes that ended in "Unexpected response (500)"** now say what's wrong: care dated
  before the year 2000, the same schedule added twice at the same moment, and an import with
  an overlong household name. An unexpected error says that something went wrong, in your
  language.

### Security

- **The Django admin site** (`/admin/`) no longer has a sign-in form of its own, which wasn't
  covered by the limits on failed sign-ins: you sign in to Sunfleck, then open it.
- **Behind an HTTPS proxy** (`SUNFLECK_BEHIND_PROXY=true`), cookies are only sent over HTTPS,
  and the limits on failed sign-ins count each person rather than everyone behind the proxy
  together.
- **A Content-Security-Policy** on every page allows only Sunfleck's own scripts, as a
  safeguard against injected ones.
- **oauthlib** 4.0.1 (used by Apprise for some notification services), for CVE-2026-49272.
- `SECURITY.md` describes how Sunfleck is protected, and what the people running it should know.
- **The first account**, which can open the Django admin site and so every household on the
  server, can no longer be given a password-reset link or removed by another Admin: that let
  an Admin of one household take it over. Only its owner can do either; they reset a
  forgotten password by email, or with `manage.py changepassword` on the server.
- **One household per person** is now enforced in the admin site, which refuses to add
  someone to a second household. Should someone already have two, they always get the
  older one, instead of whichever the database returned first.
- **Web Push devices** can only use the push services browsers use (Google's, Mozilla's,
  Apple's and Microsoft's; `SUNFLECK_PUSH_HOSTS` adds more), and a failed push shows only the
  push service's status, not its answer. Before, any member could add a "device" at an
  address on the server's network and read the start of its answer in the error message.
  Devices already added at another address stop receiving pushes, with a message saying why.
- **Plugins' API endpoints** need a signed-in member, and a CSRF token for changes, unless the
  plugin makes an endpoint public with `auth=None`. Before, they were open to anyone unless the
  plugin checked, and had no CSRF protection even when it did. No built-in plugin has
  endpoints, so nothing was exposed; it's fixed before the plugin interface is frozen in 1.0.
- **The limits on failed sign-ins hold**: they're counted in the database (or Redis), so the
  web workers share them and a restart doesn't reset them; before, each worker counted on its
  own. Port 8000 is no longer open to the network by default, so nobody can bypass the proxy
  and claim another address, and the Nginx example now sets `X-Forwarded-For`, without which
  the proxy passed on whatever address a visitor claimed.
- **With two AI plugins on, each question went to both**, with the plant's history and photos,
  and both services billed for it, though only one answer was used. Now only the first AI
  plugin that answers is asked; the next is asked only if it fails. The same holds for plant
  identification and frost dates.
- **Without email set up, invitation and password-reset links no longer go to the log**,
  where anyone who can read the logs could use them; anyone could ask for a reset email. The
  log only notes that an email wasn't sent. Admins copy the links in the app, as before; if
  you're the only Admin and locked out, use `manage.py changepassword`.
- **Only the sign-in endpoints the app uses are reachable** under `/_allauth/`; the others
  (sign-up, email addresses, phone numbers) answer 404. Adding an email address there ended
  in a server error and left a stray row behind.
- **First-run setup can't be completed twice at once on PostgreSQL**: two requests in the
  same moment could both make an account with the admin site.
- **The Docker image's base images are pinned by digest**, so a release can be rebuilt
  exactly; Dependabot keeps them up to date.
- **A stored API key is only sent to the server it was saved for**: in the OpenAI-compatible
  plugin, changing the server address asks for the key again, also for **Test**. Before, an
  Admin could have another Admin's key sent to an address of their choice. Plugins can bind
  a secret to their own settings the same way (`bound_to`).
- **The OpenAI-compatible plugin only accepts `http://` and `https://` addresses**, and no
  longer writes what a failing server answered to the log, which could repeat parts of a
  question (or of a local file, with a `file:` address).
- **A few slow requests no longer stop the app for everyone**: each of the 2 web server
  processes now answers 4 requests at once (`WEB_THREADS`), so two questions to a slow AI
  model, or two tests of a notification server that doesn't answer, leave room for everyone
  else.
- **Limits on how much work one request or member can cause**: requests over 25 MB are refused
  before they're read (they used to be read whole, without signing in, before any check), and
  so are photos over 50 megapixels, which took hundreds of MB of memory to decode. Each member
  may ask the AI 10 times a minute, identify a plant 10 times, and test a notification
  channel 5 times; each of these is slow, and may cost money. The Caddy example now limits
  request sizes too.
- **Behind an HTTPS proxy, browsers are told to use only HTTPS for a year** (HSTS), so a
  first visit over `http://` can't be intercepted. **Only turn on `SUNFLECK_BEHIND_PROXY`
  with HTTPS that you'll keep**: browsers that visited won't open the site over `http://`
  for a year.
- **The health check no longer tells strangers the exact version**, which says which known
  problems apply. Members, and the server itself, still see it.
- **Photos in an imported export** are stored as uploads are: as WebP files without their
  metadata (such as where a phone photo was taken), named by Sunfleck. Before, they were
  stored as they came, with the archive's file names, and a photo with too many pixels ended
  the import with an error instead of saying what was wrong. Sunfleck's own exports still
  import byte for byte.

## [0.9.0] - 2026-11-06

**Iris.** Help from an AI model, only when someone asks for it: Claude joins the AI plugins,
a photo of a struggling plant gets likely causes and what to do, and questions about a plant
are answered from its care and history, in conversations the household can read.

### Added

- **AI (Claude)**: a plugin for Anthropic's Claude models, with your own API key, next to the
  OpenAI-compatible one. Claude Sonnet by default; the model is a setting. It reaches
  `api.anthropic.com`, only when someone asks for a suggestion.
- **What's wrong?**: on a plant's page, take or choose a photo of a struggling plant, add a few
  words if you like, and the household's AI plugin suggests likely causes and what to do,
  from the photo together with the plant's care, place and recent history. It says when to
  act soon, and when the photo isn't clear enough. The photo can be kept on the plant. With
  the OpenAI-compatible plugin, it needs a model that can look at photos.
- **Ask about this plant**: a conversation with the household's AI plugin about one plant,
  which knows its species, place, pot, schedules and recent care. Follow-up questions continue
  it. Conversations are kept under **Questions** on the plant's page for the whole household
  to read (Gardeners and Admins can ask and delete), and are included in exports.

## [0.8.0] - 2026-11-06

**Hibiscus.** For collectors: grow new plants from the ones you have and keep track of where
each came from, print QR labels or write NFC tags that open a plant's page, and keep a
wishlist. Grow lights now take each plant's distance into account, and three dead ends found
by the click counts are gone.

### Added

- **Add a place and a location from the plant form** (#120): with no places yet, the plant
  form adds your home and its first room in a dialog, instead of a link away from the form.
  With places already, **Add a location** adds a room or bed to one of them. The new location
  is chosen for the plant, and nothing typed is lost.
- **Propagation and lineage**: **Propagate** on a plant's page adds cuttings, divisions,
  offsets or seedlings as plants of their own, with its species, care profile, location and
  lights. They're marked with the new **Propagating** status, watered but not fertilized
  until they've taken. Each plant shows the one it was grown from, and the plants grown from
  it. Exports include this, and older exports still import.
- **QR and NFC labels**: each plant's page shows a QR code that opens it. **Print QR labels**
  prints a sheet of them, for all plants, one location's or chosen ones, in three sizes. On
  Chrome for Android, **Write to an NFC tag** writes the plant's address to a tag. Labels use
  `SUNFLECK_PUBLIC_URL` when it's set.
- **A wishlist** of plants you'd like to have, with where to get them and notes; add one from
  the Plants page or a species' page in the Care guide. **Got it** opens the plant form filled
  in, and saving the plant takes it off the list. Exports include it.
- **Add a care type while logging care or adding a schedule** (#121): **Add a care type**
  under the care type opens the same dialog as Settings → Care types, and the new type is
  chosen, without losing what you've typed.

### Changed

- **Grow lights take each plant's distance into account** (#144), as windows already did: the
  plant form asks how far below the light each plant is, and a grow light can say where its
  brightness was measured ("600 at 45 cm"). Plants nearer the light get more light, and
  ones further away less. Plants without a distance get the same light as before.
- **Today shows a new household how to get started** (#122): until there's a plant, a
  checklist (a place, a location in it, a first plant) replaces the empty lists of care, ticks
  off each step that's done, and has a button for the next. It replaces the two cards that
  linked to the Places and Plants pages.

### Fixed

- **Screen readers announce the loading spinners** ("Loading…", "Loading map…").
- **A seeds card's Edit button** isn't cut off by long notes on a phone.

## [0.7.0] - 2026-11-06

**Gardenia.** Growing food outside: garden beds with their size, frost dates for each place, a
sowing calendar for the seeds you have, and a harvest log. Adding a light no longer means
leaving the plant form.

### Added

- **Add a window or grow light from the plant form** (#98): when a plant's room has no lights
  yet, or is missing one, add it without leaving the form. The new light is chosen for the
  plant, and nothing typed is lost.
- **In the care dataset:** the Madagascar dragon tree (*Dracaena marginata*), known to be toxic
  to cats and dogs (ASPCA), and the avocado (*Persea americana*), as an indoor tree.
- **Garden beds**: an outdoor location can be a raised bed or a bed in the ground, with its
  width and length. Raised beds dry out sooner, so their plants are watered a little more
  often, and a bed's size gives how much water the whole bed needs ("about 20 mm: 60 L for the
  whole bed"). Exports include beds, and older exports still import.
- **Seeds**: a list of the seeds you have (from the Plants page), with their species, variety,
  how many, and the year to sow them by. Exports include them.
- **A harvest log**: log what you pick from vegetables, herbs and fruit, weighed or counted, and
  see the year's total on the plant's page. Exports include harvests.
- **A sowing calendar** for your seeds: when to sow, plant out and harvest each, from the
  place's frost dates, sorted into now, the next four weeks and later. Today mentions what to
  sow or plant out now, and **Sown** adds the seedlings as a plant.
- **Crop timing** in the care dataset: when to sow, plant out and harvest 32 vegetables, herbs
  and annual flowers, in weeks from the frost dates. The Care guide shows it ("Sow indoors: 8
  to 6 weeks before the last frost"). It's a draft, written like the timings on seed packets.
- **Frost dates** for each site: the typical last spring frost and first autumn frost, for
  sowing and planting out. The weather plugin estimates them once from 20 years of Open-Meteo's
  past weather (a new host, `archive-api.open-meteo.com`); or enter them on the site's page.
  Plugins can give them with the new `frost_dates` hook.

### Changed

- **How much to water plants in the ground follows the soil water balance** (with the weather
  plugin): a watering puts back what the soil holds, 10 to 20 mm depending on the plant,
  instead of 25 mm a week spread over the interval. Plugins can give the amount with
  `Adjustment.amount_mm`.

### Fixed

- **Screen readers name the close button of dialogs and notifications** ("Close"), instead of
  only "button".
- **The water and fertilizer bars update as soon as care is logged** (#136): on a plant's page
  and in the list, they kept the old due date until the page was opened again. The same went
  for moving a plant, or changing its pot or light.

## [0.6.1] - 2026-11-01

**Fuchsia.** Fixes from using 0.6: the background worker now runs its jobs on Docker
installs, and the logs are quieter.

### Changed

- **Quieter logs**: the web server no longer logs every request, most of which are health
  checks and app files. Warnings and errors are still logged. Set `SUNFLECK_ACCESS_LOG=true`
  to log every request again.

### Fixed

- **The worker couldn't run its jobs** on Docker installs: the image came with an empty job
  queue owned by root, which each new volume copied, so the worker failed quietly and
  reminders, weather updates and nightly recalculations didn't run. The image no longer has it,
  and Sunfleck removes the old one when it starts.
- **Data files Sunfleck can't write to** now stop it at startup, with the command that fixes
  them, instead of making the worker fail quietly.

## [0.6.0] - 2026-11-01

**Fuchsia.** Care where you are: notifications from the app itself, care in your calendar,
and outdoor watering that follows the weather. Plugins can be tested before saving, and their
page is tidier.

### Added

- **Test a plugin before saving it**: plugins that can be checked have a **Test** button on
  the Plugins page, which tries the settings in the form without saving them, and says what's
  wrong if they don't work (#93). The AI plugin asks the model a tiny question, the Pl@ntNet
  plugin checks the API key with a blank image, and the weather plugin checks that Open-Meteo
  can be reached. Plugins add a test with the new `check_settings` hook.
- **Notifications from the app itself (Web Push)**: under Notifications, **Get notifications
  on this device** sends the digest and reminders to that phone or computer, without ntfy or
  another app. Each device then shows as a channel to test, rename or pause. It needs Sunfleck
  over HTTPS; on iPhone and iPad, the app added to the Home Screen.
- **Care in your calendar**: under Notifications, **Get a calendar address** gives you a
  private iCal feed of the next two weeks of care, for Google Calendar, Apple Calendar and
  others. The address is shown once (only a hash of it is kept), and a new one stops the old.
- **Outdoor watering that follows the weather**: with the weather plugin on, outdoor plants are
  due when a soil water balance says the soil is dry again: the water the weather took since
  watering (Open-Meteo's evapotranspiration), the rain, and what the soil holds. **Why?** shows
  the numbers; the plugin's README has the formula. Plugins can give a due date of their own
  (`Adjustment.due_on`) and know when a plant was last watered.
- **Tidier Plugins page**: each plugin's card folds away, still showing its name, whether it's
  on, and badges for an error, for sending data and for unsaved changes (#95). Plugins that are
  off start folded; turning one on opens it, so **Save** and what it sends are in sight. Your
  choice is remembered in the browser.

### Changed

- **ntfy with an access token**: the help under a notification address, and the user guide,
  now show where the token goes (`ntfys://tk_token@your-server/your-topic`).

### Fixed

- **AI suggestions from a slow model**, such as an Ollama model that has to load first, could
  fail after 30 seconds: the web server stopped any request that took longer. It now allows
  250 seconds (`WEB_TIMEOUT`), longer than the AI plugin waits for an answer. Identifying a
  plant with Pl@ntNet, which waits up to 30 seconds, is no longer cut off either.

## [0.5.1] - 2026-10-31

**Echinacea.** Fixes from using 0.5: no more error page when the app was open during an update,
and a clear message when `SECRET_KEY` isn't set.

### Fixed

- **A missing `SECRET_KEY` is now explained**: starting Sunfleck with `SECRET_KEY` empty in
  `.env` only said "dependency failed to start: container … is unhealthy". `docker compose up`
  now stops straight away and says to set `SECRET_KEY`, and the troubleshooting section covers
  an unhealthy container.
- **An error after an update**: an app that was open during an update could show "Unexpected
  Application Error! 'text/html' is not a valid JavaScript MIME type" when opening a page.
  The app now reloads itself once to get the new version, and a file that no longer exists is
  reported as not found (#89).

## [0.5.0] - 2026-10-31

**Echinacea.** AI suggestions and toxicity to pets: an optional AI plugin (OpenAI, or your own
model with Ollama) that suggests a care profile for unusual plants, flags for houseplants known
to be toxic to cats and dogs, and asking when a new plant was last cared for.

### Added

- **Toxicity to pets**: 28 houseplant genera and species now carry a "known to be toxic to
  cats / dogs" flag, each linking to the specific ASPCA Animal Poison Control entry it comes
  from (#84). Everything else stays "unknown" rather than guessed as safe.
- **Suggest a care profile with AI**, for plants whose species has no care profile: with an AI
  plugin on, **Suggest with AI** on the plant form asks which built-in profile fits best, and
  why ("Hoyas grow on trees and like to dry out a little"). The AI can only choose one of the
  built-in profiles, so the care itself always comes from the reviewed dataset, and nothing
  changes until you use the suggestion.
- **AI plugin (OpenAI-compatible)**, off until an Admin turns it on: suggestions from an AI
  model through OpenAI, or a model you run yourself with Ollama or LM Studio. It's only asked
  when you ask for a suggestion, and every answer is checked before it's used. Plugins can
  offer other AI services through the new `complete_json` hook.
- **When was it last cared for?** Adding a plant asks roughly when it was last watered and
  fertilized (today, a few days ago, about a week ago, or don't know), so its first due dates
  and care bars start from there instead of from the day it was added (#76). The answer is
  kept in its history, marked "Estimated when added".

## [0.4.1] - 2026-10-30

**Dahlia.** Fixes from using 0.4: sensible water amounts for bigger pots, and what to add
when a plant's light isn't known.

### Changed

- **When a plant's light isn't known**, its page now says what to add (the windows or grow
  lights that reach it, or a location's sun exposure) instead of leaving the light check out.

### Fixed

- **Water amounts for bigger pots** were far too high: they were a share of the whole pot's
  volume, which grows with the cube of its width (2.8 gallons for a 15-inch pot). They're now
  the water to wet again the soil that dried since the last watering, at most the top 10 cm
  (4 in) or so: about 2 litres (half a gallon) for that pot. Small pots change little. Every
  plant's amount is updated when Sunfleck starts.

## [0.4.0] - 2026-10-30

**Dahlia.** Smarter care: humidity in the predictions, care at a glance, light through the
year, and schedules that learn from how you water. Also an About page.

### Added

- **About Sunfleck**, in the account menu: which version is running, with its release notes,
  the version of the care data, the licences and the source code, and credits.
- **Humidity in watering predictions**: indoors, dry air means watering sooner and damp air
  later. A location's own humidity setting is used; without one, and with the weather plugin
  on, it's estimated in cold weather from the outdoor dew point and the room's temperature
  (heated winter air is dry). The location's page shows the estimate, and **Why?** mentions
  when the air is dry for a plant that likes humid air.
- **Care at a glance**: slim water, fertilizer and light bars on each plant's card and page.
  Water and fertilizer run down until the care is due (red when it's due or overdue, grey
  while it rests); light shows how the plant's spot compares with what it likes at this time
  of year. Each bar is also said in words ("Water in 2 days", "Light: a bit low for this
  plant"), on the page and for screen readers.
- **Is this spot bright enough?** A plant's page compares the light at its spot with what it
  likes, season by season, with a tip when it's too dim or too bright, and says how much
  light each window or grow light gives it now. A location's page shows each window's light
  through the year (at 1 m from the glass) and each grow light's.
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

[Unreleased]: https://github.com/mazelado/sunfleck/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mazelado/sunfleck/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/mazelado/sunfleck/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/mazelado/sunfleck/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/mazelado/sunfleck/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/mazelado/sunfleck/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/mazelado/sunfleck/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/mazelado/sunfleck/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/mazelado/sunfleck/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/mazelado/sunfleck/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/mazelado/sunfleck/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mazelado/sunfleck/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mazelado/sunfleck/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mazelado/sunfleck/releases/tag/v0.1.0
