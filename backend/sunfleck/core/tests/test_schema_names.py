from collections import defaultdict

from ninja import Schema

import sunfleck.config.api  # noqa: F401 - every router and its schemas


def test_api_schemas_have_unique_names() -> None:
    # The OpenAPI schema (and the frontend's types) name schemas by their class name: two with
    # the same name silently become one, e.g. the iCal feed's and the sowing calendar's.
    modules: dict[str, set[str]] = defaultdict(set)

    def walk(cls: type[Schema]) -> None:
        for subclass in cls.__subclasses__():
            modules[subclass.__name__].add(subclass.__module__)
            walk(subclass)

    walk(Schema)

    assert {name: found for name, found in modules.items() if len(found) > 1} == {}
