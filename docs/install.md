# Installing Sunfleck

Sunfleck runs as two containers from one Docker image: the app, and a worker for background
jobs (reminders, weather updates, the nightly recalculation). Everything it stores, the
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
   **Household** in the account menu.

`docker compose ps` shows whether it's running and healthy, and `docker compose logs -f`
follows what it's doing (Ctrl+C stops following, not Sunfleck).

## Reach it from your phone (HTTPS)

Sunfleck listens on port 8000 without HTTPS. Phones on your home network can open
`http://<your-computer>:8000` (add that address to `ALLOWED_HOSTS` and, with `http://`, to
`CSRF_TRUSTED_ORIGINS`), but browsers only let you install it as an app over HTTPS, and it
should never be reachable from the internet without it. The usual way is a **reverse proxy**
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
    }
}
```

**Nginx Proxy Manager, Traefik** and the like work the same way: forward to port 8000, keep
the `Host` header, and allow uploads of at least 25 MB.

**Only at home, without a domain?** [Tailscale](https://tailscale.com/) gives your server an
HTTPS address only your own devices can reach: `tailscale serve --bg 8000`. Use the address it
prints in `.env` as above.

### Installing it on your phone

Open Sunfleck in your phone's browser, then choose **Install app** in the account menu
(Android, and Chrome or Edge on a computer), or **Share → Add to Home Screen** in Safari on an
iPhone or iPad. It then opens like an app, from its own icon. (Your data always comes from
the server, so it needs a connection to it.)

## Email

Without email, Sunfleck writes emails to its log, and Admins can copy invitation and
password-reset links from the app. To send them, set in `.env`:

```
EMAIL_URL=smtp+tls://user:password@mail.example.com:587
EMAIL_FROM=Sunfleck <plants@example.com>
```

Use `smtp+tls://` for port 587 (STARTTLS), `smtps://` for port 465, and `smtp://` without
encryption. Special characters in the user name or password must be URL-encoded (`@` is
`%40`).

## Notifications and plugins

- **Notifications** (a daily digest of what needs care, an evening reminder, frost warnings)
  are set up by each person under **Notifications** in the account menu. They go through
  [Apprise](https://github.com/caronc/apprise/wiki), which supports ntfy, Telegram, email,
  Discord, Signal, Gotify and about 100 more. The worker container sends them.
- **Plugins** are turned on by an Admin under **Plugins**. They're off by default, since they
  send data to outside services; the page says exactly what each sends.
  - **Weather (Open-Meteo)**: each site's weather on Today, frost warnings, and outdoor
    watering that follows the rain and heat. Free, no account needed.
  - **Plant identification (Pl@ntNet)**: identify a plant from a photo when adding it. Needs
    a free API key from [my.plantnet.org](https://my.plantnet.org) (500 identifications a day).

## Backups

Two ways, best used together:

- **An export**, from **Export and import** in the account menu (Admins): a ZIP file with the
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

Database changes are applied automatically when it starts. Make a backup first. The Compose
file uses the latest release; to stay on a version, put it in the `image:` lines, e.g.
`ghcr.io/mazelado/sunfleck:0.1`.

## PostgreSQL and Redis (optional)

SQLite, built in, is plenty for a household. To use **PostgreSQL** instead, set
`DATABASE_URL=postgres://user:password@host:5432/sunfleck`. To use **Redis** for the
background job queue (instead of a file in the volume), set
`HUEY_REDIS_URL=redis://host:6379/0`. Changing the database starts empty: use an export to
move your data.

## All settings

Set in `.env`; run `docker compose up -d` after changing them.

| Setting | Default | What it does |
|---|---|---|
| `SECRET_KEY` | *(required)* | Signs sessions and links. Keep it secret |
| `SUNFLECK_ENCRYPTION_KEY` | *(made from `SECRET_KEY`)* | Encrypts stored secrets; recommended. Several, comma-separated, to replace a key: the first encrypts, all decrypt |
| `ALLOWED_HOSTS` | `localhost` | The host names you reach Sunfleck at, comma-separated |
| `CSRF_TRUSTED_ORIGINS` | *(none)* | Those addresses with `https://`, needed for signing in through them |
| `SUNFLECK_PUBLIC_URL` | *(none)* | The address notifications link to |
| `SUNFLECK_BEHIND_PROXY` | `false` | `true` behind a reverse proxy with HTTPS |
| `TIME_ZONE` | `UTC` | The server's time zone; each site has its own |
| `EMAIL_URL`, `EMAIL_FROM` | *(log only)* | Sending emails ([above](#email)) |
| `DATABASE_URL` | SQLite in the volume | PostgreSQL ([above](#postgresql-and-redis-optional)) |
| `HUEY_REDIS_URL` | *(file in the volume)* | Redis for the job queue |
| `LOG_LEVEL` | `INFO` | How much to log: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

## Troubleshooting

- **"Bad Request (400)"**: the address you use isn't in `ALLOWED_HOSTS`.
- **"CSRF verification failed" or signing in fails**: add the address, with `https://`, to
  `CSRF_TRUSTED_ORIGINS`; behind a reverse proxy, also set `SUNFLECK_BEHIND_PROXY=true`.
- **"Sunfleck can't be reached"** in the installed app: the server isn't running or the phone
  has no connection. `docker compose ps` shows whether it's up.
- **No reminders arrive**: check the worker is running (`docker compose ps`), then use
  **Send a test** on the Notifications page, which shows the error if sending fails.
- **"…isn't writable by user ID 1000"** when using a folder instead of the volume: Sunfleck
  runs as user 1000; give it the folder with `sudo chown 1000 <folder>`.
- **Stored secrets can't be read** after changing `SECRET_KEY`: set `SUNFLECK_ENCRYPTION_KEY`
  (and keep it), then enter notification addresses and API keys again.
- Anything else: `docker compose logs` usually says what's wrong. Please
  [open an issue](https://github.com/mazelado/sunfleck/issues) if it doesn't.
