# Security policy

## Reporting a vulnerability

Please report security problems **privately**, not in a public issue:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**, and describe the problem and how to reproduce it.

Only the maintainer can read the report. You'll get an answer within a week or so: Sunfleck is
a household project, looked after in spare time. Once a fix is released, the advisory is
published, crediting you if you'd like.

## Supported versions

Fixes go into the latest release only, as a patch release (for example 0.5.1). Keep your
install up to date: see [upgrading](docs/install.md#upgrading).

| Version | Gets security fixes |
|---|---|
| The latest minor release (now 0.5) | Yes |
| Older releases | No |

## What's in scope

Sunfleck itself and the plugins in this repository: for example getting into another
household's plants, signing in without a password, or reading the secrets plugins keep, such as
API keys. Problems in the software Sunfleck depends on are best reported to that project; tell
us too if Sunfleck needs an update for it.
