# AI (Claude)

A built-in [Sunfleck](../../README.md) plugin: suggestions from Anthropic's Claude models,
through the [Claude API](https://platform.claude.com/docs), with your own API key.

AI is always optional in Sunfleck: everything works without it, and it's only asked when you
ask: for a care profile for an unusual plant, or what's wrong with a plant from a photo of it.
Its answers are suggestions, which you review before acting on them.

## Setting it up

1. Get an API key at [console.anthropic.com](https://console.anthropic.com), under **API
   keys**. Requests are billed to the account, per use; set a spending limit there if you
   like.
2. In Sunfleck, as an Admin: **Plugins** → **AI (Claude)**: turn it on, paste the API key, and
   save.

| Setting | |
|---|---|
| API key | From console.anthropic.com. Stored encrypted and never shown again. |
| Model | `claude-sonnet-5-5` by default. `claude-haiku-5-5` costs less and is quicker; `claude-opus-5-5` is the most capable, and costs more. |

**Test** asks Claude a tiny question with the settings in the form, before you save them, and
says what went wrong if it doesn't answer: a refused key, a model that doesn't exist, a used-up
rate limit or credit balance, or no connection to `api.anthropic.com`.

## What it sends

Only when someone asks (or an Admin clicks **Test**, which sends a tiny question of its own),
to `api.anthropic.com`: Sunfleck's question, the instructions for the answer, and the API key.

- For a care profile: the plant's species and family, and whether it grows indoors or
  outdoors.
- For **What's wrong?**: the photo taken for it (made smaller, without its location data),
  what the person wrote, and the plant's details: its name, species, care profile, place
  (indoors or outdoors, temperature, humidity, light), pot, schedules, recent care and notes. Anthropic's terms for the API apply to what it does with them.

## How it works

It uses Anthropic's official Python SDK (`anthropic`) and asks for an answer as JSON matching
a schema (structured outputs). Sunfleck checks every answer against the schema before using
it.

- Sunfleck's questions are short, so it asks the current models to think little
  (`effort: low`), which keeps them quick and cheap; a little more (`medium`) for a photo.
- On the current models, a question one of Anthropic's safety classifiers declines is
  retried on Anthropic's recommended fallback model (`fallbacks: "default"`); the
  suggestion then says which model answered.
- Older models you set yourself are asked without either option, so they still work.

## Development

Its tests answer the SDK's requests with a fake API (`FakeApi` in
`tests/test_client.py`), through the SDK's own client, so they run offline and also cover how
the SDK builds requests and reports errors. They're run with the backend's (`make test`).
