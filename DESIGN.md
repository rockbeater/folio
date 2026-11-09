# Design

> **Status:** Første udkast, afledt af Pixieset-skærmbilleder af cover, galleri, køb af billede og kurv.

Denne fil samler designreglerne for kundeinterfacet og admin. Formålet og rammerne er beskrevet i [MISSION.md](MISSION.md), og funktionerne i [FEATURES.md](FEATURES.md).

**Flot frontend er et krav, ikke en bonus.** Kunden møder fotografens arbejde gennem vores interface. Hvis interfacet er grimt eller langsomt, ser billederne dårligere ud.

Knaptekster og labels i eksemplerne er skrevet på dansk. Første version af interfacet er på engelsk (se [FEATURES.md](FEATURES.md), afsnit 21).

---

## 0. Hvad vi lærer af Pixieset

Vi tager principperne med, men ikke udseendet 1:1. Vi bruger egne skrifttyper, egne ikoner og egne farver.

**Det, der virker, og som vi tager med:**

- Billedet er helten. Interfacet er hvidt, gråt og koksgråt, og al farve kommer fra fotografierne.
- Coveret er et billede i fuld skærmbredde med en mørk tone over, så den hvide titel er centreret og læsbar.
- Hierarki skabes med skriftstørrelse, vægt, versaler og spatiering, ikke med farver.
- Labels, navigation og knapper står i versaler med bred spatiering (`GRUPPEBILLEDER`, `ADD TO CART`). Brødtekst og produktnavne står med almindelige bogstaver.
- Formerne er flade og skarpe: kvadratiske hjørner, 1px linjer og ingen skygger.
- Grid'et har tætte mellemrum mellem billederne og luftige margener rundt om siden.
- Handlinger på billedet (køb, favorit, download, del) vises først, når man holder musen over.
- Købspanelet er delt i to: billedet til venstre på en sløret baggrund lavet af billedets egne farver, og et hvidt panel med produkterne til højre.
- Produktoptioner vælges i bokse med kant, hvor den valgte boks har en mørk kant. Der er en tydelig mængdevælger og én fyldt primærknap.
- Kurven står til venstre og ordreoversigten i en grå flade til højre.

**Det, vi gør bedre:**

- **Mobile first.** Paneler bliver til bundark (bottom sheets), handlinger er tilgængelige uden hover, og der er en fast købsknap i bunden.
- **Kontrast.** Pixiesets lysegrå tekst ligger omkring 2,8:1 mod hvid. Vores sekundære tekst skal mindst nå 4,5:1 (WCAG AA).
- **Ægte beskæring.** Vi viser kunden præcis, hvordan billedet beskæres til det valgte printformat, og lader kunden justere udsnittet. Pixieset skriver kun "Crop will be set automatically".
- **Prisen står på knappen** og opdateres, når man vælger: `LÆG I KURV · 29 kr.`
- **Rabatkoden kan bruges med det samme.** Et tryk på koden i kampagnebanneret kopierer den, og kurven har sit eget felt til rabatkoden, så kunden ikke skal vente til næste trin.
- **Priser formateres efter sprog:** `19 kr.` på dansk og `DKK 19.00` på engelsk, ikke `DKK19.00`.
- **Skrifttyperne er selvhostede** og ligger i Docker-imaget. Der sendes ingen forespørgsler til Google Fonts, så besøgendes IP-adresser ikke deles med tredjepart (GDPR).

---

## 1. Designprincipper

1. **Billedet først.** Interfacet må aldrig konkurrere med fotografierne: ingen farvede flader, ingen dekorationer og ingen skygger. Vi beskærer aldrig fotografens komposition i grid'et.
2. **Ro.** Én primær handling per skærm. Sekundære handlinger er tekstlinks eller ikoner.
3. **Selvforklarende.** En kunde uden teknisk erfaring skal kunne favoritmarkere, downloade og købe uden vejledning.
4. **Hurtigt er smukt.** Billeder toner ind fra en pladsholder, layoutet hopper aldrig, og navigationen føles øjeblikkelig.
5. **Touch er lige så vigtigt som mus.** Alt, der kan gøres med hover, kan også gøres med touch.
6. **Konsistens gennem tokens.** Farver, skrifttyper og afstande kommer fra design-tokens. Komponenterne hardcoder dem aldrig, så temaer og designvalg kun skifter tokens.

