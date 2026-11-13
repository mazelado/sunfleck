# Security review for 1.0

The security review the [roadmap](roadmap.md) asks for before 1.0 ("Jasmine: mature and
beautiful"). It is a report only: nothing was fixed. Each finding is meant to become one fix,
in the work packages at the end. The code quality review is in
[code-review-1.0.md](code-review-1.0.md).

## Summary

**No critical (4) problem was found.** No request by a member of one household reached
another household's data through the API, and no unauthenticated request reached anything
it shouldn't. One finding is **major (3)**: a household Admin can take over the first
account, which is also the instance's Django superuser (S1). The released 0.9 has it too.
Whether it needs a patch release is the maintainer's call: on an instance with one household
it gives an Admin little they didn't have; on an instance with several households it gives a
co-Admin of the first household the admin site, and through it every household.

| | |
|---|---|
| **Reviewed** | The backend (`backend/sunfleck/`), the four built-in plugins (`plugins/`), the frontend's handling of untrusted data (`frontend/src/`, `frontend/public/push-sw.js`, `vite.config.ts`), the Docker setup (`docker/`) and the install documentation |
| **At commit** | `1ceaee8` (main, 2026-11-13; version 0.9.0 plus the Unreleased changes) |
| **How** | Every API module read in full, against the threat model in the review brief. Each suspicion was then tried with a throwaway pytest against the real app (not kept in the repository; each finding describes its test). A generic sweep called every API path that takes an id with another household's ids. `pip-audit` on the exported `uv.lock` and `npm audit` were run. The backend suite passed before and after (795 tests) |
| **Dependencies** | `pip-audit`: no known vulnerabilities in 200 locked packages. `npm audit`: only deepmerge (GHSA-gcqx-w48m-w2h4), already accepted |
| **Earlier work** | PR #161 fixed the findings of a first pass (admin sign-in form, Secure cookies, per-person sign-in limits behind a proxy, CSP). S4 is about what that fix left open |

**Not covered:**
- PostgreSQL and Redis: everything ran on SQLite with the in-memory job queue. S14 (a race
  that only PostgreSQL allows) is unconfirmed for that reason.
- The built Docker image wasn't built or run; the Dockerfile and entry point were read.
- The real outside services (Anthropic, OpenAI, Pl@ntNet, Open-Meteo, push services) weren't
  called. The plugins were exercised with their network functions replaced.
- The frontend was checked for injection, storage and caching, not page by page.
- django-allauth, Django Ninja, Apprise and pywebpush themselves, beyond how Sunfleck
  configures and calls them.
- Denial of service was reasoned about (S7), not load-tested.

Severity uses the scale of [heuristic-review.md](heuristic-review.md): 4 critical, 3 major,
2 minor, 1 cosmetic or hardening.

## Findings

| ID | Title | Severity | Area | Where | Status |
|---|---|---|---|---|---|
| S1 | A household Admin can take over (or delete) the first account, the instance's superuser | 3 | Accounts | `backend/sunfleck/accounts/api.py:399`, `accounts/services.py:206`, `:220` | Confirmed |
| S2 | A "device" for push notifications lets any member read answers from servers on the host's network | 2 | Notifications | `backend/sunfleck/notifications/push.py:76`, `:114` | Confirmed |
| S3 | Plugins' API routes get no sign-in or CSRF check unless the plugin adds one | 2 | Plugins | `backend/sunfleck/config/api.py:36` | Confirmed |
| S4 | The per-address limit on failed sign-ins can be sidestepped, and is counted per worker | 2 | Sign-in, deployment | `backend/sunfleck/config/settings.py:55`, `docker/compose.yaml:14`, `docs/install.md:101` | Confirmed |
| S5 | AI questions go to every AI plugin that's on, not only the one that answers | 2 | AI, plugins | `backend/sunfleck/ai/services.py:29`, `plugins/registry.py:96` | Confirmed |
| S6 | Imported photos are stored as they come: metadata kept, file type and name from the archive | 2 | Import | `backend/sunfleck/dataio/importer.py:184`, `:229` | Confirmed |
| S7 | Nothing limits how much work one request or one member can cause | 2 | Deployment, uploads | `docker/entrypoint.sh:41`, `backend/sunfleck/core/images.py:21`, `dataio/importer.py:35` | Unconfirmed |
| S8 | An Admin can have a stored API key sent to a server of their choice with **Test** | 1 | Plugins | `backend/sunfleck/plugins/services.py:134`, `:184` | Confirmed |
| S9 | The OpenAI-compatible plugin accepts `file://` addresses and logs what it reads | 1 | Plugins | `plugins/ai-openai/sunfleck_ai_openai/client.py:45`, `:75` | Confirmed |
| S10 | allauth endpoints the app doesn't use are reachable; adding an email address is a 500 | 1 | Sign-in | `backend/sunfleck/config/settings.py:169` | Confirmed |
| S11 | Invitation and password-reset links are written to the log when email isn't set up | 1 | Logging | `backend/sunfleck/config/settings.py:200`, `accounts/api.py:242` | Confirmed |
| S12 | Deployment defaults: the health check tells anyone the version, no HSTS, unpinned base images | 1 | Deployment | `backend/sunfleck/core/api.py:33`, `docker/Dockerfile:4`, `:12`, `:32` | Confirmed |
| S13 | A person with two memberships gets whichever household the database returns first | 1 | Accounts | `backend/sunfleck/accounts/permissions.py:15`, `accounts/admin.py:42` | Confirmed (by reading) |
| S14 | On PostgreSQL, two simultaneous first-run setups can both succeed | 1 | Setup | `backend/sunfleck/accounts/services.py:92` | Unconfirmed |

---

### S1. A household Admin can take over (or delete) the first account, the instance's superuser (3)

**What's wrong.** `POST /api/v1/household/members/{id}/password-reset-link`
(`accounts/api.py:399`) lets an Admin make a password-reset link for any member of their
household. That's intended: it's how passwords are reset without email. But the first
account is also `is_staff` and `is_superuser` (`accounts/services.py:95`), and nothing treats
it differently. An Admin who was invited later can make a reset link for the first account,
set its password, and is signed in as it straight away (`ACCOUNT_LOGIN_ON_PASSWORD_RESET`).
They now have `/admin/`: every household's rows, every account, and the power to make more
superusers. `DELETE /api/v1/household/members/{id}` (`accounts/services.py:206`) has the same
gap from the other side: a co-Admin can delete the first account, and with it the only way
into the admin site.

**Why it matters.** Sunfleck's two promises are that nobody acts above their role and nobody
reaches another household. "Admin of one household" and "superuser of the instance" are
different roles, and this turns the first into the second. Scenario: the owner of an instance
that hosts their own household and their parents' makes their partner an Admin. The
partner's account (or whoever steals its session) resets the owner's password, opens
`/admin/plants/plant/` and reads or edits the parents' plants, notes and members. It also
locks the owner out until they reset their password with `manage.py changepassword`.

It isn't rated critical because the attacker must already be an Admin in the first
account's own household, a role the owner gave them, and because an instance has a second
household only if the owner made one in the admin site. With one household, the gain is the
admin site itself.

**0.9 is affected.** The endpoint and the superuser flag are unchanged since before 0.9.0.

**How to reproduce.** A pytest: the household's first Admin is made staff and superuser; a
second household has a plant "Private plant"; a second Admin of the first household signs in.
`GET /admin/` is refused for them. They `POST` the reset-link endpoint for the first Admin's
membership, take the key from the end of the URL, and `POST
/_allauth/browser/v1/auth/password/reset` with `{"key", "password"}` from a fresh client.
That client then gets 200 from `/admin/plants/plant/`, and the page contains "Private plant".
The test passed as written.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Refuse reset links and removal for an account with `is_staff` or `is_superuser` unless the person asking is that account (403 `permission_denied`); the superuser resets their own password by email or `manage.py changepassword` | Two checks in `accounts/services.py`, a line in the user guide | Low. A stricter permission for a security reason, which [stability.md](stability.md) allows when announced |
| B | Stop making the first account a superuser at all; the admin site is reached with an account made by `manage.py createsuperuser` | Setup, `SECURITY.md`, the install guide, and a migration question for existing instances | Medium: changes how every existing instance reaches `/admin/`, and the first account keeps its flag on upgraded instances unless a migration removes it |
| C | Only allow reset links for members whose role is below the asker's, and never for Admins | One check | Low, but two Admins who lose email can no longer help each other, which is the case the feature exists for |

**Recommendation: A**, in a PR of its own that could also be a 0.9 patch release. B is the
cleaner model and worth an issue for after 1.0, since it separates the two roles for good.

**Regression test.** `test_an_admin_cannot_reset_or_remove_the_instance_superuser`: as
above, expecting 403 from both endpoints and the superuser's password unchanged; plus one
showing an Admin can still make a link for an ordinary Admin and for themselves.

---

### S2. A "device" for push notifications lets any member read answers from servers on the host's network (2)

**What's wrong.** `POST /api/v1/notifications/push/devices` accepts any subscription whose
endpoint starts with `https://` (`notifications/push.py:76`). **Test** then sends a POST to
it, and when the answer isn't a success, the error shown to the member contains the answer's
body: pywebpush puts `response.text` in its exception, and `push.py:114` passes the
exception's text on, 500 characters of it. Connection errors are passed on in the same way
(`push.py:116`), which tells open ports from closed ones.

**Why it matters.** `SECURITY.md` already says that members can make the server send
requests to machines on its network. It doesn't say they can read the answers, and this is
open to Viewers, the lowest role. Scenario: a Viewer adds a "device" with the endpoint
`https://nas.home.example/api/status`, clicks Test, and reads the first 450 characters of
the NAS's answer in the error message. It's limited to HTTPS addresses with a certificate the
server trusts, and to answers with a status above 202.

**0.9 is affected.**

**How to reproduce.** A pytest with `requests.post` replaced by a function returning status
403 and the text `INTERNAL-SECRET: …`: as a Viewer, add a push device with the endpoint
`https://192.168.1.1/admin/status` and valid-looking keys (201), then `POST
/api/v1/notifications/channels/{id}/test`. The 422 answer's message contains
`INTERNAL-SECRET`, and the fake was called with the internal address.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Never pass the push service's answer on: store and show the status code and a fixed sentence; log the body at DEBUG | A few lines in `push.py` | Low. Admins lose the push service's own wording, which is rarely useful |
| B | A as well, and only accept endpoints on the hosts browsers really use (`fcm.googleapis.com`, `*.push.apple.com`, `*.notify.windows.com`, `updates.push.services.mozilla.com`), with a setting to add more | `push.py`, a setting, the install guide | Low to medium: a browser with a push service not on the list stops working until it's added |
| C | Resolve the endpoint and refuse private and loopback addresses | A helper used before sending | Medium: DNS rebinding and redirects need care, and it's easy to get subtly wrong |

**Recommendation: B.** A alone removes the reading; the list also removes the request, and
real subscriptions only ever point at a handful of services.

**Regression test.** `test_a_push_service's_answer_is_never_shown`: as above, asserting the
body isn't in the response or in `last_error`; and
`test_push_endpoints_must_be_a_known_push_service`, expecting 422 `invalid_subscription` for
an unknown host.

---

### S3. Plugins' API routes get no sign-in or CSRF check unless the plugin adds one (2)

**What's wrong.** Each plugin's router is made as `Router(tags=[…])` (`config/api.py:36`),
without `auth`, and the API has no default `auth` either. Sunfleck's own routers all pass
`auth=django_auth`, which is also where Django Ninja does its CSRF check. So a plugin
endpoint is open to everyone unless it calls `require_enabled`, and even when it does, it
has no CSRF protection, because `require_enabled` (`plugins/__init__.py:75`) only checks the
session.

**Why it matters.** Plugins are trusted code, but this is about what the core gives them by
default. The plugin guide says "endpoints must check access: start each one with
`require_enabled`", and a plugin author who does exactly that still ships state-changing
endpoints that another site can trigger from the member's browser. Browsers' default
`SameSite=Lax` cookies stop most cross-site POSTs, so what's left is requests from sibling
subdomains and older browsers. No built-in plugin has endpoints today, so nothing is exposed
yet. It's worth fixing before 1.0 because the plugin interface is frozen then: making
plugin routes stricter later is a breaking change for any plugin that relied on open ones.

**How to reproduce.** A pytest that builds a router exactly as `config/api.py` does, adds
`POST /do` calling `require_enabled`, and mounts it under `/api/v1/plugins/fake_api/`. With
`Client(enforce_csrf_checks=True)`, signed in as a Viewer and sending no CSRF token, the
answer is 200 `{"changed": true}`. The same client gets 403 from `POST /api/v1/wishlist`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Make plugin routers with `auth=django_auth`; a plugin that wants a public endpoint says so on that endpoint (`auth=None`) | One line in `config/api.py`, a paragraph in `docs/plugins.md` | Low now, since no known plugin has endpoints. After 1.0 it would be a breaking change |
| B | Leave the router; make `require_enabled` run the CSRF check itself for unsafe methods | `plugins/__init__.py` | Low, but endpoints that forget `require_enabled` stay wide open |
| C | A, and also wrap every plugin endpoint so that it's refused unless the plugin is on for the household | `config/api.py` | Medium: decides for plugins that may have a reason for a household-independent endpoint |

**Recommendation: A**, before the interface freezes. `require_enabled` stays as the check
for "on for this household".

**Regression test.** `test_plugin_endpoints_need_sign_in_and_a_csrf_token`: a plugin added
with `registry.add`, its router built by the same function `config/api.py` uses (extract it
so the test can call it); anonymous gets 401, a signed-in POST without a token gets 403.

---

### S4. The per-address limit on failed sign-ins can be sidestepped, and is counted per worker (2)

**What's wrong.** Three things weaken the limit of 10 failed sign-ins a minute per address:

1. With `SUNFLECK_BEHIND_PROXY=true`, allauth takes the client's address from the last
   entry of `X-Forwarded-For` (`settings.py:55`). The Compose file publishes port 8000 on
   every interface (`docker/compose.yaml:14`), so anyone who can reach the host's port 8000
   directly sends whatever header they like.
2. The documented Nginx configuration (`docs/install.md:94`–`104`) doesn't set
   `X-Forwarded-For`. Nginx passes the client's own header through, so the same is true
   through the proxy. Without the header, everyone counts as one address, the problem PR
   #161 set out to fix.
3. The counters live in Django's default cache, which is per process (no `CACHES` in
   `settings.py`). With the default two workers, each has its own counters, and they're
   empty again after a restart.

