from typing import Any

import apprise
import pytest

from sunfleck.notifications import delivery


class FakeEntry:
    def __init__(self, message: str) -> None:
        self.message = message


def test_supported_addresses() -> None:
    assert delivery.is_supported("ntfy://ntfy.sh/plants")
    assert delivery.is_supported("tgram://123456:ABCdef/987654")
    assert not delivery.is_supported("pager://555")
    assert delivery.service_of("NTFY://ntfy.sh/plants") == "ntfy"


def test_a_message_is_sent(monkeypatch: pytest.MonkeyPatch) -> None:
    sent: list[dict[str, Any]] = []

    def notify(self: apprise.Apprise, **kwargs: Any) -> bool:
        sent.append(kwargs)
        return True

    monkeypatch.setattr(apprise.Apprise, "notify", notify)

    delivery.send("ntfy://ntfy.sh/plants", "Title", "Body")

    assert (sent[0]["title"], sent[0]["body"], sent[0]["timeout"]) == ("Title", "Body", 15)


def test_a_refused_message_says_why(monkeypatch: pytest.MonkeyPatch) -> None:
    def notify(self: apprise.Apprise, **kwargs: Any) -> bool:
        kwargs["log_callback"](FakeEntry("A Connection error occurred sending ntfy."), None)
        return False

    monkeypatch.setattr(apprise.Apprise, "notify", notify)

    with pytest.raises(delivery.DeliveryError, match="A Connection error occurred"):
        delivery.send("ntfy://ntfy.sh/plants", "Title", "Body")


def test_unknown_addresses_are_refused() -> None:
    with pytest.raises(delivery.DeliveryError, match="isn't one Apprise knows"):
        delivery.send("pager://555", "Title", "Body")
