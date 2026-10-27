import io
from typing import Any

from factory.declarations import SubFactory
from factory.django import DjangoModelFactory
from PIL import ExifTags, Image

from sunfleck.accounts.tests.factories import HouseholdFactory
from sunfleck.plants.models import Plant


class PlantFactory(DjangoModelFactory[Plant]):
    class Meta:
        model = Plant

    household = SubFactory(HouseholdFactory)
    nickname = "Monty"


def image_bytes(
    width: int = 400,
    height: int = 300,
    image_format: str = "JPEG",
    mode: str = "RGB",
    color: str | tuple[int, ...] = "green",
    exif: dict[int, Any] | None = None,
    exif_details: dict[int, Any] | None = None,
) -> bytes:
    """Return an image file's contents, optionally with EXIF tags.

    `exif` holds main tags (orientation, GPS, ...); `exif_details` holds tags of the EXIF
    sub-directory (the date the photo was taken, ...).
    """
    image = Image.new(mode, (width, height), color)
    data = Image.Exif()
    for tag, value in (exif or {}).items():
        data[tag] = value
    if exif_details:
        data.get_ifd(ExifTags.IFD.Exif).update(exif_details)
    buffer = io.BytesIO()
    options = {"exif": data} if exif or exif_details else {}
    image.save(buffer, image_format, **options)
    return buffer.getvalue()
