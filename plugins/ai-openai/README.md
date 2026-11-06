# AI (OpenAI-compatible)

A built-in [Sunfleck](../../README.md) plugin: suggestions from an AI model, through any
service with OpenAI's chat completions API. That includes OpenAI itself, and models you run
yourself with [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai), in which case
nothing leaves your network.

AI is always optional in Sunfleck: everything works without it, and it's only asked when you
ask: for a care profile for an unusual plant, what's wrong with a plant from a photo of it,
or a question about a plant.
Its answers are suggestions, which you review before acting on them.

## Setting it up

In Sunfleck, as an Admin: **Plugins** → **AI (OpenAI-compatible)**: turn it on, fill in the
settings below, and save.

| Service | Server address | Model | API key |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` (the default) | e.g. `gpt-4.1-mini` | From platform.openai.com |
| Ollama | `http://<computer>:11434/v1` | A model you pulled, e.g. `qwen2.5:7b` | Leave empty |
| LM Studio | `http://<computer>:1234/v1` | The model loaded in LM Studio | Leave empty |

With Docker, `<computer>` is the address of the machine running Ollama as seen from
Sunfleck's container (not `localhost`, which is the container itself). Small models (under
about 7B parameters) may give poor suggestions.

**What's wrong?** sends a photo, so it needs a model that can look at images (a vision
model), such as `gpt-4.1-mini` on OpenAI, or `qwen2.5vl:7b` or `gemma3` on Ollama. With a
model that can't, Sunfleck says so.

The API key is stored encrypted and never shown again.

**Test** asks the model a tiny question with the settings in the form, before you save them,
and says what went wrong if it doesn't answer: a wrong address, a model the server doesn't
have, a refused key. A model that has to be loaded first can take a minute.

## What it sends

Only when someone asks (or an Admin clicks **Test**, which sends a tiny question of its own),
to the server you set: Sunfleck's question, the instructions for the answer, and the API key.

- For a care profile: the plant's species and family, and whether it grows indoors or
  outdoors.
- For **What's wrong?**: the photo taken for it (made smaller, without its location data),
  what the person wrote, and the plant's details: its name, species, care profile, place
  (indoors or outdoors, temperature, humidity, light), pot, schedules, recent care and notes.
- For **Ask about this plant**: the question, the latest part of the conversation (up to 20
  questions and answers), and the same details of the plant, without a photo.

The service's own terms apply to what it does with them.

## How it works

It asks for an answer as JSON matching a schema (`response_format` of type `json_schema`).
Servers that don't support that are asked again for plain JSON, with the schema in the
instructions. Sunfleck checks every answer against the schema before using it. Photos are
sent in the message as `image_url` data URLs.

## Development

The plugin uses only the Python standard library. Its tests replace the call to the service
with a fake (`FakeServer` in `tests/test_client.py`), so they run offline; they're run with
the backend's (`make test`).
