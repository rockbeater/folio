# Folio

Self-hosted client galleries and a print store for photographers. A replacement for Pixieset that runs in one Docker container, with your photos in a plain folder on your own server or NAS.

- One folder per gallery, one subfolder per section. Add photos over the network (SMB) or upload them in the browser.
- Beautiful, fast client galleries on every screen, with favorites, downloads, guest and client access, and sharing.
- Deliver galleries by email from Folio, through your own email provider.
- Sell prints and digital downloads with Stripe.

This page is the simple guide: from nothing to your first gallery, step by step. Everything else (all settings, reverse proxies, Stripe details, backups, development) is in **[docs/ADVANCED.md](docs/ADVANCED.md)**.

**Contents**

1. [Install on a server with Docker](#install-on-a-server-with-docker)
2. [Install on a Synology NAS](#install-on-a-synology-nas)
3. [Your first gallery](#your-first-gallery)
4. [Your own domain with HTTPS](#your-own-domain-with-https)
5. [Updating](#updating)
6. [When something does not work](#when-something-does-not-work)

---

## Install on a server with Docker

You need a Linux server (or a computer that is always on) with Docker and Docker Compose, and a folder with your photos.

### Step 1: Make a folder for Folio

```bash
mkdir -p ~/folio
```

```bash
cd ~/folio
```

### Step 2: Find your user and group id

Folio must be able to write to your photo folder (for uploads from the browser). It runs as the user and group you give it. Find yours with:

```bash
id
```

The output looks like `uid=1000(anna) gid=1000(anna) …`. You need the two numbers: here `1000` and `1000`.

### Step 3: Create the `.env` file

The `.env` file holds Folio's settings. Create it in `~/folio`:

```bash
nano .env
```

Paste this, change the values, and save (in nano: <kbd>Ctrl</kbd>+<kbd>O</kbd>, <kbd>Enter</kbd>, <kbd>Ctrl</kbd>+<kbd>X</kbd>):

```ini
# User and group that own your photo folder (from step 2)
PUID=1000
PGID=1000

# Your time zone
TZ=Europe/Copenhagen

# Your public address with HTTPS. Leave empty for now (see "Your own domain with HTTPS").
BASE_URL=

# How much Folio writes to the log: debug, info, warn or error
LOG_LEVEL=info
```

The same file is in this repository as [.env.example](.env.example), with optional email settings too.

### Step 4: Create `docker-compose.yml`

```bash
nano docker-compose.yml
```

Paste this and change `/path/to/photos` to your photo folder, for example `/srv/photos`:

```yaml
services:
  folio:
    image: ghcr.io/rockbeater/folio:latest
    container_name: folio
    restart: unless-stopped
    env_file:
      - .env            # the settings from step 3
    ports:
      - "8080:8080"     # left side: the port on your server
    volumes:
      - /path/to/photos:/photos   # your photo folder
      - ./data:/data              # database and settings: back this up
      - ./cache:/cache            # thumbnails: can be deleted at any time
```

If port 8080 is already in use, change only the left number, for example `"8090:8080"`.

### Step 5: Start Folio

```bash
docker compose up -d
```

Check that it started:

```bash
docker compose logs -f
```

You should see `listening on http://0.0.0.0:8080` and `library scan complete`. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop watching the log (Folio keeps running).

### Step 6: Create your admin account

Open `http://<your-server-ip>:8080` in a browser. Enter your studio name, your email, a password and the language, and you are in.

Continue with [Your first gallery](#your-first-gallery).

---

## Install on a Synology NAS

This works on Synology models that can run **Container Manager** (DSM 7.2 or newer; most "+" models and some others). The steps use the DSM menus, so you do not need the command line.

### Step 1: Install Container Manager

Open **Package Center**, search for **Container Manager** and install it. This also creates a shared folder called `docker`.

### Step 2: Make the folders

Open **File Station**.

1. **Photos:** decide where your galleries live. You can create a new shared folder, for example `Galleries` (**Control Panel → Shared Folder → Create**), or use a folder inside an existing share such as `photo`. In this guide it is `/volume1/Galleries`.
2. **Folio:** in the `docker` folder, create a folder `folio`, and inside it the folders `data` and `cache`.

You now have:

```
/volume1/docker/folio/data
/volume1/docker/folio/cache
/volume1/Galleries            ← your photos, one folder per gallery
```

### Step 3: Find your user and group id

Folio runs as one of your DSM users, and that user needs **read/write** access to the photo folder (**Control Panel → Shared Folder → Galleries → Edit → Permissions**). Use your own user.

To find the user's numbers without the command line:

1. Open **Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script**.
2. **General:** name it `my id`, user **root**.
3. **Task Settings → Run command:** (replace `yourname` with your DSM user name)
   ```bash
   id yourname > /volume1/docker/folio/my-id.txt
   ```
4. Save, select the task and click **Run**. Open `my-id.txt` in File Station.

It says something like `uid=1026(yourname) gid=100(users)`. You need `1026` and `100`. Delete the task and the file afterwards.

### Step 4: Create the settings file

Create a text file on your computer called **`folio.env`** with this content, and upload it to `/volume1/docker/folio` with File Station:

```ini
# Your DSM user and group (from step 3)
PUID=1026
PGID=100

# Your time zone
TZ=Europe/Copenhagen

# Your public address with HTTPS. Leave empty for now (see step 8).
BASE_URL=

LOG_LEVEL=info
```

> On a NAS we call it `folio.env` instead of `.env`, because files starting with a dot are hidden on Mac and awkward to create on Windows. It works the same way.

### Step 5: Create the project

1. Open **Container Manager → Project → Create**.
2. **Project name:** `folio`
3. **Path:** choose `/docker/folio`
4. **Source:** choose **Create docker-compose.yml** and paste this. Change `/volume1/Galleries` if your photos are somewhere else:

```yaml
services:
  folio:
    image: ghcr.io/rockbeater/folio:latest
    container_name: folio
    restart: unless-stopped
    env_file:
      - folio.env
    ports:
      - "8080:8080"
    volumes:
      - /volume1/Galleries:/photos
      - /volume1/docker/folio/data:/data
      - /volume1/docker/folio/cache:/cache
```

5. Click **Next**. Skip the web portal settings (Web Station) with **Next**.
6. Tick **Start the project once it is created** and click **Done**.

Container Manager downloads Folio and starts it. This takes a minute the first time. The project should show as **Running**. To see the log: **Container → folio → Log**.

If port 8080 is used by something else on your NAS, change the line to for example `"8090:8080"` and open that port instead.

### Step 6: Create your admin account

Open `http://<your-nas-ip>:8080` (for example `http://192.168.1.20:8080`). Enter your studio name, email, password and language.

### Step 7: Add photos from your computer

Your photo folder is a normal shared folder, so you can copy photos straight into it:

- **Mac:** Finder → Go → Connect to Server → `smb://<your-nas-ip>/Galleries`
- **Windows:** File Explorer → `\\<your-nas-ip>\Galleries`

Create one folder per gallery, with one subfolder per section (see [Your first gallery](#your-first-gallery)). Folio picks them up within a minute.

### Step 8: Make the galleries reachable for clients (HTTPS)

To send links to clients, Folio needs a public address with HTTPS, for example `https://gallery.yourstudio.com`.

1. **Domain:** point a domain at your home's internet address. With your own domain, create an `A` record to your public IP. Or use Synology's free address (**Control Panel → External Access → DDNS**, e.g. `yourstudio.synology.me`).
2. **Router:** forward ports **443** and **80** to your NAS (80 is only needed for the certificate).
3. **Certificate:** **Control Panel → Security → Certificate → Add → Add a new certificate → Get a certificate from Let's Encrypt**, for your domain.
4. **Reverse proxy:** **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**:
   - **Source:** protocol `HTTPS`, hostname `gallery.yourstudio.com`, port `443`
   - **Destination:** protocol `HTTP`, hostname `localhost`, port `8080`
   - Tab **Custom Header → Create → Custom**, add:
     - `X-Real-IP` = `$remote_addr`
     - `X-Forwarded-For` = `$proxy_add_x_forwarded_for`
     - `X-Forwarded-Proto` = `$scheme`

     (Without them, Folio sees every visitor as the NAS, and the activity statistics cannot tell visitors apart.)
5. **Use the certificate:** **Control Panel → Security → Certificate → Settings**, and choose your certificate for `gallery.yourstudio.com`.
6. **Tell Folio its address:** edit `folio.env` (for example with the **Text Editor** package, or edit it on your computer and upload it again):
   ```ini
   BASE_URL=https://gallery.yourstudio.com
   ```
   Then apply it: **Container Manager → Project → folio → Action → Stop**, and then **Action → Build**.

From now on, always open Folio on `https://gallery.yourstudio.com`, also for the admin (`https://gallery.yourstudio.com/admin`).

### Step 9: Back up

Set up **Hyper Backup** to back up `/docker/folio/data` (the database and settings) and your photo folder. The `cache` folder does not need a backup. Folio can also make a backup from the admin under **Settings → Backup**.

### Updating on Synology

When a new version is out, **Container Manager → Image** shows **Update available** next to `ghcr.io/rockbeater/folio`. Click it and choose **Update**. Container Manager restarts Folio with the new version. Your galleries and settings are kept, and database changes are applied automatically.

---

## Your first gallery

There are two ways, and you can mix them.

**From a folder:** in your photo folder, create a folder for the gallery and one subfolder per section:

```
Galleries/
├── Anna & Mads Wedding/
│   ├── Getting ready/
│   ├── Ceremony/
│   └── Reception/
└── Family Session 2026/
    └── Highlights/
```

Photos must be inside a section folder. Within a minute the gallery shows up in the admin as a **Draft**.

**From the browser:** in the admin, click **New gallery**, and drag photos (or whole folders) onto the page.

Then:

1. **Design:** choose the cover, fonts, colors and grid.
2. **Settings:** password, downloads, favorites, client access, expiry and more.
3. **Publish:** change the status from **Draft** to **Published**. Not ready yet but already sharing the link (for example at the wedding)? Choose **Pre-release**: the link shows a "coming soon" page where guests leave their email, and they get an email when you publish.
4. **Share:** set up email under **Settings → Email sending** once, then send the gallery from the **Email** tab, or copy the link.

The store is optional. Open it under **Store → Settings**, add a price list with products, shipping and VAT, and connect Stripe. The store page tells you what is missing before customers can order. See [docs/ADVANCED.md](docs/ADVANCED.md#store-and-stripe).

---

## Your own domain with HTTPS

Clients need a public HTTPS address. On a Synology NAS, follow [step 8 above](#step-8-make-the-galleries-reachable-for-clients-https). On another server, put a reverse proxy in front of Folio (Caddy, Nginx Proxy Manager, Traefik). Examples are in [docs/ADVANCED.md](docs/ADVANCED.md#https-and-reverse-proxies).

Then set the address in `.env`:

```ini
BASE_URL=https://gallery.yourstudio.com
```

and apply it:

```bash
docker compose up -d
```

> When `BASE_URL` is set, open Folio only on that address. If you open it on the local IP instead, forms (saving, logging in, paying) are refused for security.

---

## Updating

```bash
docker compose pull
```

```bash
docker compose up -d
```

Your galleries and settings are kept. Database changes are applied automatically when the new version starts. On a Synology NAS, see [Updating on Synology](#updating-on-synology).

---

## When something does not work

**Look at the log first.** It shows what Folio does: uploads, orders, payments, emails and errors.

- Server: `docker compose logs -f`
- Synology: **Container Manager → Container → folio → Log**

Common problems:

| What you see | What to do |
|---|---|
| Log says `cannot write to /photos` | `PUID`/`PGID` do not match the owner of your photo folder, or that user lacks read/write permission on it. |
| Saving or logging in fails with "Forbidden" | You opened Folio on another address than `BASE_URL`. Use the `BASE_URL` address. |
| Uploads fail through your domain but work on the local address | Your reverse proxy limits the request size. Folio uploads in pieces of 8 MB; allow at least that. |
| Customers cannot order | Open **Store** in the admin: the red box at the top lists what is missing. |
| Emails are not sent | **Settings → Email sending → Send test email** shows the error from your provider. |

More in [docs/ADVANCED.md](docs/ADVANCED.md).

## How Folio was made

Folio's code and documentation were written by Claude, Anthropic's AI model, working in Claude Code. The project owner set the goals, made the product decisions and tested every version.

## Documents

- [docs/ADVANCED.md](docs/ADVANCED.md): all settings, reverse proxies, store and Stripe, backups, development
- [MISSION.md](MISSION.md): purpose and architecture
- [FEATURES.md](FEATURES.md): features
- [DESIGN.md](DESIGN.md): design rules and visual direction
