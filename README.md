# Folio

Self-hosted client galleries for photographers. A replacement for Pixieset that runs in a single Docker container, with your photos in a plain folder on your own server or NAS.

- One folder per gallery, one subfolder per section. Add photos over SMB or upload them in the browser.
- Beautiful, fast client galleries on every screen: cover layouts, grids, lightbox, favorites and downloads.
- Deliver galleries by email straight from Folio, using your own email provider.
- Print store with Stripe is planned (see [FEATURES.md](FEATURES.md)).

## Installation with Docker Compose

1. Create a folder for Folio on your server, e.g. `/opt/folio`, and save this as `docker-compose.yml` in it:

```yaml
services:
  folio:
    image: ghcr.io/rockbeater/folio:latest
    container_name: folio
    restart: unless-stopped
    ports:
      - "${PORT:-8080}:${PORT:-8080}"
    environment:
      # Port Folio listens on. Set PORT in a .env file next to this file to change it.
      - PORT=${PORT:-8080}
      # Public address of your galleries. Uncomment when Folio runs behind a
      # reverse proxy with HTTPS; it is also used for links in emails.
      # - BASE_URL=https://gallery.example.com
      # User and group that own your photo folder (run `id` on the host to find them).
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Copenhagen
    volumes:
      # Your photo library: one folder per gallery, one subfolder per section.
      - /path/to/photos:/photos
      # Database and settings. Back this up.
      - ./data:/data
      # Generated thumbnails. Can be deleted at any time.
      - ./cache:/cache
```

2. Change `/path/to/photos` to your photo folder (for example a NAS share), and `PUID`, `PGID` and `TZ` to match your setup. If your galleries will be reached through a domain with HTTPS, uncomment `BASE_URL` and set it to that address.

3. Start Folio:

```bash
docker compose up -d
```

4. Open `http://<your-server>:8080` (or your `BASE_URL`) and create your admin account.

### Changing the port

Folio listens on port 8080 by default. To use another port, create a file called `.env` next to `docker-compose.yml`:

```
PORT=3000
```

Then run `docker compose up -d` again. The port is used both inside the container and on your server.

The same file is in the repository as [docker-compose.yml](docker-compose.yml).

### Updating

```bash
docker compose pull
```

```bash
docker compose up -d
```

Database changes are applied automatically when the new version starts.

### Without Compose

```bash
docker run -d --name folio -p 8080:8080 \
  -e PORT=8080 -e PUID=1000 -e PGID=1000 \
  -v /path/to/photos:/photos \
  -v folio-data:/data \
  -v folio-cache:/cache \
  ghcr.io/rockbeater/folio:latest
```

### Image visibility

The image is published to the GitHub Container Registry. While the repository is private, the image is private too: either make the package public on GitHub (Packages → folio → Package settings → Change visibility), or log in on the server first with `docker login ghcr.io` using a token with the `read:packages` scope.

## Folders

| Path in the container | Contents |
|---|---|
| `/photos` | Your photo library. Each folder is a gallery, each subfolder a section. Folio needs write access for uploads. |
| `/data` | Database, settings and uploaded logo. Back this up. |
| `/cache` | Generated thumbnails. Safe to delete; it is rebuilt automatically. |

```
/photos
├── Anna & Mads Wedding/
│   ├── Getting ready/
│   ├── Ceremony/
│   └── Reception/
└── Family Session 2026/
    └── Highlights/
```

New folders show up in the admin as drafts within a minute. Folio writes a small hidden `.folio-id` file into each gallery folder so a gallery keeps its settings when you rename the folder.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port Folio listens on. |
| `BASE_URL` | – | Public address, e.g. `https://gallery.example.com`. Required behind an HTTPS reverse proxy; used in email links. |
| `PUID` / `PGID` | `1000` | User and group Folio runs as. Set them to the owner of your photo folder. |
| `TZ` | `UTC` | Time zone. |
| `SCAN_INTERVAL_SECONDS` | `60` | How often the photo library is scanned for changes. |
| `PROCESSING_CONCURRENCY` | `2` | Photos processed in parallel. |
| `UPLOAD_MAX_MB` | `500` | Maximum size of one uploaded file. |
| `TRASH_RETENTION_DAYS` | `30` | Days before deleted photos are removed from `/photos/.trash`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | – | Optional. Email settings can also be entered in the admin; environment variables win. `SMTP_SECURITY` is `starttls`, `tls` or `none`. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. Folio logs form posts, uploads, orders, Stripe events and errors to the container log (`docker logs -f folio`). |
| `STRIPE_SIMULATOR` | `0` in Docker | `1` turns on a simulated payment page when no Stripe key is set, so the whole order flow can be tried without Stripe. Never use it for real sales. |

### Store and Stripe

The store is off until you open it under **Store → Settings**. Choose the currency first, then add a price list with products, VAT rates and shipping methods, and turn on the store for each gallery under **Settings → Store**.

To take payments, paste a Stripe secret key or a restricted key under **Store → Settings**. Folio checks the key, creates the webhook endpoint `<BASE_URL>/api/stripe/webhook` itself and stores its signing secret. Stripe must be able to reach that address, so set `BASE_URL` to your public HTTPS address. Orders are only marked as paid when the signed webhook arrives. Use a test key (`sk_test_…` or `rk_test_…`) and Stripe's test cards to try everything before you switch to a live key.

### HTTPS

Run Folio behind a reverse proxy such as Caddy, Traefik or Nginx Proxy Manager, set `BASE_URL`, and make sure the proxy forwards the `Host` header and `X-Forwarded-Proto`.

## Development

Requires Node.js 22.

```bash
npm install
npm run dev
```

Photos, data and cache go to `dev-data/` by default. Other useful commands:

```bash
npm run check   # type check
npm test        # unit tests
npm run build   # production build (start with: npm start)
```

## Documents

- [MISSION.md](MISSION.md): purpose and architecture
- [FEATURES.md](FEATURES.md): all features to be implemented
- [DESIGN.md](DESIGN.md): design rules and visual direction
