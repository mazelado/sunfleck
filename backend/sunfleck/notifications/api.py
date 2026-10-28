"""Notifications API: each person's channels (where reminders go) and when they get them.

Everyone in a household sets up their own notifications. Channel URLs are secrets, so they're
never sent back: only the kind of service.
"""

from datetime import datetime, time

from django.http import HttpRequest
from ninja import Router, Schema, Status
from ninja.security import django_auth
from pydantic import Field

from sunfleck.accounts.models import Role, User
from sunfleck.accounts.permissions import require_role
from sunfleck.core.errors import ApiError
from sunfleck.notifications import services
from sunfleck.notifications.models import NotificationChannel, NotificationPreferences

router = Router(tags=["notifications"], auth=django_auth)


class PreferencesSchema(Schema):
    digest_time: time = Field(description="When the daily digest is sent, in `timezone`.")
    reminder_time: time | None = Field(
        description="An evening reminder of what's still due; none for no reminder."
    )
    timezone: str = Field(max_length=64)


class ChannelOut(Schema):
    id: int
    label: str
    service: str = Field(description="The kind of service, e.g. `ntfy`, `tgram`, `mailto`.")
    enabled: bool
    last_sent_at: datetime | None
    last_error: str | None


class NotificationsOut(Schema):
    preferences: PreferencesSchema
    channels: list[ChannelOut]


class ChannelIn(Schema):
    label: str = Field(min_length=1, max_length=100)
    url: str = Field(
        min_length=3, max_length=2000, description="An Apprise URL, e.g. ntfy://ntfy.sh/my-plants"
    )


class ChannelUpdateIn(Schema):
    label: str = Field(min_length=1, max_length=100)
    enabled: bool
    url: str | None = Field(default=None, max_length=2000, description="Leave out to keep it.")


class MessageOut(Schema):
    title: str
    body: str


class PreviewOut(Schema):
    message: MessageOut | None = Field(description="None when there's nothing to tell.")


def _channel_out(channel: NotificationChannel) -> ChannelOut:
    return ChannelOut(
        id=channel.pk,
        label=channel.label,
        service=channel.service,
        enabled=channel.enabled,
        last_sent_at=channel.last_sent_at,
        last_error=channel.last_error or None,
    )


def _preferences_out(preferences: NotificationPreferences) -> PreferencesSchema:
    return PreferencesSchema(
        digest_time=preferences.digest_time,
        reminder_time=preferences.reminder_time,
        timezone=preferences.timezone,
    )


def _error(exc: services.NotificationError) -> ApiError:
    return ApiError(422, exc.code, str(exc), {"field": exc.field} if exc.field else {})


def _user(request: HttpRequest) -> User:
    return require_role(request, Role.VIEWER).user


def _get_channel(user: User, channel_id: int) -> NotificationChannel:
    channel = user.notification_channels.filter(pk=channel_id).first()
    if channel is None:
        raise ApiError(404, "channel_not_found", "This channel doesn't exist.")
    return channel


@router.get("/notifications", response=NotificationsOut)
def get_notifications(request: HttpRequest) -> NotificationsOut:
    """The signed-in person's notification channels and preferences."""
    user = _user(request)
    return NotificationsOut(
        preferences=_preferences_out(services.preferences_for(user)),
        channels=[_channel_out(channel) for channel in user.notification_channels.all()],
    )


@router.put("/notifications/preferences", response=PreferencesSchema)
def update_preferences(request: HttpRequest, data: PreferencesSchema) -> PreferencesSchema:
    try:
        preferences = services.update_preferences(
            _user(request), services.PreferencesData(**data.model_dump())
        )
    except services.NotificationError as exc:
        raise _error(exc) from exc
    return _preferences_out(preferences)


@router.post("/notifications/channels", response={201: ChannelOut})
def add_channel(request: HttpRequest, data: ChannelIn) -> Status[ChannelOut]:
    """Add somewhere to send notifications, as an Apprise URL."""
    try:
        channel = services.add_channel(_user(request), data.label, data.url)
    except services.NotificationError as exc:
        raise _error(exc) from exc
    return Status(201, _channel_out(channel))


@router.put("/notifications/channels/{channel_id}", response=ChannelOut)
def update_channel(request: HttpRequest, channel_id: int, data: ChannelUpdateIn) -> ChannelOut:
    channel = _get_channel(_user(request), channel_id)
    try:
        services.update_channel(channel, data.label, data.enabled, data.url)
    except services.NotificationError as exc:
        raise _error(exc) from exc
    return _channel_out(channel)


@router.delete("/notifications/channels/{channel_id}", response={204: None})
def delete_channel(request: HttpRequest, channel_id: int) -> Status[None]:
    _get_channel(_user(request), channel_id).delete()
    return Status(204, None)


@router.post("/notifications/channels/{channel_id}/test", response=ChannelOut)
def test_channel(request: HttpRequest, channel_id: int) -> ChannelOut:
    """Send a test message now."""
    channel = _get_channel(_user(request), channel_id)
    try:
        services.send_test(channel)
    except services.NotificationError as exc:
        raise _error(exc) from exc
    return _channel_out(channel)


@router.get("/notifications/preview", response=PreviewOut)
def preview(request: HttpRequest) -> PreviewOut:
    """What today's digest would say, if it were sent now."""
    message = services.preview(_user(request))
    return PreviewOut(
        message=MessageOut(title=message.title, body=message.body) if message else None
    )
