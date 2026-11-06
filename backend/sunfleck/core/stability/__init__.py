"""What Sunfleck promises to keep stable within a major version (docs/stability.md), as data.

`snapshot()` describes the HTTP API and the plugin interface as they are now. The baselines in
this folder are the same description at 1.0, extended by `make stability-baseline` as things are
added; `core/tests/test_stability.py` checks nothing in them has gone or changed.
"""

import dataclasses
import inspect
import json
from pathlib import Path
from typing import Any

BASELINE_DIR = Path(__file__).parent
API_BASELINE = BASELINE_DIR / "api-v1.json"
PLUGINS_BASELINE = BASELINE_DIR / "plugins-v1.json"

# The Sunfleck objects hooks receive, whose fields plugins may read.
HOOK_MODELS = [
    "accounts.Household",
    "accounts.Membership",
    "care.CareEvent",
    "care.CareType",
    "places.Site",
    "plants.Plant",
]

Snapshot = dict[str, Any]


def api_snapshot() -> Snapshot:
    """Every endpoint of /api/v1/, with its request fields and its response fields and types.

    Fields are paths into the JSON, e.g. `photos[].id`; parameters are `path:...` and `query:...`.
    Plugins' own endpoints aren't part of Sunfleck's API, so they're left out.
    """
    from sunfleck.config.api import api

    # Round-tripped through JSON, as clients see it (status codes become strings).
    schema = json.loads(json.dumps(api.get_openapi_schema()))
    components = schema.get("components", {}).get("schemas", {})
    endpoints: Snapshot = {}
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            if any(tag.startswith("plugin: ") for tag in operation.get("tags", [])):
                continue
            endpoints[f"{method.upper()} {path}"] = {
                "request": _request(operation, components),
                "response": _response(operation, components),
            }
    return dict(sorted(endpoints.items()))


def plugins_snapshot() -> Snapshot:
    """What plugin API version 1 offers: exported names, hooks' arguments, and readable fields."""
    from django.apps import apps

    import sunfleck.plugins
    from sunfleck.plugins import hookspecs

    types = {}
    for name in sunfleck.plugins.__all__:
        exported = getattr(sunfleck.plugins, name)
        if dataclasses.is_dataclass(exported):
            types[name] = sorted(field.name for field in dataclasses.fields(exported))
    hooks = {
        name: list(inspect.signature(function).parameters)
        for name, function in inspect.getmembers(hookspecs, inspect.isfunction)
        if hasattr(function, f"{hookspecs.PROJECT}_spec")
    }
    models = {
        label: sorted(
            field.name
            for field in apps.get_model(label)._meta.get_fields()
            if getattr(field, "concrete", False)
        )
        for label in HOOK_MODELS
    }
    return {
        "api_version": sunfleck.plugins.API_VERSION,
        "exports": sorted(sunfleck.plugins.__all__),
        "hooks": dict(sorted(hooks.items())),
        "types": dict(sorted(types.items())),
        "models": models,
    }


def write_baselines() -> None:
    for path, snapshot in ((API_BASELINE, api_snapshot()), (PLUGINS_BASELINE, plugins_snapshot())):
        path.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n")


def load(path: Path) -> Snapshot:
    data: Snapshot = json.loads(path.read_text())
    return data


def api_breaks(baseline: Snapshot, current: Snapshot) -> list[str]:
    """What a client written against `baseline` would find missing or different in `current`.

    A response field may only narrow its type (e.g. stop being null), and a request field may
    only widen it (e.g. start accepting null).
    """
    problems = []
    for endpoint, before in baseline.items():
        now = current.get(endpoint)
        if now is None:
            problems.append(f"{endpoint}: gone")
            continue
        for part, before_fields, now_fields, narrows in (
            ("response", before["response"], now["response"], True),
            ("request", before["request"]["fields"], now["request"]["fields"], False),
        ):
            for field, kind in before_fields.items():
                if field not in now_fields:
                    problems.append(f"{endpoint}: {part} field {field} gone")
                    continue
                was, is_now = set(kind.split("|")), set(now_fields[field].split("|"))
                if not (is_now <= was if narrows else is_now >= was):
                    problems.append(
                        f"{endpoint}: {part} field {field} is {now_fields[field]}, was {kind}"
                    )
        problems.extend(
            f"{endpoint}: request field {field} is now required"
            for field in sorted(
                set(now["request"]["required"]) - set(before["request"]["required"])
            )
        )
    return problems


