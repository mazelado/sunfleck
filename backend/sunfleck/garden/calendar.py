"""The sowing calendar: when to sow, plant out and harvest the household's seeds.

Each seed's species has crop timing in the care dataset (`Taxon.crop`): steps in weeks from the
site's typical last spring or first autumn frost, and the days to the first harvest. Here
they become dates, from the site's frost dates (places.frost).
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal

from sunfleck.garden.models import SeedPacket
from sunfleck.places.models import Site

Action = Literal["sow_indoors", "sow_outdoors", "plant_out", "harvest"]
# Frost dates known; known not to happen (it doesn't freeze there, so nothing is timed by
# them); or not known yet.
FrostState = Literal["known", "none", "unknown"]
# How far ahead the calendar looks.
AHEAD = timedelta(days=365)


@dataclass(frozen=True)
class Entry:
    seed: SeedPacket
    action: Action
    starts_on: date
    ends_on: date


def frost_state(site: Site) -> FrostState:
    if not site.frost_source:
        return "unknown"
    return "known" if site.last_frost or site.first_frost else "none"


def _frost_on(site: Site, after: str, year: int) -> date | None:
    """The site's frost date (`last_frost` or `first_frost`) in the given year."""
    frost = site.last_frost if after == "last_frost" else site.first_frost
    if frost is None:
        return None
    try:
        return date(year, frost.month, frost.day)
    except ValueError:  # 29 February, in a year without one
        return date(year, 2, 28)


def windows(crop: dict[str, Any], site: Site, year: int) -> list[tuple[Action, date, date]]:
    """The crop's steps as dates, for the season timed from the given year's frost dates, then
    its harvest. Empty when a step's frost date isn't known (or it doesn't freeze there)."""
    found: list[tuple[Action, date, date]] = []
    for step in crop.get("steps", []):
        frost = _frost_on(site, step["after"], year)
        if frost is None:
            return []
        first, last = step["weeks"]
        found.append(
            (step["action"], frost + timedelta(weeks=first), frost + timedelta(weeks=last))
        )
    harvest = crop.get("harvest_days")
    if found and harvest:
        _, starts_on, ends_on = found[-1]
        found.append(
            (
                "harvest",
                starts_on + timedelta(days=harvest[0]),
                ends_on + timedelta(days=harvest[1]),
            )
        )
    return found


def calendar(site: Site, today: date) -> list[Entry]:
    """What to do with the household's seeds from today to a year ahead, soonest first: this
    season's steps not yet over, and next season's."""
    seeds = SeedPacket.objects.filter(household=site.household).select_related("taxon")
    entries = []
    for seed in seeds:
        crop = seed.taxon.crop if seed.taxon else None
        if not crop:
            continue
        # The season timed from last year's frost dates may still be going (e.g. garlic
        # planted in autumn and harvested the next summer).
        for year in (today.year - 1, today.year, today.year + 1):
            for action, starts_on, ends_on in windows(crop, site, year):
                if ends_on >= today and starts_on <= today + AHEAD:
                    entries.append(Entry(seed, action, starts_on, ends_on))
    return sorted(entries, key=lambda entry: (entry.starts_on, entry.seed.name, entry.action))
