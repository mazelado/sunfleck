# Common development commands. Run `make help` to list them.

BACKEND := cd backend &&
DEV_ENV := DEBUG=true

.DEFAULT_GOAL := help
.PHONY: help setup dev migrate migrations superuser test lint format

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  make %-12s %s\n", $$1, $$2}'

setup: ## Install dependencies and the pre-commit hooks
	$(BACKEND) uv sync
	uv run --project backend pre-commit install

dev: migrate ## Run the development server at http://localhost:8000
	$(BACKEND) $(DEV_ENV) uv run python manage.py runserver

migrate: ## Apply database migrations
	$(BACKEND) $(DEV_ENV) uv run python manage.py migrate

migrations: ## Create migrations after changing models
	$(BACKEND) $(DEV_ENV) uv run python manage.py makemigrations

superuser: ## Create an admin account for the Django admin (/admin)
	$(BACKEND) $(DEV_ENV) uv run python manage.py createsuperuser

test: ## Run the test suite
	$(BACKEND) uv run pytest

lint: ## Check formatting, lint rules, types, and migrations
	$(BACKEND) uv run ruff format --check .
	$(BACKEND) uv run ruff check .
	$(BACKEND) uv run mypy .
	$(BACKEND) $(DEV_ENV) uv run python manage.py makemigrations --check --dry-run

format: ## Fix formatting and auto-fixable lint problems
	$(BACKEND) uv run ruff format .
	$(BACKEND) uv run ruff check --fix .
