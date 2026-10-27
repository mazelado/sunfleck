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

This starts two servers side by side:
- **Vite** on port 5173 serves the React frontend and reloads the page instantly when you save
  a file.
- **Django** on port 8000 serves the API. Vite forwards `/api`, `/admin`, and `/static` to it.

Open <http://localhost:5173>. You should see the Sunfleck page with a green
"Connected · version …" badge. Other useful pages:
- <http://localhost:5173/api/v1/docs>: interactive API documentation
- <http://localhost:5173/admin/>: the Django admin. Create an account for it first with
  `make superuser`

Stop both servers with **Ctrl+C**. Your local database lives in `backend/data/db.sqlite3`. To
start fresh, stop the servers and delete that folder.

## 4. Everyday commands

Run `make` (or `make help`) to see them all.

| Command | When to use it |
|---|---|
| `make dev` | Run the app locally |
| `make test` | Run all tests (backend and frontend). Do this before every commit |
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
code they test, as `*.test.tsx`.

## 7. Configuration

Settings come from environment variables (see
[technical-plan.md](technical-plan.md#configuration-environment-variables)). For development,
`make` sets `DEBUG=true`, which provides safe local defaults, so no configuration is needed.

To try PostgreSQL locally, set `DATABASE_URL` and install the driver:

```bash
cd backend
uv sync --extra postgres
DEBUG=true DATABASE_URL=postgres://user:password@localhost:5432/sunfleck uv run python manage.py migrate
```

## 8. Docker

`make docker` builds the production image as `sunfleck:dev`: one container that serves both the
API and the built frontend. To try it:

```bash
docker run --rm -p 8000:8000 -e SECRET_KEY=try-it-out sunfleck:dev
```

Then open <http://localhost:8000>. See `docker/compose.yaml` and `docker/env.example` for a
longer-lived setup. Published images (`ghcr.io/mazelado/sunfleck`) will start with the first
release.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Open a new terminal after installing uv, or follow the PATH hint the installer printed |
| `The SECRET_KEY environment variable must be set` | You ran `manage.py` directly. Use the `make` commands, or prefix the command with `DEBUG=true` |
| `Error: That port is already in use` | Another `make dev` is still running. Stop it with Ctrl+C in that terminal |
| The page says "Can't reach the server" | The Django server isn't running or crashed. Check its output in the `make dev` terminal |
| `npm ci` fails with "unsupported engine" | Your Node.js is too old. Install version 22.12 or newer |
| The pre-commit hooks don't run | Run `make setup` again |
