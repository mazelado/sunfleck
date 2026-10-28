# Style Guide

This guide describes how we write code and run the project. It applies to everyone,
including the maintainer and AI tools. Where a tool can enforce a rule automatically
(formatters, linters, type checkers), the tool is the source of truth and this guide
explains *why*.

**Rule zero: consistency beats preference.** When in doubt, match the code around you. If
you think a rule here is wrong, open an issue to change the guide. Don't just break the rule.

Contents:
1. [Principles](#1-principles)
2. [Repository and workflow](#2-repository-and-workflow)
3. [Python and Django](#3-python-and-django)
4. [API design](#4-api-design)
5. [Database and data](#5-database-and-data)
6. [Frontend (React + TypeScript)](#6-frontend-react--typescript)
7. [Testing](#7-testing)
8. [Plugins](#8-plugins)
9. [Security and privacy](#9-security-and-privacy)
10. [Dependencies](#10-dependencies)
11. [Documentation](#11-documentation)
12. [Tooling summary](#12-tooling-summary)

---

## 1. Principles

1. **Simple over clever.** Write code a newcomer can follow. Prefer boring, well-known
   solutions.
2. **Small, focused changes.** One concern per pull request. Large features land as a series
   of small PRs.
3. **Make it work, make it right, then make it fast**, and only optimize what you've measured.
4. **The app must run well on a Raspberry Pi.** Keep memory use, background jobs, and
   dependencies modest.
5. **Everything optional stays optional.** AI, weather, plant identification, and other
   external services must be switchable off, and the app must remain useful without them.
6. **Users own their data.** Every piece of user data must be exportable and importable.
7. **Accessible and translatable by default.** Not as an afterthought.

## 2. Repository and workflow

### Branches
- `main` is always releasable. Nobody commits to it directly. All changes arrive through
  pull requests.
- Name branches `<type>/<short-description>`, using the same types as commit messages:
  `feat/care-reminders`, `fix/photo-upload-rotation`, `docs/style-guide`.

### Commit messages
We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <summary in imperative mood, ≤ 72 chars>

<optional body: what changed and WHY, wrapped at 72 chars>

<optional footer: "Closes #123", "BREAKING CHANGE: ...">
```

Types: `feat`, `fix`, `docs`, `style` (formatting only), `refactor`, `perf`, `test`,
`build`, `ci`, `chore`.

Examples:
- `feat(reminders): add snooze action to due tasks`
- `fix(api): return 404 instead of 500 for unknown plant id`

### Pull requests
- Fill in the PR template. Link the issue it resolves.
- Keep PRs under ~400 changed lines of hand-written code where possible (generated files,
  migrations, and lockfiles don't count).
- CI must pass before review. Address every review comment, either with a change or a reply.
- PRs are **squash-merged**, so the PR title must itself be a valid Conventional Commit message.

### Versioning and releases
- [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`. Before 1.0, minor
  versions may contain breaking changes, and these must be noted in the changelog.
- User-facing changes are recorded in `CHANGELOG.md` following
  [Keep a Changelog](https://keepachangelog.com/).

## 3. Python and Django

### Formatting and linting
- **Python 3.12+.**
- **Ruff** formats and lints. Line length is 100. Don't argue with the formatter.
- Ruff replaces Black (formatting), isort (import sorting), Flake8 and its plugins (linting),
  and pyupgrade. **Don't add those tools**: they would duplicate Ruff and could fight over
  formatting.
- Imports are sorted by Ruff. Use absolute imports within the project.

### Type hints
- All functions, methods, and module-level variables have type hints, **including return
  types**.
- **mypy** with the **django-stubs mypy plugin** is the type checker that runs in CI, and CI
  is the source of truth. We chose mypy over pyright because only the mypy plugin understands
  Django's dynamic behavior: the types of model fields, managers, related objects
  (`plant.care_events`), and querysets. Pyright can read django-stubs but not its plugin, so
  it reports false errors or misses real ones in Django code.
- Using **Pylance/pyright in your editor** is fine for completions and quick feedback. If the
  editor and mypy disagree, mypy wins.
- New code must type-check without `# type: ignore`. If an ignore is truly needed, add an
  error code and a reason:
  `# type: ignore[attr-defined]  # django-stubs doesn't know about X`.
- Prefer precise types (`list[Plant]`, `Literal["indoor", "outdoor"]`) over `Any`.

### Naming
We follow the [PEP 8 naming conventions](https://peps.python.org/pep-0008/#naming-conventions),
enforced by Ruff's `pep8-naming` (`N`) rules.

| Thing | PEP 8 style | Example |
|---|---|---|
| Packages | short, all lowercase; avoid underscores | `plants`, `care` |
| Modules | short, all lowercase; underscores if they help readability | `schedules.py`, `care_events.py` |
| Classes | `CapWords` (also called PascalCase) | `CareSchedule` |
| Exceptions | `CapWords`, ending in `Error` | `ScheduleConflictError` |
| Functions, methods | `lowercase_with_underscores` | `next_due_date()` |
| Variables, arguments | `lowercase_with_underscores` | `due_date`, `plant_id` |
| Instance / class method first argument | always `self` / `cls` | `def from_dict(cls, data)` |
| Constants (module level) | `UPPER_CASE_WITH_UNDERSCORES` | `DEFAULT_WATERING_DAYS` |
| Type variables | short `CapWords`; `_co`/`_contra` suffix for variance | `T`, `PlantT`, `T_co` |
| Non-public names | one leading underscore | `_clamp_interval()` |
| Name clashing with a keyword or builtin | one trailing underscore | `class_`, `type_` |

More PEP 8 rules:
- Never use `l` (lowercase L), `O` (uppercase o), or `I` (uppercase i) as single-character
  names. They look like `1` and `0`.
- Don't use a double leading underscore (`__name`) unless you specifically need name
  mangling to avoid clashes in subclasses.
- Never invent `__dunder__` names. Those are reserved for Python itself.
- Acronyms in `CapWords` are all capitals: `HTTPClient`, `OIDCProvider` (not `HttpClient`).

Project conventions (on top of PEP 8):
- Booleans read as a yes/no question: `is_outdoor`, `has_grow_light`.
- Use full words (`location`, not `loc`). Put units in names when they're ambiguous:
  `interval_days`, `ppfd_umol_m2_s`, `pot_diameter_cm`.
- Django apps are packages, so their names follow the package rule: `plants`, `locations`,
  `care`.

### Docstrings and comments
- Public modules, classes, and functions get a docstring in
  [Google style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings).
- Comments explain **why**, not what. If code needs a comment to explain *what* it does,
  first try to make the code clearer.
- No commented-out code in `main`. Git remembers it.
- `TODO` comments must reference an issue: `# TODO(#42): handle dormancy`.

### Project structure (Django)
- Each domain area is a Django app in `backend/<app_name>/` (e.g. `plants`, `care`,
  `locations`). Apps should depend on each other as little as possible.
- **Where logic lives:**
  - `models.py`: data structure, simple derived properties, and invariants.
  - `services.py`: business operations that change data (`log_care_event()`,
    `generate_reminders()`). Views and plugins call services, not each other.
  - `selectors.py`: reusable read queries (`plants_due_today(user)`).
  - `api.py`: thin HTTP layer that validates input, calls a service or selector, and
    returns a schema. No business logic.
  - `tasks.py`: background and scheduled jobs. Thin, calling services.
- Settings come from **environment variables** (12-factor), with safe defaults for local
  development. Never hardcode secrets, hosts, or paths.

### Errors and logging
- Raise specific exceptions (define domain exceptions like `ScheduleConflictError`); never
  `raise Exception(...)`.
- Never use a bare `except:`. Catch only what you can handle.
- Use the `logging` module (`logger = logging.getLogger(__name__)`), never `print()`.
- Log levels: `DEBUG` for diagnostics, `INFO` for notable events, `WARNING` for recoverable
  problems, `ERROR` for failures needing attention.
- Never log secrets, API keys, passwords, tokens, or precise user location.

### Dates, times, and units
- Store all datetimes in **UTC**, timezone-aware (`USE_TZ = True`). Convert to the user's or
  site's time zone only for display and for "what day is it" calculations.
- Use **metric/SI units internally** (cm, °C, mm of rain, liters). Convert to the user's
  preferred units only at the display layer.

## 4. API design

- The API lives under `/api/v1/`. Breaking changes require a new version.
- Built with Django Ninja. Every endpoint has typed request and response schemas, which
  generates the OpenAPI docs automatically.
- Resource URLs are plural nouns: `GET /api/v1/plants`, `POST /api/v1/plants/{id}/care-events`.
- JSON fields use `snake_case`.
- Use correct status codes: `200` OK, `201` created, `204` no content, `400` invalid input,
  `401` not signed in, `403` not allowed, `404` not found, `409` conflict, `422` validation error.
- Errors use one consistent shape:
  ```json
  { "error": { "code": "plant_not_found", "message": "Plant 42 does not exist.", "details": {} } }
  ```
- List endpoints are paginated. Never return unbounded lists.
- Every endpoint checks **permissions**. Write tests proving that an unauthorized user is
  refused.

## 5. Database and data

- Code must work on **SQLite and PostgreSQL**. CI runs the test suite against both.
- Use the Django ORM. Raw SQL needs a comment explaining why and must be tested on both
  databases.
- Migrations:
  - Every model change ships with its migration, generated by `makemigrations` and reviewed
    by a human.
  - Never edit a migration that has been released. Write a new one.
  - Data migrations must be reversible, or explicitly documented as irreversible.
- Watch out for N+1 queries (one query per item in a loop). Use `select_related()` and
  `prefetch_related()`, and test query counts for list endpoints.
- Uploaded files (photos) are stored through Django's storage API, never with hardcoded
  paths, so that S3-compatible storage can be added later.
- Every new model must be included in **export/import**. The export format is versioned.

## 6. Frontend (React + TypeScript)

### Language and formatting
- **TypeScript with `strict: true`.** No `any`; use `unknown` and narrow it. No `@ts-ignore`;
  if unavoidable, use `@ts-expect-error` with a reason.
- **ESLint** and **Prettier** run in CI. Don't argue with the formatter.

### Components
- Function components and hooks only.
- One component per file. Filename matches the component name: `PlantCard.tsx`.
- Keep components small. If a component exceeds ~150 lines, split it.
- Props are typed with an interface named `<Component>Props`.
- Prefer composition over configuration flags. Several small components beat one component
  with ten boolean props.

### Naming
| Thing | Style | Example |
|---|---|---|
| Components, types | `PascalCase` | `CareTimeline`, `PlantSummary` |
| Hooks | `useSomething` | `usePlants()` |
| Functions, variables | `camelCase` | `formatInterval()` |
| Files (non-component) | `camelCase.ts` | `apiClient.ts` |
| Folders | `kebab-case` | `care-schedule/` |

### Data and state
- Server data is fetched and cached with **TanStack Query**. Don't copy server data into
  component state.
- API types are **generated from the backend's OpenAPI schema**, never written by hand, so
  the frontend and backend can't drift apart.
- Keep global client state minimal. Prefer URL parameters (filters, tabs) and local state.

### UI, accessibility, and i18n
- Use **Mantine** components and the theme's design tokens (colors, spacing, radius). No
  hardcoded colors or pixel values in components.
- **Mobile-first.** Design for a 375px-wide screen first, then enhance for larger ones. Touch
  targets are at least 44×44px.
- Target **WCAG 2.2 AA**: semantic HTML, labels on every input, visible focus, sufficient
  contrast in light *and* dark themes, `alt` text on meaningful images, never color alone to
  convey meaning.
- A button's or link's accessible name **includes the text it shows** (WCAG 2.5.3), so people
  using voice control can say what they see. Prefer visible text over `aria-label`; a card
  that links somewhere is named by its content.
- Every page has one `<main>` (`AppShell.Main`, or `AuthCard` for signed-out pages).
- Checking: `features/layout/accessibility.test.tsx` runs [axe](https://github.com/dequelabs/axe-core)
  on the main pages (add new pages to it). Colour contrast needs a real browser: check new
  colours with the axe DevTools extension or Lighthouse, in both themes. The theme
  (`theme.ts`) already fixes Mantine's dimmed text and "light" badges, which are too faint.
- **Every user-visible string goes through the translation function** (`t("plants.add")`).
  No hardcoded English in components.
- Dates, numbers, and units are formatted with the user's locale and unit preferences.

## 7. Testing

- **Every change that alters behavior comes with tests.** A bug fix includes a test that fails
  without the fix.
- Backend: **pytest** + **pytest-django**; test data via **factory_boy** factories, not
  fixtures copied between tests.
- Frontend: **Vitest** + **React Testing Library**. Test what the user sees and does
  ("clicking *Watered* shows a confirmation"), not implementation details.
- End-to-end: **Playwright**, for a small set of critical journeys (sign in, add plant, log
  care, get reminder).
- Structure tests as **Arrange / Act / Assert**. One behavior per test.
- Test names describe the behavior:
  `test_watering_reminder_is_skipped_when_rain_is_forecast`.
- Tests must be fast and independent: no real network calls (mock external services), no
  reliance on test order, and no dependence on the current date (freeze time).
- Coverage: aim for **≥ 85%** on the backend. Coverage is a guide, not a goal. A test that
  executes code without asserting anything is worse than no test.
- Care prediction and scheduling logic must have thorough unit tests with realistic
  scenarios, including edge cases (time zones, daylight saving changes, leap years,
  dormancy).

## 8. Plugins

- Core code and built-in plugins use the **same public plugin API**. If a built-in plugin
  needs a private shortcut, the plugin API is missing something. Fix the API instead.
- The plugin API is versioned separately and documented. Breaking it requires a major
  version bump and a deprecation period of at least one minor release.
- Plugins must:
  - declare their name, version, compatible app versions, and required settings;
  - fail gracefully: a broken or unreachable plugin must never crash the app, only disable
    its own features and log the error;
  - store their own data in their own tables or namespaced settings;
  - include tests.
- External-service plugins must document exactly what data they send to the service.

## 9. Security and privacy

- **Never commit secrets.** Use environment variables. `.env` files are git-ignored.
- Follow Django's security defaults (CSRF protection, secure cookies, password hashing).
  Don't turn them off.
- Validate all input at the API boundary. Never trust the client.
- Uploaded files: validate the type and size, strip EXIF metadata (it can contain GPS
  location) unless the user opts in, and never execute or serve them as HTML.
- Check permissions on every object access, not just on the endpoint.
- Escape output. Never inject unsanitized HTML (`dangerouslySetInnerHTML` needs review and
  sanitization).
- Send user data to third parties only through services the user has explicitly configured.
  AI prompts must not include more personal data than the feature needs.
- Report vulnerabilities privately (see `CONTRIBUTING.md`).

## 10. Dependencies

- Every new dependency must be justified in the PR. Can we do it in a few lines of our own
  code instead?
- Prefer well-maintained, widely used packages with active releases.
- The license must be **compatible with AGPL-3.0**: MIT, BSD, Apache-2.0, LGPL, MPL-2.0, GPL-3.0
  and AGPL-3.0 are fine. Ask before using anything else.
- Python dependencies are managed with **uv** (`pyproject.toml` + `uv.lock`); frontend with
  **npm** (`package.json` + `package-lock.json`). Lockfiles are always committed.
- Dependency updates arrive through automated PRs (Dependabot or Renovate) and must pass CI.

## 11. Documentation

- User-facing features are documented in `docs/` when they ship, in the same PR.
- Significant technical decisions are recorded as **Architecture Decision Records** in
  `docs/adr/NNNN-title.md`: the context, the decision, and its consequences. Examples:
  "use Django Ninja for the API", "care data licensing strategy".
- Keep `README.md` short: what it is, how to install, where to find more.
- Write in plain, friendly English. Many readers are not native speakers.

## 12. Tooling summary

| Purpose | Backend | Frontend |
|---|---|---|
| Package manager | uv | npm |
| Formatter | Ruff (Black-compatible; replaces Black) | Prettier |
| Linter | Ruff (replaces Flake8, isort, pyupgrade) | ESLint |
| Type checker | mypy + django-stubs plugin (CI); pyright/Pylance OK in editors | TypeScript (`tsc --noEmit`) |
| Unit tests | pytest, pytest-django, factory_boy | Vitest, React Testing Library |
| End-to-end tests | Playwright | Playwright |
| Pre-commit hooks | pre-commit (runs all of the above on changed files) | |
| CI | GitHub Actions: lint, type-check, test on SQLite + PostgreSQL, build Docker image | |

These tools will be configured when the codebase is created. Until then, this table is the plan.
