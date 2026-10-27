import shutil
from pathlib import Path

import pytest
from django.conf import settings


@pytest.fixture
def dataset_copy(tmp_path: Path) -> Path:
    """A copy of the real dataset that a test can change or break."""
    copy = tmp_path / "care"
    shutil.copytree(settings.CARE_DATA_DIR, copy)
    return copy
