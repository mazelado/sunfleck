"""Calling the Pl@ntNet identification API (https://my.plantnet.org/doc/api/identify).

POST /v2/identify/all with the photos as multipart `images`, each with an `organs` value
("auto" lets Pl@ntNet tell what the photo shows). It answers the species it may be, best first.
"""

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

from sunfleck.plugins import Candidate, Identification, PhotoToIdentify

logger = logging.getLogger(__name__)

URL = "https://my-api.plantnet.org/v2/identify/all"
TIMEOUT_SECONDS = 30
MAX_RESULTS = 5
ATTRIBUTION = "Identified by Pl@ntNet"


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
