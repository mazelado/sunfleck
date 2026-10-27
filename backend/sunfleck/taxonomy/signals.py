"""Keep the database's care data in step with the dataset (data/care)."""

import logging
from typing import Any

from django.conf import settings

from sunfleck.taxonomy.loader import load_care_data

logger = logging.getLogger(__name__)


def load_care_data_after_migrate(**kwargs: Any) -> None:
    """After `migrate`, load the care dataset if it's a version not loaded yet."""
    path = settings.CARE_DATA_DIR
    if not (path / "dataset.yaml").is_file():
        logger.warning("No care dataset in %s; care suggestions are unavailable.", path)
        return
    load_care_data(path)
