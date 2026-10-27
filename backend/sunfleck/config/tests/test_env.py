import pytest

from sunfleck.config.env import env_bool, env_list, env_str, parse_email_url


def test_env_str_returns_value_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUNFLECK_TEST_VALUE", "hello")

    assert env_str("SUNFLECK_TEST_VALUE", "default") == "hello"


def test_env_str_returns_default_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUNFLECK_TEST_VALUE", raising=False)

    assert env_str("SUNFLECK_TEST_VALUE", "default") == "default"


@pytest.mark.parametrize("raw", ["1", "true", "True", " YES ", "on"])
def test_env_bool_recognizes_true_words(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("SUNFLECK_TEST_FLAG", raw)

    assert env_bool("SUNFLECK_TEST_FLAG") is True


@pytest.mark.parametrize("raw", ["0", "false", "No", "off", ""])
def test_env_bool_recognizes_false_words(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("SUNFLECK_TEST_FLAG", raw)

    assert env_bool("SUNFLECK_TEST_FLAG", default=True) is False


def test_env_bool_returns_default_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUNFLECK_TEST_FLAG", raising=False)

    assert env_bool("SUNFLECK_TEST_FLAG", default=True) is True


def test_env_bool_rejects_unknown_words(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUNFLECK_TEST_FLAG", "maybe")

    with pytest.raises(ValueError, match="SUNFLECK_TEST_FLAG must be true or false"):
        env_bool("SUNFLECK_TEST_FLAG")


def test_env_list_splits_and_trims_commas(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUNFLECK_TEST_HOSTS", " example.com, plants.local ,,")

    assert env_list("SUNFLECK_TEST_HOSTS") == ["example.com", "plants.local"]


def test_env_list_returns_copy_of_default_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUNFLECK_TEST_HOSTS", raising=False)
    default = ["localhost"]

    result = env_list("SUNFLECK_TEST_HOSTS", default)

    assert result == ["localhost"]
    assert result is not default


@pytest.mark.parametrize(
    ("url", "port", "use_tls", "use_ssl"),
    [
        ("smtp://mail.example.com", 25, False, False),
        ("smtp+tls://mail.example.com", 587, True, False),
        ("smtps://mail.example.com", 465, False, True),
        ("smtp+tls://mail.example.com:2525", 2525, True, False),
    ],
)
def test_parse_email_url_picks_port_and_encryption(
    url: str, port: int, use_tls: bool, use_ssl: bool
) -> None:
    options = parse_email_url(url)["OPTIONS"]

    assert options["host"] == "mail.example.com"
    assert (options["port"], options["use_tls"], options["use_ssl"]) == (port, use_tls, use_ssl)


def test_parse_email_url_decodes_credentials() -> None:
    options = parse_email_url("smtps://me%40example.com:p%40ss%2Fword@mail.example.com")["OPTIONS"]

    assert options["username"] == "me@example.com"
    assert options["password"] == "p@ss/word"


@pytest.mark.parametrize("url", ["http://mail.example.com", "smtp://", "mail.example.com"])
def test_parse_email_url_rejects_invalid_urls(url: str) -> None:
    with pytest.raises(ValueError, match="EMAIL_URL"):
        parse_email_url(url)
