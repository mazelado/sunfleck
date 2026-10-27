# Development Guide

How to get Sunfleck running on your computer, and the everyday commands for working on it.
No prior Django experience needed.

## 1. Install the tools (once)

| Tool | What it's for | How to install |
|---|---|---|
| **Git** | Version control | macOS: `xcode-select --install` · Linux: your package manager (`sudo apt install git`) · Windows: see the note below |
| **uv** | Installs Python and the project's Python packages | `curl -LsSf https://astral.sh/uv/install.sh \| sh` (see [uv docs](https://docs.astral.sh/uv/getting-started/installation/)) |
| **make** | Runs the shortcut commands below | macOS: included with `xcode-select --install` · Linux: `sudo apt install make` |
| **Editor** | Writing code | [VS Code](https://code.visualstudio.com/) with the *Python*, *Pylance*, *Ruff*, and *EditorConfig* extensions is a good choice |

You don't need to install Python yourself: uv downloads a suitable version automatically.
Node.js and Docker will be needed later, for the frontend and the Docker image.

> **Windows:** use [WSL 2](https://learn.microsoft.com/windows/wsl/install) (Windows Subsystem
> for Linux) and follow the Linux instructions inside it. VS Code works with WSL through its
> *WSL* extension.

## 2. Get the code (once)

```bash
git clone https://github.com/mazelado/sunfleck.git
cd sunfleck
make setup
```

`make setup` creates a virtual environment in `backend/.venv`, installs all dependencies, and
installs the **pre-commit hooks**: checks that run automatically every time you commit.

## 3. Run the app

```bash
make dev
```

Then open:
- <http://localhost:8000/api/v1/health>: should show `{"status": "ok", ...}`
- <http://localhost:8000/api/v1/docs>: interactive API documentation
- <http://localhost:8000/admin/>: the Django admin. Create an account for it first with
  `make superuser`

Stop the server with **Ctrl+C**. Your local database lives in `backend/data/db.sqlite3`. To
start fresh, stop the server and delete that folder.

## 4. Everyday commands

Run `make` (or `make help`) to see them all.

| Command | When to use it |
|---|---|
| `make dev` | Run the app locally |
| `make test` | Run the tests. Do this before every commit |
| `make lint` | Check formatting, lint rules, types, and migrations, exactly like CI does |
| `make format` | Automatically fix formatting and simple lint problems |
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

## 6. Project layout (backend)

```
backend/
├── pyproject.toml        # dependencies and tool settings (Ruff, mypy, pytest)
├── uv.lock               # exact versions of every dependency (don't edit by hand)
├── manage.py             # Django's command-line tool
└── sunfleck/
    ├── config/           # settings, URL routes, the API root
    ├── core/             # shared code (and the health-check endpoint)
    └── accounts/         # users (more in milestone M1)
```

Each Django app keeps its tests in a `tests/` folder next to the code.

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

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `uv: command not found` | Open a new terminal after installing uv, or follow the PATH hint the installer printed |
| `The SECRET_KEY environment variable must be set` | You ran `manage.py` directly. Use the `make` commands, or prefix the command with `DEBUG=true` |
| `Error: That port is already in use` | Another `make dev` is still running. Stop it, or run on another port: `cd backend && DEBUG=true uv run python manage.py runserver 8001` |
| The pre-commit hooks don't run | Run `make setup` again |
