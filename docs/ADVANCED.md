# Folio: advanced guide

The step-by-step installation is in the [README](../README.md). This page has the details: every setting, reverse proxies, the store and Stripe, email, backups, logging and development.

**Contents**

- [Configuration](#configuration)
- [Folders and the photo library](#folders-and-the-photo-library)
- [HTTPS and reverse proxies](#https-and-reverse-proxies)
- [Store and Stripe](#store-and-stripe)
- [Downloads on phones and computers](#downloads-on-phones-and-computers)
- [Email](#email)
- [Backups and restore](#backups-and-restore)
- [Logging](#logging)
- [Statistics and your own visits](#statistics-and-your-own-visits)
- [Security](#security)
- [Running without Compose](#running-without-compose)
- [The Docker image](#the-docker-image)
- [Development](#development)

---

## Configuration

All settings are environment variables. With Docker Compose, put them in the `.env` file and load it with `env_file` (see [.env.example](../.env.example)). Most other settings are made in the admin.

| Variable | Default | Description |
|---|---|---|
| `PUID` / `PGID` | `1000` | User and group Folio runs as. Set them to the owner of your photo folder (`id` on the host). |
| `TZ` | `UTC` | Time zone, e.g. `Europe/Copenhagen`. Used for dates, expiry and reminders. |
| `BASE_URL` | – | Public address, e.g. `https://gallery.example.com`. Needed behind an HTTPS reverse proxy, for links in emails and for the Stripe webhook. When set, Folio only accepts forms posted from this address. |
| `PORT` | `8080` | Port Folio listens on inside the container. To use another port on the host, change the left side of `ports` in `docker-compose.yml` instead. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. See [Logging](#logging). |
| `SCAN_INTERVAL_SECONDS` | `60` | How often the photo library is scanned for changes (in addition to the file watcher). |
| `PROCESSING_CONCURRENCY` | `2` | Photos processed in parallel. Lower it on small NAS models. |
| `UPLOAD_MAX_MB` | `500` | Largest single file accepted by browser uploads. |
| `TRASH_RETENTION_DAYS` | `30` | Days before deleted photos and galleries are removed from `/photos/.trash`. |
| `DOWNLOAD_PART_GB` | `4` | Large client downloads are split into ZIP files of at most this size. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURITY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | – | Optional email settings. When `SMTP_HOST` is set, these win over the admin settings. `SMTP_SECURITY` is `starttls`, `tls` or `none`. |
| `STRIPE_SIMULATOR` | `0` in Docker | `1` shows a simulated payment page when no Stripe key is set, so the whole order flow can be tried without Stripe. Never use it for real sales. |

The paths inside the container (`PHOTOS_DIR=/photos`, `DATA_DIR=/data`, `CACHE_DIR=/cache`) are set by the image; map your folders onto them with `volumes`.

---

## Folders and the photo library

| Path in the container | Contents |
|---|---|
| `/photos` | Your photo library. Each folder is a gallery, each subfolder a section. Folio needs write access for uploads, moving and deleting. |
| `/data` | Database, settings, logo, watermarks and product photos. Back this up. |
| `/cache` | Generated thumbnails and download copies. Safe to delete; Folio makes them again. |

```
/photos
├── Anna & Mads Wedding/
│   ├── Getting ready/
│   ├── Ceremony/
│   └── Reception/
└── Family Session 2026/
    └── Highlights/
```

- New folders show up in the admin as drafts within a minute. A folder that disappears is marked as missing, not deleted.
- Folio writes a small hidden `.folio-id` file into each gallery folder, so a gallery keeps its settings when you rename the folder.
- Photos directly in a gallery folder (not in a section) and folders inside sections are ignored, with a warning in the admin.
- Deleting photos or galleries in the admin moves them to `/photos/.trash`.
- NAS system folders such as `@eaDir` and `#recycle` are ignored.

---

## HTTPS and reverse proxies

Clients should reach Folio over HTTPS. Run a reverse proxy in front of it and set `BASE_URL`. The proxy must:

- forward the `Host` header,
- send `X-Forwarded-Proto`, and `X-Forwarded-For` or `X-Real-IP` (for the client's IP address in statistics),
- allow request bodies of at least 8 MB (browser uploads are sent in 8 MB pieces),
- allow long requests for large ZIP downloads.

**Caddy**

```
gallery.example.com {
	reverse_proxy folio:8080
}
```

Caddy gets the certificate and sets the forwarding headers by itself.

**Nginx**

```nginx
server {
	listen 443 ssl;
	server_name gallery.example.com;
	# ssl_certificate … ;

	client_max_body_size 64m;
	proxy_read_timeout 1h;
	proxy_buffering off;

	location / {
		proxy_pass http://127.0.0.1:8080;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

**Nginx Proxy Manager / Synology:** create a proxy host for the domain pointing to port 8080, request a Let's Encrypt certificate, and add the headers above. The Synology steps are in the [README](../README.md#step-8-make-the-galleries-reachable-for-clients-https).

Folio trusts `X-Forwarded-For`, `X-Real-IP` and `CF-Connecting-IP` only when the request comes from a private address (your proxy), so visitors cannot fake their address.

> With `BASE_URL` set, open Folio only on that address. Forms opened on another address (e.g. the local IP) are refused as a security measure.

---

## Store and Stripe

The store is off until you set it up. In the admin under **Store**:

1. **Settings:** choose the currency first (prices are not converted if you change it later), then the store name, email, terms of sale and the licence for digital photos. Open the store.
2. **Price lists:** add products: prints with options (e.g. size and paper) and a price per combination, or digital downloads (photo, section or whole gallery). The default price list is used by galleries that have none chosen.
3. **VAT:** add the rate for each country you sell to. Prices include VAT.
4. **Shipping:** add at least one method per country, or one for the rest of the world. Pickup is a method with fee 0. Digital-only orders need no shipping.
5. **Discount codes** (optional), also shown as a banner in galleries.
6. In each gallery: **Settings → Store**: turn it on and choose the price list. Or open the price list and click **Assign to all galleries**, which can also turn the store on everywhere at once.

The top of the store pages lists what still stops customers from ordering.

**Prints and crops.** When a photo does not have the shape of the print size (e.g. `13x18` or `A4` in the option name), the customer must choose the crop in the cart before ordering. In the order, **Download with crop** gives the photo at full resolution with the crop applied (JPEG quality 100 without chroma subsampling, colour profile kept, no resizing or sharpening). Prints without a crop are downloaded as the original file. **Download print files** gives all prints of an order as one ZIP, named by product, size and quantity.

**Country in the checkout.** The cart starts with the customer's likely country chosen, among the countries you ship to; they can always change it. Folio makes no outside lookups for this. Behind Cloudflare (or CloudFront, Vercel, Google App Engine, or a proxy that sets `X-Country-Code`, e.g. nginx with a GeoIP module) it uses the country of the visitor's IP address from that header; otherwise the browser's language and region (`Accept-Language`).

**Orders.** A checkout only becomes an order when the payment is confirmed: unpaid checkouts are not shown, get their order number only when paid (so numbers have no gaps) and are removed after three days.

### Connecting Stripe

1. Set `BASE_URL` to your public HTTPS address first. Stripe must reach `<BASE_URL>/api/stripe/webhook`.
2. In Stripe, create a key. A **restricted key** is safest. It needs:
   - write: **Checkout Sessions**, **Webhook Endpoints**, **Refunds**
   - read: **Payment Intents**, **Charges**, **Events** (and optionally **Account**, to show your account name)
   It does not need access to payouts or anything else.
3. Paste it in **Store → Settings → Stripe**. Folio checks the key, creates the webhook endpoint and saves its signing secret.
4. Try it with a test key (`sk_test_…` / `rk_test_…`) and Stripe's test cards before you switch to a live key.

Orders are only marked as paid when the signed webhook arrives. If the signing secret is lost, **Set up webhook again** deletes the endpoint and creates a new one. Payment methods (cards, Apple Pay, Google Pay, MobilePay and more) are turned on in the Stripe dashboard; Checkout shows the ones that fit the currency and country. Refunds can be made from the order page in the admin.

---

## Downloads on phones and computers

Folio picks the best way to save photos for each kind of device. The defaults are marked "recommended" under **Settings → Preferences → Downloads on phones and computers**, where each device can be changed:

| Device | Recommended | What happens |
|---|---|---|
| iPhone, iPad | Save to Photos | The share sheet opens with the photos; "Save images" puts them straight into the photo library in full quality. Large selections go in batches (default 20 photos, adjustable), because the phone holds a whole batch in memory. |
| Android | One download per photo | Each photo is downloaded on its own and shows up in the gallery app. The browser may ask once to allow several downloads. |
| Chrome and Edge on a computer | Save into a folder | The visitor picks a folder and the photos are written into it, with progress. Starting again skips photos that are already there. |
| Safari on a Mac, Firefox and others | ZIP file | One ZIP (split into parts when very large). |

This works for every download: the whole gallery, a section, favorites and lists, single photos, shared lists, quick share links and purchased digital photos. When a method is not supported in a browser, Folio falls back to the next best; there is always a "Download as one ZIP file instead" link. Downloaded copies keep the capture date, so they are sorted correctly in the photo library.

**Screenshots** cannot be blocked or detected on a website (streaming services do it with DRM video, which does not exist for photos). Instead, Folio turns off the phone's own "save image" menu on gallery photos and, on a long press, a right-click or the PrintScreen key, shows a small box pointing at the download button. It is only shown when downloads are allowed.

## Email

Folio sends email through your own provider (SMTP): gallery delivery, expiry reminders, store emails and notifications to you. Enter the details under **Settings → Email sending** (with presets for common providers), or set the `SMTP_…` variables. Send yourself a test email there to see any error from your provider.

For good delivery, send from an address on your own domain and set up SPF and DKIM with your email provider. Templates per language are under **Settings → Email templates**.

---

## Backups and restore

**What to back up:**

- `/data`: the database and settings. Required.
- Your photo folder: your originals.
- `/cache` is not needed.

**From the admin:** **Settings → Backup** downloads a ZIP of `/data` with a consistent copy of the database (your photos are not included). **Restore** replaces all settings, galleries, favorites and orders with a backup; the current data is first moved to a `.before-restore-…` folder in `/data`, so you can go back.

**From the host:** stop Folio (`docker compose stop`), copy the `data` folder, and start it again. On a Synology NAS, Hyper Backup can do this on a schedule.

---

## Logging

Folio logs to the container log:

```bash
docker compose logs -f
```

With `LOG_LEVEL=info` you see form posts and API calls that change something, uploads, checkouts and orders, Stripe calls and webhooks, emails that fail, failed admin logins, and full error details for anything that goes wrong (status 500). `debug` shows more, `warn` and `error` show less. Secrets and passwords are never logged.

### Self-check

Every 15 minutes Folio checks what it depends on, and **Settings → System** shows the result (with **Check now**):

| Check | What it looks at |
|---|---|
| Stripe connection | The key still works and Stripe can be reached (only while the store is open). |
| Stripe webhook | The endpoint still exists in Stripe, is switched on and points to `BASE_URL`. |
| Email sending | Folio can connect and log in to your mail server. |
| Sent emails | Emails that failed in the last 7 days. |
| Photo library | `/photos` can be reached and written to. |
| Disk space | Free space for data, cache and photos (warning below 5 GB, error below 1 GB). |
| Public address | `BASE_URL` is set. |
| Photo processing | Photos that could not be processed. |

Problems show as a bar at the top of the admin (warnings can be hidden until something changes). When a check starts failing, you also get an email at the studio's contact address, at most once a day per problem (not for email sending itself). Changes are logged as `[health]`.

---

## Statistics and your own visits

The **bell** at the top of the admin shows what happened in all galleries: paid orders, submitted selections, downloads and registrations, with the number of new items since you last looked. **See all** opens the activity page, grouped by day and filterable.

Each gallery's **Activity** tab shows visits per day, downloads, registrations, favorite lists with notes and thumbnails, the most favorited photos, share links and orders. Folio counts visits on your own server; there is no third-party tracking.

The download log also shows the visitor's IP address (as your reverse proxy passes it on, see [HTTPS and reverse proxies](#https-and-reverse-proxies)), and a downloaded single photo opens with a click. IP addresses are personal data: mention them in your privacy policy. They are deleted with the gallery, and with the visitor's other data when you delete an email address under **Settings → Privacy**.

Your own visits are not counted: not while you are logged in, and not from IP addresses you have used while logged in during the last 30 days (so also not from a private window on the same network). The list of addresses and the switch are under **Settings → Privacy**.

If your reverse proxy does not forward the visitor's address, every visitor has the proxy's address, and Folio would leave everyone out. Add the forwarding headers (see [HTTPS and reverse proxies](#https-and-reverse-proxies)) or turn the switch off.

---

## Security

- Every admin page, form and API call requires a login. Two-factor login with an authenticator app is under **Settings → Account**.
- Gallery passwords, client passwords, download PINs and share links are checked on the server; guests never receive private photos or client-only sections.
- Search engines are told not to index anything. Under **Settings → Privacy** you can allow the homepage; galleries are never indexed.
- **Settings → Privacy** also finds, exports and deletes the personal data stored for an email address (GDPR). Orders are kept for bookkeeping.

---

## Running without Compose

```bash
docker run -d --name folio --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  -v /path/to/photos:/photos \
  -v "$PWD/data":/data \
  -v "$PWD/cache":/cache \
  ghcr.io/rockbeater/folio:latest
```

---

## The Docker image

- `ghcr.io/rockbeater/folio:latest` is built for `linux/amd64` and `linux/arm64` on every push to `main`. Tagged releases also get version tags, and every build gets a `sha-…` tag.
- The container starts as root only to prepare `/data` and `/cache`, then drops to `PUID`:`PGID`. It warns in the log if that user cannot write to `/photos`.
- A health check calls `/healthz` every 30 seconds.
- If the package on GitHub is private, make it public (GitHub → Packages → folio → Package settings → Change visibility), or log in on the server first with `docker login ghcr.io` and a token with the `read:packages` scope.

---

## Development

Requires Node.js 22.

```bash
npm install
```

```bash
npm run dev
```

Photos, data and cache go to `dev-data/` by default. Without a Stripe key, the payment simulator is on in development.

```bash
npm run check   # type check
npm test        # unit tests
npm run build   # production build; start it with: npm start
```

After changing the database schema in `src/lib/server/db/schema.ts`, run `npm run db:generate` and commit the new migration in `drizzle/`.
