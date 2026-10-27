"""The root of the JSON API, served under /api/v1/."""

from ninja import NinjaAPI

from sunfleck import __version__
from sunfleck.accounts.api import router as accounts_router
from sunfleck.care.api import router as care_router
from sunfleck.core.api import router as core_router
from sunfleck.core.errors import register_error_handlers
from sunfleck.places.api import router as places_router
from sunfleck.plants.api import router as plants_router
from sunfleck.taxonomy.api import router as taxonomy_router

api = NinjaAPI(title="Sunfleck API", version=__version__, urls_namespace="api-v1")
register_error_handlers(api)
api.add_router("/", core_router)
api.add_router("/", accounts_router)
api.add_router("/", places_router)
api.add_router("/", plants_router)
api.add_router("/", care_router)
api.add_router("/", taxonomy_router)
