# Security

Folio holds other people's photos, personal data and payments. Security is part of every feature, not added afterwards. This page describes how Folio is built to protect them, and how to report a problem.

## Reporting a vulnerability

Please report security problems privately, not in a public issue. Use **Security → Report a vulnerability** on the GitHub repository. Include the steps to reproduce, the version (image tag or commit) and what an attacker could reach.

You will get an answer as soon as possible. Fixes are released as a new image, and the problem is described once updating is possible.

## Principles

**The server decides.** Everything that matters is checked on the server on every request: who you are, what you may see, what things cost, and whether a payment happened. Nothing the browser sends is trusted on its own. Hidden fields, changed prices, edited IDs and made-up roles have no effect.

**Least access by default.** New galleries are drafts. Guests see only what the photographer has shared with them. Private photos and client sections never reach a guest, not even as a thumbnail. Admin pages, form actions and API calls all require a login, checked centrally before any route runs.

**No secrets in the browser.** Stripe keys, SMTP passwords and signing keys stay on the server. Pages only ever get what they show.

**Small attack surface.** Folio is one process with a local database. No public database port, no third-party scripts, no tracking and no AI features. Payments go through Stripe's hosted checkout, so card data never touches Folio.

## How it is done

### Accounts and sessions

- Passwords are hashed with scrypt. Login, two-factor and recovery codes are compared in constant time.
- Two-factor login (TOTP) with one-time recovery codes. Recovery codes are stored as hashes.
- Session tokens are random and stored only as hashes. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS. Changing the password ends all sessions.
- Failed attempts are limited per visitor and per account or gallery, so guessing does not pay off, including when it is spread over many addresses.
- The first admin account can only be created with a one-time setup code that only the person running the server can see.

### Galleries and sharing

- Gallery passwords, client access, download PINs and share links are checked on the server. Unlocks are kept in signed cookies that cannot be forged or moved to another gallery.
- Every query for photos, favorites, lists and downloads is scoped to the gallery and to the visitor's own signed identity. Changing an ID in the address gives nothing.
- Photos are served through Folio, never from a public folder. Originals and full-size copies are only sent when the gallery allows downloads for that visitor.

### Store and payments

- Prices, discounts, shipping, VAT and totals are calculated on the server from the product catalog. Quantities and amounts are validated and clamped.
- An order is only marked as paid by a Stripe webhook with a valid signature, within a short time window. Repeated events are handled safely.
- Limited coupons are counted while a checkout is in progress, so parallel checkouts cannot use the same coupon more often than allowed.
- Digital downloads are tied to the paid order behind a long random link.

### Input, output and files

- All text is escaped when shown. Rich text from the photographer only allows a small set of formatting and `http(s)` links. Emails are escaped the same way.
- A strict Content Security Policy only allows Folio's own scripts. Pages cannot be framed by other sites.
- Uploads are checked by type and name, and photos are decoded and processed by the image library before anything is shown. File names cannot leave the photo folder.
- Backups are restored with path checks, so an archive cannot write outside the data folder.
- CSV exports are written so spreadsheet programs do not run cell contents as formulas.

### Abuse and cost

- Logins, passwords, PINs, email sign-ups, checkouts, archive downloads and notification emails have limits, so one visitor or script cannot flood the server, the photographer's inbox or the Stripe account.
- Cross-site form posts are refused. The visitor's real address is only taken from proxy headers when the request comes from the local proxy.

### Headers

`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` on every response. `Strict-Transport-Security` over HTTPS. Admin responses are not cached. Search engines are asked not to index galleries.

### Running Folio

- The Docker image runs Folio as a normal user, not as root.
- Secrets live in the data folder or in environment variables, never in the repository or the image.
- Dependencies are kept up to date and checked for known vulnerabilities. Every change runs type checks and tests before an image is published.

See [docs/ADVANCED.md](docs/ADVANCED.md#security) for what you as the operator should do: HTTPS, the reverse proxy, the setup code and backups.

## Privacy

Folio stores only what galleries and orders need. Under **Settings → Privacy** the photographer can find, export and delete the data stored for an email address. Orders are kept for bookkeeping. Visits from the photographer's own devices are left out of the statistics.
