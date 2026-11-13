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
| The latest minor release (now 0.9) | Yes |
| Older releases | No |

## What's in scope

Sunfleck itself and the plugins in this repository: for example getting into another
household's plants, signing in without a password, or reading the secrets plugins keep, such as
API keys. Problems in the software Sunfleck depends on are best reported to that project; tell
us too if Sunfleck needs an update for it.

## How Sunfleck is protected, and what to know

Sunfleck is meant for one household and the people it invites, on a server the household
runs. What it does to keep that safe, and what the people running it should know:

- **Households are kept apart.** Every request is checked against the person's household
  and role (Viewer, Gardener, Admin). Photos and avatars are served only to members, and
  exports only to Admins.
- **Signing in** is by email and password, with limits on failed attempts. There's no
  sign-up: the first account is made on the setup page, and everyone else is invited. Finish
  the setup as soon as Sunfleck is running, before it can be reached from elsewhere: until
  then, whoever opens it first becomes its Admin.
- **The Django admin site** (`/admin/`) is open only to the first account. It has no sign-in
  form of its own: sign in to Sunfleck first. Because that account reaches every household,
  other Admins can't make a password-reset link for it or remove it.
- **Over HTTPS** (with `SUNFLECK_BEHIND_PROXY=true`), cookies are only ever sent over HTTPS.
  Every page carries a Content-Security-Policy that allows only Sunfleck's own scripts.
- **Secrets** (notification addresses, plugins' API keys) are stored encrypted with
  `SUNFLECK_ENCRYPTION_KEY`, are never shown again, and aren't exported.
- **Uploads** are checked to be images, limited to 20 MB, and stored again without their
  metadata (such as where a photo was taken).
- **Sunfleck contacts the addresses people give it,** as it's meant to:
  - every member can add notification addresses (Apprise URLs), and Sunfleck sends to
    them, including addresses on your own network (a ntfy or Gotify server, say). Devices
    for Web Push can only use the push services browsers use, and what a push service
    answers is never shown, only its status;
  - Admins set the servers that plugins use, such as an AI model on your network.

  So someone you invite could make the server send requests to other machines on your
  network. Invite people you trust, as you would with a key to the house.
- **Plugins** run inside Sunfleck with its full access, like any software you install: use the
  built-in ones, or ones you trust. They're off until an Admin turns them on, and each says
  exactly what it sends where.