**Why it matters.** The per-account limit (5 failures in 5 minutes for one email address)
is not affected: it held in every variation tried. What's lost is the limit across accounts:
someone can try one common password against every member's address without being slowed, or,
through Nginx without the header, lock everyone out by failing ten times a minute. The
per-worker counting doubles every limit, the per-account one included.

**0.9:** point 1 and the spoofing in point 2 arrived with PR #161 and are unreleased. The
shared counter behind a proxy and point 3 are in 0.9.

**How to reproduce.** A pytest with `ALLAUTH_TRUSTED_PROXY_COUNT=1`: 13 failed sign-ins for
13 different accounts. With the same `X-Forwarded-For` each time, the 11th to 13th answer
`too_many_login_attempts`. With a different value each time, all 13 answer
`email_password_mismatch`. With no header, the 11th is refused (one shared counter). The
cache is `LocMemCache` (printed from `settings.CACHES`).

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Documentation and Compose only: publish `127.0.0.1:8000:8000` by default (with a comment on how to open it for a LAN without a proxy), and add `proxy_set_header X-Forwarded-For $remote_addr;` to the Nginx example | `docker/compose.yaml`, `docs/install.md` | Low, but changing the published address surprises people who open `http://server:8000` on their LAN today: it must be in the upgrade notes. [stability.md](stability.md) promises port 8000, not the interface |
| B | A, and move the counters to a cache all workers share: Django's database cache (a table in the same database), or Redis when `HUEY_REDIS_URL` is set | `settings.py`, a migration or `createcachetable` in the entry point | Low: one small table, written on sign-in attempts only |
| C | Instead of A's Compose change, a setting naming the proxy's address, and ignore forwarded headers from anyone else | `settings.py`, a small middleware | Medium: one more setting to get wrong, and Docker's bridge addresses make it awkward |

