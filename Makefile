# Common development commands. Run `make help` to list them.

BACKEND := cd backend &&
FRONTEND := cd frontend &&
DEV_ENV := DEBUG=true

.DEFAULT_GOAL := help
.PHONY: help setup dev dev-backend dev-frontend dev-worker migrate migrations superuser test test-backend \
	test-frontend lint lint-backend lint-frontend format api-types messages docker

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-14s %s\n", $$1, $$2}'

setup: ## Install dependencies and the pre-commit hooks
	$(BACKEND) uv sync
	$(FRONTEND) npm ci
	uv run --project backend pre-commit install

dev: migrate ## Run the app at http://localhost:5173 (Ctrl+C stops it)
	@echo "Starting... open http://localhost:5173 once Vite reports it's ready."
	@$(MAKE) --no-print-directory -j3 dev-backend dev-frontend dev-worker

dev-backend: ## Run only the Django server (port 8000)
	$(BACKEND) $(DEV_ENV) uv run python manage.py runserver

dev-frontend: ## Run only the Vite dev server (port 5173)
	$(FRONTEND) npm run dev

dev-worker: ## Run only the background worker (reminders, weather, nightly jobs)
	$(BACKEND) $(DEV_ENV) uv run python manage.py run_huey

migrate: ## Apply database migrations
	$(BACKEND) $(DEV_ENV) uv run python manage.py migrate

migrations: ## Create migrations after changing models
	$(BACKEND) $(DEV_ENV) uv run python manage.py makemigrations

superuser: ## Create an admin account for the Django admin (/admin)
	$(BACKEND) $(DEV_ENV) uv run python manage.py createsuperuser

test: test-backend test-frontend ## Run all tests

test-backend: ## Run the backend tests
	$(BACKEND) uv run pytest

test-frontend: ## Run the frontend tests
	$(FRONTEND) npm test

lint: lint-backend lint-frontend ## Run every check that CI runs (except tests)

lint-backend: ## Check backend formatting, lint rules, types, and migrations
	$(BACKEND) uv run ruff format --check . ../plugins
	$(BACKEND) uv run ruff check . ../plugins
	$(BACKEND) uv run mypy . ../plugins
	$(BACKEND) $(DEV_ENV) uv run python manage.py makemigrations --check --dry-run

lint-frontend: ## Check frontend formatting, lint rules, and types
	$(FRONTEND) npm run format:check
	$(FRONTEND) npm run lint
	$(FRONTEND) npm run typecheck

format: ## Fix formatting and auto-fixable lint problems
	$(BACKEND) uv run ruff format . ../plugins
	$(BACKEND) uv run ruff check --fix . ../plugins
	$(FRONTEND) npm run format
	$(FRONTEND) npx eslint --fix .

api-types: ## Regenerate frontend API types after changing the backend API
	$(BACKEND) $(DEV_ENV) uv run python manage.py export_openapi_schema \
		--api sunfleck.config.api.api --indent 2 --sorted --output ../frontend/src/api/openapi.json
	$(FRONTEND) npm run api-types

messages: ## Update the server's translation files (add a language with LOCALE=de); see docs/translating.md
	$(BACKEND) uv run python manage.py makemessages $(if $(LOCALE),--locale $(LOCALE),--all) \
		--ignore=.venv --ignore="*/tests/*" --no-obsolete

docker: ## Build the production Docker image as sunfleck:dev
	docker build --file docker/Dockerfile --tag sunfleck:dev .
