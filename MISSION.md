# Mission

> Arbejdstitel: **pixieset_replace**. Endeligt navn vælges senere.

## Kort fortalt

Vi bygger et **selvhostet alternativ til Pixieset**. Fotografer bruger det til at levere smukke gallerier til deres kunder og til at sælge prints og digitale filer. Det hele kører i **én Docker-container** på fotografens egen server eller NAS, og billederne ligger i en **almindelig mappe**, som fotografen selv har adgang til.

## Hvorfor

- **Ejerskab:** Billederne, kunderne og betalingerne er fotografens egne. Der er ingen tredjepart imellem, ingen lagergrænser og ingen platformsgebyr på salg.
- **Det passer til den måde, fotografer arbejder på:** Mange fotografer har allerede billederne på en NAS eller server. Et galleri skal kunne oprettes ved at lægge en mappe på et SMB-share, uden at billederne skal uploades til en cloud-tjeneste.
- **Pengene går direkte til fotografen:** Betalinger går ind på fotografens egen Stripe-konto.

## For hvem

| Bruger | Behov |
|---|---|
| **Fotografen (admin)** | En enkelt fotograf eller et lille studie. Vil levere gallerier hurtigt, styre adgang og downloads og sælge prints, uden at bruge tid på teknikken. |
| **Kunden** | Modtager et galleri, ofte på mobilen og som regel uden teknisk erfaring. Skal kunne se, vælge favoritter, downloade og bestille uden vejledning. |

## Kerneprincipper

1. **Filsystemet er sandheden for billeder.** Mappestrukturen *er* gallerierne. Hvad der ligger på disken, vises i galleriet.
2. **Kundeoplevelsen er produktet.** Kundeinterfacet skal være ekstremt responsivt, hurtigt og smukt på alle skærmstørrelser. Kunden må aldrig være i tvivl om, hvordan man downloader eller bestiller.
3. **Simpel drift.** Én container, tydelige volumes, fornuftige standardindstillinger. Man skal kunne gå fra `docker compose up` til et delt galleri på få minutter.
4. **Klar til salg fra start.** Webshoppen bygges efter galleri-kernen, men datamodellen og arkitekturen tager højde for den fra dag ét.
5. **Betaling uden friktion.** Stripe skal kunne sættes op af en fotograf med en helt almindelig Stripe-konto, uden udviklerhjælp.
6. **Privatliv og sikkerhed som standard.** Gallerier er private, indtil fotografen siger andet. Ingen kortdata rører vores server.

---

## Arkitektur i hovedtræk

### Docker

Programmet leveres som et **rigtigt Docker-image**, der bygges og publiceres automatisk (fx på GitHub Container Registry). Imaget skal være multi-arch (`amd64` og `arm64`), så det også kører på NAS'er og små servere.

Selve mappeforbindelsen laves som et **volume mount**. Dockerfilen deklarerer de mapper, containeren forventer, og i `docker-compose.yml` (eller `docker run -v`) peger man dem på de rigtige mapper på værten.

| Sti i containeren | Indhold | Bemærkning |
|---|---|---|
| `/photos` | Originalbillederne: én mappe per galleri | Skal være skrivbar, fordi upload via webinterface skriver hertil. Kan være en SMB/NFS-mappe på en NAS. |
| `/data` | Database og konfiguration | Det eneste, der skal tages backup af ud over billederne. |
| `/cache` | Genererede thumbnails og webstørrelser | Kan slettes når som helst og genskabes automatisk. |

Eksempel (illustrativt, den endelige konfiguration fastlægges under udviklingen):

```yaml
services:
  gallery:
    image: ghcr.io/rockbeater/pixieset_replace:latest
    ports:
      - "8080:8080"
    environment:
      - BASE_URL=https://galleri.ditdomaene.dk
      - PUID=1000            # filrettigheder på /photos, vigtigt på NAS
      - PGID=1000
      - TZ=Europe/Copenhagen
    volumes:
      - /mnt/nas/gallerier:/photos
      - ./data:/data
      - ./cache:/cache
    restart: unless-stopped
```

