"""Plugins' background jobs, scheduled when the worker starts (it imports every `tasks.py`)."""

from sunfleck.plugins.jobs import register_jobs
from sunfleck.plugins.registry import registry

registered = register_jobs(registry)
