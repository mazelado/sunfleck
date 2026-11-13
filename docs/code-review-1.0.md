# Code quality review for 1.0

The deep code review the [roadmap](roadmap.md) asks for before 1.0 ("Jasmine: mature and
beautiful"). It is a report only: nothing was fixed. Each finding is meant to become one fix,
in the work packages at the end. The security review, done first, is in
[security-review-1.0.md](security-review-1.0.md); findings there aren't repeated here.

## Summary

The code is in good shape for a release: the layering the style guide asks for is followed
almost everywhere, the linters and type checkers pass with nothing switched off, and the
backend has 97% test coverage with tests that assert behaviour. **Nothing found loses or
corrupts stored data on its own (no severity 4).** Three findings are **major (3)**, bugs
people will meet:

- **Q1:** putting care off is silently undone when the plant's due date moves for any
  reason, such as editing the plant or a new weather forecast.
- **Q2:** setting `SUNFLECK_ENCRYPTION_KEY` on an instance that ran without it makes every
  stored secret unreadable (notification channels, plugins' API keys, the push key).
- **Q3:** the first time Today is opened each day, every schedule is recalculated inside
  that request, about 15 database queries per plant.

One finding matters for [stability.md](stability.md): several list endpoints return plain
arrays (Q6). After 1.0 they can't be paginated without a new API version, so it's worth
deciding now.

| | |
|---|---|
| **Reviewed** | The backend (`backend/sunfleck/`, 11 apps), the four built-in plugins (`plugins/`), and the frontend (`frontend/src/`) |
| **At commit** | `1ceaee8` (main, 2026-11-13; version 0.9.0 plus the Unreleased changes) |
| **How** | The backend's API, services, selectors, schedules, import and export, notifications and AI modules and the plugins were read in full; the prediction engine's prediction functions were read, its tables weren't checked. Suspected bugs were tried with throwaway pytests (not kept; each finding describes its test). Query counts were measured with `CaptureQueriesContext`. Dead code was looked for with a reference count over the backend, [knip](https://knip.dev) for the frontend, and a script comparing `en.json` with the keys the code uses. `make lint`'s checks and both test suites were run |
| **Results of the checks** | Ruff and mypy: clean (229 files). ESLint and `tsc`: clean. Backend: 795 tests pass, 96.6% coverage. Frontend: 304 tests pass |

**Not covered:**
- The frontend was reviewed by tooling and by reading the API layer, sign-in flow and
  shared helpers, not component by component. Its accessibility wasn't audited again
  (`accessibility.test.tsx` passes).
- The end-to-end tests (`make e2e`) and `make dev` weren't run; nothing was checked by hand
  in a browser.
- PostgreSQL: everything ran on SQLite. Findings that depend on it say so.
- The care dataset's contents (`data/care/`) and the prediction engine's numbers.
- The plugins weren't run against the real services. Q9 is unconfirmed for that reason.

Severity uses the scale of [heuristic-review.md](heuristic-review.md): 4 critical, 3 major,
2 minor, 1 cosmetic or hardening.

## Findings

| ID | Title | Severity | Area | Where | Status |
|---|---|---|---|---|---|
| Q1 | Putting care off is undone whenever the due date moves | 3 | Care | `backend/sunfleck/care/schedules.py:235` | Confirmed |
| Q2 | Setting an encryption key later makes existing secrets unreadable | 3 | Core, deployment | `backend/sunfleck/core/crypto.py:37` | Confirmed |
| Q3 | The day's first Today request recalculates every schedule, about 15 queries per plant | 3 | Care, performance | `backend/sunfleck/care/schedules.py:262`, `:308`, `care/tasks.py:13` | Confirmed |
| Q4 | A household that used a care type of its own can't be deleted | 2 | Care, data model | `backend/sunfleck/care/models.py:72` | Confirmed |
| Q5 | The AI is told care dates in UTC next to a local "today" | 2 | AI | `backend/sunfleck/ai/context.py:112` | Confirmed |
| Q6 | Eight list endpoints aren't paginated, and can't be after 1.0 | 2 | API design, stability | `plants/api.py:852`, `garden/api.py:110`, `:246`, `ai/api.py:122` and others | Confirmed |
| Q7 | Four inputs end in a 500 instead of an error the app can show | 2 | Error handling | `care/services.py:138`, `care/schedules.py:449`, `dataio/importer.py:426` | Confirmed (one part unconfirmed) |
| Q8 | A failing AI plugin is reported as "no AI plugin is turned on" | 2 | AI, error handling | `ai/services.py:26`, `ai/chat.py:123`, `plants/api.py:766` | Confirmed (by reading) |
| Q9 | The Claude plugin's list of models is behind, and its token limit includes thinking | 2 | Plugins | `plugins/ai-anthropic/sunfleck_ai_anthropic/client.py:22`, `:26` | Unconfirmed |
| Q10 | Export makes 4 to 5 queries per plant and runs in a web worker | 2 | Export, performance | `backend/sunfleck/dataio/exporter.py:131`, `:223`, `:270` | Confirmed |
| Q11 | Tests missing for behaviour that matters most | 2 | Tests | See the finding | Confirmed |
| Q12 | 30 of 141 components are over the style guide's 150 lines; 13 files hold three or more | 1 | Frontend structure | `frontend/src/features/settings/HouseholdPage.tsx` and others | Confirmed |
| Q13 | Unused translation keys and exports, and comments about a future that has happened | 1 | Dead code, docs | `frontend/src/i18n/locales/en.json:21`, `docs/STYLE_GUIDE.md:373` and others | Confirmed |
| Q14 | The same small helpers are written out in several apps | 1 | Duplication | `care/api.py:371`, `garden/api.py:234`, `ai/api.py:92` and others | Confirmed |
| Q15 | Small races on "check, then create" | 1 | Correctness | `care/services.py:51`, `dataio/importer.py:483`, `notifications/services.py:253` | Confirmed (by reading) |

---

### Q1. Putting care off is undone whenever the due date moves (3)

**What's wrong.** `recalculate` clears the snooze whenever the new prediction's due date
differs from the stored one (`care/schedules.py:235`–`236`). The comment gives the reason:
"a snooze puts off one due date, not the next". That's right when the care was logged. But
the due date also moves when the plant is edited, when its light or room changes, when the
season's interval changes, and, for outdoor plants with the weather plugin, with every new
forecast (its water balance sets the due date directly).

**Why it matters.** Scenario: watering is due today; you're away, so you choose **Later → in
a week**. That evening someone corrects the pot's size. The prediction moves by two days,
the snooze is gone, and the plant is "due" again five days early, in Today, the digest and
the calendar feed. With the weather plugin this needs no one to do anything: the hourly
forecast is enough. Putting care off is a main feature of Today, and it quietly doesn't
hold.

**How to reproduce.** A pytest with frozen time: a plant with a predicted watering schedule,
watered two days ago, due on 15 May. On the 15th, `schedules.snooze(schedule, 22 May)`. Then
set `container_diameter_cm` and `container_height_cm` to 40 and save the plant. Reading the
schedules again gives `next_due` 17 May and `snoozed_until None`. (Confirmed for a plant
edit. The weather case follows from the same line and wasn't run.)

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Clear the snooze only where the care is logged (and where the schedule's mode or interval is changed by hand), not in `recalculate`. A snooze that's in the past is ignored by `due_on` already | `care/schedules.py`, `care/services.py` or the care signal | Low. One behaviour changes on purpose: a snooze now survives the prediction moving later than the snooze, where `due_on` already shows the later date |
| B | Keep clearing in `recalculate`, but only when the last-done date changed (compare `history.last_done` with a stored copy) | A new column on `CareSchedule`, a migration, export and import | Medium: more state for the same result |
| C | Store the snooze as "not before this day" on the plant's care type rather than on the prediction | Model change | High for what it buys, this close to the freeze |

**Recommendation: A.**

**Regression test.** `test_a_snooze_survives_the_prediction_moving` (the test above,
expecting `due_on` 22 May), and `test_logging_the_care_ends_the_snooze`, which pins the
behaviour the comment describes.

---

### Q2. Setting an encryption key later makes existing secrets unreadable (3)

**What's wrong.** Without `SUNFLECK_ENCRYPTION_KEY`, secrets are encrypted with a key
derived from `SECRET_KEY`. Once the setting has a value, only the listed keys are used
(`core/crypto.py:37`–`43`): the derived key is no longer tried. Everything stored before is
lost to the app: notification channels fail with "encrypted with a key that's no longer
set", plugins quietly lose their API keys (`plugins/services.py:68` logs a warning and
carries on), and the push key can't sign, which breaks every push channel for good, because
the public half that browsers subscribed with stays in the database.

**Why it matters.** Setting the key is what the app itself recommends: the warning in the
log says "Set it to keep them readable if SECRET_KEY changes", and `env.example` calls it
"Recommended". Anyone who follows that advice on a running instance loses the secrets it
was meant to protect. The install guide sets the key before the first sign-in (step 4), so
new installs are fine; instances from before the setting existed, and people who skipped the
step, are not. `env.example` warns about changing `SECRET_KEY`, not about this.

**How to reproduce.** A pytest: with `ENCRYPTION_KEYS=[]`, `token = crypto.encrypt("x")`;
clear the cached `_fernet`; with `ENCRYPTION_KEYS=[crypto.generate_key()]`,
`crypto.decrypt(token)` raises `DecryptionError`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Always add the derived key as the last, decrypt-only key. New secrets use the first listed key; old ones stay readable while `SECRET_KEY` is unchanged | Three lines in `crypto.py`, a sentence in `env.example` and the install guide | Low. The derived key was already able to read these secrets; nothing new is exposed |
| B | A, and a `manage.py reencrypt_secrets` command that rewrites every secret with the first key, so the old keys can be dropped | `crypto.py`, a command touching three models, the install guide's key-replacement steps | Low to medium. It also finishes the documented way to replace a key, which today leaves old secrets on the old key for ever |
| C | Documentation only: tell people to enter their secrets again after setting the key | `docs/install.md`, `env.example` | None; push subscriptions still can't be recovered without database surgery |

**Recommendation: B**, or A alone if B doesn't fit before the release.

**Regression test.** `test_secrets_from_before_the_key_was_set_stay_readable`, and for B
`test_reencrypting_moves_every_secret_to_the_first_key`.

---

### Q3. The day's first Today request recalculates every schedule, about 15 queries per plant (3)

**What's wrong.** `due_tasks` calls `refresh` for each schedule (`care/schedules.py:331`),
which recalculates any schedule not calculated today (`:262`–`266`): for each one, the care
history (two queries), the plant's lights (not prefetched here), the plugins' states (a
query and a decryption per hook call), sometimes the site's weather, then a save and a
history row. All inside a GET.

The nightly job is meant to prevent this, but it runs at 02:23 UTC (`care/tasks.py:13`) and
"today" is each site's own. For a site in the Americas, 02:23 UTC is still yesterday
evening, so the job computes yesterday and the morning's first request does the work. For a
site in Asia or Oceania, the new day began up to twelve hours before the job runs.

**Why it matters.** Measured with two schedules per plant: 82 queries for 5 plants and 382
for 25, where the same request later in the day takes 7. With the weather plugin and 25
outdoor plants: 234. A household with 100 plants on a Raspberry Pi with an SD card waits
seconds for the app's first page every morning, and SQLite holds its write lock for that
long. The digest does the same work in the worker, where it's harmless. Two people opening
Today at once both recalculate, and can both write a `ScheduleAdjustment` for the same
change.

**How to reproduce.** A pytest with frozen time: create n plants with a watering and a
fertilizing schedule on 10 May, call `GET /api/v1/today` (7 queries), move the clock to 11
May, call it again inside `CaptureQueriesContext`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Run the recalculation hourly and only for sites whose local day has just begun (or simply for every schedule whose `calculated_on` isn't its site's today) | `care/tasks.py`, `care/schedules.py` | Low. Requests still recalculate as a fallback when the worker is down, as now |
| B | A, and make the fallback cheap: prefetch lights in `due_tasks`, load each plant's history in one query per care type for all plants, and read plugin states once per request | `care/schedules.py`, `plugins/registry.py` or `services.py` | Medium: touches the hot path of predictions; the property tests and `test_today.py` cover it |
| C | Never recalculate in a GET: serve yesterday's numbers and queue a job | `care/api.py`, `care/tasks.py` | Medium to high: Today could show stale dates for a few seconds, and instances without a worker would never update |

**Recommendation: A first** (small, removes the daily cost for everyone with a worker),
**then B** as a follow-up.

**Regression test.** `test_the_first_today_of_the_day_makes_a_bounded_number_of_queries`
with `django_assert_max_num_queries`, for 5 and 25 plants after the job has run for that
site's day; and `test_schedules_are_recalculated_when_a_site's_day_begins` for sites at
UTC−8 and UTC+10.

---

### Q4. A household that used a care type of its own can't be deleted (2)

**What's wrong.** `CareEvent.care_type` is `PROTECT` (`care/models.py:72`), so that a care
type in use can't be deleted from under its events. Deleting a household cascades to its
care types, and Django refuses the whole delete with `ProtectedError`, even though the
events are being deleted in the same operation.

**Why it matters.** The API never deletes households, so this only shows in the admin site,
as an error page, when the instance's owner removes a household. It will matter more when
"delete my household" is built, which data ownership will ask for sooner or later.

**How to reproduce.** A pytest: a household with a plant, a care type of its own and one
event of that type; `household.delete()` raises `ProtectedError`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Change the foreign key to `RESTRICT`, which refuses deleting a care type alone but allows it when the events go in the same delete | One line and a migration (no data change) | Low; behaves the same on SQLite and PostgreSQL, since Django enforces it |
| B | A `delete_household` service that deletes in the right order | `accounts/services.py`, and the admin action must use it | Low, but the admin site's own delete button stays broken unless overridden |

**Recommendation: A.**

**Regression test.** `test_a_household_with_its_own_care_types_can_be_deleted`, and keep
`delete_care_type`'s existing test for a type in use.

---

### Q5. The AI is told care dates in UTC next to a local "today" (2)

**What's wrong.** `plant_context` starts with "Today is" in the site's time zone
(`ai/context.py:20`) but lists recent care with `event.performed_at.date()`
(`ai/context.py:112`), the UTC date.

**Why it matters.** For a site in Sydney, a plant watered at 8:30 on Monday is described as
"Today is 2026-05-11" and "2026-05-10: Water". The model is told it was watered yesterday,
and "should I water it today?" gets an answer built on that. West of UTC, evening care
moves to tomorrow. The style guide asks for exactly this conversion for "what day is it".

**How to reproduce.** A pytest: a site in `Australia/Sydney`, time frozen at 22:30 UTC on 10
May, one watering logged now; the context holds both lines above.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Convert with the plant's zone: `performed_at.astimezone(plant_zone(plant)).date()` | One line | None |
| B | A, and give the model relative days as well ("2 days ago"), which models handle better than date arithmetic | A few lines; prompts change, so the chat tests' expected text changes | Low |

**Recommendation: A** now; B is a prompt improvement to try separately.

**Regression test.** `test_care_dates_in_the_context_are_the_site's_days`.

---

### Q6. Eight list endpoints aren't paginated, and can't be after 1.0 (2)

**What's wrong.** The style guide (section 4): "List endpoints are paginated. Never return
unbounded lists." Plants, photos and the timeline are. These return a bare array or an
unbounded `items`:

| Endpoint | Where | Grows with |
|---|---|---|
| `GET /wishlist` | `plants/api.py:852` | Use, without limit |
| `GET /plants/{id}/harvests` | `garden/api.py:246` | Use ("a few hundred at most", says the docstring) |
| `GET /plants/{id}/conversations` | `ai/api.py:122` | Use |
| `GET /conversations/{id}` (its messages) | `ai/api.py:160` | Capped at 100 by `MAX_QUESTIONS` |
| `GET /seeds` | `garden/api.py:110` | Use ("a few dozen") |
| `GET /sites` (with locations and lights) | `places/api.py:288` | Slowly |
| `GET /household/members`, `/household/invitations` | `accounts/api.py:370`, `:410` | Slowly |
| `GET /care-types`, `/plants/{id}/schedules` | `care/api.py:428`, `:546` | Bounded in practice |

**Why it matters.** None of these is slow today. The point is the freeze:
[stability.md](stability.md) promises that responses keep their fields and types. A bare
array can never gain a `count` or a cursor without `/api/v2/`. If any of these should ever
be paged, the shape has to change before 1.0. The wishlist and harvests are the ones a keen
gardener can grow into the thousands over years.

**How to reproduce.** Read the response types in `frontend/src/api/openapi.json`, or the
decorators at the lines above.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Wrap the use-driven lists (wishlist, harvests, conversations, seeds) in `{items, count}` with optional `limit` and `offset`, defaulting to everything up to a generous cap; leave the slow-growing ones as arrays and add them to the style guide as named exceptions | Four endpoints, their frontend hooks and tests, the stability baseline | Medium: a breaking change to four responses, which is only allowed now. The baseline test will flag it and must be re-recorded on purpose |
| B | Keep every shape; add optional `limit` and `offset` query parameters and a server-side cap, with the total in an `X-Total-Count` header | The same four endpoints, no frontend change needed | Low. Stays compatible, but is a second pagination style next to `{items, count}` |
| C | Decide these lists stay whole, and write that into the style guide and [stability.md](stability.md) | Two paragraphs | None now; the option is gone after 1.0 |

**Recommendation: A** if the release can take four small response changes, otherwise **B**.
C is a legitimate choice too, as long as it's made on purpose.

**Regression test.** For A or B, a test per endpoint that a `limit` is honoured and the
count is right, and a query-count test as the style guide asks for list endpoints.

---

### Q7. Four inputs end in a 500 instead of an error the app can show (2)

**What's wrong.** Each of these raises an exception nothing catches:

1. **Care logged in year 1 with a UTC offset.** `performed_at` has no lower bound; with
   `0001-01-01T00:00:00+14:00`, `astimezone(UTC)` overflows (`care/services.py:138`).
   Confirmed: `OverflowError`. Without the offset it's accepted and stored as care 2,000
   years ago.
2. **Two schedules for the same care, created at once.** `_apply` checks `exists()` and then
   saves (`care/schedules.py:449`–`481`); the second request hits the unique constraint.
   Confirmed that the `IntegrityError` isn't caught (the race itself wasn't run).
3. **An import whose household name is over 100 characters.** The name is saved without
   validation (`dataio/importer.py:426`). On SQLite, 5,000 characters are stored (confirmed);
   on PostgreSQL this would be a `DataError`, which the importer's `except IntegrityError`
   doesn't cover (unconfirmed). Members' names and emails in the file aren't validated
   either, but they aren't stored.
4. **An import with an image over Pillow's pixel limit:** see S6 in the security review.

**Why it matters.** The app's error handling is otherwise consistent: every service raises
its own error with a stable code, and the frontend explains each code in words. A 500 shows
"Unexpected response (500)" and puts a traceback in the log for something a person typed or
double-tapped. The second case is the realistic one: two people in a household setting up
the same new plant.

**How to reproduce.** (1) `POST /api/v1/plants/{id}/care-events` with the timestamp above.
(2) Create a schedule, then create the same one again directly in a savepoint to see the
exception type the service lets through. (3) Import a minimal export with a 5,000-character
`household`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Fix each where it happens: a lower bound on `performed_at` (the year 2000, say) with `care_too_long_ago`; catch `IntegrityError` around the schedule's save and raise the existing `schedule_exists`; run the household through `full_clean` in the importer like every other imported object | Three small changes | Low. A new error code is allowed by [stability.md](stability.md) |
| B | A, and a last-resort handler in `core/errors.py` that turns `IntegrityError` into 409 `conflict` and anything else into 500 in the standard error shape, still logged | `core/errors.py` | Low to medium: a generic 409 could hide a real bug behind a tidy error; log it at ERROR so it's still seen |

**Recommendation: A**, and from B only the standard shape for 500s, so that the app can
show a translated "something went wrong" instead of "Unexpected response".

**Regression test.** `test_care_before_2000_is_refused`,
`test_a_second_schedule_for_the_same_care_is_a_conflict_not_a_crash` (make the `exists()`
check pass by patching it), `test_an_export_with_an_overlong_household_name_is_invalid`.

---

### Q8. A failing AI plugin is reported as "no AI plugin is turned on" (2)

**What's wrong.** `ai.ask` returns None both when no AI plugin is on and when the plugin
raised (`ai/services.py:26`–`35`; the registry records the error and leaves the answer
out). All three callers turn None into "No AI plugin is turned on" with a 404
(`ai/chat.py:123`, `ai/diagnosis.py:113`, `taxonomy/suggest.py:74`).

Next to it: `diagnose_plant` saves the photo after the AI has answered
(`plants/api.py:766`–`771`). If saving fails, the request fails and the diagnosis that was
just paid for is thrown away.

**Why it matters.** A Gardener asks a question, the plugin crashes on an unexpected answer,
and they're told the feature is off, although the button to ask is right there. The Admin
sees the real error on the Plugins page, but the person asking can't know to go and tell
them. The app already has the right code for this elsewhere: identification answers
`identification_failed` in the same situation (`taxonomy/identify.py:90`).

**How to reproduce.** Add a fake plugin whose `complete_json` raises, turn it on, and `POST
/api/v1/plants/{id}/conversations`: the answer is 404 `chat_unavailable`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Make `ask` tell the two apart: None when no plugin is on, an `AiAnswer` with problem `failed` when one is on but gave nothing; the callers already map problems to `ai_…` codes (502). Add `ai_failed` to the frontend's messages. In `diagnose_plant`, catch the photo error and return the diagnosis with `photo: null` | `ai/services.py`, `plants/api.py`, `en.json` | Low. A new error code for a new distinction, which the stability rules allow |
| B | Raise a dedicated exception from `ask` instead of a problem code | `ai/services.py` and three callers | Low, but a second way of reporting problems next to `AiAnswer.problem` |

**Recommendation: A**, in the same PR as S5 in the security review, which touches the same
function.

**Regression test.** `test_a_crashing_ai_plugin_is_reported_as_failed_not_as_off` for each
of the three features; `test_a_diagnosis_is_returned_even_if_its_photo_can't_be_kept`.

---

### Q9. The Claude plugin's list of models is behind, and its token limit includes thinking (2, unconfirmed)

**What's wrong.** The plugin keeps a hand-written list of the models that take `effort` and
`fallbacks: "default"` (`client.py:26`–`31`). Checked against Anthropic's current model
documentation:

- `claude-fable-5-2`, the current top model, isn't on it. Someone who sets it gets no
  `effort` (so the model's default, `high`, for one-line questions) and no fallback when a
  safety classifier declines a request, which the plugin then reports as "answered, but not
  as asked".
- `claude-fable-5` is on it, but isn't among the models documented for the `"default"`
  fallback. If the API refuses the parameter there, every request to that model fails with a
  400, shown as "unavailable".
- `MAX_TOKENS = 4096` (`client.py:22`) is called "enough for any of Sunfleck's JSON
  answers". On the models where thinking can't be turned off (Opus 5.5, the Fable models),
  thinking counts towards it. A diagnosis from a photo at `medium` effort can use it up
  before the answer, and the plugin reports `invalid_answer`.

**Why it matters.** Whoever picks a model the list doesn't know gets slower, dearer and
less reliable answers with nothing saying why. A list like this is out of date again with
each model release.

**What would confirm it.** A test key: ask a diagnosis with each model id and compare
`stop_reason` and `usage.output_tokens` with the limit; send `fallbacks: "default"` to
`claude-fable-5`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Update the lists (add `claude-fable-5-2`, check `claude-fable-5`), raise the limit to about 16,000, and report `max_tokens` stops with a clearer detail | `client.py`, tests | Low; the same upkeep comes round with the next model |
| B | A, and stop keeping lists: send `effort` and `fallbacks` to any model, and on a 400 that names one of them, retry once without it and remember that for the model | `client.py` | Low to medium: one extra request the first time an older model is used; the error text to match is the API's and may change |
| C | Ask the Models API for capabilities | `client.py` | Medium: one more call and a dependency on fields that may not describe fallbacks |

**Recommendation: B.**

**Regression test.** `test_a_model_the_plugin_doesn't_know_still_gets_effort_and_fallbacks`,
`test_a_model_that_refuses_fallbacks_is_asked_again_without_them`, with the client replaced
as in the existing tests.

---

### Q10. Export makes 4 to 5 queries per plant and runs in a web worker (2)

**What's wrong.** `_plant` queries care events, harvests, conversations (and each
conversation's messages) and schedules for every plant (`dataio/exporter.py:131`–`181`,
called at `:223`). Measured: 36 queries for 5 plants, 116 for 25. Photos are then read whole
into memory one at a time (`:270`), and the archive is written to a temporary file before
the first byte is sent, all inside a web request with two workers (see S7).

**Why it matters.** Export is rare, and the docs point large households to the command. But
"users own their data" is a principle, and the Download button is the way most people will
use it: on a Pi with 150 plants and 2,000 photos it holds one of two workers for a long time
and may hit the proxy's timeout, which looks like a broken download.

**How to reproduce.** `CaptureQueriesContext` around `GET /api/v1/export`, reading the
streamed response to the end.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Prefetch the four relations (and messages) in `build`, and copy photos into the archive in chunks with `archive.open(name, "w")` | `exporter.py` | Low: the round-trip test compares the result field by field |
| B | A, and build the export in the worker: the button starts it, the app shows progress and offers the file when it's ready | A model or a file convention for finished exports, two endpoints, UI | Medium to high: new API surface days before it freezes |

**Recommendation: A** for 1.0. B is worth an issue for 1.x; it's an addition, so it doesn't
need the freeze.

**Regression test.** `test_exporting_makes_the_same_number_of_queries_for_5_and_25_plants`.

---

### Q11. Tests missing for behaviour that matters most (2)

**What's wrong.** Coverage is high and the tests assert behaviour: no test was found that
passes without checking anything. What's missing is by topic, not by line. These had no
test, which is how the findings above and in the security review got through:

| Behaviour | Why it matters | Finding |
|---|---|---|
| The limits on failed sign-ins | A security control with no test at all (`grep` finds none) | S4 |
| One generic cross-household sweep | Each app tests its own endpoints; nothing fails when a new endpoint forgets | S1, S3 |
| A plugin's own API routes | `register_api` is tested for being mounted, not for what protects it | S3 |
| Two plugins implementing the same "first one answers" hook | Every AI test adds one plugin | S5 |
| Hostile or foreign import archives | Tests import Sunfleck's own exports, edited | S6, Q7 |
| Secrets across a key change from the derived key | `test_crypto.py` covers rotation between listed keys only | Q2 |
| A snooze outliving a recalculation | Snoozing and recalculating are tested apart | Q1 |
| Query counts on Today on a new day, and on export | The style guide asks for query-count tests on list endpoints; Today's covers the cached case | Q3, Q10 |
| Time zones away from Europe in the AI context | Tests use the default zone | Q5 |
| A plugin that raises, in each AI feature | Tested for the registry, not for what the person is told | Q8 |

**Why it matters.** The style guide: "Every endpoint checks permissions. Write tests proving
that an unauthorized user is refused." The per-endpoint tests do that well. A sweep that
reads the endpoints from the API itself is the only kind that also covers the endpoint added
next month.

**How to reproduce.** Search the tests for each topic, for example
`grep -rn "too_many" backend/sunfleck/*/tests` (no result).

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Add each test with the fix for its finding, as the fix plans say | Spread over the fix PRs | None; but the sweep belongs to no fix |
| B | A, plus one PR for the two tests that guard the future: the cross-household sweep (every path from `api.get_openapi_schema()` that takes an id, called with another household's ids and valid bodies, expecting 404 and unchanged rows; it fails for a path it has no ids for, so new endpoints must be added to it) and a role sweep (every unsafe method as a Viewer expects 403) | A new `core/tests/test_isolation.py` | Low. Valid bodies need a small table of example requests, which is the test's upkeep |

**Recommendation: B.** The sweep written for this review took an hour and is described in
the security review's summary; with valid bodies it becomes the regression test for the
property the project cares most about.

**Regression test.** This finding is the tests.

---

### Q12. 30 of 141 components are over the style guide's 150 lines; 13 files hold three or more (1)

**What's wrong.** The style guide: "One component per file", and "if a component exceeds
~150 lines, split it". Counting `.tsx` files outside tests: 30 are over 150 lines. The
largest are `HouseholdPage.tsx` (403 lines, 6 components), `ConversationPage.tsx` (319, 6),
`ProfilePage.tsx` (316, 5), `PluginsPage.tsx` (307), `LocationPlants.tsx` (299),
`LocationFormPage.tsx` (286), `PlantTimeline.tsx` (284, 4), `LightSourceForm.tsx` (281),
`WishlistPage.tsx` (279), `AppLayout.tsx` and `SeedsPage.tsx` (264 each). Thirteen files
define three or more components.

**Why it matters.** Nothing is wrong with how these work, and the helpers inside them are
small and well named. But the rule is one the project wrote for itself, and rule zero says
to change the guide when a rule is wrong, not to break it. The settings pages are also the
ones the 1.0 UI plan touched least, so they're the oldest code.

**How to reproduce.**
`find src -name "*.tsx" ! -name "*.test.tsx" | xargs wc -l | sort -n` and
`grep -cE "^(export )?function [A-Z]"` per file, in `frontend/`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Split the worst five (the files over 300 lines) along the components they already contain, one file each; no behaviour change | Five files become about twenty | Low: the tests are per feature, not per file, so they keep passing unchanged |
| B | Change the guide to what the code does: "one exported component per file; small private helpers may share it; split a file over ~250 lines" | A paragraph in `STYLE_GUIDE.md` | None |
| C | An ESLint rule (`max-lines` per file) at the chosen limit, warnings only at first | `eslint.config.js` | Low |

**Recommendation: B and C together, then A** for what's still over the new limit. The
code's habit (a page with its private rows and dialogs) is reasonable; the guide should
describe it and the linter should hold the line.

**Regression test.** The lint rule.

---

### Q13. Unused translation keys and exports, and comments about a future that has happened (1)

**What's wrong.**

- **Eight translation keys nothing uses** in `frontend/src/i18n/locales/en.json`:
  `common.add` (`:21`), `common.notFound` (`:24`), `plants.uploading` (`:654`),
  `guide.notFound` (`:902`), and `glance.light.low`, `.aBitLow`, `.good` and `.bright`.
  (Keys built from a variable, such as `glance.water.inDays`, were checked and are used.)
  Every key is work for each translator.
- **Unused exports:** the types `Invitation` (`api/accounts.ts:12`), `CareProfileSuggestion`
  (`api/taxonomy.ts:63`), `PutOffCare` (`features/care/PutOffDialog.tsx:14`) and
  `GlanceCare` (`features/plants/glanceText.ts:10`), and `export` on `initialLights`
  (`features/plants/plantForm.ts:34`) and `careText` (`glanceText.ts:13`), which are only
  used in their own files.
- **Comments and documents that still speak of a time before now:**
  `care/schedules.py:7` ("which the nightly job will run"), `plugins/hookspecs.py:49` and
  `plugins/types.py:94` ("from M9, when the worker exists"), `docs/plugins.md:10` ("It may
  still change before v1.0"), `:118` ("from M9") and `:156` ("Docker images will document a
  two-line `Dockerfile`", which doesn't exist yet: installing a plugin in Docker is
  undocumented), `docs/STYLE_GUIDE.md:373` ("These tools will be configured when the
  codebase is created"), and `SECURITY.md:21` ("now 0.9", to change with the release).

The backend has no dead code: a reference count over every top-level function and class
found nothing unused outside Django's app classes.

**Why it matters.** Small, but 1.0 is when translators and plugin authors arrive, and they
read exactly these files. The missing Dockerfile for plugins is the one real gap: the plugin
guide ends its install section with a promise.

**How to reproduce.** `npx knip` in `frontend/`; a script that flattens `en.json` and
searches `src/` for each key (allowing for plural suffixes and keys built with template
strings).

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Delete the keys and exports, reword the comments, and write the two-line Dockerfile into `docs/plugins.md` and `docs/install.md` | One small PR | Low. Check the two `notFound` keys aren't meant for a page that should show them |
| B | A, and add knip and the key check to `make lint` and CI, so it stays clean | `package.json`, `Makefile`, the workflow, a small script | Low: one more development dependency, to justify as the style guide asks |

**Recommendation: B.** `docs/translating.md` already has a test that the languages match;
this is its other half.

**Regression test.** The CI check.

---

### Q14. The same small helpers are written out in several apps (1)

**What's wrong.** None of these is wrong; each is the same few lines kept in step by hand:

| What | Where |
|---|---|
| "The plant, if it's the household's, or 404" | `plants/api.py:522`, `care/api.py:371` and `:378`, `garden/api.py:234`, `ai/api.py:92` |
| A service error turned into a 422 with its field | `plants/api.py:476`, `care/api.py:364`, `places/api.py:248`, `garden/api.py:106`, `notifications/api.py:88`, `plugins/api.py:103`, and again inline at `garden/api.py:187` |
| The service error classes themselves (`code`, `message`, `field`) | `PlantsError`, `CareError`, `PlacesError`, `GardenError`, `NotificationError`, `PluginError`: six identical classes |
| "Today at this site" | `care/api.py:335`, `garden/api.py:159`, `:241`, `notifications/digest.py:79`, `care/schedules.py:68`, and the weather plugin's `hooks.py:48` |
| "A time without a zone is local time at the plant's site" | `care/services.py:118`, `plants/services.py:272` |
| A seed's display name | `garden/api.py:91`, `garden/services.py:65` |
| The AI plugins' `attribution`, `CHECK` task and `check_settings` | `plugins/ai-anthropic/…/client.py:33`, `hooks.py:8`; `plugins/ai-openai/…/client.py:31`, `hooks.py:8` |
| A JSON-over-`urllib` POST that returns the status and body | `plugins/ai-openai/…/client.py:35`, `plugins/identify-plantnet/…/plantnet.py:52` |

And three places where `api.py` does more than the style guide's "thin HTTP layer":
`diagnose_plant` orchestrates reading, diagnosing and keeping the photo
(`plants/api.py:740`), `sowing_calendar` chooses the site (`garden/api.py:148`), and
`log_harvest` checks the date (`garden/api.py:267`).

**Why it matters.** The garden app's two versions of "today for this plant" already differ:
`garden/api.py:241` falls back to the server's zone through `timezone.localdate()`, the care
app through `settings.TIME_ZONE`. They're the same today, and they're the kind of pair that
drifts. S9 in the security review (URL schemes) would have been one fix instead of two with
a shared HTTP helper.

**How to reproduce.** `grep -rn "def _get_plant" backend/sunfleck` and the lines above.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Move the core's duplicates to where they belong: a `ServiceError` base in `core/errors.py` with one handler registered for it (the six `_…_error` functions and most `try`/`except` blocks in `api.py` files go), `site_today(site)` on `Site` or in `places`, `plants.selectors.get_plant`, and the two zone helpers into one | About 12 files, no behaviour change | Low to medium: wide but mechanical; the API tests pin every status and code |
| B | A, and for plugins: export `site_today` and a small `post_json` from `sunfleck.plugins` | Plugin API additions, the stability baseline | Low; additions are allowed after 1.0 too, so this needn't be rushed |
| C | Leave it; note the pairs in the style guide | A paragraph | None |

**Recommendation: A** after 1.0's must-fix work, or straight after the release: it changes
nothing that's frozen. B when the next plugin needs it.

**Regression test.** None new: the existing API tests are the safety net. Run the stability
baseline to confirm no error code or status changed.

---

### Q15. Small races on "check, then create" (1)

**What's wrong.** Besides the schedule race in Q7 and the setup race in S14:

- **Care type names:** `_apply_care_type` checks that the name is free and then saves
  (`care/services.py:51`–`59`). No constraint backs it, so two requests can create two
  "Bottom water" types.
- **Import into an empty household:** `is_empty` is checked before the transaction starts
  (`dataio/importer.py:483`), so two imports started together both run.
- **Plugin errors:** `record_error` uses `update_or_create` (`plugins/services.py:207`),
  which is safe, but `registry.call` reads every plugin's state on each hook call, and a
  save from the Plugins page in between is overwritten only in `last_error`: fine.
- **Notifications:** `_send_once` marks the day as sent before sending
  (`notifications/services.py:253`). If the worker is killed mid-send, that day's digest is
  recorded as sent and never retried.

Two people logging care for the same plant at once, the case the brief asks about, is safe:
each request inserts its own event, and schedules are only marked out of date.

**Why it matters.** Each needs two people (or a crash) in the same second, in a household.
They're listed so the pattern is known, and because the first two are cheap to close.

**How to reproduce.** By reading. Each could be shown with two threads on PostgreSQL.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | A unique constraint on (household, lower(name)) for care types, with the `IntegrityError` mapped to `care_type_exists`; move `is_empty` inside the import's transaction; give the notification log a `sending` status that a later run may retry after the send window | Two migrations, three small changes | Low. The care-type migration fails on an instance that already has duplicates: it needs a data step that renames them first |
| B | Lock the household row (`select_for_update`) in the services that check before creating | Several services | Low on PostgreSQL; on SQLite it does nothing, and nothing is needed there |

**Recommendation: A** for care types and the import; leave the notification case as it is
and note it in the code: a digest lost to a crash is better than one sent twice.

**Regression test.** `test_two_care_types_with_the_same_name_are_refused_by_the_database`,
`test_an_import_checks_the_household_is_empty_inside_its_transaction`.

## What's good

Worth keeping exactly as it is while fixing the above:

- **The layering holds.** `api.py` files validate, call a service or selector and convert;
  services own the rules and raise errors with stable codes; models are plain. A newcomer
  can find where a rule lives by its app's name.
- **Errors are one shape with stable codes,** and the frontend translates by code, so
  server messages never need translating. Every service documents what it raises.
- **Types are real.** mypy with the Django plugin passes on 229 files with a handful of
  explained ignores; the frontend's API types are generated from the schema, with no `any`.
- **Tests read as specifications:** names say the behaviour, time is frozen, the network is
  replaced at one seam per plugin (`post`, `download`, `new_client`), and the prediction
  engine has property-based tests. The frontend's tests run west of UTC on purpose, to catch
  off-by-one-day bugs.
- **Time is handled with care:** UTC in the database, each site's own "today", digest times
  that survive daylight-saving changes (the comparison is on local wall time, and the
  once-a-day log stops a repeat), and a fix for digests set just before midnight.
- **The stability machinery** (`core/stability/`, the recorded API and plugin interface, the
  test that builds the database from the first migration) is the right tool for the promises
  in [stability.md](stability.md), and already caught nothing breaking in this review.
- **Plugins fail softly:** every hook call is isolated, errors are recorded for the Admin,
  answers of the wrong type are refused, and a plugin that can't load is reported instead of
  stopping the app. The built-in plugins use only the public interface.
- **Comments say why.** There are no `TODO`s, no `print`, no commented-out code and no bare
  `except`; the broad ones are each explained ("a broken plugin must never stop the app").
- **List pages don't have N+1 queries:** `GET /plants` takes 7 queries for 5 plants and for
  25, and so do Today (once calculated) and `GET /sites` (6).
- **The frontend's data layer:** server state only in TanStack Query, the cache reset on
  sign-in and sign-out, one place that turns both error formats into one `ApiError`, and
  every user-visible string in `en.json`: a search for literal text in components found none.

## Fix plan

One pull request per package. Packages 1 to 5 are for before 1.0; 6 to 10 can follow it,
since they change nothing that 1.0 freezes. Each adds the regression tests named in its
findings.

| # | Package | Findings | Files | How to test |
|---|---|---|---|---|
| 1 | **Decide the list endpoints' shape** (only possible before the freeze) | Q6 | `plants/api.py`, `garden/api.py`, `ai/api.py`, their hooks in `frontend/src/api/`, `core/stability/api-v1.json`, `docs/STYLE_GUIDE.md` | The new tests; `make api-types` and `make stability-baseline`, checking the baseline's diff by eye; the wishlist, seeds, harvests and conversations pages by hand |
| 2 | **A snooze holds** | Q1 | `care/schedules.py`, `care/services.py` or `care/signals.py` | The new tests; by hand: put watering off for a week, edit the plant, check Today |
| 3 | **Secrets survive setting a key** | Q2 | `core/crypto.py`, a `reencrypt_secrets` command, `docker/env.example`, `docs/install.md` | The new tests; on a copy of an instance without a key: add a channel, set the key, send a test, run the command, remove nothing, send again |
| 4 | **Today is ready before you are** | Q3 (option A) | `care/tasks.py`, `care/schedules.py` | The new tests; with `TIME_ZONE` and a site in `America/Los_Angeles`, run the worker past local midnight and count the queries of the next Today |
| 5 | **Errors people can read** | Q7, Q8, Q5 (with S5's PR for `ai/services.py`) | `care/services.py`, `care/schedules.py`, `dataio/importer.py`, `core/errors.py`, `ai/services.py`, `ai/context.py`, `plants/api.py`, `frontend/src/i18n/locales/en.json` | The new tests; turn on an AI plugin with a wrong address and ask a question: the message says it failed |
| 6 | **Tests that guard isolation** | Q11 | A new `core/tests/test_isolation.py` | It fails when a `_get_…` helper's household filter is removed (try one) |
| 7 | **The Claude plugin keeps up with models** | Q9 | `plugins/ai-anthropic/sunfleck_ai_anthropic/client.py`, its tests and README | The new tests; with a real key, a diagnosis on `claude-fable-5-2`, `claude-opus-5-5` and `claude-haiku-5-5` |
| 8 | **Cheaper recalculation and export; deletable households** | Q3 (option B), Q10, Q4, Q15 | `care/schedules.py`, `plugins/services.py`, `dataio/exporter.py`, `dataio/importer.py`, `care/models.py`, `care/services.py`, two migrations | The new query-count tests; export and import a large demo household (`manage.py demo_household`) and compare |
| 9 | **Tidy: dead keys, stale comments, the plugin Dockerfile** | Q13 | `en.json`, four frontend files, `care/schedules.py`, `plugins/hookspecs.py`, `plugins/types.py`, `docs/plugins.md`, `docs/install.md`, `docs/STYLE_GUIDE.md`, `SECURITY.md`, `package.json`, `Makefile` | `make lint` with the new checks; build an image with a plugin by the documented Dockerfile |
| 10 | **Shared helpers and component sizes** | Q14, Q12 | `core/errors.py`, the `api.py` and `services.py` of six apps, `places/`, `docs/STYLE_GUIDE.md`, `eslint.config.js`, the five largest settings and plant pages | Both test suites unchanged and passing; `make stability-baseline` shows no change |