def plugin_breaks(baseline: Snapshot, current: Snapshot) -> list[str]:
    """What a plugin written against `baseline` would find missing or different in `current`."""
    problems = []
    if current["api_version"] != baseline["api_version"]:
        problems.append(f"API_VERSION is {current['api_version']}, was {baseline['api_version']}")
    problems.extend(
        f"sunfleck.plugins.{name} gone"
        for name in baseline["exports"]
        if name not in current["exports"]
    )
    for hook, arguments in baseline["hooks"].items():
        if hook not in current["hooks"]:
            problems.append(f"hook {hook} gone")
        else:
            problems.extend(
                f"hook {hook}: argument {argument} gone"
                for argument in arguments
                if argument not in current["hooks"][hook]
            )
    for group in ("types", "models"):
        for name, fields in baseline[group].items():
            now = current[group].get(name)
            if now is None:
                problems.append(f"{name} gone")
            else:
                problems.extend(f"{name}.{field} gone" for field in fields if field not in now)
    return problems


def _request(operation: Snapshot, components: Snapshot) -> Snapshot:
    fields: dict[str, str] = {}
    required: list[str] = []
    for parameter in operation.get("parameters", []):
        name = f"{parameter['in']}:{parameter['name']}"
        fields[name] = _type(parameter.get("schema", {}), components)
        if parameter.get("required"):
            required.append(name)
    body = operation.get("requestBody")
    if body:
        for content in body["content"].values():
            schema = _resolve(content["schema"], components)
            _walk(schema, "", components, fields, set())
            required.extend(schema.get("required", []))
    return {"fields": dict(sorted(fields.items())), "required": sorted(set(required))}


def _response(operation: Snapshot, components: Snapshot) -> dict[str, str]:
    fields: dict[str, str] = {}
    for status, response in operation.get("responses", {}).items():
        if not status.startswith("2"):
            continue
        for content in response.get("content", {}).values():
            schema = _resolve(content["schema"], components)
            fields["(body)"] = _type(schema, components)
            _walk(schema, "", components, fields, set())
    return dict(sorted(fields.items()))


def _walk(
    schema: Snapshot, prefix: str, components: Snapshot, fields: dict[str, str], seen: set[str]
) -> None:
    """Add every field under `schema` to `fields`, as `prefix.name` (`[]` for array items)."""
    for option in schema.get("anyOf", []) + schema.get("allOf", []) + schema.get("oneOf", []):
        _walk(_follow(option, components, seen), prefix, components, fields, seen)
    if "items" in schema:
        _walk(_follow(schema["items"], components, seen), f"{prefix}[]", components, fields, seen)
    for name, child in schema.get("properties", {}).items():
        path = f"{prefix}.{name}" if prefix else name
        fields[path] = _type(child, components)
        _walk(_follow(child, components, seen), path, components, fields, seen)


def _follow(schema: Snapshot, components: Snapshot, seen: set[str]) -> Snapshot:
    """The schema a $ref points to, once per branch, so self-referencing schemas end."""
    ref = schema.get("$ref")
    if ref is None:
        return schema
    if ref in seen:
        return {}
    seen.add(ref)
    return _resolve(schema, components)


def _resolve(schema: Snapshot, components: Snapshot) -> Snapshot:
    ref = schema.get("$ref")
    resolved: Snapshot = components[ref.rsplit("/", 1)[-1]] if ref else schema
    return resolved


def _type(schema: Snapshot, components: Snapshot) -> str:
    """A field's JSON type, e.g. `integer`, `string|null` or `array`."""
    schema = _resolve(schema, components)
    options = schema.get("anyOf") or schema.get("oneOf")
    if options:
        return "|".join(sorted({_type(option, components) for option in options}))
    if "type" in schema:
        kind = schema["type"]
        return "|".join(sorted(kind)) if isinstance(kind, list) else str(kind)
    if "properties" in schema or "allOf" in schema:
        return "object"
    return "any"
