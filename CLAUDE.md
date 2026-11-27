# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

Sunfleck is a self-hosted plant care app: a Django + Django Ninja API, a Huey worker, and a
React + TypeScript + Mantine PWA, shipped as one Docker image (SQLite by default, PostgreSQL
supported, must run on a Raspberry Pi). It predicts when each plant needs care from a care
dataset, light, pot, season and weather, and learns from soil feedback. License: AGPL-3.0;
the care dataset in `data/care/` is CC BY-SA 4.0.

**The rules live in [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md); read the relevant section
before writing code.** This file is a map and a list of things that are easy to miss. Rule
zero: match the code around you.

## Layout

```
backend/sunfleck/        Django project (run everything backend-side from backend/)
  config/                settings (env vars), URLs, the Ninja API root (config/api.py)
  core/                  shared helpers: errors.py (ServiceError), pagination, limits,
                         images, crypto; stability/ (API + plugin interface baselines);
                         tests/test_isolation.py (sweeps every endpoint)
  accounts/ places/ plants/ care/ garden/ notifications/ ai/ taxonomy/ dataio/ plugins/
  sensors/               a plant's chosen sensors, their latest readings and daily summaries
  prediction/            the care prediction engine: plain Python, no Django models
  testing.py             factory_boy factories
plugins/                 built-in plugins, each its own package (weather-openmeteo,
                         identify-plantnet, ai-openai, ai-anthropic, homeassistant),
                         installed editable
frontend/src/
  api/                   one module per area; openapi.json + schema.d.ts are GENERATED
  features/<area>/       pages and components, tests beside them (*.test.tsx)
  components/ lib/       shared UI (PageHeader, FormActions, ...) and helpers
  i18n/locales/en.json   every English string
  test/                  Vitest setup; MSW fake API (server.ts)
frontend/e2e/            Playwright journeys, effort budgets, README screenshots
data/care/               care profiles (archetypes/), genera.yaml, schema/, dataset.yaml
docker/                  Dockerfile, entrypoint, compose files
docs/                    user, install, plugin, translating, roadmap, reviews
```

The "Project layout" section of `docs/development.md` predates most apps; trust the tree.

Inside a Django app: `models.py` (structure, invariants) · `services.py` (operations that
change data) · `selectors.py` (reusable reads) · `api.py` (thin: validate, call, return a
schema) · `tasks.py` (thin Huey jobs) · `tests/`. Domain errors subclass
`core.errors.ServiceError`; don't add per-endpoint `try`/`except` to convert them.

## Commands

Run `make help` for the full list. The essentials:

| Command | Use |
|---|---|
| `make setup` | `uv sync`, `npm ci`, pre-commit hooks |
| `make dev` | Vite :5173 + Django :8000 + Huey worker |
| `make test` / `make test-backend` / `make test-frontend` | pytest / Vitest |
| `make lint` | everything CI checks except tests (ruff, mypy, migrations check, prettier, eslint, tsc, knip, unused translation keys) |
| `make format` | auto-fix formatting and lint |
| `make api-types` | regenerate `frontend/src/api/openapi.json` and `schema.d.ts` |
| `make stability-baseline` | record API / plugin-interface additions |
| `make migrations` | after changing a model |
| `make e2e` / `make screenshots` | Playwright against a production build |

- Running `manage.py` directly needs `DEBUG=true` (otherwise: "SECRET_KEY must be set"):
  `cd backend && DEBUG=true uv run python manage.py <cmd>`.
- A single backend test: `cd backend && uv run pytest sunfleck/care/tests/test_x.py -k name`.
  A single frontend test: `cd frontend && npx vitest run src/features/care`.
- Prediction engine property tests, thoroughly:
  `uv run pytest sunfleck/prediction --hypothesis-profile=thorough`.

## When you change...

- **A model:** run `make migrations`, review the migration, never edit a released one. Every
  model must be covered by export/import (`dataio/`, versioned format, with tests that older
  exports still import).
- **The API:** run `make api-types` (CI fails if the generated files differ) and
  `make stability-baseline` (the record's diff must only *add*; removals, renames, type
  widening of responses, or newly required fields are breaking and need `/api/v2`). A new
  endpoint that takes a body needs an example in `BODIES` in `core/tests/test_isolation.py`,
  and a new kind of id needs a way to make one there. Lists are paginated
  (`{"items", "count"}`, `limit`/`offset`, ordered by something unique).
- **The plugin interface (`sunfleck.plugins`):** same baseline (`plugins-v1.json`). Built-in
  plugins use only the public API; plugins must fail gracefully.
