# Translating Sunfleck

Sunfleck is written in English. Translations are welcome: you don't need to be a programmer,
only to edit text files (and, for the last step, to open a pull request; see
[CONTRIBUTING.md](../CONTRIBUTING.md)).

There are two parts to translate:

| Part | What it covers | File |
|---|---|---|
| **The app** | Everything on screen | `frontend/src/i18n/locales/<language>.json` |
| **The server** | Emails (invitations, password resets), notifications (the daily digest), and the Django admin | `backend/sunfleck/locale/<language>/LC_MESSAGES/django.po` |

Use the language's code: `de` for German, `nl` for Dutch, `pt-BR` for Brazilian Portuguese
(`pt_BR` in the server's folder name, as gettext writes it).

## Adding a language

1. **The app.** Copy `frontend/src/i18n/locales/en.json` to `<language>.json` and translate
   the texts (the parts after the colons). Keep:
   - the keys (before the colons) exactly as they are;
   - placeholders like `{{name}}` and `{{count}}`, which are replaced with names and numbers;
   - plural forms: English has `_one` and `_other` (e.g. `count_one`, `count_other`); use the
     forms your language needs, e.g. `_one`, `_few`, `_many` and `_other` in Polish. See
     [i18next's plural rules](https://www.i18next.com/translation-function/plurals).

   Texts you leave out are shown in English, so a partial translation is fine to start with.
2. **The server.** Run `make messages LOCALE=de` (with your language's code). It creates
   `backend/sunfleck/locale/de/LC_MESSAGES/django.po`: fill in each `msgstr ""` under its
   `msgid`. Keep placeholders like `%(name)s`. A tool such as [Poedit](https://poedit.net/)
   makes this easier.
3. **Tell Sunfleck about it.** Add the language to `LANGUAGES` in
   `backend/sunfleck/config/settings.py`, e.g. `("de", "Deutsch")`. (A test checks that the
   app's translation files and this list match.)
4. **Check it.** `make test` checks that the app's translation uses only keys and placeholders
   that exist in English, and `make lint` checks the server's (with
   [gettext](https://www.gnu.org/software/gettext/) installed; CI always does). Then run
   `make compile-messages` for the server's texts, run the app (`make dev`), choose your
   language under **Profile → Language**, and look around. Emails and notifications are sent
   in each person's language.

People choose their language in their profile; before signing in, the app uses the
browser's language if Sunfleck has it.

## Keeping a translation up to date

When English texts change, the app's file may have keys that no longer exist (the tests say
which) and is missing new ones (shown in English). English itself has no keys the app doesn't
use: `make lint` checks, so nobody translates a text that's never shown. For the server, run `make messages`: it
updates every `.po` file, marking changed texts as "fuzzy" for review.

## Spanish

Spanish (`es`) is one translation for every Spanish-speaking country, so:

- **Address people as _tú_**, as most apps do.
- **Use words understood everywhere**, and avoid ones from one country only: _dispositivo_, not
  _ordenador_ or _computadora_; _app_, not _aplicación móvil_.
- **Keep it short where space is tight** (the tab bar, buttons beside a plant's name), and check
  it on a 375px-wide phone: _Guía_ in the tab bar, _Luego_ for **Later**.
- **Roles keep one form**, as in the rest of the interface: _Admin_, _Jardinero_, _Lector_.

The same English word is always translated the same way:

| English | Spanish |
|---|---|
| Household | Hogar |
| Place; home or garden | Lugar; casa o jardín |
| Room or spot | Habitación o espacio |
| Garden bed | Bancal |
| Care; care type; care guide; care profile | Cuidados; tipo de cuidado; Guía de cuidados; perfil de cuidados |
| Water; watering | Regar; riego |
| Fertilize; fertilizer | Abonar; abono |
| Repot, prune, mist | Trasplantar, podar, pulverizar |
| Schedule; routine | Pauta; rutina |
| Resting season | Época de reposo |
| Snooze; put off | Posponer; aplazar |
| Log (care) | Registrar |
| Settings; plugin | Ajustes; complemento |
| Grow light | Lámpara de cultivo |
| Garden; Collection (parts of the app) | Jardín; Colección |
| Wishlist; seeds; harvest | Lista de deseos; semillas; cosecha |
| Turn on / off | Activar / desactivar |

## Not translated (yet)

- **Plant names and care profiles** come from the care dataset, which has its own
  translations: see [data/care/README.md](../data/care/README.md).
- **Plugin settings** are shown as the plugin describes them.