**Recommendation: B.** The Nginx line is needed whatever else is done.

**Regression test.** `test_failed_sign_ins_are_limited_per_address_and_per_account`: there
is no test of the limits at all today. Assert the 6th failure for one account and the 11th
from one address are refused; and a settings test that the cache isn't `LocMemCache` outside
tests.

---

### S5. AI questions go to every AI plugin that's on, not only the one that answers (2)

**What's wrong.** `ai.ask` (`ai/services.py:29`) loops over `registry.call(…)` and returns
the first answer. But `registry.call` (`plugins/registry.py:96`) has already called every
enabled plugin and collected the answers before the loop sees the first one. With both AI
plugins on, each question, photo and plant history goes to both providers, and both bill
for it. The hook's documentation says "the first enabled plugin that answers is used".
`identify.identify` and `frost.estimate` have the same shape.

**Why it matters.** The style guide's rule is that data goes to third parties only through
services the user configured, and no more than the feature needs. Both services were
configured, so this isn't a leak to a stranger, but an Admin who keeps OpenAI as a spare
doesn't expect every diagnosis photo to go there too, or to pay twice. Scenario: a household
has "AI (Claude)" on for answers and "AI (OpenAI-compatible)" on pointing at a hosted
service they were trying out. Every "What's wrong?" photo goes to both.

