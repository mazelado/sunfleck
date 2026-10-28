"""The plugin's hooks: identifying a plant through Pl@ntNet."""

from sunfleck.plugins import Identification, PhotoToIdentify, hookimpl

from sunfleck_identify_plantnet import Settings, plantnet


@hookimpl
def identify_plant(
    photos: list[PhotoToIdentify], language: str, settings: Settings
) -> Identification:
    api_key = settings.api_key.get_secret_value().strip()
    if not api_key:
        return Identification(plantnet.ATTRIBUTION, problem="missing_api_key")
    return plantnet.identify(photos, language, api_key)