HTTPS håndteres af en reverse proxy foran containeren (fx Caddy, Traefik eller Nginx Proxy Manager). Containeren har et healthcheck og kan opdateres ved at hente et nyt image.

### Mappestruktur

```
/photos
├── 2026-06-14 Bryllup Anna & Mads/      ← galleri
│   ├── Forberedelser/                   ← sektion
│   │   ├── IMG_0001.jpg
│   │   └── IMG_0002.jpg
│   ├── Vielse/                          ← sektion
│   └── Fest/                            ← sektion
└── Familie Jensen/                      ← galleri
    └── Highlights/                      ← sektion
```

**Regler:**

- **Hver mappe i roden er et galleri.**
- **Hver undermappe i et galleri er en sektion**, ligesom "sets" i Pixieset. Sektionerne sorteres alfabetisk som standard, og rækkefølgen kan ændres i admin.
- **En sektion indeholder kun billeder.** Dybere mapper og andre filtyper ignoreres og vises som en advarsel i admin.
- **Understøttede formater:** JPEG, PNG og WebP fra start. HEIC og AVIF er mål. RAW-filer understøttes ikke.
- **To veje ind, samme resultat:** Billeder kan tilføjes ved at oprette mapper og kopiere filer direkte (fx via SMB) eller ved at oprette gallerier og sektioner og uploade via webinterfacet. Begge dele ender som filer i `/photos`.
- **Ændringer opdages automatisk.** Der bruges en filwatcher kombineret med periodisk scanning, fordi filnotifikationer ikke virker pålideligt på netværksdrev.
- **Nye gallerier fra filsystemet oprettes som kladde.** De er ikke synlige for kunder, før fotografen publicerer dem.
- **Genererede filer skrives aldrig i `/photos`.** Thumbnails og webstørrelser ligger i `/cache`, så originalmapperne forbliver rene.

### Metadata: fil per mappe eller database?

Indstillinger som "downloads tilladt", adgangskode, udløbsdato, prisliste og design kunne enten ligge i en lille fil i hver mappe eller i en database. Det har vi vurderet:

| | Fil i mappen | Database |
|---|---|---|
| Overlever kopiering og backup af mappen | ✅ | ❌ (kræver backup af `/data`) |
| Sikkerhed: adgangskoder og priser kan ikke ændres af alle med SMB-adgang | ❌ | ✅ |
| Konsistens med ordrer, favoritter og download-log | ❌ | ✅ |
| Hurtige opslag uden at læse fra netværksdrev | ❌ | ✅ |
| Ingen konflikter mellem redigering i UI og i fil | ❌ | ✅ |

**Beslutning (foreløbig): Databasen (SQLite i `/data`) er sandheden for alle indstillinger.** Filsystemet er kun sandheden for billeder og struktur.

Et problem skal dog løses: Hvis man omdøber en galleri-mappe via SMB, må indstillingerne ikke gå tabt. Derfor lægger programmet en **lille skjult id-fil** (fx `.gallery-id`) i hver galleri-mappe. Den indeholder kun galleriets id og ingen indstillinger. På den måde genkendes galleriet, selv om mappen omdøbes eller flyttes.

Mulig udvidelse senere: en valgfri `galleri.yml`, der læses **én gang** som skabelon, når et galleri oprettes fra filsystemet, og eksport/import af galleri-indstillinger.

### Kundeinterface

- **Mobile first** og hurtigt: responsive billedstørrelser, lazy loading, slørede pladsholdere og en fuldskærmsvisning med swipe.
- **Favoritter**, deling af galleri-link og evt. kommentarer til fotografen.
- **Intuitiv downloadproces:**
  1. Vælg *hvad*: hele galleriet, en sektion, favoritter eller et enkelt billede.
  2. Vælg *størrelse*: web eller høj opløsning (styret af fotografen per galleri).
  3. Eventuelt e-mail eller download-PIN, hvis fotografen kræver det.
  4. Downloaden **starter med det samme**: ZIP-filer streames løbende i stedet for at blive bygget først. På mobil kan enkeltbilleder gemmes direkte i fotoappen.