**0.9 is affected.**

**How to reproduce.** A pytest adding two fake plugins with `registry.add`, each recording
its `complete_json` calls, both turned on for the household. One `ai.ask` with the prompt
"PRIVATE NOTES" leaves two recorded calls, one per plugin.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Add `registry.call_first(hook, household, expect, **kwargs)`: call plugins in order and stop at the first usable answer; use it for `complete_json`, `identify_plant` and `frost_dates` | `registry.py`, three callers | Low. Behaviour matches the documentation |
| B | Let the household choose one AI plugin (a setting), and refuse to turn on a second | Plugins API and page | Medium: new UI and a migration for households with both on |
| C | Make `registry.call` lazy (a generator) | `registry.py` | Medium: every caller that relies on all plugins having run (`on_care_event_logged`, `site_conditions` on Today) would change too |

**Recommendation: A.** B is a reasonable feature for later; A fixes the surprise now.

**Regression test.** `test_only_the_first_ai_plugin_is_asked`, as above, asserting one call;
and one showing the second plugin is asked when the first raises.

---

### S6. Imported photos are stored as they come: metadata kept, file type and name from the archive (2)

**What's wrong.** `read_photo` (`dataio/importer.py:184`) checks that a file in the archive
opens as a WebP, JPEG or PNG, then stores its bytes unchanged. Uploads go through
`images.process_photo`, which re-encodes and drops metadata; imports don't. So:

- EXIF, including GPS positions, stays in the stored file, against the style guide's rule
  and `SECURITY.md`'s "stored again without their metadata".
- The stored file's extension is whatever the archive's path ends in
  (`importer.py:229`): `photos/1.html` is stored as `<uuid>.html`.
- The file is served as `image/webp` whatever it is (`plants/api.py:814`).
- An image over Pillow's hard pixel limit raises `DecompressionBombError`, which nothing
  catches: the import answers 500 instead of `invalid_export`.
- Width and height come from the JSON, not the image.

**Why it matters.** An export made by Sunfleck only holds clean WebP files, so a household
restoring its own backup is fine. The risk is an archive from elsewhere: one shared in a
forum, or one put together by a migration script from another app, with phone photos that
still carry where they were taken. Every member, Viewers included, can then download them
with the position inside. Nothing is served as HTML today, because photos only leave through
the API with a fixed type and `nosniff`. The `.html` name would matter the day media files
are served by a web server or an S3 bucket, which the style guide keeps open.

**0.9 is affected.**

