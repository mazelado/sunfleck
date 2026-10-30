"""Photo processing: check an upload is an image, then resize it and remove its metadata.
Used for plant photos and profile pictures.

The browser already shrinks photos before uploading them; this is the server's own check, and
it handles uploads from other clients and iPhone HEIC photos.
"""

import contextlib
import io
import warnings
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import IO

from django.utils import timezone
from PIL import ExifTags, Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

register_heif_opener()

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
IMAGE_MAX_EDGE = 2048
THUMBNAIL_MAX_EDGE = 512
# Enough for plant identification services, which work on smaller images still.
IDENTIFY_MAX_EDGE = 1280
AVATAR_SIZE = 256
ALLOWED_FORMATS = {"JPEG", "MPO", "PNG", "WEBP", "HEIF", "AVIF"}
IMAGE_QUALITY = 82
THUMBNAIL_QUALITY = 75
# EXIF dates before digital cameras existed are camera clock errors.
EARLIEST_PLAUSIBLE_YEAR = 1990


class ImageError(Exception):
    """The upload isn't a usable image. `code` is stable and shown to API clients."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ProcessedPhoto:
    image: bytes
    thumbnail: bytes
    width: int
    height: int
    # When the camera says the photo was taken. Naive (no time zone) if the camera didn't
    # record its time zone offset; None if there's no usable date.
    taken_at: datetime | None


def process_photo(file: IO[bytes]) -> ProcessedPhoto:
    """Return a WebP copy of the photo (at most 2048 px on its long edge) and a thumbnail.

    The copies are turned upright and carry no EXIF metadata, which can include the GPS
    position where the photo was taken.

    Raises:
        ImageError: If the file isn't a supported image or is too large to process.
    """
    source, image, taken_at = _open(file, IMAGE_MAX_EDGE)
    has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")
    image.thumbnail((IMAGE_MAX_EDGE, IMAGE_MAX_EDGE), Image.Resampling.LANCZOS)
    thumbnail = image.copy()
    thumbnail.thumbnail((THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE), Image.Resampling.LANCZOS)
    # Keep the colour profile, so colours look the same; it holds nothing personal.
    icc_profile = source.info.get("icc_profile")
    return ProcessedPhoto(
        image=_webp(image, IMAGE_QUALITY, icc_profile),
        thumbnail=_webp(thumbnail, THUMBNAIL_QUALITY, icc_profile),
        width=image.width,
        height=image.height,
        taken_at=taken_at,
    )


def process_avatar(file: IO[bytes]) -> bytes:
    """A profile picture: the middle of the photo, as a WebP square of AVATAR_SIZE pixels,
    upright and without metadata.

    Raises:
        ImageError: If the file isn't a supported image or is too large to process.
    """
    _, image, _ = _open(file, AVATAR_SIZE * 4)
    # Faces tend to be in the upper part of a portrait: keep a little more of the top.
    square = ImageOps.fit(
        image.convert("RGB"),
        (AVATAR_SIZE, AVATAR_SIZE),
        Image.Resampling.LANCZOS,
        centering=(0.5, 0.4),
    )
    return _webp(square, IMAGE_QUALITY, None)


def jpeg_for_identification(file: IO[bytes]) -> bytes:
    """A JPEG copy of the photo to send for identification: upright, at most 1280 px on its
    long edge, and without metadata (no GPS position).

    Raises:
        ImageError: If the file isn't a supported image or is too large to process.
    """
    _, image, _ = _open(file, IDENTIFY_MAX_EDGE)
    image = image.convert("RGB")
    image.thumbnail((IDENTIFY_MAX_EDGE, IDENTIFY_MAX_EDGE), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=IMAGE_QUALITY)
    return buffer.getvalue()


def _open(file: IO[bytes], max_edge: int) -> tuple[Image.Image, Image.Image, datetime | None]:
    """The photo as opened, the same turned upright, and when it was taken."""
    with warnings.catch_warnings():
        # Pillow warns about images that are big enough to exhaust memory ("decompression
        # bombs"); refuse them.
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            source = Image.open(file)
            if source.format not in ALLOWED_FORMATS:
                raise ImageError("unsupported_image", "Upload a JPEG, PNG, WebP, or HEIC photo.")
            taken_at = _taken_at(source.getexif())
            # For JPEGs, decode at a reduced size straight away, which saves a lot of memory.
            source.draft("RGB", (max_edge, max_edge))
            image = ImageOps.exif_transpose(source)
        except (Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
            raise ImageError("image_too_large", "This photo has too many pixels.") from exc
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageError("invalid_image", "This file isn't a photo we can read.") from exc
    return source, image, taken_at


def _webp(image: Image.Image, quality: int, icc_profile: bytes | None) -> bytes:
    buffer = io.BytesIO()
    options = {"icc_profile": icc_profile} if icc_profile else {}
    image.save(buffer, "WEBP", quality=quality, method=4, **options)
    return buffer.getvalue()


def _taken_at(exif: Image.Exif) -> datetime | None:
    """Return when the photo was taken, from its EXIF data."""
    details = exif.get_ifd(ExifTags.IFD.Exif)
    raw = details.get(ExifTags.Base.DateTimeOriginal) or exif.get(ExifTags.Base.DateTime)
    if not isinstance(raw, str):
        return None
    try:
        taken_at = datetime.strptime(raw.strip(), "%Y:%m:%d %H:%M:%S")  # noqa: DTZ007 - see below
    except ValueError:
        return None
    # Cameras record local time; newer ones also record its offset from UTC, e.g. "+02:00".
    offset = details.get(ExifTags.Base.OffsetTimeOriginal)
    if isinstance(offset, str):
        with contextlib.suppress(ValueError):
            taken_at = datetime.strptime(f"{raw.strip()} {offset.strip()}", "%Y:%m:%d %H:%M:%S %z")
    return taken_at if is_plausible_date(taken_at) else None


def is_plausible_date(taken_at: datetime) -> bool:
    """Whether a photo could really have been taken then; cameras' clocks are often wrong."""
    if taken_at.year < EARLIEST_PLAUSIBLE_YEAR:
        return False
    # A date in the future means the clock is wrong. (A day's margin covers naive local times
    # ahead of UTC.)
    latest = timezone.now() + timedelta(days=1)
    return taken_at <= (latest if taken_at.tzinfo else latest.replace(tzinfo=None))
