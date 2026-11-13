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
# AI models read photos up to about this size; larger ones are scaled down by the service.
AI_MAX_EDGE = 1568
AVATAR_SIZE = 256
ALLOWED_FORMATS = {"JPEG", "MPO", "PNG", "WEBP", "HEIF", "AVIF"}
IMAGE_QUALITY = 82
THUMBNAIL_QUALITY = 75
# EXIF dates before digital cameras existed are camera clock errors.
EARLIEST_PLAUSIBLE_YEAR = 1990
# A crop smaller than this, in pixels of the photo, is a slip of the fingers.
MIN_CROP_PIXELS = 32
# Photos with more pixels are refused before they're decoded (a 50 megapixel image takes about
# 200 MB of memory; the server may be a Raspberry Pi). Below Pillow's own limit (89 MP).
MAX_PIXELS = 50_000_000


class ImageError(Exception):
    """The upload isn't a usable image. `code` is stable and shown to API clients."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Crop:
    """The part of a photo to show, as fractions (0 to 1) of its width and height, measured
    from its top left corner once it's upright."""

    x: float
    y: float
    width: float
    height: float

    def box(self, width: int, height: int) -> tuple[int, int, int, int]:
        """The crop in pixels of an image this size, as Pillow's (left, top, right, bottom).

        Raises:
            ImageError: `invalid_crop` if it isn't inside the image, or is too small.
        """
        # A little slack for rounding in the browser.
        inside = (
            0 <= self.x < 1
            and 0 <= self.y < 1
            and self.width > 0
            and self.height > 0
            and self.x + self.width <= 1.001
            and self.y + self.height <= 1.001
        )
        if not inside:
            raise ImageError("invalid_crop", "The crop isn't inside the photo.")
        left, top = round(self.x * width), round(self.y * height)
        right = min(round((self.x + self.width) * width), width)
        bottom = min(round((self.y + self.height) * height), height)
        if min(right - left, bottom - top) < min(MIN_CROP_PIXELS, width, height):
            raise ImageError("invalid_crop", "The crop is too small.")
        return left, top, right, bottom


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


@dataclass(frozen=True)
class StoredImage:
    data: bytes
    width: int
    height: int


def clean_webp(content: bytes, max_edge: int, quality: int) -> StoredImage:
    """An image as Sunfleck stores it: a WebP, upright, at most `max_edge` pixels on its long
    edge, without EXIF or XMP metadata (which can hold where a photo was taken).

    One that's like that already (as in Sunfleck's own exports) is kept byte for byte, so it
    loses no quality; anything else is encoded again.

    Raises:
        ImageError: If it isn't a supported image, or has too many pixels.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(io.BytesIO(content)) as image:
                clean = (
                    image.format == "WEBP"
                    and not image.info.get("exif")
                    and not image.info.get("xmp")
                    and not image.getexif()
                    and max(image.size) <= max_edge
                )
                if clean:
                    return StoredImage(content, image.width, image.height)
        except (Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
            raise ImageError("image_too_large", "This photo has too many pixels.") from exc
        except (UnidentifiedImageError, OSError) as exc:
            raise ImageError("invalid_image", "This file isn't a photo we can read.") from exc
    source, upright, _ = _open(io.BytesIO(content), max_edge)
    has_alpha = upright.mode in ("RGBA", "LA", "PA") or "transparency" in upright.info
    converted = upright.convert("RGBA" if has_alpha else "RGB")
    converted.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return StoredImage(
        _webp(converted, quality, source.info.get("icc_profile")),
        converted.width,
        converted.height,
    )


def thumbnail(file: IO[bytes], crop: Crop | None) -> bytes:
    """A new thumbnail for a stored photo: the part of it in `crop` (all of it without one), at
    most THUMBNAIL_MAX_EDGE pixels on its long edge.

    Raises:
        ImageError: If the crop isn't inside the photo, or the photo can't be read.
    """
    source, image, _ = _open(file, IMAGE_MAX_EDGE)
    if crop is not None:
        image = image.crop(crop.box(image.width, image.height))
    image.thumbnail((THUMBNAIL_MAX_EDGE, THUMBNAIL_MAX_EDGE), Image.Resampling.LANCZOS)
    return _webp(image, THUMBNAIL_QUALITY, source.info.get("icc_profile"))


def process_avatar(file: IO[bytes], crop: Crop | None = None) -> bytes:
    """A profile picture: the part of the photo the person chose, or else the middle of it, as
    a WebP square of AVATAR_SIZE pixels, upright and without metadata.

    Raises:
        ImageError: If the file isn't a supported image, is too large to process, or the crop
            isn't inside it.
    """
    _, image, _ = _open(file, AVATAR_SIZE * 4)
    if crop is not None:
        image = image.crop(crop.box(image.width, image.height))
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
    return _jpeg(file, IDENTIFY_MAX_EDGE)


def jpeg_for_ai(file: IO[bytes]) -> bytes:
    """A JPEG copy of the photo to send to an AI model: upright, at most 1568 px on its long
    edge, and without metadata (no GPS position).

    Raises:
        ImageError: If the file isn't a supported image or is too large to process.
    """
    return _jpeg(file, AI_MAX_EDGE)


def _jpeg(file: IO[bytes], max_edge: int) -> bytes:
    _, image, _ = _open(file, max_edge)
    image = image.convert("RGB")
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
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
            if source.width * source.height > MAX_PIXELS:
                raise ImageError("image_too_large", "This photo has too many pixels.")
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