**How to reproduce.** Three pytests building a minimal export in memory. (1) A JPEG with a
GPS IFD: after `importer.import_into`, the stored file is a JPEG and
`Image.open(…).getexif().get_ifd(0x8825)` still has the position. (2) The photo's path set
to `photos/1.html`: the stored name ends in `.html`. (3) `Image.MAX_IMAGE_PIXELS` lowered to
stand in for a huge image: `import_into` raises `DecompressionBombError`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Pass imported photos through the upload pipeline: `process_photo` for the image, `images.thumbnail` with the imported crop for the thumbnail; take width and height from the result | `importer.py`, tests | Low to medium: imports get slower (a re-encode per photo), and re-encoding a WebP loses a little quality each round trip |
| B | Keep the bytes when the file is already a WebP without EXIF or XMP (what Sunfleck's own exports hold), and re-encode everything else; always name files `.webp`; catch the pixel-limit error | `importer.py`, a small helper in `core/images.py` | Low: Sunfleck's own exports import byte for byte as now |
| C | Only refuse: reject any photo that isn't a metadata-free WebP | `importer.py` | Low for security, but archives from other tools stop importing |

**Recommendation: B.**

**Regression test.** `test_imported_photos_lose_their_metadata_and_become_webp` (JPEG with
GPS in, WebP without it out, name ends in `.webp`), and
`test_an_oversized_photo_is_an_invalid_export` (422, nothing imported, no files left).

---

### S7. Nothing limits how much work one request or one member can cause (2, unconfirmed)

**What's wrong.** Read from the code and configuration, not load-tested:

- **Request bodies have no size limit.** Django's `DATA_UPLOAD_MAX_MEMORY_SIZE` doesn't
  cover files, and the 20 MB check (`core/images.py:21`) runs after the whole upload is on
  disk. The CSRF check reads the form, and with it the files, before the session is looked
  at, so this doesn't need an account. The Nginx example limits bodies to 25 MB; the Caddy
  example and a bare port 8000 don't.
- **Two blocking workers, 250 seconds each** (`docker/entrypoint.sh:41`–`42`). Two AI
  questions to a slow model, or two notification tests to an address that never answers (15
  seconds each, repeated), hold both, and the app stops answering for everyone. Nothing
  limits how often a member may ask the AI, identify a plant or test a channel, each of which
  can also cost money.
- **Large inputs are held in memory:** images up to Pillow's 89 megapixel warning limit are
  decoded whole (about 350 MB for a PNG), an import's `sunfleck.json` may be 200 MB
  (`dataio/importer.py:35`) and is parsed in one piece, and an export reads each photo into
  memory (`dataio/exporter.py:267`). The style guide's target is a Raspberry Pi.

**Why it matters.** Members are trusted with the household's data, but a Viewer's stolen
session, or anyone at all in the first case, shouldn't be able to stop the app or fill the
disk's temporary folder. Scenario: a script posts a 5 GB body to `/api/v1/setup` with a made-up
CSRF cookie and matching header; each attempt holds a worker for up to 250 seconds and writes
to `/tmp` until then.

**What would confirm it.** Against a built image: time a large multipart POST without a
session and watch `/tmp`; send three slow AI requests with `WEB_CONCURRENCY=2` and check that
`/api/v1/health` stops answering; upload an 80 megapixel PNG and watch the worker's memory.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Document it: a body limit in every proxy example (Caddy's `request_body max_size`), and "don't expose port 8000" (with S4) | `docs/install.md` | None, but protects only those who read it |
| B | A, plus limits in the app: refuse bodies over a size by `Content-Length` early in a small middleware (larger for `/api/v1/import`); lower `Image.MAX_IMAGE_PIXELS` to about 50 megapixels; per-member limits on AI, identify and channel tests (using the shared cache from S4); threaded workers (`--threads 4`) so slow requests don't take a whole worker | Middleware, `core/images.py`, three endpoints, the entry point | Low to medium. The pixel limit refuses the 100 and 200 megapixel modes of some phones when a client other than the app uploads them; threads need a check that nothing relies on one request per process |
| C | Move AI calls to the worker and poll for the answer | AI API and frontend | High: changes API behaviour that 1.0 freezes, for a problem B mostly covers |

**Recommendation: B**, in two PRs (limits; workers), with A's documentation in the first.

**Regression test.** `test_bodies_over_the_limit_are_refused_before_they_are_read` (413,
with a `Content-Length` over the limit and no body sent),
`test_asking_the_ai_is_limited_per_member` (429 `too_many_requests` on the n-th question in
a minute), and one for the lowered pixel limit.

---

### S8. An Admin can have a stored API key sent to a server of their choice with **Test** (1)

**What's wrong.** A secret setting left empty in the form means "keep the stored one"
(`plugins/services.py:134`). `check` (`services.py:184`) uses the same rule with the unsaved
form, so an Admin can change the OpenAI-compatible plugin's server address in the form,
leave the key empty and click Test: the stored key goes to the new address as a `Bearer`
header.

**Why it matters.** `SECURITY.md` says secrets "are never shown again". One Admin's key can
be read by another Admin this way. Admins are trusted and could replace the key anyway, so
this is hardening; it matters most after an Admin's session is stolen.

