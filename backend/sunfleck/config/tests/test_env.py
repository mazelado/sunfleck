import pytest

from sunfleck.config.env import env_bool, env_list, env_str


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
