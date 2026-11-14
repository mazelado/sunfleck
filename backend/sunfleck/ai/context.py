"""What an AI model is told about a plant, for diagnosing it or answering questions about it.

Only what helps judge its health and care: its species and care profile, where and how it
grows, its schedules and its recent care. Never people's names or the site's address.
"""

from sunfleck.care.models import CareEvent
from sunfleck.care.schedules import local_today, schedules_for
from sunfleck.places.models import LocationKind
from sunfleck.plants.models import Plant
from sunfleck.plants.time import plant_zone
from sunfleck.taxonomy.models import FALLBACK_LANGUAGE, translated, translated_names

# How much of the care log, newest first.
RECENT_CARE = 15


def plant_context(plant: Plant) -> str:
    """The plant, in plain lines of English (the model answers in the person's language)."""
    today = local_today(plant)
    lines = [f"Today is {today.isoformat()}.", f"The plant: {plant.nickname}"]
    if plant.taxon is not None:
        common = translated_names(plant.taxon.common_names, FALLBACK_LANGUAGE)
        name = f" ({common[0]})" if common else ""
        lines.append(f"Species: {plant.taxon.scientific_name}{name}, family {plant.taxon.family}")
    profile = plant.effective_care_profile
    if profile is not None:
        lines.append(f"Care profile: {translated(profile.name, FALLBACK_LANGUAGE)}")
    lines.append(f"Status: {plant.get_status_display()}")
    if plant.acquired_on:
        lines.append(f"Had since: {plant.acquired_on.isoformat()}")
    lines += _where(plant)
    lines += _pot(plant)
    lines += _schedules(plant)
    lines += _recent_care(plant)
    if plant.notes:
        lines.append(f"Notes about it: {plant.notes}")
    return "\n".join(lines)


def _where(plant: Plant) -> list[str]:
    location = plant.location
    if location is None:
        return ["Where: not recorded"]
    hemisphere = "southern" if location.site.latitude < 0 else "northern"
    if location.kind == LocationKind.OUTDOOR:
        lines = [f"Where: outdoors ({location.name}), {hemisphere} hemisphere"]
        if location.exposure:
            lines.append(f"Sun: {location.get_exposure_display()}")
        if location.bed_type:
            lines.append(f"In a {location.get_bed_type_display().lower()}")
        return lines
    lines = [f"Where: indoors ({location.name}), {hemisphere} hemisphere"]
    if location.temperature_min_c is not None and location.temperature_max_c is not None:
        lines.append(
            f"Room temperature: {location.temperature_min_c:g}-{location.temperature_max_c:g} °C"
        )
    if location.humidity:
        lines.append(f"Humidity: {location.get_humidity_display()}")
    lights = []
    for link in plant.light_links.select_related("light_source"):
        light = link.light_source
        if light.kind == "window":
            distance = f", {link.distance_cm} cm away" if link.distance_cm is not None else ""
            lights.append(f"a window facing {light.direction}{distance}")
        else:
            distance = f", {link.distance_cm} cm below it" if link.distance_cm is not None else ""
            lights.append(f"a grow light{distance}")
    lines.append(f"Light: {', '.join(lights)}" if lights else "Light: not recorded")
    return lines


def _pot(plant: Plant) -> list[str]:
    parts = []
    if plant.container_diameter_cm:
        parts.append(f"{plant.container_diameter_cm} cm wide")
    if plant.container_material:
        parts.append(plant.get_container_material_display().lower())
    if plant.soil_type:
        parts.append(f"in {plant.get_soil_type_display().lower()}")
    return [f"Pot: {', '.join(parts)}"] if parts else []


def _schedules(plant: Plant) -> list[str]:
    lines = []
    for schedule in schedules_for(plant):
        if not schedule.enabled:
            continue
        name = schedule.care_type.name or schedule.care_type.key
        every = f"about every {schedule.interval_days} days" if schedule.interval_days else ""
        due = f", next due {schedule.next_due.isoformat()}" if schedule.next_due else ""
        lines.append(f"- {name}: {every or 'resting'}{due}")
    return ["Care schedule:", *lines] if lines else ["Care schedule: none"]


def _recent_care(plant: Plant) -> list[str]:
    events = (
        CareEvent.objects.filter(plant=plant)
        .select_related("care_type")
        .order_by("-performed_at")[:RECENT_CARE]
    )
    lines = []
    for event in events:
        name = event.care_type.name or event.care_type.key
        details = []
        if event.skipped:
            details.append("checked, not needed")
        if event.feedback:
            details.append(f"soil was {event.get_feedback_display().lower()}")
        if event.notes:
            details.append(f'notes: "{event.notes[:200]}"')
        extra = f" ({'; '.join(details)})" if details else ""
        # The site's day, like "Today is" above, not the UTC one.
        day = event.performed_at.astimezone(plant_zone(plant)).date()
        lines.append(f"- {day.isoformat()}: {name}{extra}")
    return ["Recent care, newest first:", *lines] if lines else ["Recent care: none logged"]