**How to reproduce.** A pytest: save `ai_openai` with `api_key="sk-FIRST-ADMINS-KEY"`; as
another Admin, `POST /api/v1/plugins/ai_openai/check` with `base_url` set to
`https://attacker.example/v1` and an empty key. The plugin's `post`, replaced by a recorder,
is called with that URL and the stored key.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | In `check` (and `update`), use the stored secret only when no other setting of the plugin differs from what's stored; otherwise require the key to be typed again, with `invalid_plugin_setting` on the key's field | `plugins/services.py`, a sentence in the form | Low. Changing the model name then also asks for the key again, a small nuisance |
| B | Let plugins mark which settings a secret is bound to (`json_schema_extra={"bound_to": ["base_url"]}`) and apply A only to those | Plugin API (new optional field), `services.py`, the OpenAI plugin | Low, more precise, slightly more interface |
| C | Document it in `SECURITY.md` and leave it | One sentence | None; the gap stays |

**Recommendation: B** if there's time before the interface freezes (it's an optional field,
so it can also come in 1.1), otherwise A.

**Regression test.** `test_a_stored_key_is_not_sent_to_a_changed_address`: the check above
answers 422 and the recorder isn't called.

---

### S9. The OpenAI-compatible plugin accepts `file://` addresses and logs what it reads (1)

**What's wrong.** The server address goes to `urllib.request.urlopen` unchecked
(`client.py:45`), which also opens `file:` and `ftp:` URLs. With `file:///etc/passwd#` as
the address, the plugin reads the file, takes it for a failed answer and logs its first 200
bytes at WARNING (`client.py:75`). Real answers are logged the same way, and they can repeat
parts of the prompt.

**Why it matters.** The contents go to the log, not back to the Admin, so today this is
only a way to put pieces of local files, or of people's questions, into logs that may be
shipped elsewhere. It's one `startswith` away from being closed.

**How to reproduce.** `client.complete(task, "file:///etc/passwd#", "", "m")` in a pytest
with `caplog`: the answer is `unavailable`, and the log holds `root:x:0:0:…`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Validate `base_url` in the plugin's `Settings` (http or https, with a host), and log the status and length instead of the body | The plugin's `__init__.py` and `client.py` | Low. A saved setting that's now invalid falls back to the default address, as `_settings` does for any invalid setting: check that this is said on the Plugins page |
| B | A shared `sunfleck.plugins.http` helper that only speaks http(s), for all three plugins that call `urlopen` | Plugin API (new export), three plugins | Low to medium: more interface to keep stable |

**Recommendation: A** now; B is in the code review as duplicated code (Q14).

**Regression test.** `test_the_server_address_must_be_http`: the setting is refused with
`invalid_plugin_setting`; and the body of a failed answer isn't in `caplog`.

---

### S10. allauth endpoints the app doesn't use are reachable; adding an email address is a 500 (1)

**What's wrong.** `allauth.headless.urls` is included whole (`config/urls.py:18`). The app
uses sign-in, sign-out, password reset and password change. The rest is reachable too:
`POST /_allauth/browser/v1/account/email` by any signed-in member raises
`ImproperlyConfigured` (no `account_confirm_email` in `HEADLESS_FRONTEND_URLS`), a 500, and
leaves an unverified `EmailAddress` row behind for an address the member chose.

**Why it matters.** No takeover follows: the stray row is unverified and can't be made
primary. But it's an unhandled error any member can cause, rows that pile up, and surface
nobody reviewed. Sign-up is correctly closed (403), and password reset doesn't reveal which
addresses have accounts (identical answers for known and unknown addresses).

**How to reproduce.** A pytest: as a Viewer, `POST /_allauth/browser/v1/account/email` with
`{"email": "new-address@example.com"}` raises `ImproperlyConfigured`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Route only the allauth views the app uses, by name, instead of including all of them | `config/urls.py` | Low to medium: must follow allauth's URL names on upgrades; a test listing the routed paths catches drift. The `/_allauth/` endpoints aren't part of the stable API |
| B | Keep the include and configure the missing pieces (`account_confirm_email`), so changing email works | Settings, a new page | Medium: a new feature (changing your email address) with its own review |
| C | A small middleware answering 404 for `/_allauth/` paths not on a list | Middleware | Low |

**Recommendation: A.** Changing one's email address is a fair feature request, but for
after 1.0.

**Regression test.** `test_only_the_sign_in_endpoints_the_app_uses_exist`: every other
allauth headless path answers 404.

---

### S11. Invitation and password-reset links are written to the log when email isn't set up (1)

**What's wrong.** Without `EMAIL_URL`, mail goes to Django's console backend
(`settings.py:200`–`204`): the whole message, link and token included, is printed to the
log. That covers invitation links (`accounts/api.py:242`) and allauth's password-reset
mail, which anyone can ask for, for any address, without signing in.

**Why it matters.** The style guide says tokens never go to logs. It's documented
(`env.example`: "emails are written to the log") and was once the only way to get a link,
but Admins now copy both kinds of link in the app, so the log copy only helps someone who
can read the logs and shouldn't be able to sign in: a log shipper, a support bundle, a
shared Portainer. A reset link works until it's used or the password changes.

