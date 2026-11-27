"""The plugin's hooks: listing and reading Home Assistant's sensors.

`sensor_choices` and `read_sensors` raise `HomeAssistantError` when Home Assistant can't be
reached or refuses the token: Sunfleck then shows the error to Admins on the Plugins page.
"""

from sunfleck.plugins import SensorChoice, SensorReading, SettingsCheck, hookimpl

from sunfleck_homeassistant import Settings, client


@hookimpl
def check_settings(settings: Settings) -> SettingsCheck:
    return client.check(settings.base_url, _token(settings))


@hookimpl
def sensor_choices(settings: Settings) -> list[SensorChoice]:
    return client.choices(settings.base_url, _token(settings))


@hookimpl
def read_sensors(sensor_ids: list[str], settings: Settings) -> list[SensorReading]:
    return client.read(settings.base_url, _token(settings), sensor_ids)


def _token(settings: Settings) -> str:
    return settings.token.get_secret_value().strip()
