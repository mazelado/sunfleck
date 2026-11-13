"""Paging for lists that grow with use but are usually read whole (the wishlist, seeds, a
plant's harvests and conversations).

They answer `{"items": [...], "count": n}` like the paged lists (plants, photos, the
timeline), so a client can page them, but return everything up to a generous `limit` by
default, so a client that doesn't page gets the whole list as long as it's an ordinary size.
"""

from django.db.models import Model, QuerySet
from ninja import Schema
from pydantic import Field

# The most a list answers at once, and what it answers when no `limit` is given.
MAX_LIST_LIMIT = 500


class ListQuery(Schema):
    limit: int = Field(
        default=MAX_LIST_LIMIT,
        ge=1,
        le=MAX_LIST_LIMIT,
        description=f"How many to return; everything up to {MAX_LIST_LIMIT} by default.",
    )
    offset: int = Field(default=0, ge=0, description="How many to skip.")


def paginate[M: Model](queryset: QuerySet[M], query: ListQuery) -> tuple[list[M], int]:
    """The items on the requested page, and how many there are in all."""
    items = list(queryset[query.offset : query.offset + query.limit])
    if query.offset == 0 and len(items) < query.limit:
        return items, len(items)  # the whole list: no need to count it
    return items, queryset.count()
