"""The root of the JSON API, served under /api/v1/."""

from ninja import NinjaAPI

from sunfleck import __version__
from sunfleck.core.api import router as core_router

api = NinjaAPI(title="Sunfleck API", version=__version__, urls_namespace="api-v1")
api.add_router("/", core_router)
