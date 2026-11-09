# Folio

Self-hosted client galleries for photographers. A replacement for Pixieset that runs in a single Docker container, with your photos in a plain folder on your own server or NAS.

- One folder per gallery, one subfolder per section. Add photos over SMB or upload them in the browser.
- Beautiful, fast client galleries on every screen: cover layouts, grids, lightbox, favorites and downloads.
- Deliver galleries by email straight from Folio, using your own email provider.
- Print store with Stripe is planned (see [FEATURES.md](FEATURES.md)).

## Quick start

```bash
docker run -d --name folio -p 8080:8080 \
  -v /path/to/photos:/photos \
  -v folio-data:/data \
  -v folio-cache:/cache \
  ghcr.io/rockbeater/folio:latest
```

Open `http://<your-server>:8080` and create your admin account.

Or use the example [docker-compose.yml](docker-compose.yml):

```bash
docker compose up -d
```

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
| `BASE_URL` | – | Public address, e.g. `https://gallery.example.com`. Required behind an HTTPS reverse proxy; used in email links. |
| `PUID` / `PGID` | `1000` | User and group Folio runs as. Set them to the owner of your photo folder. |
| `TZ` | `UTC` | Time zone. |
| `SCAN_INTERVAL_SECONDS` | `60` | How often the photo library is scanned for changes. |
| `PROCESSING_CONCURRENCY` | `2` | Photos processed in parallel. |
| `UPLOAD_MAX_MB` | `500` | Maximum size of one uploaded file. |
| `TRASH_RETENTION_DAYS` | `30` | Days before deleted photos are removed from `/photos/.trash`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | – | Optional. Email settings can also be entered in the admin; environment variables win. `SMTP_SECURITY` is `starttls`, `tls` or `none`. |

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
