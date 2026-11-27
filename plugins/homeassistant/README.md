# Home Assistant for Sunfleck

A built-in [Sunfleck](../../README.md) plugin that reads sensors you already have in
[Home Assistant](https://www.home-assistant.io): a plant's soil moisture, and the light,
temperature and humidity around it.

- **Soil moisture** from plant sensors, such as a Xiaomi Mi Flora or a Zigbee soil sensor:
  Home Assistant entities `sensor.…` with the device class `moisture`.
- **Light** (`illuminance`, in lx), **temperature** (`temperature`, in °C; °F is converted)
  and **humidity** (`humidity`, in %): e.g. from a room's climate sensor, a weather station,
  or your phone's companion app.

Other entities (lights, switches, `binary_sensor.…` leak sensors, batteries) aren't offered.

## Setting it up

1. **Make an access token in Home Assistant.** Open your profile (your name, bottom left),
   then the **Security** tab. Under **Long-lived access tokens**, choose **Create token**,
   name it e.g. "Sunfleck", and copy it: Home Assistant shows it only once. A token can do
   what your Home Assistant user can, so you may prefer a separate, non-admin user for
   Sunfleck.
2. **In Sunfleck, as an Admin:** **Plugins** → **Home Assistant**: turn it on, and fill in
   - **Server address**: the address you open Home Assistant at, such as
     `http://homeassistant.local:8123` or `https://ha.example.org`. With Docker, use the
     address of the computer running Home Assistant as seen from Sunfleck's container (not
     `localhost`, which is the container itself). If `homeassistant.local` isn't found from
     the container, use its IP address, e.g. `http://192.168.1.20:8123`.
   - **Access token**: the token from step 1. It's stored encrypted and never shown again.
     If you change the server address, enter the token again: Sunfleck never sends a token
     to an address other than the one it was saved with.
3. **Test** connects to Home Assistant with the settings in the form, before you save them,
   and says how many sensors it found, or what went wrong (an address it can't reach, a
   refused token). Then save.

Gardeners and Admins then choose a sensor of each kind for a plant on its page.

## What it sends

To the Home Assistant server you set, and nowhere else: **the access token**, and **the ids
of the sensors being read** (e.g. `sensor.monstera_soil_moisture`). Nothing about your
plants or household leaves Sunfleck.

- Every 15 minutes, while a plant uses one of its sensors, the worker reads them.
- When a Gardener or Admin chooses a sensor, and when an Admin clicks **Test**, it asks Home Assistant
  for the list of its entities.

If Home Assistant can't be reached or refuses the token, Admins see the error on the Plugins
page, and the plant keeps its latest reading.

## How it works

It uses Home Assistant's [REST API](https://developers.home-assistant.io/docs/api/rest/):

- **Test:** `GET /api/` (Home Assistant answers "API running."), then `GET /api/states` to
  count the sensors.
- **Choosing a sensor:** `GET /api/states`, keeping `sensor.` entities with one of the device
  classes above. The name shown is the entity's friendly name (or its id), sorted by name.
- **Reading:** for up to 10 sensors, `GET /api/states/<entity_id>` for each. For more, one
  `GET /api/states`, which has every entity Home Assistant knows (often hundreds of KB):
  a few small requests are cheaper for a Raspberry Pi than that list every 15 minutes, until
  there are about 10 of them.
- **Values:** the entity's state as a number; °F is converted to °C. `unavailable`, `unknown`
  or a state that isn't a number is read as no value.
  The time of a reading is when the sensor last reported (`last_reported`, Home Assistant
  2024.7 and later), or else when its value last changed (`last_updated`). Sensors Home
  Assistant no longer has are left out.

## Development

The plugin uses only the Python standard library. Its tests replace the request with a fake
Home Assistant (`FakeServer` in `tests/test_client.py`), so they run offline; they're run with
the backend's (`make test`).

## License

AGPL-3.0, like Sunfleck.
