# Writing a Sunfleck plugin

A plugin is a normal Python package that adds a feature to Sunfleck, such as weather. Plugins
use the **plugin API, version 1**, which is everything in the `sunfleck.plugins` package.
Sunfleck's built-in plugins are packaged and installed exactly the same way as yours.

> Status: the plugin API arrived in milestone M8. It may still change before v1.0, but changes
> that break plugins will raise its version (see [Versions](#versions)).

## 1. The package

```
sunfleck-plugin-example/
├── pyproject.toml
└── sunfleck_plugin_example/
    ├── __init__.py      # the PluginInfo (no Django imports here)
    ├── hooks.py         # the hook implementations
    ├── apps.py          # only if the plugin has its own models
    ├── models.py
    ├── migrations/
    └── tests/
```

Declare the plugin in `pyproject.toml` with an entry point in the `sunfleck.plugins` group:

```toml
[project]
name = "sunfleck-plugin-example"
version = "0.1.0"
dependencies = []  # Sunfleck itself isn't a dependency: the plugin runs inside it

[project.entry-points."sunfleck.plugins"]
example = "sunfleck_plugin_example:plugin"
```

## 2. Describing the plugin

`__init__.py` describes the plugin. Sunfleck reads it while Django is still starting up, so it
must not import Django models (importing `sunfleck.plugins` is fine).

```python
from pydantic import BaseModel, Field

from sunfleck.plugins import PluginInfo


class Settings(BaseModel):
    threshold_mm: int = Field(default=5, ge=1, le=50, title="Rain threshold (mm)")


plugin = PluginInfo(
    id="example",                      # lowercase letters, digits and underscores
    name="Example",
    version="0.1.0",
    api_version="1",                   # the plugin API version it was built for
    description="Puts watering off after rain.",
    django_app="sunfleck_plugin_example",  # only if it has models
    hooks="sunfleck_plugin_example.hooks",
    settings_schema=Settings,
    sends_data_to=("rain.example.com: each site's latitude and longitude",),
)
```

- **`settings_schema`** is a Pydantic model. Admins change the settings on the **Plugins** page,
  in a form made from the model: numbers (with `ge`/`le` limits), yes/no, choices (an `Enum`),
  and text. Give each field a `title`, and a `description` if it needs explaining.
- **`sends_data_to`** must list every outside service the plugin contacts, and exactly what
  it sends. Admins see this before turning the plugin on.
- **Plugins are off until an Admin turns them on**, for each household. Only set
  `enabled_by_default=True` for plugins that don't send data anywhere.

## 3. Hooks

Hooks are functions Sunfleck calls; implement the ones you need in the `hooks` module, marked
with `@hookimpl`. A hook may leave out arguments it doesn't use.

```python
from datetime import timedelta

from sunfleck.plugins import Adjustment, CareContext, Factor, hookimpl


@hookimpl
def care_factors(context: CareContext, settings: Settings) -> list[Adjustment]:
    if context.site is None or context.conditions.indoor:
        return []
    rain_mm = ...  # e.g. from the plugin's own table
    if rain_mm < settings.threshold_mm:
        return []
    return [
        Adjustment(
            Factor("example_rain", details={"mm": rain_mm}),
            not_before=context.today + timedelta(days=2),
        )
    ]
```

| Hook | Called | Returns |
|---|---|---|
| `care_factors(context, settings)` | When a plant's predicted watering is calculated | `Adjustment`s: a `Factor` (its `multiplier` changes the interval, its `details` explain it, and must be JSON) and, optionally, a day before which watering isn't due |
| `site_conditions(site, settings)` | For the Today page | `SiteConditions` (temperatures, precipitation, a WMO weather code, alerts such as frost), or None |
| `on_care_event_logged(event, settings)` | After care is logged | Nothing |
| `on_plant_created(plant, settings)` | After a plant is added | Nothing |
| `register_api(router)` | Once, at startup | Nothing: add endpoints to the Django Ninja `router`, served under `/api/v1/plugins/<id>/` |
| `register_periodic_jobs()` | Once, at startup (from M9) | `PeriodicJob`s to run in the background |

- Hooks are only called for households that turned the plugin on, with that household's
  `settings` (None if the plugin has no settings). `register_api` and `register_periodic_jobs`
  run once for everyone.
- **Endpoints must check access**: start each one with `require_enabled(request, "example")`,
  which returns the signed-in member and refuses households that haven't turned the plugin on.
- **Fail gracefully.** If a hook raises an exception, Sunfleck logs it, shows it to Admins on
  the Plugins page, and carries on without that plugin's answer. Still, prefer catching
  expected failures (a service being down) yourself and returning nothing.
- After your data changes what a prediction would say (e.g. new weather), call
  `mark_site_out_of_date(site)` so the site's plants are recalculated.
- The app explains a factor by its `code`; codes it doesn't know are shown as they are, until
  the app learns to explain them (plugins can't add translations yet).

## 4. Models and settings storage

A plugin with `django_app` has its own Django app: its models get their own tables and
migrations, which `migrate` applies like Sunfleck's own. Name tables after the plugin (Django
does this by default) and don't change Sunfleck's tables.

## 5. Installing

Install the package into Sunfleck's Python environment and restart:

```bash
uv pip install sunfleck-plugin-example   # or pip install
python manage.py migrate                 # if it has models
```

Docker images will document a two-line `Dockerfile` for this. If a plugin can't be loaded (it
fails to import, or was built for another plugin API version), Sunfleck starts without it and
shows the reason on the Plugins page.

## 6. Testing

Test hooks like any Django code. In Sunfleck's own test suite, a plugin can be added and removed
around a test:

```python
from sunfleck.plugins.registry import registry

registry.add(plugin, hooks_module)
...
registry.remove(plugin.id)
```

## Versions

`api_version` is the plugin API version a plugin was built for. Sunfleck only loads plugins
built for its current major version (`1`). New hooks and new optional fields don't change the
major version; removing or changing anything does, after at least one minor release in which
the old way still works and is deprecated.
