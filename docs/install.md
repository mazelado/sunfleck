# Installing Sunfleck

Sunfleck runs as two containers from one Docker image: the app, and a worker for background
jobs (reminders, weather updates, the daily recalculation of due dates). Everything it stores, the
database and plant photos, is in one volume. It runs fine on a Raspberry Pi 4 or 5.

- [What you need](#what-you-need)
- [Install](#install)
- [Reach it from your phone (HTTPS)](#reach-it-from-your-phone-https)
- [Email](#email)
- [Notifications and plugins](#notifications-and-plugins)
- [Backups](#backups)
- [Upgrading](#upgrading)
- [PostgreSQL and Redis (optional)](#postgresql-and-redis-optional)
- [All settings](#all-settings)
- [Troubleshooting](#troubleshooting)

## What you need

- A computer that's always on: a home server, a NAS, a Raspberry Pi (64-bit OS), or a small
  cloud server. The images are for `linux/amd64` and `linux/arm64`.
- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin
  (`docker compose version` should work).
- For using it on your phone, and installing it as an app: an address with **HTTPS**, e.g.
  through a reverse proxy (see [below](#reach-it-from-your-phone-https)).

## Install

1. Make a folder for Sunfleck and download the Compose file and the example settings:

   ```bash
   mkdir sunfleck && cd sunfleck
   curl -fsSLO https://raw.githubusercontent.com/mazelado/sunfleck/main/docker/compose.yaml
   curl -fsSL https://raw.githubusercontent.com/mazelado/sunfleck/main/docker/env.example -o .env
   ```

2. Edit `.env`. At least:
   - `SECRET_KEY`: a long random string. Make one with `openssl rand -base64 48`.
   - `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` and `SUNFLECK_PUBLIC_URL`: the address you'll
     open Sunfleck at (see [All settings](#all-settings)). Just trying it on this computer?
     Leave them; `localhost` always works.
   - `TIME_ZONE`, e.g. `Europe/Berlin` or `America/Chicago`.

3. Start it:

   ```bash
   docker compose up -d
   ```

4. Make the key that encrypts stored secrets (such as notification addresses and plugins' API
   keys), put it in `.env` as `SUNFLECK_ENCRYPTION_KEY`, and restart:

   ```bash
   docker compose run --rm sunfleck manage encryption_key
   docker compose up -d
   ```

5. Open <http://localhost:8000> (or your address). The first visit shows the **setup page**:
   create your account, which becomes the household's Admin. Then invite the others from
   **Settings → Household** (the gear at the top).

`docker compose ps` shows whether it's running and healthy, and `docker compose logs -f`
follows what it's doing (Ctrl+C stops following, not Sunfleck).

## Reach it from your phone (HTTPS)

Sunfleck listens on port 8000 without HTTPS, reachable only from the computer it runs on.
Phones on your home network can open `http://<your-computer>:8000` once you set
`SUNFLECK_LISTEN_ADDRESS=0.0.0.0` in `.env` (and add that address to `ALLOWED_HOSTS` and, with
`http://`, to `CSRF_TRUSTED_ORIGINS`), but browsers only let you install it as an app over
HTTPS, and it should never be reachable from the internet without it. The usual way is a **reverse proxy**
in front of it that provides HTTPS. Then set, in `.env` (with your own address):

```
ALLOWED_HOSTS=plants.example.com
CSRF_TRUSTED_ORIGINS=https://plants.example.com
SUNFLECK_PUBLIC_URL=https://plants.example.com
SUNFLECK_BEHIND_PROXY=true
```

and run `docker compose up -d` again.

**Caddy** gets certificates automatically. A `Caddyfile`:

```
plants.example.com {
	request_body {
		max_size 25MB  # photos can be up to 20 MB
	}
	reverse_proxy localhost:8000
}
```

**Nginx** (with your own certificates):

```nginx
server {
    listen 443 ssl;
    server_name plants.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;
    client_max_body_size 25m;  # photos can be up to 20 MB

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # The visitor's own address, replacing any they sent: limits on failed sign-ins
        # count each person by it.
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

**Nginx Proxy Manager, Traefik** and the like work the same way: forward to port 8000, keep
the `Host` header, set `X-Forwarded-For` to the visitor's address, and allow uploads of at
least 25 MB. With the proxy in its own container, leave `SUNFLECK_LISTEN_ADDRESS` as it is and
have the proxy reach Sunfleck over a shared Docker network (`http://sunfleck:8000`).

**Only at home, without a domain?** [Tailscale](https://tailscale.com/) gives your server an
HTTPS address only your own devices can reach: `tailscale serve --bg 8000`. Use the address it
prints in `.env` as above.

### Installing it on your phone

Open Sunfleck in your phone's browser, then choose **Install app** in the account menu
(Android, and Chrome or Edge on a computer), or **Share → Add to Home Screen** in Safari on an
iPhone or iPad. It then opens like an app, from its own icon. (Your data always comes from
the server, so it needs a connection to it.)

## Email

Without email, Sunfleck doesn't send emails, and Admins copy invitation and password-reset
links from the app instead. The log only notes that an email wasn't sent, without the link in
it, since those links sign people in. To send them, set in `.env`:

```
EMAIL_URL=smtp+tls://user:password@mail.example.com:587
EMAIL_FROM=Sunfleck <plants@example.com>
```

Use `smtp+tls://` for port 587 (STARTTLS), `smtps://` for port 465, and `smtp://` without
encryption. Special characters in the user name or password must be URL-encoded (`@` is
`%40`).

## Notifications and plugins

- **Notifications** (a daily digest of what needs care, an evening reminder, frost warnings)
  are set up by each person under **Settings → Notifications**. They go through
  [Apprise](https://github.com/caronc/apprise/wiki), which supports ntfy, Telegram, email,
  Discord, Signal, Gotify and about 100 more. The worker container sends them.
  - **Web Push**, notifications from Sunfleck itself, needs Sunfleck reached over **HTTPS**
    (see above): browsers only allow it on secure sites. Set `SUNFLECK_PUBLIC_URL` to that
    https address, which push services are given as the contact for your server. The keys
    are made the first time someone turns it on. On iPhone and iPad it works in the app added
    to the Home Screen (iOS 16.4 or later). Pushes only go to the push services browsers use:
    Google's (Chrome, Edge, Samsung Internet, Opera), Mozilla's (Firefox), Apple's (Safari)
    and Microsoft's (Windows). If a browser's device is refused with "isn't a known push
    service", add its push service's host to `SUNFLECK_PUSH_HOSTS` (and please open an issue
    so it can be added for everyone).
- **Plugins** are turned on by an Admin under **Plugins**. They're off by default, since they
  send data to outside services; the page says exactly what each sends.
  - **Weather (Open-Meteo)**: each site's weather on Today, frost warnings and frost dates,
    and outdoor watering that follows the rain and heat. Free, no account needed. It reaches
    `api.open-meteo.com` and `archive-api.open-meteo.com`.
  - **Plant identification (Pl@ntNet)**: identify a plant from a photo when adding it. Needs
    a free API key from [my.plantnet.org](https://my.plantnet.org) (500 identifications a day).
  - **AI (OpenAI-compatible)** and **AI (Claude)**: suggestions from an AI model, only when
    someone asks. Claude needs an API key from
    [console.anthropic.com](https://console.anthropic.com), billed per use, and reaches
    `api.anthropic.com`.
  - **Other plugins** are installed into the image: see
    [Installing a plugin](plugins.md#5-installing).

## Backups

Two ways, best used together:

- **An export**, from **Settings → Export and import** (Admins): a ZIP file with the
  household's places, plants, photos and care history. It can be imported into a new
  Sunfleck, e.g. on another server. It leaves out passwords and secrets (notification
  addresses, API keys). For very large households, use the command instead, and copy the file
  out of the volume:

  ```bash
  docker compose run --rm sunfleck manage export_household /data/export.zip
  docker compose cp sunfleck:/data/export.zip .
  ```
- **The whole volume**, with everything including accounts. Stop Sunfleck first, so the
  database is copied in a consistent state:

  ```bash
  docker compose stop
  docker run --rm -v sunfleck_sunfleck-data:/data -v "$PWD":/backup alpine \
      tar czf /backup/sunfleck-$(date +%F).tar.gz -C /data .
  docker compose start
  ```

  The volume's name starts with the folder name (`sunfleck_` above): `docker volume ls` shows
  it. To restore, stop Sunfleck and unpack the archive into the volume the same way
  (`tar xzf` instead of `tar czf`).

## Upgrading

```bash
docker compose pull
docker compose up -d
```

Database changes are applied automatically when it starts. Make a backup first, and read the
[release notes](https://github.com/mazelado/sunfleck/releases). The Compose file uses the
latest release; to stay on a version, set it in `.env`, e.g. `SUNFLECK_VERSION=0.1` (0.1's bug
fixes, but not 0.2).

You can upgrade from any earlier release with the same major version in one step, e.g. from
0.1 straight to 1.4. Going back to an older version isn't supported: restore the backup
instead. What stays the same between versions is in [stability.md](stability.md).

To check which version is running, open **About Sunfleck** in the account menu. (The health
check at `/api/v1/health` only says which version to people signed in, and to the server
itself, so strangers can't tell which known problems apply.)

## PostgreSQL and Redis (optional)

SQLite, built in, is plenty for a household. To use **PostgreSQL** instead, set
`DATABASE_URL=postgres://user:password@host:5432/sunfleck`. To use **Redis** for the
background job queue (instead of a file in the volume), set
`HUEY_REDIS_URL=redis://host:6379/0`. Changing the database starts empty: use an export to
move your data.

## Replacing the encryption key

Setting `SUNFLECK_ENCRYPTION_KEY` on a Sunfleck that ran without it is safe: secrets stored
before stay readable, as long as `SECRET_KEY` doesn't change. To move them to the new key (and
to replace a key later):

1. Make a new key with `docker compose run --rm sunfleck manage encryption_key`, and put it
   first in `SUNFLECK_ENCRYPTION_KEY`, keeping any old key after a comma. Run
   `docker compose up -d`.
2. Encrypt every stored secret again with the new key:

   ```bash
   docker compose run --rm sunfleck manage reencrypt_secrets
   ```

3. Remove the old key from `SUNFLECK_ENCRYPTION_KEY` and run `docker compose up -d`. From now
   on, `SECRET_KEY` can change without losing secrets.

Secrets the command can't read (from a key that's already gone) are listed and left as they
are: enter those notification addresses and API keys again in the app.

## All settings

Set in `.env`; run `docker compose up -d` after changing them.

| Setting | Default | What it does |
|---|---|---|
| `SECRET_KEY` | *(required)* | Signs sessions and links. Keep it secret |
| `SUNFLECK_ENCRYPTION_KEY` | *(made from `SECRET_KEY`)* | Encrypts stored secrets; recommended. Several, comma-separated, to replace a key: the first encrypts, all decrypt ([replacing a key](#replacing-the-encryption-key)) |
| `ALLOWED_HOSTS` | `localhost` | The host names you reach Sunfleck at, comma-separated |
| `CSRF_TRUSTED_ORIGINS` | *(none)* | Those addresses with `https://`, needed for signing in through them |
| `SUNFLECK_PUBLIC_URL` | *(none)* | The address notifications, calendar entries, QR labels and NFC tags link to |
| `SUNFLECK_LISTEN_ADDRESS` | `127.0.0.1` | Who can reach port 8000: only this computer, or `0.0.0.0` for every network it's on. Read by Compose |
| `SUNFLECK_BEHIND_PROXY` | `false` | `true` behind a reverse proxy with HTTPS. Cookies are then only sent over HTTPS, so plain `http://` addresses can't be used to sign in |
| `TIME_ZONE` | `UTC` | The server's time zone; each site has its own |
| `EMAIL_URL`, `EMAIL_FROM` | *(log only)* | Sending emails ([above](#email)) |
| `DATABASE_URL` | SQLite in the volume | PostgreSQL ([above](#postgresql-and-redis-optional)) |
| `HUEY_REDIS_URL` | *(file in the volume)* | Redis for the job queue |
| `LOG_LEVEL` | `INFO` | How much to log: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `SUNFLECK_ACCESS_LOG` | `false` | `true` logs every request the web server answers, for tracking down a problem |
| `SUNFLECK_PUSH_HOSTS` | *(none)* | More push services Web Push may send to, comma-separated ([below](#notifications-and-plugins)) |
| `WEB_CONCURRENCY`, `WEB_THREADS` | `2`, `4` | Web server processes, and requests each answers at once. More threads let more slow requests (AI answers) wait without holding up the app; more processes use more memory |
| `WEB_TIMEOUT` | `250` | Seconds a web server process may stop answering before it's restarted. Long enough for an AI model that has to load first |

## Troubleshooting

- **"required variable SECRET_KEY is missing a value"** when starting: `SECRET_KEY` in `.env`
  is empty. Set it to a long random string (`openssl rand -base64 48`).
- **"dependency failed to start: container … is unhealthy"**: the app stopped while starting.
  `docker compose logs sunfleck` says why, for example a setting that's wrong or a data folder
  that isn't writable (see below).
- **"Bad Request (400)"**: the address you use isn't in `ALLOWED_HOSTS`.
- **"Request Entity Too Large" (413)**: the reverse proxy, or Sunfleck, refuses anything over
  25 MB. Photos are up to 20 MB. To import an export larger than the proxy allows, use the
  `import_household` command.
- **"CSRF verification failed" or signing in fails**: add the address, with `https://`, to
  `CSRF_TRUSTED_ORIGINS`; behind a reverse proxy, also set `SUNFLECK_BEHIND_PROXY=true`.
- **"Sunfleck can't be reached"** in the installed app: the server isn't running or the phone
  has no connection. `docker compose ps` shows whether it's up.
- **No reminders arrive**: check the worker is running (`docker compose ps`), then use
  **Send a test** on the Notifications page, which shows the error if sending fails.
- **"…isn't writable by user ID 1000"**: Sunfleck runs as user 1000, and something in its data
  belongs to another user, usually because a command was run as root. Give it back with
  `docker compose run --rm -u root --entrypoint chown sunfleck -R 1000:999 /data`, or, when
  using a folder instead of the volume, `sudo chown -R 1000:999 <folder>`. The message shows the
  exact command.
- **The first account's password is forgotten** and email isn't set up: other Admins can't
  make a reset link for that account, so set a new password on the server with
  `docker compose run --rm sunfleck manage changepassword <email>`.
- **Stored secrets can't be read** after changing `SECRET_KEY`: if you still have the old
  `SECRET_KEY`, put it back, then follow [Replacing the encryption key](#replacing-the-encryption-key)
  before changing it again. Otherwise set `SUNFLECK_ENCRYPTION_KEY` (and keep it), then enter
  notification addresses and API keys again.
- Anything else: `docker compose logs` usually says what's wrong. Please
  [open an issue](https://github.com/mazelado/sunfleck/issues) if it doesn't.
