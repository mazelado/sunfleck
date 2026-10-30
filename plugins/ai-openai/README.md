# AI (OpenAI-compatible)

A built-in [Sunfleck](../../README.md) plugin: suggestions from an AI model, through any
service with OpenAI's chat completions API. That includes OpenAI itself, and models you run
yourself with [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai), in which case
nothing leaves your network.

AI is always optional in Sunfleck: everything works without it, and it's only asked when you
ask for a suggestion (e.g. a care profile for an unusual plant), which you review before it's
used.

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

The API key is stored encrypted and never shown again.

## What it sends

Only when someone asks for a suggestion, to the server you set: Sunfleck's question (for a
care profile: the plant's species and family, and whether it grows indoors or outdoors), the
instructions for the answer, and the API key. The service's own terms apply to what it does
with them.

## How it works

It asks for an answer as JSON matching a schema (`response_format` of type `json_schema`).
Servers that don't support that are asked again for plain JSON, with the schema in the
instructions. Sunfleck checks every answer against the schema before using it.

## Development

The plugin uses only the Python standard library. Its tests replace the call to the service
with a fake (`FakeServer` in `tests/test_client.py`), so they run offline; they're run with
the backend's (`make test`).