---

## 2. Visuel identitet

### Typografi

**Rollefordeling:**

| Rolle | Brug | Stil |
|---|---|---|
| **Display** | Cover-titel, galleri-titel, overskrifter | Versaler, bred spatiering, medium/semibold |
| **Label** | Navigation, knapper, feltlabels, tekstlinks | Display-skriften i lille størrelse med versaler og meget bred spatiering |
| **Brødtekst** | Beskrivelser, produktnavne, priser, formularer | Almindelige bogstaver og god læsbarhed |

**Regler:**

- Versaler laves med CSS (`text-transform: uppercase`), aldrig i selve teksten. Det gør oversættelser nemmere og undgår, at skærmlæsere staver ordene.
- Brødtekst er mindst `16px`. Det gælder også inputfelter, så iOS ikke zoomer ind.
- Priser og tal bruger tabeltal (`font-variant-numeric: tabular-nums`), så beløbene står på linje.
- Skrifttyperne skal understøtte æ, ø og å og resten af Latin Extended (til svensk, norsk og tysk senere).
- Kun skrifttyper med åben licens (OFL), og de selvhostes i imaget.

**Skala (kundeinterface):**

| Element | Størrelse | Spatiering | Vægt |
|---|---|---|---|
| Cover-titel | `clamp(2rem, 6vw, 4.5rem)` | `0.08em` | 500–600 |
| Sideoverskrift (fx KURV) | `1.5rem` | `0.12em` | 600 |
| Galleri-titel i header | `1.125rem` | `0.12em` | 600 |
| Label, navigation og knap | `0.75–0.8125rem` | `0.14–0.18em` | 500 |
| Brødtekst | `1rem` / linjehøjde `1.5` | normal | 400 |
| Metatekst (varianter, hjælpetekst) | `0.875rem` | normal | 400 |

**Skrifttype-sæt (designvalg per galleri), foreløbige forslag der skal afprøves med rigtige danske titler:**

| Sæt | Display | Brødtekst | Karakter |
|---|---|---|---|
| **Moderne** (standard) | Jost | Inter | Geometrisk, ren og tidløs |
| **Klassisk** | Cormorant Garamond | Source Sans 3 | Elegant, bryllup |
| **Editorial** | Playfair Display | Inter | Magasin, kontrastrig |
| **Minimal** | Inter | Inter | Neutral, kun vægtkontrast |

I sættene Klassisk og Editorial står cover-titlen med almindelige bogstaver i stedet for versaler, fordi serif-skrifter tager sig bedst ud sådan.

### Farver

Farverne defineres som tokens. Et tema skifter kun værdierne.

| Token | Brug |
|---|---|
| `--color-bg` | Sidebaggrund |
| `--color-surface` | Flader: kampagnebanner, ordreoversigt, sekundære knapper |
| `--color-text` | Primær tekst, primærknappens baggrund, valgt kant |
| `--color-text-muted` | Sekundær tekst, inaktiv navigation, varianter |
| `--color-border` | 1px linjer og kanter |
| `--color-accent` | Valgfri accent: badge på kurven og aktivt hjerte. Standard er lig `--color-text`. |
| `--color-scrim` | Mørk tone over billeder, bag hvid tekst |

**Farvetemaer (alle kontraster er målt og består WCAG AA):**

