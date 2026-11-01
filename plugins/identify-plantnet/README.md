# Plant identification (Pl@ntNet)

A built-in [Sunfleck](../../README.md) plugin: identify a plant from a photo when adding it,
with [Pl@ntNet](https://plantnet.org), a citizen-science project that recognizes tens of
thousands of species.

## Setting it up

1. Create a free account at [my.plantnet.org](https://my.plantnet.org) and copy your API key
   from its settings. The free plan allows 500 identifications a day.
2. In Sunfleck, as an Admin: **Plugins** → **Plant identification (Pl@ntNet)**: turn it on,
   paste the key and save. The key is stored encrypted and never shown again. **Test**
   checks that Pl@ntNet accepts the key, by sending it a blank grey image. That may count as
   one of the day's identifications.
3. When adding a plant, choose a photo and press **Identify from the photo**. Close-ups of a
   leaf or flower work best.

## What it sends

Only when someone asks for an identification, to `my-api.plantnet.org`:
- the chosen photo, as a JPEG of at most 1280 px **without its metadata**, so not where it was
  taken;
- the person's language, for common names;
- the API key.

**Test** sends only a blank grey image, the key and English as the language.

Pl@ntNet's own terms apply to what it does with them: see [my.plantnet.org](https://my.plantnet.org).

## Development

The plugin uses only the Python standard library. Its tests replace the call to Pl@ntNet with
a fake (`FakePlantNet` in `tests/test_plantnet.py`), so they run offline; they're run with the
backend's (`make test`).
