"""The promises in docs/stability.md: nothing in the API or the plugin interface goes or changes.

If one of these fails, a change would break clients or plugins: keep the old behaviour, or
deprecate it as docs/stability.md describes. After adding to either, run `make
stability-baseline` so the baselines include the new parts.
"""

import copy

import pytest

from sunfleck.core import stability


@pytest.fixture(scope="module")
def api() -> stability.Snapshot:
    return stability.api_snapshot()


@pytest.fixture(scope="module")
def plugins() -> stability.Snapshot:
    return stability.plugins_snapshot()


def test_the_api_keeps_everything_in_its_baseline(api: stability.Snapshot) -> None:
    assert stability.api_breaks(stability.load(stability.API_BASELINE), api) == []


def test_the_plugin_interface_keeps_everything_in_its_baseline(
    plugins: stability.Snapshot,
) -> None:
    assert stability.plugin_breaks(stability.load(stability.PLUGINS_BASELINE), plugins) == []


def test_the_baselines_are_up_to_date(api: stability.Snapshot, plugins: stability.Snapshot) -> None:
    # Additions are fine, but belong in the baselines, so that they're kept too.
    assert stability.load(stability.API_BASELINE) == api, "make stability-baseline"
    assert stability.load(stability.PLUGINS_BASELINE) == plugins, "make stability-baseline"


ENDPOINT: stability.Snapshot = {
    "GET /api/v1/things/{id}": {
        "request": {
            "fields": {"path:id": "integer", "query:sort": "string"},
            "required": ["path:id"],
        },
        "response": {"(body)": "object", "id": "integer", "name": "null|string"},
    }
}


def changed(change: str) -> stability.Snapshot:
    current = copy.deepcopy(ENDPOINT)
    endpoint = current["GET /api/v1/things/{id}"]
    match change:
        case "removed field":
            del endpoint["response"]["name"]
        case "response may now be null":
            endpoint["response"]["id"] = "integer|null"
        case "request field now required":
            endpoint["request"]["required"].append("query:sort")
        case "request field narrowed":
            endpoint["request"]["fields"]["query:sort"] = "null"
        case "endpoint gone":
            current.clear()
    return current


@pytest.mark.parametrize(
    ("change", "problem"),
    [
        ("removed field", "response field name gone"),
        ("response may now be null", "response field id is integer|null, was integer"),
        ("request field now required", "request field query:sort is now required"),
        ("request field narrowed", "request field query:sort is null, was string"),
        ("endpoint gone", "gone"),
    ],
)
def test_breaking_api_changes_are_found(change: str, problem: str) -> None:
    assert stability.api_breaks(ENDPOINT, changed(change)) == [
        f"GET /api/v1/things/{{id}}: {problem}"
    ]


def test_compatible_api_changes_pass() -> None:
    current = copy.deepcopy(ENDPOINT)
    endpoint = current["GET /api/v1/things/{id}"]
    endpoint["response"]["name"] = "string"  # no longer null
    endpoint["response"]["added"] = "boolean"
    endpoint["request"]["fields"]["query:sort"] = "null|string"  # now also accepts null
    endpoint["request"]["fields"]["query:filter"] = "string"
    current["POST /api/v1/things"] = {"request": {"fields": {}, "required": []}, "response": {}}

    assert stability.api_breaks(ENDPOINT, current) == []


def test_breaking_plugin_changes_are_found(plugins: stability.Snapshot) -> None:
    current = copy.deepcopy(plugins)
    current["api_version"] = "2"
    current["exports"].remove("hookimpl")
    current["hooks"]["care_factors"].remove("context")
    del current["hooks"]["frost_dates"]
    current["types"]["AiTask"].remove("prompt")
    del current["models"]["plants.Plant"]

    assert stability.plugin_breaks(plugins, current) == [
        "API_VERSION is 2, was 1",
        "sunfleck.plugins.hookimpl gone",
        "hook care_factors: argument context gone",
        "hook frost_dates gone",
        "AiTask.prompt gone",
        "plants.Plant gone",
    ]