- **Designvalg:** Flere temaer, cover-layouts, grid-stile og typografi, som kan vælges per galleri. Detaljerne beskrives i [DESIGN.md](DESIGN.md).

### Webshop

Webshoppen er forberedt i arkitekturen fra start og implementeres efter galleri-kernen.

- **Produkter og print options:** Prints, lærreder, rammer og lignende med varianter (størrelse, papir, finish).
- **Prislister:** Flere prislister, der knyttes til gallerier. Det samme produkt kan have forskellig pris i forskellige prislister.
- **Digitale produkter:** Salg af højopløselige enkeltbilleder eller hele gallerier.
- **Shipping:** Forsendelsesmetoder, lande og zoner, fast pris, fri fragt over et beløb og afhentning.
- **Moms:** Priser vises inklusive moms (standard 25 % i Danmark) med korrekt specifikation på kvitteringen.
- **En god ordre-backend:** Ordrestatus (betalt, i produktion, afsendt, leveret), beskeder til kunden og eksport af ordrens filer til print/lab (fx en ZIP med filer navngivet efter størrelse og antal).
- **Fulfillment:** Fotografen håndterer selv ordrerne til at starte med. Integration med printlab er forberedt, men kommer senere.

### Betaling med Stripe

- **Stripe Checkout** (Stripes egen betalingsside) bruges, så ingen kortdata rører vores server, og PCI-byrden er minimal. Kort, Apple Pay, Google Pay og MobilePay kan slås til i Stripe uden ekstra kode.
- **Nem opsætning til en almindelig Stripe-konto:**
  1. Admin → Betaling → indsæt API-nøgle.
  2. Programmet validerer nøglen og viser kontoens navn, så man kan se, at det er den rigtige konto.
  3. Programmet **opretter selv webhook-endpointet** i Stripe og gemmer signing secret. Man skal ikke ind i Stripes udviklerindstillinger.
  4. Lav et testkøb i test mode, og skift derefter til live med ét klik.
- Ordrer markeres først som betalt, når Stripe har bekræftet betalingen via webhook. Det er ikke nok, at kunden er sendt tilbage til siden.
- Pengene går direkte til fotografens egen Stripe-konto.
- Webhooks kræver, at installationen kan nås fra internettet via `BASE_URL`.

---

## Ikke-mål (indtil videre)

- Multi-tenant SaaS med mange fotografer på én installation.
- Andre betalingsudbydere end Stripe.
- CRM, kontrakter, fakturering og bookingkalender (svarende til Pixieset Studio Manager).
- Website-builder.
- Video i gallerier.
- RAW-filer.

## Succeskriterier

- Fra `docker compose up` til første delte galleri på **under 10 minutter**.
- En ny mappe på NAS'en dukker op i admin (som kladde) **inden for et minut**.
- En kunde på mobilen kan finde, favoritmarkere og downloade billeder **uden vejledning**.
- Et galleri med **1.000+ billeder** føles hurtigt på en mobil over 4G.
- Stripe kan sættes op på **under 5 minutter** uden at læse dokumentation.

## Åbne spørgsmål

- Hvad sker der med billeder, der ligger direkte i galleriets rod uden en sektion? De kan vises som en standardsektion eller ignoreres med en advarsel.
- Skal vi have en `galleri.yml` som skabelon ved oprettelse fra filsystemet?
- Teknologivalg: sprog, framework og om SQLite skal suppleres med Postgres som mulighed.
- Får kunder rigtige konti, eller er adgang via link, e-mail og PIN nok?
- Hvad skal der ske med ordrer, når et billede slettes fra disken?
- Endeligt produktnavn.

## Relaterede dokumenter

- [FEATURES.md](FEATURES.md): Den samlede liste over funktioner, der skal implementeres.
- [DESIGN.md](DESIGN.md): Designprincipper, temaer og visuel retning.
