from pathlib import Path

from django.conf import settings

LOCALES = Path(settings.BASE_DIR).parent / "frontend" / "src" / "i18n" / "locales"


def test_the_server_and_the_app_offer_the_same_languages() -> None:
    """A language added to the app (a translation file) must be added to LANGUAGES too, so
    people can choose it and get emails and notifications in it; and the other way round."""
    app = sorted(path.stem for path in LOCALES.glob("*.json"))

    assert app, f"No translation files in {LOCALES}"
    assert sorted(code for code, _ in settings.LANGUAGES) == app
