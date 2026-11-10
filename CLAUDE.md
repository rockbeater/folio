# Instruktioner til Claude

## Git

- Arbejd direkte på `main`. Commit og push til `main`, når en opgave er færdig.
- Opret ikke feature-branches eller pull requests, medmindre jeg beder om det. Det gælder også, når sessionen tildeler en `claude/...`-branch.

## Projektet

Projektet hedder **Folio**: et selvhostet alternativ til Pixieset med galleri og butik.

**Byg generelt.** Folio er et produkt til alle fotografer, ikke skræddersyet til ejerens forretning. Hardcod aldrig studienavne, sprog, valuta, lande, priser eller tekster. Alt den slags er indstillinger med neutrale standardværdier. Eksempler i dokumenterne (fx danske priser eller navne) er kun eksempler.

- [MISSION.md](MISSION.md): formål og arkitektur.
- [FEATURES.md](FEATURES.md): alle funktioner, der skal implementeres. Kryds punkter af, når de er implementeret.
- [DESIGN.md](DESIGN.md): design og visuel retning.
- [README.md](README.md): den simple trin-for-trin-guide (server og Synology). Alt teknisk står i [docs/ADVANCED.md](docs/ADVANCED.md). Hold begge opdateret, når indstillinger eller opsætning ændres.

## Kode

- SvelteKit (Svelte 5, runes) + TypeScript, SQLite via Drizzle (`src/lib/server/db/schema.ts`, migrationer i `drizzle/`), billeder via sharp.
- Server-kode ligger i `src/lib/server/`: `library/` (scanning af fotomappen), `images/` (cache-filer), `mail/` (e-mail), `access.ts` og `client.ts` (adgang, roller gæst/kunde/ejer), `lists.ts` og `shares.ts` (favoritlister og delingslinks), `store/` (butik, kurv, ordrer og Stripe via REST), `totp.ts`, `gdpr.ts` og `backup.ts`.
- Butikslogik, der deles af server og klient (priser, varianter, moms, totaler), ligger i `src/lib/store.ts`. Beløb er heltal i valutaens mindste enhed.
- Alt under `/admin` kræver login i `src/hooks.server.ts`. Form actions kører ikke layoutets load, så stol ikke på layoutet til adgangskontrol.
- Kundegalleri: `src/routes/g/[slug]/` og `src/lib/components/client/`. Admin: `src/routes/admin/` og `src/lib/components/admin/`.
- Al brugertekst ligger i `src/lib/i18n/en.ts`. Skriv aldrig tekst direkte i komponenterne.
- Designtokens ligger i `src/lib/styles/base.css` (kunde) og `admin.css` (admin). Følg DESIGN.md.
- Efter ændringer i skemaet: `npm run db:generate` og commit migrationen.
- Kør `npm run check` og `npm test` før commit. Produktion: `npm run build` og `npm start` (server.js).
- Docker-imaget bygges og publiceres af `.github/workflows/ci.yml` ved push til `main`.