- **User-visible text:** frontend strings go through `t(...)` with keys in
  `i18n/locales/en.json` (unused keys fail `make lint`); backend strings use Django's
  translation functions.
- **The care dataset (`data/care/`):** bump the version in `dataset.yaml`, cite sources in the
  file's `sources`, never change a released profile `key`, toxicity is only ever "toxic"
  (never "safe"). AI-drafted values must be checked against real sources.
- **Anything users will notice:** add an entry under `## [Unreleased]` in `CHANGELOG.md`
  (Keep a Changelog; bold lead-in, plain words, PR number) and update `docs/` in the same PR.
  Tests-only or internal changes get no changelog entry.
- **UI visuals:** consider `make screenshots`; add new pages to
  `features/layout/accessibility.test.tsx`.

## Conventions that are easy to miss

Backend
- Ruff (line length 100) and mypy `--strict` with the django-stubs plugin; mypy is the source of
  truth. Every function has type hints including return types. `# type: ignore` needs an error
  code and a reason.
- pytest treats **warnings as errors**; coverage must stay ≥ 85%. No real network (mock it), no
  dependence on today's date (use `time-machine`), factories from `sunfleck/testing.py`.
- Code must work on SQLite *and* PostgreSQL (CI runs both, Python 3.12–3.15).
- Datetimes are stored in UTC; "what day is it" is computed in the site's time zone
  (`places.time.site_today`, `plants.time.plant_today`). Units are metric internally.
- Every endpoint checks household membership and role; write a test that the wrong user is
  refused. Watch for N+1 queries and test query counts on lists.
- Use `logging`, never `print`; never log secrets or precise locations.

Frontend
- TypeScript strict, no `any`, no `@ts-ignore`. ESLint `max-lines` is an **error** at 300 lines
  of code per `src` file; split components past ~150 lines. One exported component per file;
  shared helpers in their own module (fast refresh).
- Server data through TanStack Query and the generated types; never hand-write API types.
- Mantine components and theme tokens only, no hardcoded colours or pixels. Pages start with
  `PageHeader` (give nested pages a `back`), forms in cards end with `FormActions`, urgency
  colours come from `features/care/urgency.ts`. See the style guide's "Look and feel".
- Mobile-first (375px), WCAG 2.2 AA, accessible names include the visible text.
- Tests use the MSW fake API; any request without a handler fails the test. Test what the user
  sees and does.

Product principles
- Everything external (AI, weather, identification) stays optional and off until an Admin
  enables it; never send user data to a service the user hasn't configured; AI output is a
  suggestion, never authoritative (especially toxicity).
- Users own their data: everything is exportable and importable.
- Keep it light enough for a Raspberry Pi. New dependencies need a justification and an
  AGPL-compatible license.

## Git, commits and pull requests

- Conventional Commits; PRs are **squash-merged**, so the PR title is the commit message. In
  this repo titles describe the result in plain words, lower case after the scope, e.g.
  `feat(care): a schedule's history, next to what was predicted`,
  `fix(plants): a photo added from the cover becomes the cover`.
- One concern per PR, ideally under ~400 hand-written lines. Bigger work lands as a series.
- Fill in `.github/pull_request_template.md`. In "AI assistance", describe what the AI did and
  leave the "I have reviewed and tested all of it" box **unticked**: it's the maintainer's to
  tick. In "How was this tested?", report what was run with counts, and say plainly what was
  *not* run (e.g. `make e2e`).
- When there's a real choice to make, lay out options A/B/C with scope and risk in a table and
  say which one the PR takes. For larger content changes (e.g. care profile reviews), propose
  them first as a document in `docs/` for the maintainer to decide on, then apply them in a
  follow-up PR that records the decisions.
- Write in plain, friendly English: many readers aren't native speakers.

## Environment gotchas

- Lock files: `backend/uv.lock` is revision 5 and `frontend/package-lock.json` was written by a
  newer npm. An older `uv` or `npm` rewrites their format (revision 5 → 3, dropped `libc`
  fields). If your tools are older, don't regenerate them wholesale: make the minimal edit and
  verify with `uv lock --check` and `npm ci --dry-run`.
- Generated files (`frontend/src/api/openapi.json`, `schema.d.ts`) are excluded from pre-commit
  and must only be changed via `make api-types`.
- The Huey worker doesn't reload on code changes; restart it.
- Local data lives in `backend/data/` (db, Huey queue, media); delete it to start fresh.
- Releasing (version bump in `backend/pyproject.toml`, `backend/sunfleck/__init__.py`,
  `frontend/package.json`, lock files, API types, changelog, roadmap; minor versions take the
  next plant name) is described in `docs/development.md#releasing`. Don't tag or release
  unless asked.
