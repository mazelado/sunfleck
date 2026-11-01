"""Calling the Pl@ntNet identification API (https://my.plantnet.org/doc/api/identify).

POST /v2/identify/all with the photos as multipart `images`, each with an `organs` value
("auto" lets Pl@ntNet tell what the photo shows). It answers the species it may be, best first.
"""

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

from sunfleck.plugins import Candidate, Identification, PhotoToIdentify, SettingsCheck

logger = logging.getLogger(__name__)

URL = "https://my-api.plantnet.org/v2/identify/all"
TIMEOUT_SECONDS = 30
MAX_RESULTS = 5
ATTRIBUTION = "Identified by Pl@ntNet"
# A plain grey 64 px JPEG, which shows no plant: testing the plugin sends it, so that a valid
# key gets "species not found" rather than using up an identification on a real photo.
BLANK_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERX"
    "RTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2Nj"
    "Y2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCABAAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAA"
    "AAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAk"
    "M2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKT"
    "lJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QA"
    "HwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdh"
    "cRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hp"
    "anN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk"
    "5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAo"
    "oooAKKKKACiiigAooooAKKKKACiiigAooooA/9k="
)


class PlantNetError(Exception):
    """Pl@ntNet answered something unexpected."""


@dataclass(frozen=True)
class Response:
    status: int
    body: bytes


def post(url: str, body: bytes, content_type: str) -> Response:
    """Send a POST request; return the status and body, for errors too."""
    request = urllib.request.Request(  # noqa: S310 - always the https URL above
        url, data=body, method="POST", headers={"Content-Type": content_type}
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as answer:  # noqa: S310
            return Response(answer.status, answer.read())
    except urllib.error.HTTPError as exc:
        return Response(exc.code, exc.read())


def _multipart(photos: list[PhotoToIdentify]) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for index, photo in enumerate(photos):
        parts += [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="images"; filename="photo{index}.jpg"\r\n'
            "Content-Type: image/jpeg\r\n\r\n".encode(),
            photo.jpeg,
            b"\r\n",
            f"--{boundary}\r\n".encode(),
            b'Content-Disposition: form-data; name="organs"\r\n\r\n',
            photo.organ.encode(),
            b"\r\n",
        ]
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def identify(photos: list[PhotoToIdentify], language: str, api_key: str) -> Identification:
    """Ask Pl@ntNet which species the plant in the photos may be.

    Raises:
        PlantNetError: If Pl@ntNet refused the request or answered something unexpected.
    """
    query = urllib.parse.urlencode(
        {
            "api-key": api_key,
            # Pl@ntNet knows languages by their base code, e.g. "pt" rather than "pt-BR".
            "lang": language.split("-")[0].lower() or "en",
            "nb-results": MAX_RESULTS,
            "include-related-images": "false",
        }
    )
    body, content_type = _multipart(photos)
    try:
        response = post(f"{URL}?{query}", body, content_type)
    except (OSError, TimeoutError) as exc:
        logger.warning("Pl@ntNet couldn't be reached: %s", exc)
        return Identification(ATTRIBUTION, problem="unavailable")

    if response.status == 404:  # "Species not found": no plant it knows in the photos
        return Identification(ATTRIBUTION)
    if response.status in (401, 403):
        return Identification(ATTRIBUTION, problem="invalid_api_key")
    if response.status == 429:
        return Identification(ATTRIBUTION, problem="quota_exceeded")
    if response.status >= 500:
        return Identification(ATTRIBUTION, problem="unavailable")
    if response.status != 200:
        raise PlantNetError(f"HTTP {response.status}: {response.body[:200]!r}")
    return _read(response.body)


PROBLEM_DETAILS = {
    "invalid_api_key": "Pl@ntNet refused the API key. Check it at my.plantnet.org.",
    "quota_exceeded": "The API key's identifications for today are used up.",
    "unavailable": "Pl@ntNet couldn't be reached, or is having problems.",
}


def check(api_key: str) -> SettingsCheck:
    """Whether Pl@ntNet accepts the API key, by sending it a blank image."""
    try:
        found = identify([PhotoToIdentify(BLANK_JPEG)], "en", api_key)
    except PlantNetError as exc:
        return SettingsCheck("invalid_answer", f"Pl@ntNet answered something unexpected: {exc}")
    if found.problem is not None:
        return SettingsCheck(found.problem, PROBLEM_DETAILS.get(found.problem, ""))
    left = f" {found.remaining} identifications left today." if found.remaining is not None else ""
    return SettingsCheck(details=f"Pl@ntNet accepted the API key.{left}")


def _read(body: bytes) -> Identification:
    try:
        data = json.loads(body)
        candidates = tuple(_candidate(result) for result in data["results"])
        remaining = data.get("remainingIdentificationRequests")
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        raise PlantNetError(f"Unexpected answer: {exc!r}") from exc
    return Identification(
        ATTRIBUTION,
        candidates=candidates,
        remaining=remaining if isinstance(remaining, int) else None,
    )


def _candidate(result: dict[str, Any]) -> Candidate:
    species = result["species"]
    names = species.get("commonNames") or []
    return Candidate(
        scientific_name=str(species["scientificNameWithoutAuthor"]),
        score=float(result["score"]),
        genus=str((species.get("genus") or {}).get("scientificNameWithoutAuthor", "")),
        family=str((species.get("family") or {}).get("scientificNameWithoutAuthor", "")),
        common_names=tuple(str(name) for name in names),
    )