| Tema | `bg` | `surface` | `text` | `text-muted` | `border` | Kontrast for sekundær tekst mod `bg` |
|---|---|---|---|---|---|---|
| **Lys** (standard) | `#FFFFFF` | `#F4F4F2` | `#1E1E1E` | `#666666` | `#E4E4E1` | 5,7:1 |
| **Sand** | `#F6F1EA` | `#EDE5DA` | `#2A2520` | `#6B6157` | `#DDD3C6` | 5,4:1 |
| **Mørk** | `#121212` | `#1E1E1E` | `#F2F2F2` | `#A3A3A3` | `#2C2C2C` | 7,4:1 |
| **Sort** | `#000000` | `#111111` | `#FFFFFF` | `#9A9A9A` | `#262626` | 7,5:1 |

**Regler:**

- Kundeinterfacet har ingen brandfarve. Farven kommer fra billederne.
- Primærknappen er fyldt med `--color-text`, og teksten har `--color-bg`. Den inverteres altså automatisk i de mørke temaer.
- Tekst oven på billeder er altid hvid på en scrim (se afsnit 5, Cover).
- Status og feedback (fejl, succes) bruger dæmpede farver og har altid et ikon eller en tekst ved siden af. Farve alene må aldrig være det eneste signal.

### Former, linjer og ikoner

- **Hjørner:** `0` i kundeinterfacet. Det er skarpt som et print. Admin bruger `6px` (se afsnit 9).
- **Linjer:** `1px` i `--color-border`. Valgt tilstand har en kant på `1.5–2px` i `--color-text`.
- **Skygger:** ingen i kundeinterfacet. Lag adskilles med flader og scrim.
- **Ikoner:** ét gennemgående outline-sæt med streg på `1.5px` på et grid på `24px`. Forslag: Lucide (ISC-licens). Ikonerne vises i `20–24px` med et klikområde på mindst `44×44px`.

---

## 3. Layout og grid

### Afstande