**How to reproduce.** Read `settings.MAILERS` with `EMAIL_URL` unset; request a password
reset for a known address with `capsys`: the link is on stdout.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Without `EMAIL_URL`, use a backend that logs "an email to x@… wasn't sent: email isn't set up" and drops the body | A ten-line backend class, `env.example`, the install guide | Low. Someone locked out as the only Admin loses the log as a way back in; `manage.py changepassword` remains and should be in Troubleshooting |
| B | Keep printing, but only when `DEBUG` is on | `settings.py` | Low |
| C | Leave it, and say so in `SECURITY.md` | One sentence | None; the gap stays |

**Recommendation: A**, with B's behaviour for development (the console backend when
`DEBUG`).

**Regression test.** `test_without_email_no_link_reaches_the_log`.

---

### S12. Deployment defaults: the health check tells anyone the version, no HSTS, unpinned base images (1)

**What's wrong.** Three small things:
- `/api/v1/health` returns the exact version without sign-in (`core/api.py:33`), which
  tells a scanner which known problems apply. `/api/v1/openapi.json` and `/api/v1/docs` are
  public too; they describe an open-source API, so that's fine, but the version is in them
  as well.
- With `SUNFLECK_BEHIND_PROXY=true` cookies are HTTPS-only, but no
  `Strict-Transport-Security` header is sent, so a first visit over `http://` can still be
  intercepted. The proxy examples don't add it either.
- The Dockerfile's base images are tags (`node:26-alpine`, `python:3.13-slim`,
  `ghcr.io/astral-sh/uv:0.11.32`), not digests, so a release can't be rebuilt exactly and
  trusts whatever the tag points at that day.

What's already right: the image runs as an unprivileged user, `DEBUG` is off unless set,
`SECRET_KEY` is required, `ALLOWED_HOSTS` is a list, and the examples hold no real secrets.

**How to reproduce.** `curl` the health endpoint without a session; look for the header in
any response with the proxy setting on; read `docker/Dockerfile:4`, `:12`, `:13`, `:32`.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Keep `version` in the health answer (the field is in the stable API) but leave it empty for requests that aren't signed in or from localhost; set `SECURE_HSTS_SECONDS` to a year when behind a proxy; pin base images by digest, with Dependabot's Docker updates keeping them fresh | `core/api.py`, `settings.py`, the Dockerfile, `.github/dependabot.yml` | Low. HSTS is hard to take back for a year: say so in the release notes. Monitors that read the version from outside lose it |
| B | Documentation only: tell people to keep the health check off the public address and to add HSTS in the proxy | `docs/install.md` | None; depends on being read |

**Recommendation: A** for HSTS and the images, **B** for the version if the maintainer
prefers not to touch the health answer's meaning before the freeze.

**Regression test.** The settings test in `core/tests/test_security.py` gains
`SECURE_HSTS_SECONDS`; `test_health_hides_the_version_from_strangers` if A is chosen.

---

### S13. A person with two memberships gets whichever household the database returns first (1)

**What's wrong.** `get_membership` (`accounts/permissions.py:15`) returns
`user.memberships….first()` without an order, on the documented assumption of one household
per person. The model allows several (the constraint is unique per user *and* household),
and the admin site's inline on a household (`accounts/admin.py:42`) makes adding one a
single click.

**Why it matters.** An instance owner who adds themselves to a second household in the
admin site, the natural way to "look in on" it, gets an account that may switch households
between requests on PostgreSQL, where row order isn't fixed. Care would be logged in the
wrong household. Nobody gains access they weren't given; it's a trap, and it sits next to S1.

**How to reproduce.** By reading. A test would create two memberships for one user and show
that nothing defines which is used.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | A constraint: one membership per user, until several are supported | A migration that fails if an instance already has such a user: it needs a check and a clear message | Low to medium |
| B | Order by `pk` in `get_membership`, and make the admin inline refuse a second membership | Two small changes | Low |

**Recommendation: B** for 1.0; A when multi-household membership is designed.

**Regression test.** `test_a_second_membership_is_refused_in_the_admin_site`.

---

### S14. On PostgreSQL, two simultaneous first-run setups can both succeed (1, unconfirmed)

**What's wrong.** `complete_setup` checks `User.objects.exists()` and then creates the
account (`accounts/services.py:92`). The comment notes that SQLite serializes transactions.
PostgreSQL at its default isolation doesn't: two requests in the same instant both see no
users, and both become superusers with a household each.

**Why it matters.** The window is the moment of first setup, on an instance that's already
reachable by someone hostile, which `SECURITY.md` warns about anyway. The second account
would be visible in the admin site, but nothing points it out. Setup can't be run again
afterwards: a second `POST /api/v1/setup` answers 409 (confirmed).

**What would confirm it.** On PostgreSQL, two threads calling `complete_setup` behind a
barrier, then counting superusers.

**Fix options.**

| | Change | Scope | Risk |
|---|---|---|---|
| A | Take a PostgreSQL advisory lock (or lock a one-row table) at the start of the transaction | `accounts/services.py` | Low; needs a backend check so SQLite is untouched |
| B | Refuse in the database: a partial unique index allowing one superuser | A migration | Medium: also blocks making a second superuser on purpose |

**Recommendation: A.**

