import io
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest
import time_machine
from PIL import ExifTags, Image

from sunfleck.plants import images
from sunfleck.plants.tests.factories import image_bytes

TAKEN: dict[int, Any] = {ExifTags.Base.DateTimeOriginal: "2026:05:01 12:30:00"}


def _open(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def test_large_photo_is_resized_to_webp_with_a_thumbnail() -> None:
    result = images.process_photo(io.BytesIO(image_bytes(4000, 3000)))

    image, thumbnail = _open(result.image), _open(result.thumbnail)
    assert (image.format, image.size) == ("WEBP", (2048, 1536))
    assert (result.width, result.height) == (2048, 1536)
    assert thumbnail.size == (512, 384)


def test_small_photo_is_not_enlarged() -> None:
    result = images.process_photo(io.BytesIO(image_bytes(300, 200)))

    assert (result.width, result.height) == (300, 200)


def test_metadata_such_as_gps_position_is_removed() -> None:
    gps = {ExifTags.GPS.GPSLatitudeRef: "N", ExifTags.GPS.GPSLatitude: (52.0, 22.0, 13.0)}
    upload = image_bytes(exif={ExifTags.Base.Make: "PhoneCo", ExifTags.IFD.GPSInfo: gps})
    assert b"PhoneCo" in upload

    result = images.process_photo(io.BytesIO(upload))

    assert not _open(result.image).getexif()
    assert b"PhoneCo" not in result.image
    assert b"PhoneCo" not in result.thumbnail


def test_sideways_photo_is_turned_upright() -> None:
    # Orientation 6: the camera was held on its side, so the picture must be turned 90°.
    upload = image_bytes(400, 300, exif={ExifTags.Base.Orientation: 6})

    result = images.process_photo(io.BytesIO(upload))

    assert (result.width, result.height) == (300, 400)


def test_transparent_png_keeps_its_transparency() -> None:
    result = images.process_photo(
        io.BytesIO(image_bytes(image_format="PNG", mode="RGBA", color=(0, 128, 0, 100)))
    )

    assert _open(result.image).mode == "RGBA"


@pytest.mark.parametrize("image_format", ["HEIF", "AVIF", "WEBP"])
def test_other_photo_formats_are_accepted(image_format: str) -> None:
    result = images.process_photo(io.BytesIO(image_bytes(image_format=image_format)))

    assert _open(result.image).format == "WEBP"


@pytest.mark.parametrize(
    ("upload", "code"),
    [
        (b"not an image at all", "invalid_image"),
        (image_bytes(image_format="GIF", mode="P"), "unsupported_image"),
        (image_bytes()[:200], "invalid_image"),  # cut off part way through
    ],
)
def test_unusable_uploads_are_refused(upload: bytes, code: str) -> None:
    with pytest.raises(images.ImageError) as exc_info:
        images.process_photo(io.BytesIO(upload))

    assert exc_info.value.code == code


def test_images_with_too_many_pixels_are_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1000)

    with pytest.raises(images.ImageError) as exc_info:
        images.process_photo(io.BytesIO(image_bytes(40, 40)))

    assert exc_info.value.code == "image_too_large"


# --- When the photo was taken -----------------------------------------------------------------


def test_date_taken_without_a_time_zone_is_naive() -> None:
    result = images.process_photo(io.BytesIO(image_bytes(exif_details=TAKEN)))

    assert result.taken_at == datetime(2026, 5, 1, 12, 30)  # noqa: DTZ001 - naive on purpose


def test_date_taken_with_a_time_zone_offset_is_aware() -> None:
    details = {**TAKEN, ExifTags.Base.OffsetTimeOriginal: "+02:00"}

    result = images.process_photo(io.BytesIO(image_bytes(exif_details=details)))

    assert result.taken_at == datetime(2026, 5, 1, 12, 30, tzinfo=timezone(timedelta(hours=2)))


def test_date_falls_back_to_when_the_file_was_saved() -> None:
    upload = image_bytes(exif={ExifTags.Base.DateTime: "2025:12:24 08:00:00"})

    result = images.process_photo(io.BytesIO(upload))

    assert result.taken_at == datetime(2025, 12, 24, 8)  # noqa: DTZ001 - naive on purpose


@time_machine.travel(datetime(2026, 6, 1, tzinfo=UTC))
@pytest.mark.parametrize(
    "raw",
    [
        "2027:01:01 00:00:00",  # in the future: the camera's clock is wrong
        "1970:01:01 00:00:00",  # an unset camera clock
        "0000:00:00 00:00:00",
        "yesterday",
    ],
)
def test_implausible_dates_taken_are_ignored(raw: str) -> None:
    upload = image_bytes(exif_details={ExifTags.Base.DateTimeOriginal: raw})

    result = images.process_photo(io.BytesIO(upload))

    assert result.taken_at is None


def test_photo_without_a_date_has_none() -> None:
    assert images.process_photo(io.BytesIO(image_bytes())).taken_at is None