Skala med `4px` som basis: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`. Der bruges ingen afstande uden for skalaen.

| | Mobil | Tablet | Desktop |
|---|---|---|---|
| Sidemargen | `16px` | `24px` | `32–48px` |
| Afstand mellem sektioner | `32px` | `48px` | `64px` |

- Tekstsider som kurv og checkout er maks. `1200px` brede, og brødtekst er maks. `65ch`.
- Billed-grid'et bruger hele bredden inden for sidemargenen.

### Billed-grid

- **Grid'et beskærer aldrig billederne.** Hvert billede vises i sit eget format.
- **Pladsen reserveres på forhånd** ud fra billedets dimensioner, så layoutet aldrig hopper.
- **Rækkefølgen er venstre mod højre.** Masonry-layoutet placerer billederne i den korteste kolonne i rækkefølge, så rækkefølgen bevares. CSS `columns` bruges ikke, fordi den læser oppefra og ned.

**Vertikal (masonry), antal kolonner:**

| Thumbnail-størrelse | Mobil | Tablet | Desktop | Stor skærm (≥1920px) |
|---|---|---|---|---|
| Normal | 2 | 3 | 4 | 5 |
| Stor | 1 | 2 | 3 | 4 |

**Horisontal (rækker med ens højde), målhøjde per række:**

| Thumbnail-størrelse | Mobil | Tablet | Desktop | Stor skærm |
|---|---|---|---|---|
| Normal | 160px | 220px | 280px | 320px |
| Stor | 240px | 320px | 400px | 480px |

Den sidste række strækkes ikke ud til fuld bredde.

**Afstand mellem billeder:**

| Grid-afstand | Mobil | Desktop |
|---|---|---|
| Normal | `4px` | `8px` |
| Stor | `12px` | `24px` |

---

## 4. Galleri-temaer og designvalg

Fotografen vælger designet per galleri med live preview på desktop og mobil. Designet kan gemmes som preset.

| Valg | Muligheder |
|---|---|
| **Cover** | Fuld skærm centreret · Fuld skærm nederst · Delt · Indrammet · Intet cover |
| **Skrifttyper** | Moderne · Klassisk · Editorial · Minimal |
| **Farve** | Lys · Sand · Mørk · Sort, plus en valgfri accentfarve |
| **Grid-stil** | Vertikal (masonry) · Horisontal (rækker) |
| **Thumbnail-størrelse** | Normal · Stor |
| **Grid-afstand** | Normal · Stor |
| **Navigationsstil** | Kun ikon · Ikon og tekst |

**Cover-layouts:**

1. **Fuld skærm centreret** (standard): billedet fylder hele skærmen. Titlen står i midten med en ghost-knap `SE GALLERI` under, og fotografens navn står nederst.
2. **Fuld skærm nederst:** som ovenfor, men titel og knap står nederst til venstre med scrim fra bunden.
3. **Delt:** billedet fylder den ene halvdel, og titlen står på den anden halvdel i `--color-bg`. På mobil står billedet øverst og teksten under.
4. **Indrammet:** billedet har en margen i `--color-bg`, og titlen og fotografens navn står under billedet.
5. **Intet cover:** galleriet starter direkte med titlen i headeren. Det er godt til mindre leverancer.

---

## 5. Komponenter

### Cover

- Højden er `100svh`, så coveret ikke hopper, når adresselinjen på mobil skjules.
- **Fokuspunkt:** fotografen sætter et fokuspunkt, som beskæringen holder i billedet på alle skærmformater, fx ansigterne i et gruppebillede.
- **Scrim:** en blød gradient i stedet for en flad mørk tone, så billedet forbliver lyst, og teksten alligevel er læsbar. Styrken tilpasses billedets lysstyrke bag teksten.
- `SE GALLERI` scroller blødt ned til galleriet. Coveret er en del af samme side, ikke en separat side.

### Ejer-bar

- Når fotografen er logget ind og ser galleriet, vises en tynd mørk bar øverst: "Du ser galleriet som ejer. Aktivitet registreres ikke." med linket `REDIGER`.

### Kampagnebanner

- Står øverst på siden i `--color-surface`: kampagneteksten centreret, så en lodret skillelinje og derefter `BRUG KODEN: FRAGT` med versaler og spatiering.
- Et tryk på koden kopierer den med beskeden "Kode kopieret". Lukkeknappen (✕) står til højre, og det huskes per galleri, at banneret er lukket.

### Header

- **Desktop:** til venstre galleri-titlen (Display) med fotografens navn i lille label under. I midten eller til venstre står sektionsnavigationen som labels: den aktive i `--color-text`, de inaktive i `--color-text-muted`. Til højre står `BUTIK` som tekstlink, så en lodret skillelinje og derefter ikonerne kurv, favoritter, download, del og slideshow.
- **Mobil:** titlen til venstre og ikonerne favoritter, kurv og menu til højre. Download, del og slideshow ligger i menuen. Sektionerne vises som en vandret scrollbar række under headeren.
- Headeren er fast (sticky) og bliver lavere, når man scroller.
- Kurv-ikonet har et badge med antal varer.
- **Sektioner:** hver sektion har sin egen visning med egen URL, så store sektioner på 700+ billeder indlæses hurtigt. Visningen "Alle" er valgfri.

### Billedfelt i grid'et

- Billedet vises i sit eget format uden kant, hjørneradius eller skygge.
- **Indlæsning:** først vises en pladsholder med billedets dominerende farve eller en sløret miniature, og derefter toner billedet ind over `300ms`.
- **Hover (kun enheder med mus):** en blød gradient i bunden med hvide ikoner for køb, favorit, download og del.
- **Touch:** et tryk åbner lightboxen, hvor alle handlinger findes. Favoritmarkerede billeder viser altid et lille udfyldt hjerte i hjørnet.

### Lightbox

- Fuld skærm i temaets baggrundsfarve. Billedet vises helt med `24–48px` luft på desktop og fra kant til kant på mobil.
- **Topbar:** luk (✕), tæller (`12 / 746`) og eventuelt filnavn.
- **Handlinger:** favorit, download, køb, del og slideshow. På desktop står de til højre i topbaren, og på mobil i en bundbar.
- **Navigation:** pile på desktop (også med tastaturet), swipe til siderne på mobil, swipe ned for at lukke, samt pinch eller dobbelttryk for at zoome til 100 % med panorering.
- Kontrollerne skjules efter 3 sekunder uden aktivitet på desktop. På mobil viser og skjuler et tryk dem.
- De næste og forrige billeder forudindlæses.

### Knapper

| Type | Udseende | Brug |
|---|---|---|
| **Primær** | Fyldt `--color-text`, tekst i `--color-bg`, versaler med spatiering, højde `48px`, fuld bredde på mobil | Én per skærm: `LÆG I KURV`, `GÅ TIL BETALING` |
| **Sekundær** | Fyldt `--color-surface`, tekst i `--color-text` | `REDIGER`, `FORTSÆT MED AT HANDLE` |
| **Ghost** | Gennemsigtig med `1px` hvid kant og hvid tekst. Ved hover bliver den hvid med mørk tekst | Oven på billeder: `SE GALLERI` |
| **Tekstlink** | Label med versaler, spatiering og chevron `›` | `BESØG BUTIKKEN ›`, `FLERE DETALJER ›` |
| **Ikonknap** | Ikon på `20–24px` i et klikområde på `44×44px` | Header og lightbox |

Deaktiverede knapper har lav opacitet og en forklaring, fx "Minimumsordre 200 kr.".

### Valg af option og antal

- **Optioner** (størrelse, papir) vises som bokse i et grid: mindst `88px` brede, `48px` høje og med `1px` kant. Den valgte boks har en kant på `2px` i `--color-text`. Skjulte variationer vises slet ikke.
- **Labelen viser det valgte:** `STØRRELSE   13x18`, hvor værdien står i `--color-text-muted`.
- **Antalsvælger:** `[ − ] [ 1 ] [ + ]` med klikområder på `44px`.

### Køb dette billede

- **Desktop:** delt visning. Billedet fylder ca. ⅓ til venstre og ligger på en kraftigt sløret, forstørret udgave af sig selv, så baggrunden får billedets egne farver. Panelet fylder ca. ⅔ til højre og glider ind fra højre.
- **Mobil:** et bundark i fuld højde. Billedet står øverst (maks. `40svh`), indholdet står under, og en fast bundbar viser `LÆG I KURV · 29 kr.`
- **Trin:**
  1. Produkter, opdelt i faner per kategori (`PRINTS`, `DIGITALT`). Hvert produkt vises med et kvadratisk billede, navn og "Fra"-pris.
  2. Produktdetalje: tilbage-pil, `FLERE DETALJER ›`, navn, pris, beskrivelse, optioner, antal og primærknap.
  3. Bekræftelse, "Lagt i kurven", med `SE KURV` og `FORTSÆT`.
- **Beskæring:** når en størrelse er valgt, vises den præcise beskæringsramme på billedet, og der er en knap til at justere udsnittet.

### Kurv

- **Desktop:** varelinjerne til venstre. Hver linje har en miniature med den valgte beskæring, produktnavn, varianter i `--color-text-muted`, knappen `REDIGER`, antalsvælger, pris og fjern (✕). Ordreoversigten står til højre i `--color-surface` med subtotal, felt til rabatkode, fragt og moms (når de kan beregnes), primærknappen `GÅ TIL BETALING` og tekstlinket `FORTSÆT MED AT HANDLE`.
- **Mobil:** linjerne og oversigten står under hinanden, og en fast bundbar viser totalen og `GÅ TIL BETALING`.
- Headeren skifter til butikstilstand med `BUTIK`, `SE GALLERI` og kurven.

### Download-dialog

- **Trin 1, hvad:** store valgbokse for hele galleriet, en sektion, favoritter eller dette billede. Hver boks viser antal billeder.
- **Trin 2, størrelse:** høj opløsning eller web med en anslået filstørrelse ("ca. 2,3 GB").
- **Trin 3** (kun hvis fotografen kræver det): e-mail og/eller PIN i samme dialog.
- På mobil kan et enkelt billede gemmes direkte i fotoappen via den indbyggede delingsfunktion.

### Adgangskodeside

- Coverbilledet ligger kraftigt sløret som baggrund. I midten står et panel med galleri-titlen, et felt til adgangskoden og knappen `ÅBN GALLERI`.

### Feedback og tilstande

- **Beskeder (toasts):** står nederst i midten (på mobil over bundbaren) i inverterede farver og forsvinder efter 4 sekunder.
- **Indlæsning:** pladsholdere med billedets farve og skeletter for tekst. Der bruges aldrig en spinner over hele siden.
- **Tomme tilstande:** et ikon og én hjælpsom sætning, fx "Tryk på ♡ for at gemme dine favoritter her."
- **Fejl:** kort, menneskelig tekst, hvad kunden kan gøre, og en knap til at prøve igen.

---

## 6. Responsivitet og breakpoints

| Navn | Bredde | Typisk enhed |
|---|---|---|
| `xs` | < 480px (designes ned til 320px) | Små telefoner |
| `sm` | 480–767px | Telefoner |
| `md` | 768–1023px | Tablets |
| `lg` | 1024–1439px | Laptops |
| `xl` | 1440–1919px | Desktop |
| `2xl` | ≥ 1920px | Store skærme |

- CSS'en skrives mobile first.
- Hover-funktioner ligger i `@media (hover: hover)`, og touch er standard.
- Faste bundbarer og lightboxen tager højde for notch og hjemmeindikator med `env(safe-area-inset-*)`.
- Fuldskærmselementer (cover, lightbox og bundark) bruger `svh`/`dvh`.
- Telefoner i liggende format har en lightbox, der fylder hele skærmen, og et kompakt cover.
- **Responsive billeder:** `srcset` i bredderne 320, 480, 640, 960, 1280, 1920, 2560 og 3600 med AVIF og WebP og JPEG som fallback. `sizes` beregnes ud fra layoutet, så der aldrig hentes et større billede end nødvendigt, og et billede aldrig skaleres op.

---

## 7. Bevægelse og animation

Bevægelse skal forklare, hvad der sker. Den må ikke pynte.

| Type | Varighed | Easing |
|---|---|---|
| Mikro (hover, fokus) | `120ms` | `ease-out` |
| UI (åbn/luk menuer, paneler) | `200ms` | `cubic-bezier(0.2, 0, 0, 1)` ind, `ease-in` ud |
| Store overgange (lightbox, bundark, billeder der toner ind) | `300–400ms` | `cubic-bezier(0.2, 0, 0, 1)` |

- **Lightbox:** billedet vokser fra sin plads i grid'et og op til fuld skærm, og ved lukning glider det tilbage.
- **Billeder:** toner ind fra pladsholderen. De "popper" aldrig ind.
- **Favorit:** hjertet fyldes med en lille hop (skala 1 → 1,2 → 1 over `200ms`).
- **Paneler:** glider ind fra højre på desktop og op fra bunden på mobil.
- **Header:** krymper blødt, når man scroller.
- Der bruges ingen parallax og ingen karruseller, der kører af sig selv. Slideshowet starter kun, når kunden selv starter det.
- `prefers-reduced-motion` respekteres: bevægelse erstattes af korte overtoninger eller fjernes helt.

---

## 8. Tilgængelighed

Målet er **WCAG 2.2 AA** i både kundeinterface og admin.

- **Kontrast:** almindelig tekst mindst 4,5:1 og stor tekst og ikoner mindst 3:1. Temaerne i afsnit 2 er målt.
- **Fokus:** en tydelig fokusring på alle interaktive elementer, som aldrig fjernes. Fokus fanges i dialoger og lightbox og vender tilbage til udgangspunktet ved lukning.
- **Tastatur:** alt kan betjenes med tastaturet. Lightboxen understøtter pile og `Esc`, og grid'et kan navigeres med `Tab`.
- **Skærmlæsere:** ikonknapper har tilgængelige navne ("Tilføj til favoritter"), billeder har alt-tekst (som minimum filnavn og sektion), og `lang` sættes efter galleriets sprog.
- **Touch:** klikområder er mindst `44×44px`.
- **Farve er aldrig eneste signal.** Status har altid tekst eller ikon.
- **Lange ord:** danske og tyske ord som `BILLEDER TIL GENNEMGANG` må aldrig bryde layoutet. Der bruges ingen faste bredder på knapper og navigation.

---

## 9. Admin-interface

Admin er et værktøj, ikke en udstilling. Det skal være roligt, tydeligt og effektivt, men følge samme visuelle sprog som kundeinterfacet.

**Layout:**

- **Global navigation:** **Gallerier** og **Butik**. Butikken har undernavigationen Ordrer, Kunder, Produkter, Moms, Fragt, Rabatkoder og Indstillinger.
- **Galleri-editoren:**
  - Topbar med navn og dato, statusvælger, søgning, `Preview` og `Del`.
  - Venstre panel med cover og fanerne Billeder, Design, Indstillinger og Aktivitet.
  - Indhold til højre.
  - I design-fanen står indstillingerne i midten og en live preview til højre med skift mellem desktop og mobil.

**Mønstre:**

- **Indstillinger:** hver indstilling har titel, kontrol og én linje hjælpetekst nedenunder, der forklarer, hvad den gør. Indstillingsmenuen viser `TIL`/`FRA`-badges for Download, Favoritter og Butik.
- **Gem:** kontakter og valg gemmes med det samme og bekræftes med et diskret "Gemt". Formularer i dialoger har `Annuller` og `Gem` nederst.
- **Tabeller:** filter per kolonne, paginering, eksportknap øverst til højre, og et klik på rækken åbner detaljen.
- **Upload:** tydelige felter at slippe filer i, med fremdrift per fil og samlet.
- **Destruktive handlinger:** kræver bekræftelse og forklarer konsekvensen ("Mappen flyttes til papirkurven i 30 dage").

**Visuelt:**

- Samme neutrale palet som temaet Lys med én accentfarve til primærknapper, aktiv fane, kontakter og links. Foreløbigt forslag: blæk-blå `#2B4C7E`, der har kontrast 8,6:1 mod hvid.
- Hjørneradius `6px` på knapper, felter og kort. Admin er blødere end kundeinterfacet.
- Skrifttypen er Inter for alt. Versaler bruges kun til små sektionslabels (`INDSTILLINGER`, `DESIGN`).
- Mørk tilstand følger styresystemet.
- Admin er bygget til desktop først, men fungerer fuldt på tablet. På mobil skal de vigtigste opgaver virke: se ordrer, dele et galleri og slå indstillinger til og fra.

---

## 10. Kvalitetskrav til frontend

En skærm er først færdig, når:

- [ ] Den er testet i størrelserne `375×667`, `390×844`, `768×1024`, `1440×900` og `2560×1440`.
- [ ] Der ikke er vandret scroll, og layoutet ikke hopper (CLS < 0,1).
- [ ] Coveret indlæses hurtigt på 4G (LCP < 2,5 s).
- [ ] Indlæsning, tom tilstand, fejl og succes alle er designet.
- [ ] Temaerne Lys og Mørk er tjekket.
- [ ] Den er tjekket med lange titler og lange danske ord.
- [ ] Den kan bruges med tastatur og skærmlæser.
- [ ] Den er tjekket med `prefers-reduced-motion`.
