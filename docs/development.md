# Development Guide

How to get Sunfleck running on your computer, and the everyday commands for working on it.
No prior Django experience needed.

## 1. Install the tools (once)

| Tool | What it's for |
|---|---|
| **Git** | Version control |
| **uv** | Installs Python and the backend's Python packages |
| **Node.js + npm** | Runs the frontend tooling (Vite, tests, linters). Version 22.12 or newer |
| **make** | Runs the shortcut commands below |
| **Docker** | Builds and runs the production image (optional for everyday development) |
| **Editor** | [VS Code](https://code.visualstudio.com/) with the *Python*, *Pylance*, *Ruff*, *ESLint*, *Prettier*, and *EditorConfig* extensions is a good choice |

You don't need to install Python yourself: uv downloads a suitable version if your system
doesn't have one.

### Arch Linux

```bash
sudo pacman -S --needed git make uv nodejs npm github-cli docker docker-buildx docker-compose
```

- **GitHub sign-in:** run `gh auth login` and choose *HTTPS*. Git then uses it to push.
- **Your Git identity** (shown on your commits):
  `git config --global user.name "Your Name"` and
  `git config --global user.email "you@example.com"`
- **Docker:** start it with `sudo systemctl enable --now docker.socket`. To run `docker` without
  `sudo`, add yourself to the `docker` group (`sudo usermod -aG docker $USER`, then log out and
  back in). Be aware that membership in this group is equivalent to root access.
- **VS Code:** the `code` package in the official repositories is the open-source build, which
  can't use Microsoft's Pylance extension. For Pylance, install `visual-studio-code-bin` from
  the AUR (for example with `yay -S visual-studio-code-bin`). Either works with Ruff, ESLint,
  and Prettier.

### Other systems

- **macOS:** `xcode-select --install` (Git and make), then install
  [uv](https://docs.astral.sh/uv/getting-started/installation/),
  [Node.js](https://nodejs.org/), and [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- **Windows:** use [WSL 2](https://learn.microsoft.com/windows/wsl/install) and follow the
  Linux instructions inside it (e.g. `sudo apt install git make nodejs npm` on Ubuntu, plus
  [uv](https://docs.astral.sh/uv/getting-started/installation/)). VS Code works with WSL
  through its *WSL* extension.

## 2. Get the code (once)

```bash
git clone https://github.com/mazelado/sunfleck.git
cd sunfleck
make setup
```

`make setup` installs the backend's dependencies (into `backend/.venv`) and the frontend's
(into `frontend/node_modules`), and installs the **pre-commit hooks**: checks that run
automatically every time you commit.

## 3. Run the app

```bash
make dev
```

This starts three processes side by side:
- **Vite** on port 5173 serves the React frontend and reloads the page instantly when you save
  a file.
- **Django** on port 8000 serves the API. Vite forwards `/api`, `/admin`, and `/static` to it.
- **The worker** (Huey) runs background jobs: reminders, weather updates, and the nightly
  recalculation. Its queue is a file next to the database (`backend/data/huey.sqlite3`). It
  doesn't reload when you change code: stop `make dev` and start it again. (`make dev-worker`
  runs just the worker.)

To try notifications, add a channel under **Notifications** in the account menu. The easiest
is [ntfy](https://ntfy.sh): install its phone app, subscribe to a topic name nobody would guess,
and add `ntfy://ntfy.sh/that-topic`. **Send a test** sends one right away; the daily digest is
sent by the worker at the time you choose, and the page shows what it would say now.

Open <http://localhost:5173>. The first time, Sunfleck shows its **setup page**: create your
account there (you become the household's Admin). To try other roles, invite yourself at a
second address from **Household**; the invitation link is printed in the `make dev` terminal
and shown on the page. Other useful pages:
- <http://localhost:5173/api/v1/docs>: interactive API documentation
- <http://localhost:5173/admin/>: the Django admin. Create an account for it first with
  `make superuser`

Stop both servers with **Ctrl+C**. Your local database lives in `backend/data/db.sqlite3`, and
plant photos in `backend/data/media/`. To start fresh, stop the servers and delete that folder.

## 4. Everyday commands

Run `make` (or `make help`) to see them all.

| Command | When to use it |
|---|---|
| `make dev` | Run the app locally |
| `make test` | Run all tests (backend and frontend). Do this before every commit |
| `make e2e` | Run the browser tests: the main journeys in Chromium at phone size, against a production build with an empty database. Slower; CI runs them on every pull request |
| `make lint` | Run the same formatting, lint, type, and migration checks as CI |
| `make format` | Automatically fix formatting and simple lint problems |
| `make api-types` | After changing the backend API, regenerate the frontend's TypeScript types (CI checks they're up to date) |
| `make docker` | Build the production Docker image |
| `make migrations` | After changing a model in `models.py`, to create the migration file |
| `make migrate` | Apply migrations to your local database (`make dev` does this for you) |

## 5. Making a change (the Git workflow)

```bash
git switch main
git pull                                   # get the latest main
git switch -c feat/short-description       # create a branch for your change

# ... edit files, run `make test` and `make lint` ...

git add -A                                 # stage your changes
git commit -m "feat(scope): what you did"  # the pre-commit hooks run here
git push -u origin feat/short-description  # upload the branch
```

Then open a pull request on GitHub and fill in the template. See the
[style guide](STYLE_GUIDE.md#2-repository-and-workflow) for branch names and commit messages.

**If a pre-commit hook fails:** it often fixes the problem itself (formatting, whitespace). Run
`git add -A` and commit again. If it reports an error it can't fix, fix it and commit again.

## 6. Project layout

```
backend/
├── pyproject.toml        # dependencies and tool settings (Ruff, mypy, pytest)
├── uv.lock               # exact versions of every dependency (don't edit by hand)
├── manage.py             # Django's command-line tool
└── sunfleck/
    ├── config/           # settings, URL routes, the API root
    ├── core/             # shared code, the health check, and the view that serves the frontend
    └── accounts/         # users (more in milestone M1)
frontend/
├── package.json          # dependencies and npm scripts
├── vite.config.ts        # dev server, proxy to Django, and test settings
└── src/
    ├── main.tsx          # entry point
    ├── App.tsx           # the app (currently a single page)
    ├── AppProviders.tsx  # theme, data fetching, and translations around the app
    ├── api/              # API client; openapi.json and schema.d.ts are generated
    ├── i18n/             # translations (locales/en.json holds every English text)
    └── test/             # test setup and helpers
docker/                   # Dockerfile, entry point, and Compose example
```

Backend tests live in a `tests/` folder in each Django app. Frontend tests sit next to the
code they test, as `*.test.tsx`. They run the real screens against a fake API (MSW,
`src/test/server.ts`); any request a test didn't set up a fake response for fails the test.

## 7. Configuration

Settings come from environment variables (see
[technical-plan.md](technical-plan.md#configuration-environment-variables)). For development,
`make` sets `DEBUG=true`, which provides safe local defaults, so no configuration is needed.

**Emails during development:** there's no email server, so emails (password resets,
invitations) are printed in the `make dev` terminal instead. Copy links from there.

To try PostgreSQL locally, set `DATABASE_URL` and install the driver:

```bash
cd backend
uv sync --extra postgres
DEBUG=true DATABASE_URL=postgres://user:password@localhost:5432/sunfleck uv run python manage.py migrate
```

### The care dataset

Care profiles and plant names live in `data/care/` (see its README). They're loaded into the
database by `make migrate` and `make dev` whenever the dataset's version changes. After editing
the dataset, bump the version in `data/care/dataset.yaml`, or reload it by hand:

```bash
cd backend
DEBUG=true uv run python manage.py load_care_data --force
```

`make test` checks the dataset and lists every problem with its file.

### Care predictions

The prediction engine is plain Python in `backend/sunfleck/prediction/`; the care app's
`schedules.py` feeds it from the database and stores the results. Saving anything a prediction
depends on marks the affected schedules out of date (`care/signals.py`); they recalculate when
next read, or when read on a new day. To bring them all up to date at once (the nightly job will
do this), run:

```bash
cd backend
DEBUG=true uv run python manage.py recalculate_schedules
```

Each change in a prediction is recorded with the factors behind it, so the Django admin
(**Care schedules**) shows why a due date moved.

The engine's property-based tests (Hypothesis) try 100 random cases each. After changing the
engine, try many more:

```bash
cd backend
uv run pytest sunfleck/prediction --hypothesis-profile=thorough
```

### Plugins

Built-in plugins live in `plugins/`, each a Python package of its own (see
[plugins.md](plugins.md)). The backend installs them from there (`[tool.uv.sources]` in
`backend/pyproject.toml`), as editable packages, so changes take effect on restart. Lint, type
checks and tests cover them: run everything from `backend/` as usual (`make lint`, `make test`).

Plugins are off until an Admin turns them on in **Settings → Plugins**. The weather plugin needs
to reach `api.open-meteo.com`; without it, Today just shows no weather (and the plugin's error).

### The map

The site form shows a map from **OpenStreetMap**. While it's open, the browser downloads map
images from `tile.openstreetmap.org` (that's the only outside service Sunfleck contacts so far).
The map is optional: coordinates can always be typed in. It's loaded only when a site form
opens, so the rest of the app stays small.

OpenStreetMap's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
requires each request to say which site it comes from (the `Referer` header). Sunfleck sends
just its address (e.g. `https://plants.example.com/`), never the page path. If the map shows
"Access blocked", that header is missing.

## 8. Docker

`make docker` builds the production image as `sunfleck:dev`: one container that serves both the
API and the built frontend. To try it:

```bash
docker run --rm -p 8000:8000 -e SECRET_KEY=try-it-out sunfleck:dev
```

Then open <http://localhost:8000>. Data is thrown away when the container stops.

For a longer-lived setup, use Docker Compose from the `docker/` folder. `compose.yaml` runs the
published image (see [Installing Sunfleck](install.md)); `compose.build.yaml` adds to it to
build the image from your code instead:

```bash
cd docker
cp env.example .env       # then edit .env: set SECRET_KEY and TIME_ZONE
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

This starts two containers from the same image: **sunfleck** (the app) and **worker** (background
jobs: reminders, weather updates, the nightly recalculation), which starts once the app is up.
`--build` rebuilds the image from your current code; drop it to reuse the last build. (Use the
same `-f` options with the other `docker compose` commands below.) Data is
kept in a Docker volume named `docker_sunfleck-data` (the `docker_` prefix comes from the
folder name), so it survives restarts and rebuilds. It holds both the database and the plant
photos (`/data/media`), so back up the whole volume. Useful commands:

| Command | Does |
|---|---|
| `docker compose logs -f` | Follow the app's and worker's output (Ctrl+C stops following, not the app) |
| `docker compose ps` | Show whether it's running and healthy |
| `docker compose down` | Stop it (data is kept) |
| `docker compose down --volumes` | Stop it **and delete all its data** |

### Releasing

Pushing a version tag publishes a release: the [Release workflow](../.github/workflows/release.yml)
builds the image for `linux/amd64` and `linux/arm64`, pushes it to `ghcr.io/mazelado/sunfleck`
(tagged e.g. `0.1.0`, `0.1` and `latest`), and creates a GitHub release with that version's
section of [CHANGELOG.md](../CHANGELOG.md), titled with the release name.

Choose the version by [Semantic Versioning](https://semver.org/): new features raise the minor
version (0.2.0), only fixes raise the patch version (0.2.1). Each minor version has the next
plant name from the [roadmap](roadmap.md#versions-and-release-names), and its patch releases
keep it.

To release:

1. In a pull request, move the changelog's *Unreleased* notes under a new version heading
   (with the release name first, e.g. `**Bougainvillea.**`), and
   set the version in `backend/pyproject.toml`, `backend/sunfleck/__init__.py` and
   `frontend/package.json`, then update the lock files (`uv lock` in `backend`, and
   `npm install --package-lock-only` in `frontend`) and the API types (`make api-types`).
   Merge it.
2. Tag the merged commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag -a v0.1.0 -m "Sunfleck 0.1.0"
   git push origin v0.1.0
   ```
3. Afterwards, set the versions to the next development version (e.g. `0.2.0.dev0` and
   `0.2.0-dev`).

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Open a new terminal after installing uv, or follow the PATH hint the installer printed |
| `The SECRET_KEY environment variable must be set` | You ran `manage.py` directly. Use the `make` commands, or prefix the command with `DEBUG=true` |
| `Error: That port is already in use` | Another `make dev` is still running. Stop it with Ctrl+C in that terminal |
| The page says "Can't reach the server" | The Django server isn't running or crashed. Check its output in the `make dev` terminal |
| The Django output shows `Not Found: /health` (or other URLs Sunfleck doesn't use) | Another program on your computer is polling port 8000, usually because it expects its own server there. Sunfleck is unaffected. To find the program, run `sudo ss -tnp 'dport = :8000'` a few times while `make dev` is running |
| Docker says `/data isn't writable` | You replaced the volume with a folder. Give it to the app's user: `sudo chown 1000 <folder>` |
| `npm ci` fails with "unsupported engine" | Your Node.js is too old. Install version 22.12 or newer |
| The pre-commit hooks don't run | Run `make setup` again |