**Regression test.** A PostgreSQL-only test (CI runs both databases) with two threads,
expecting one success and one `setup_already_completed`.

## What's good

Worth keeping exactly as it is while fixing the above:

- **Household scoping is consistent.** Every endpoint starts with `require_role`, and every
  lookup by id goes through a `_get_…(household, id)` helper that filters by household and
  answers 404, never 403, so ids don't reveal what exists. The sweep found no path that
  answered anything else for another household's ids. Ids inside request bodies (locations,
  lights, care types, plants to move, wishes) are checked the same way in the services.
- **Roles are checked on every request,** from the database, so a role change or a removal
  takes effect at once. Removing a member deletes the account, and its sessions and calendar
  address with it.
- **Tokens are done properly:** invitations and calendar addresses are 256-bit random
  values, stored only as SHA-256 hashes and looked up by hash; invitations expire after a
  week, are single-use, and earlier ones for the same address are revoked.
- **Sign-up is closed, setup can't be repeated, and password reset doesn't reveal accounts.**
- **Uploads:** format allow-list, re-encoding to WebP, EXIF dropped, orientation applied,
  Pillow's bomb warning turned into an error, files named by random UUIDs, and served only
  through the API with a fixed type, `nosniff`, `private` caching and `Vary: Cookie`.
- **Secrets:** Fernet with key rotation, secrets kept apart from other settings, never
  returned by the API, excluded from the admin site and from exports (a test checks it).
- **The AI layer** validates every answer against the task's JSON Schema whatever the plugin
  did, renders answers as plain text, never acts on them, and sends no names, addresses or
  coordinates (only the hemisphere). Photos sent out are re-encoded without metadata.
- **The frontend** has no `dangerouslySetInnerHTML`, keeps nothing secret in `localStorage`
  (one open/closed flag), accepts only `http(s)` wishlist links, guards its `next` redirect,
  clears its cache on sign-in and sign-out, and its service worker caches the app's files
  only, never API answers.
- **Headers and deployment:** a strict Content-Security-Policy with no inline scripts,
  frame-ancestors none, the admin site without a sign-in form of its own, an unprivileged
  container user, and no usable secrets in the examples.
- **Import** is all-or-nothing in one transaction, cleans up files on failure, only fills an
  empty household, maps people by email to members of that household only, and never reads a
  path from the archive onto the disk (no zip slip: names are only looked up inside the
  archive).

## Fix plan

One pull request per package, in this order. Each adds the regression tests named in its
findings.

| # | Package | Findings | Files | How to test |
|---|---|---|---|---|
| 1 | **Protect the instance's superuser** (candidate for a 0.9 patch release) | S1, S13 | `accounts/services.py`, `accounts/api.py`, `accounts/permissions.py`, `accounts/admin.py`, `docs/user-guide.md`, `SECURITY.md` | The new tests; by hand, as a second Admin, try the reset link and removal on the first account in **Settings → Household** and check the message is clear |
| 2 | **Push devices can't reach or reveal other servers** | S2 | `notifications/push.py`, `notifications/services.py`, `settings.py`, `docs/install.md` | The new tests; a real push from Chrome, Firefox and Safari still arrives |
| 3 | **Plugin routes are protected by default** (before the interface freezes) | S3 | `config/api.py`, `plugins/__init__.py`, `docs/plugins.md`, `core/stability/plugins-v1.json` if exports change | The new test; `make stability-baseline` shows only additions |
| 4 | **Sign-in limits that hold** | S4 | `docker/compose.yaml`, `docs/install.md`, `config/settings.py`, `docker/entrypoint.sh` | The new tests; in Docker behind Caddy and behind the Nginx example, fail 11 sign-ins from two machines and check each is counted alone |
| 5 | **One plugin answers** | S5 | `plugins/registry.py`, `ai/services.py`, `taxonomy/identify.py`, `places/frost.py` | The new tests; with both AI plugins on, one question appears in one provider's usage page |
| 6 | **Imports go through the photo pipeline** | S6 | `dataio/importer.py`, `core/images.py` | The new tests; import an export made by 0.9 and compare photos and crops |
| 7 | **Limits on request size and repeated work** | S7 (limits), S12 (HSTS, health) | A new middleware, `core/images.py`, `ai/api.py`, `taxonomy/api.py`, `notifications/api.py`, `settings.py`, `docs/install.md` | The new tests; upload a 25 MB photo and a 30 MB export through each proxy example |
| 8 | **Workers that don't all block** | S7 (workers) | `docker/entrypoint.sh`, `docs/install.md` | In Docker, three slow AI requests (a local model) while Today still loads |
| 9 | **Plugin settings: keys and addresses** | S8, S9 | `plugins/services.py`, `plugins/ai-openai/…/__init__.py`, `client.py`, `docs/plugins.md` | The new tests; the Plugins page's Test button with a changed address asks for the key |
| 10 | **Less surface, quieter logs** | S10, S11, S12 (image digests), S14 | `config/urls.py`, a mail backend in `core/`, `docker/Dockerfile`, `.github/dependabot.yml`, `accounts/services.py`, `docker/env.example` | The new tests; sign in, out, reset and change a password in the app; build the image |
