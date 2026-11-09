# Features

> **Status:** Første udkast, afledt af Pixieset-skærmbilleder af galleri og butik.

Denne fil er den samlede liste over alle funktioner, der skal implementeres. Formålet og rammerne er beskrevet i [MISSION.md](MISSION.md).

Folio består kun af **galleri** og **butik**. Pixiesets Website, Studio Manager, Mobile Gallery App og Photo Editor er bevidst udeladt. Vi bygger tilsvarende funktionalitet, men med vores eget design (se [DESIGN.md](DESIGN.md)).

**Prioritet:** `MVP` = første brugbare version · `v1` = første fulde version · `Senere` = på listen, men ikke planlagt

### Ordliste

| Pixieset | Hos os |
|---|---|
| Collection | Galleri |
| Set | Sektion |
| Price Sheet | Prisliste |
| Homepage | Forside |

---

## 1. Admin: overblik

- [ ] `MVP` Dashboard med to områder: **Gallerier** og **Butik**.
- [ ] `MVP` Galleri-oversigt: alle gallerier som kort med cover, navn, dato, status og antal billeder.
- [ ] `MVP` Opret galleri med navn og valgfri event-dato. Det opretter mappen i `/photos`.
- [ ] `v1` Filtrér gallerier på status og kategori-tags, søg på navn, og sortér efter dato, navn eller oprettelse.
- [ ] `v1` Søg i hele billedbiblioteket på tværs af gallerier (filnavn).
- [ ] `v1` Nøgletal på dashboardet: nye ordrer, seneste aktivitet og gallerier, der snart udløber.

## 2. Galleri og filsystem

- [ ] `MVP` Hver mappe i `/photos` er et galleri, og hver undermappe er en sektion.
- [ ] `MVP` Ændringer opdages automatisk med en filwatcher og periodisk scanning.
- [ ] `MVP` "Scan nu"-knap per galleri og globalt.
- [ ] `MVP` Nye gallerier fra filsystemet oprettes som kladde.
- [ ] `MVP` En skjult `.folio-id`-fil sørger for, at omdøbte eller flyttede mapper genkendes.
- [ ] `MVP` Advarsler i admin om ugyldigt indhold: dybere mapper, filer der ikke er billeder, og ulæselige filer.
- [ ] `MVP` Thumbnails og webstørrelser genereres i `/cache` i flere bredder og moderne formater (WebP/AVIF). Det sker i en baggrundskø med fremdriftsvisning.
- [ ] `MVP` Korrekt EXIF-rotation og konvertering til sRGB ved visning. Originalerne røres aldrig.
- [ ] `MVP` Ændrede filer genbehandles automatisk, og slettede filer forsvinder fra galleriet.
- [ ] `v1` Papirkurv: billeder og sektioner, der slettes via admin, flyttes til `/photos/.trash` og tømmes efter 30 dage.
- [ ] `v1` Advarsel, hvis man sletter et billede, der indgår i en ubehandlet ordre.
- [ ] `Senere` Valgfri `galleri.yml`, der bruges som skabelon, når et galleri oprettes fra filsystemet.

## 3. Galleri-editor: billeder og sektioner

- [ ] `MVP` Topbar med redigerbart galleri-navn, event-dato, statusvælger (Kladde / Publiceret / Skjult), søgning i galleriet, Preview og Del.
- [ ] `MVP` Venstre panel med cover-billede og fanerne **Billeder**, **Design**, **Indstillinger** og **Aktivitet**.
- [ ] `MVP` Sektionsliste med antal billeder. Tilføj sektion (opretter en undermappe), omdøb (omdøber mappen) og slet.
- [ ] `MVP` Træk og slip for at ændre sektionernes rækkefølge.
- [ ] `MVP` Upload ved at trække filer eller hele mapper ind, med fremdriftsvisning. En mappe bliver til en ny sektion.
- [ ] `MVP` Sortering per sektion: filnavn (naturlig sortering, så `IMG_2` kommer før `IMG_10`), optagelsesdato (EXIF) eller manuelt med træk og slip.
- [ ] `MVP` Valg af thumbnail-størrelse i admin-visningen.
- [ ] `MVP` Vælg cover-billede fra galleriet.
- [ ] `v1` Robust upload af store mængder: chunked upload, der kan genoptages, og håndtering af dubletter (spring over / erstat / omdøb).
- [ ] `v1` Fokuspunkt på coveret, så beskæringen rammer rigtigt på både mobil og desktop.
- [ ] `v1` Massehandlinger: vælg flere billeder og flyt, kopier, skjul, slet, download dem eller opret et hurtigt delingslink (se afsnit 7).
- [ ] `v1` Skjul enkelte billeder for kunden uden at slette filen.
- [ ] `v1` "Mere"-menu: anvend preset, kopier indstillinger fra et andet galleri, download originaler og slet galleri.

## 4. Galleri-editor: design

- [ ] `MVP` Live preview i editoren med skift mellem desktop og mobil.
- [ ] `MVP` **Cover:** flere cover-layouts med titel, dato, fotografens navn og en "Se galleri"-knap.
- [ ] `MVP` **Grid-stil:** Vertikal (masonry i kolonner) og Horisontal (rækker med ens højde).
- [ ] `v1` **Typografi:** kuraterede skrifttype-par til overskrift og brødtekst.
- [ ] `v1` **Farve:** farvetemaerne Lys, Sand, Mørk og Sort samt en valgfri accentfarve.
- [ ] `v1` **Thumbnail-størrelse:** Normal / Stor.
- [ ] `v1` **Grid-afstand:** Normal / Stor.
- [ ] `v1` **Navigationsstil:** Kun ikon / Ikon og tekst.
- [ ] `v1` Design-presets: gem et design og brug det som standard for nye gallerier.

De konkrete layouts, skrifttyper og farver beskrives i [DESIGN.md](DESIGN.md).

## 5. Galleri-editor: indstillinger

Indstillingerne er delt op i Generelt, Privatliv, Download, Favoritter og Butik. Download, Favoritter og Butik viser deres TIL/FRA-status direkte i menuen.

### 5.1 Generelt

- [ ] `MVP` Galleri-URL (slug): unik og autogenereret ud fra navnet med korrekt translitterering af æ, ø og å, så "Rørvig" bliver til `roervig` og ikke `rrvig`.
- [ ] `v1` Kunde tilknyttet galleriet (navn og e-mail). Bruges til deling og notifikationer, ikke som CRM.
- [ ] `v1` Kategori-tags, fx bryllup, familie eller udendørs.
- [ ] `v1` Standard-vandmærke: vælg blandt vandmærkerne fra de globale indstillinger, eller intet.
- [ ] `v1` Auto-udløb: galleriet skjules automatisk på en bestemt dato, og kunden kan få en påmindelsesmail et antal dage før.
- [ ] `v1` E-mailregistrering: besøgende angiver e-mail, før de får adgang. Registreringerne vises under Aktivitet.
- [ ] `v1` Galleri-guide: introkort, der viser nye besøgende, hvordan man favoritmarkerer, downloader og køber.
- [ ] `v1` Slideshow til/fra.
- [ ] `v1` Vis filnavne til/fra, så kunden kan henvise til et bestemt billede.
- [ ] `v1` Sprog for kundevisningen per galleri. Standardsproget kommer fra de globale indstillinger.

### 5.2 Privatliv

- [ ] `MVP` Galleri-adgangskode med en "Generer"-knap.
- [ ] `v1` Vis på forsiden til/fra (standard: fra).

**Gæsteadgang og kundeadgang:**

Et galleri kan have to adgangsniveauer. **Gæster** (fx bryllupsgæster og familie) bruger det almindelige galleri-link og eventuelt galleri-adgangskoden. **Kunden** (fx brudeparret) logger ind med en separat kundeadgangskode og ser mere end gæsterne.

- [ ] `v1` Kundeadgang til/fra per galleri.
- [ ] `v1` Kundeadgangskode med en "Generer"-knap, adskilt fra galleri-adgangskoden. Er der også en galleri-adgangskode, skal gæster stadig bruge den.
- [ ] `v1` Sektioner kun for kunden: fotografen vælger sektioner, som kun kunden kan se, fx "Forberedelser".
- [ ] `v1` Kunden kan markere enkelte billeder som private. De skjules for gæster, men er stadig synlige for kunden med et låse-ikon. Kunden kan fjerne markeringen igen.
- [ ] `v1` Fotografen kan slå kundens mulighed for at markere private billeder til og fra.
- [ ] `v1` Download kan indstilles forskelligt for gæster og kunden, fx kan kun kunden downloade i høj opløsning.
- [ ] `v1` Gæster kan aldrig se, finde, downloade eller købe private billeder og sektioner kun for kunden. Det gælder også via direkte billed-URL'er, søgning, slideshow, delte favoritlister og ZIP-downloads. Adgangen kontrolleres på serveren.

### 5.3 Download

- [ ] `MVP` Fotodownload til/fra.
- [ ] `MVP` Downloadstørrelser: Høj opløsning (Original eller 3600px) og/eller Webstørrelse (2048, 1024 eller 640px). Fotografen bestemmer, hvilke kunden kan vælge imellem.
- [ ] `v1` Download-PIN: kunden skal indtaste en 4-cifret PIN for at downloade.
- [ ] `v1` Avancerede indstillinger: begræns download til udvalgte sektioner.
- [ ] `v1` Download af enkeltbilleder til/fra, adskilt fra "download alle".
- [ ] `v1` Kræv e-mail ved download, så downloads kan spores per person.
- [ ] `v1` Vandmærke på downloads i webstørrelse til/fra.
- [ ] `Senere` Begrænset antal gratis downloads, fx maks. N billeder.

### 5.4 Favoritter

- [ ] `MVP` Favoritter til/fra.
- [ ] `MVP` Favoritter knyttes til en e-mail (kunden bliver spurgt første gang), så fotografen kan se, hvem der har valgt hvad.
- [ ] `v1` Favoritnoter: kunden kan skrive en note til et favoritmarkeret billede.
- [ ] `v1` Foruddefinerede favoritlister med en grænse for antal valg, fx "Album: vælg 30", "Retouchering: vælg 5" og "Gratis downloads: vælg 10".
- [ ] `v1` Eksport af en favoritliste som filnavne, klar til at indsætte i en søgning i Lightroom, eller som CSV.
- [ ] `v1` Flere favoritlister: kunden kan oprette flere lister med eget navn, fx "Til væggen" eller "Til farmor". Listerne gemmes under kundens e-mail, så de er der igen ved næste besøg.
- [ ] `v1` "Send til fotografen": kunden markerer en liste som færdig, og fotografen får besked.

**Deling af favoritlister:**

- [ ] `v1` Kunden kan dele en favoritliste via et link. I delingsdialogen vælger kunden, om delingen skal være privat:
  - **Privat deling (standard: til):** modtageren ser **kun** billederne på listen og hverken resten af galleriet, sektionerne eller andre billeder. Linket virker uden galleriets adgangskode, men giver kun adgang til listens billeder.
  - **Åben deling:** linket åbner listen, men modtageren kan også gå videre til resten af galleriet med de samme rettigheder som en gæst. Galleri-adgangskoden kræves stadig, hvis galleriet har en.
- [ ] `v1` Linket viser altid listens aktuelle indhold, og kunden kan stoppe delingen når som helst. Så holder linket op med at virke.
- [ ] `v1` En delt liste viser kun billeder, som en gæst må se. Private billeder og sektioner kun for kunden kommer aldrig med, og kunden får at vide, hvor mange billeder der er udeladt.
- [ ] `v1` Download og køb fra en delt liste følger galleriets indstillinger for gæster. Download-PIN gælder stadig.
- [ ] `v1` Fotografen kan slå deling af favoritlister til og fra per galleri og vælge, om privat deling er standard.

### 5.5 Butik

- [ ] `v1` Butik til/fra per galleri.
- [ ] `v1` Vælg prisliste for galleriet.
- [ ] `Senere` Personaliseret produktforhåndsvisning, hvor kundens billede vises på produktet, fx i en ramme eller på et lærred.

## 6. Galleri-editor: aktivitet

- [ ] `v1` Download-aktivitet: hvem (e-mail), hvad (galleri, sektion eller billede), hvilken størrelse og hvornår.
- [ ] `v1` Favorit-aktivitet: lister per e-mail med noter og mulighed for eksport.
- [ ] `v1` E-mailregistreringer.
- [ ] `v1` Private billeder: de billeder, kunden har markeret som private, med mulighed for at fjerne markeringen.
- [ ] `v1` Delingslinks: hurtige delingslinks og delte favoritlister med antal visninger og downloads. Hvert link kan kopieres igen, redigeres eller deaktiveres.
- [ ] `v1` Ordrer fra dette galleri.
- [ ] `v1` Simpel optælling af besøg uden tredjeparts-tracking.

## 7. Deling og preview

- [ ] `MVP` Kopier galleri-link (og eventuelt adgangskode).
- [ ] `MVP` Preview: se galleriet som kunden. Det tæller ikke med i aktiviteten.
- [ ] `MVP` Send galleriet til kunden via e-mail direkte fra admin (se afsnit 19). Ved kundeadgang kan gæstelinket og kundeadgangskoden sendes hver for sig.
- [ ] `v1` **Hurtige delingslinks:** vælg billeder i admin og opret et link, der kun viser de valgte billeder. Det er nyttigt til leverandører, samarbejdspartnere og presse.
- [ ] `v1` Hvert hurtige delingslink har et navn, download til/fra (med valg af størrelse) og eventuelt en udløbsdato og en adgangskode.
- [ ] `v1` Hurtige delingslinks er uafhængige af galleriets adgangskode og status. Modtageren ser kun de valgte billeder og kan ikke komme videre til resten af galleriet.
- [ ] `Senere` QR-kode til galleriet og til hurtige delingslinks.

## 8. Kundeoplevelse

- [ ] `MVP` Cover-side med titel, dato, fotografens navn og logo samt en "Se galleri"-knap.
- [ ] `MVP` Topbar med galleri-navn, sektionsnavigation og ikoner for butik, kurv, favoritter, download og del.
- [ ] `MVP` Responsivt grid med lazy loading, responsive billedstørrelser og slørede pladsholdere.
- [ ] `MVP` Lightbox i fuldskærm: swipe på mobil, piletaster på desktop, pinch-zoom samt knapper til favorit, download og køb.
- [ ] `MVP` Favoritmarkering fra både grid og lightbox, og en visning af kun favoritter.
- [ ] `MVP` Adgangskodeside for beskyttede gallerier.
- [ ] `v1` Slideshow.
- [ ] `v1` Kampagnebanner øverst i galleriet, fx "Gratis fragt på ordrer over 499 kr. Brug koden FRAGT". Det kan lukkes.
- [ ] `v1` Side for udløbne gallerier med kontaktinfo til fotografen.
- [ ] `v1` Del-knap: kopier link, eller brug den indbyggede delingsfunktion på mobil.
- [ ] `v1` "Log ind som kunde" i menuen. Når kunden er logget ind, vises det diskret i headeren, og "Markér som privat" findes i lightboxen og i massevalg.
- [ ] `v1` Favoritlister: opret, omdøb, skift mellem og del lister direkte fra favoritvisningen.
- [ ] `v1` Visning af en privat delt liste: en enkel side med listens navn, fotografens navn og listens billeder. Der er ingen navigation til resten af galleriet.

## 9. Download-flow for kunden

- [ ] `MVP` Download hele galleriet, en sektion, favoritterne eller et enkelt billede.
- [ ] `MVP` Valg af størrelse blandt dem, fotografen har tilladt.
- [ ] `MVP` ZIP-filen streames, så downloaden starter med det samme uden ventetid på pakning.
- [ ] `MVP` På mobil kan et enkelt billede gemmes direkte i fotoappen via den indbyggede delingsfunktion.
- [ ] `v1` Download-PIN og e-mailkrav håndteres i samme flow uden at forlade siden.
- [ ] `v1` Meget store downloads kan deles op i flere ZIP-filer.

## 10. Forside

- [ ] `v1` Offentlig forside med de gallerier, der har "Vis på forside" slået til, samt fotografens logo, navn og kontaktinfo.
- [ ] `v1` Gallerier på forsiden kan stadig være beskyttet med adgangskode.
- [ ] `v1` Forsideindstillinger: titel, introtekst, kontaktinfo og links til sociale medier.
- [ ] `v1` Forsiden er slået fra som standard.

## 11. Butik: produkter og prislister

### Prislister

- [ ] `v1` Flere prislister, fx "Nordic Digital self fulfill". Én prisliste er markeret som standard og bruges til nye gallerier. Prislisten vælges per galleri.
- [ ] `v1` Detaljer for en prisliste: navn, hvor mange gallerier den er tildelt (med link til dem), minimumsordre og antal produkter.
- [ ] `v1` Minimumsbeløb per prisliste: kunden kan ikke gå til betaling, før kurven når beløbet.
- [ ] `v1` Dupliker, omdøb og slet prislister, og vælg standard.

### Produkter

- [ ] `v1` Produkterne vises grupperet efter kategori (fx Prints, Vægbilleder og Digitalt) med billede, navn og "Fra"-pris.
- [ ] `v1` Et produkt har navn, kategori, op til 5 produktbilleder (kvadratiske anbefales) og en beskrivelse med simpel formatering (fed, kursiv, understreget og links).
- [ ] `v1` Produktoptioner, fx Størrelse (10x15, 13x18, 18x24, 20x30, A4, A3, 30x40, 30x45, 40x60, 50x70) og Papir (Glossy, Semi glossy). Optionerne kan sorteres med træk og slip, redigeres og slettes.
- [ ] `v1` Variationsmatrix: alle kombinationer af optionerne oprettes automatisk. Hver kombination har sin egen pris, ekstra fragt og synlighed, så enkelte kombinationer kan skjules uden at blive slettet. Matrixen kan filtreres på alle, synlige og skjulte.
- [ ] `v1` Produkter uden optioner har én pris og én ekstra fragt.
- [ ] `v1` Fysiske produkter håndteres altid af fotografen selv. Digitale produkter kan kunden downloade straks efter betaling.
- [ ] `v1` Digitale produkter: enkeltbillede (høj opløsning eller web), hel sektion eller helt galleri.
- [ ] `v1` "Kræver intet billede": produktet kan lægges direkte i kurven uden et valgt billede, fx en USB-nøgle eller en ekstra ydelse.
- [ ] `v1` "Momsfritaget" per produkt.
- [ ] `v1` "Maks. én per køb" per produkt.
- [ ] `v1` "Køb til flere billeder": kunden kan vælge flere billeder til samme produkt i ét trin.
- [ ] `v1` Beskæringsværktøj: kunden vælger et udsnit, når billedets format ikke passer til printformatet.

## 12. Butik: kurv og checkout

- [ ] `v1` "Køb"-knap på billedet: vælg produkt og variant, og læg i kurven.
- [ ] `v1` Kurven huskes på tværs af besøg.
- [ ] `v1` Ret antal, fjern varer og se samlet pris inkl. moms og fragt før betaling.
- [ ] `v1` Felt til rabatkode i kurven.
- [ ] `v1` Valg af leveringsadresse og fragtmetode. Rene digitale ordrer kræver ingen adresse.
- [ ] `v1` Tydelig besked, hvis kurven ikke når prislistens minimumsbeløb.
- [ ] `v1` Kunden accepterer handelsbetingelserne og, ved køb af digitale produkter, også billedlicensen.
- [ ] `v1` Betaling via Stripe Checkout. Ordrer på 0 kr. (fx med 100 % rabat) gennemføres uden Stripe.
- [ ] `v1` Kvitteringsside og ordrebekræftelse. Digitale produkter kan downloades straks fra kvitteringssiden og via et link i mailen.

## 13. Butik: ordrer

- [ ] `v1` Ordreoversigt med kolonnerne ordrenummer, status, kunde, galleri, type (fysisk/digital), dato og beløb.
- [ ] `v1` Filtrering per kolonne (nummer, status, kunde, galleri og type) og paginering.
- [ ] `v1` Ordrestatus: Afventer betaling, Behandles, Afsendt, Fuldført, Annulleret og Refunderet.
- [ ] `v1` Ordredetalje: produkter med billede og filnavn, adresse, fragt, rabat, moms og betalingsstatus fra Stripe.
- [ ] `v1` Download ordrens filer samlet til print som en ZIP, hvor filerne er navngivet efter produkt, størrelse og antal.
- [ ] `v1` Markér som afsendt med trackingnummer, hvilket sender en mail til kunden.
- [ ] `v1` Hel eller delvis refundering direkte fra admin via Stripe.
- [ ] `v1` Interne noter på ordren.
- [ ] `v1` Eksport af ordrer til CSV til bogføring.
- [ ] `Senere` Faktura og kvittering som PDF.

## 14. Butik: kunder

- [ ] `v1` Kundeliste ud fra ordrerne: navn, e-mail, antal ordrer, samlet køb og seneste ordre.
- [ ] `v1` Kundedetalje med ordrehistorik.
- [ ] `v1` Eksport til CSV.

## 15. Butik: moms

- [ ] `v1` Momssatser per land, som fotografen selv opretter (fx Danmark 25 %). For hver sats vælges, om den også gælder fragt og digitale produkter.
- [ ] `v1` Priser angives og vises inkl. moms, og momsbeløbet specificeres på ordren og kvitteringen.
- [ ] `v1` Produkter kan fritages for moms (se afsnit 11).
- [ ] `v1` Momsrapport: omsætning og opkrævet moms per periode, med eksport til CSV til momsangivelsen.

## 16. Butik: shipping

- [ ] `v1` Fragtmetoder med navn, fast gebyr per ordre og forventet leveringstid, fx "Hjemmelevering, 55 kr., Danmark".
- [ ] `v1` Hver fragtmetode gælder for ét land eller for resten af verden (international). Der kan være flere metoder per land, og der skal være mindst én metode for hvert land, man sælger til.
- [ ] `v1` Ekstra fragt per produkt eller variation lægges oven i ordrens fragtgebyr, fx ved store vægbilleder.
- [ ] `v1` Gratis fragt over et bestemt beløb, sat op som rabatkode (se afsnit 17).
- [ ] `v1` Afhentning hos fotografen som en fragtmetode til 0 kr.
- [ ] `v1` Rene digitale ordrer kræver ingen fragt.
- [ ] `Senere` Fragtpris efter antal eller vægt.

## 17. Butik: rabatkoder, kampagner og gavekort

- [ ] `v1` Rabattyper: procent, fast beløb, gratis fragt og gratis produkt (fx et gratis print). De kan kombineres, fx 100 % rabat og gratis fragt.
- [ ] `v1` Hver rabatkode har navn, kode, beskrivelse, startdato og eventuelt slutdato.
- [ ] `v1` Betingelser: minimumsbeløb (fx gratis fragt over 499 kr.), maks. antal brug i alt, maks. ét brug per galleri og begrænsning til bestemte gallerier eller produkter.
- [ ] `v1` Oversigt med fanerne Aktive, Planlagte og Inaktive og kolonnerne navn, kode, status, periode, antal brug og banner.
- [ ] `v1` Kampagnebanner: en rabatkode kan vises som banner øverst i gallerierne.
- [ ] `Senere` Gavekort: salg og indløsning af gavekort med saldo, samt en redigerbar mail til at dele gavekortet.
- [ ] `Senere` Automatiske rabatter uden kode, fx mængderabat.

## 18. Butik: indstillinger og Stripe

- [ ] `v1` Butikken kan slås til og fra globalt for alle gallerier.
- [ ] `v1` Butiksnavn, kontakt-e-mail og valuta, som vælges ved opsætningen.
- [ ] `v1` Handelsbetingelser med simpel formatering, vist ved checkout.
- [ ] `v1` Digital billedlicens med simpel formatering, vist ved checkout, når kurven indeholder digitale produkter.
- [ ] `v1` Stripe-opsætning: indsæt nøgle, se den valideret med kontonavn, få webhooken oprettet automatisk, og skift mellem test mode og live mode.
- [ ] `v1` Status for Stripe-forbindelsen: forbundet eller ej, test eller live, og hvornår den seneste webhook blev modtaget.
- [ ] `v1` Ordrer markeres først som betalt, når betalingen er bekræftet via webhook.
- [ ] `v1` Betalingsmetoder (kort, Apple Pay, Google Pay, MobilePay m.fl.) styres i Stripes dashboard uden ekstra kode. Folio angiver ikke selv betalingsmetoderne, så Checkout automatisk viser dem, der er slået til og passer til valuta og land. MobilePay kræver fx valutaen DKK, EUR, NOK eller SEK og en virksomhed i EØS.
- [ ] `v1` Webhooken oprettes via Stripes API med de hændelser, Folio bruger. Signing secret returneres kun ved oprettelsen og gemmes med det samme. Går den tabt, sletter Folio endpointet og opretter et nyt.
- [ ] `v1` Der kan bruges en begrænset nøgle (restricted key) i stedet for den hemmelige nøgle. Guiden viser de nødvendige rettigheder: skrive-adgang til Checkout Sessions, Webhook Endpoints og Refunds samt læse-adgang til betalinger og hændelser.
- [ ] `Senere` Offline-betaling: kunden afgiver ordren uden at betale online, og fotografen markerer den som betalt manuelt, fx efter bankoverførsel.
- [ ] `Senere` Ordreforsinkelse: digitale ordrer frigives først efter en valgt periode (fx 6 timer), så fotografen kan nå at gennemgå dem.

## 19. E-mail: levering og notifikationer

Levering af gallerier via e-mail er en kernefunktion. Mailen er ofte kundens første møde med galleriet, så den skal være lige så gennemført som galleriet selv.

### 19.1 Afsendelse og opsætning

- [ ] `MVP` SMTP-opsætning i admin: server, port, kryptering (TLS/STARTTLS), brugernavn og adgangskode. Kan også sættes via miljøvariabler.
- [ ] `MVP` Afsenderen vises med studiets navn (fx "Fotograf Sebastian") og egen afsenderadresse. Svar fra kunden går direkte til fotografens e-mail (Reply-To).
- [ ] `MVP` "Send testmail" med en tydelig og forståelig fejlbesked, hvis opsætningen ikke virker.
- [ ] `MVP` Mails sendes i baggrunden og forsøges igen automatisk ved midlertidige fejl.
- [ ] `v1` Forudfyldte indstillinger og en kort guide for almindelige udbydere (fx Google Workspace, Microsoft 365, Simply, One.com, Brevo og Postmark), herunder SPF og DKIM, så mails ikke havner i spam.

### 19.2 Levering af galleri

- [ ] `MVP` "Send galleri" fra Del-knappen i admin: modtagere (én eller flere, forudfyldt med kundens e-mail), skabelon, emne og besked.
- [ ] `MVP` Fotografen vælger, hvad mailen indeholder: link til galleriet og eventuelt adgangskoden. Ved kundeadgang (afsnit 5.2) kan kundeadgangskoden sendes til kunden og gæstelinket til andre.
- [ ] `MVP` Forhåndsvisning af mailen præcis som kunden ser den, og "Send test til mig selv", før den sendes.
- [ ] `MVP` En smuk HTML-mail med studiets logo eller navn, galleriets titel med versaler, coverbilledet, beskeden og en tydelig knap, "Se galleriet". Coverbilledet er indlejret i mailen, så det vises med det samme.
- [ ] `MVP` Mailen ser godt ud i både lys og mørk tilstand og på mobil og har en ren tekstversion.
- [ ] `MVP` "Publicer og send" i ét trin, hvis galleriet stadig er en kladde.
- [ ] `MVP` Afsendelseslog per galleri: modtager, tidspunkt, skabelon og status (sendt eller fejlet), og mulighed for at sende igen.
- [ ] `v1` Send senere: planlæg afsendelsen til et bestemt tidspunkt.
- [ ] `v1` Kopiér invitationsteksten med link til brug i SMS eller Messenger.

### 19.3 Skabeloner

- [ ] `MVP` Flere navngivne skabeloner til levering af gallerier, fx "Tidlig levering" og "Bryllup", hver med emne og besked. Én skabelon er standard.
- [ ] `MVP` Flettefelter i emne og besked: `{client_name}`, `{gallery_name}`, `{gallery_link}`, `{password}`, `{studio_name}` og `{event_date}`.
- [ ] `MVP` Skabelonerne administreres under Indstillinger → E-mail-skabeloner.
- [ ] `v1` Skabelon til udløbspåmindelse.
- [ ] `v1` Skabeloner til butikken: ordrebekræftelse, digital levering, afsendt og refundering.
- [ ] `v1` Skabeloner per sprog, så mailen automatisk følger galleriets sprog.

### 19.4 Automatiske mails og notifikationer

- [ ] `v1` Udløbspåmindelse et valgt antal dage før galleriet udløber. Den kan sendes til kunden og/eller til alle, der har registreret sig, favoritmarkeret eller downloadet.
- [ ] `v1` Butiksmails: ordrebekræftelse, digital levering, afsendt (med trackingnummer) og refundering.
- [ ] `v1` Notifikationer til fotografen: ny ordre og indsendt favoritliste.
- [ ] `v1` Alle mails sendes på galleriets sprog.

## 20. Globale indstillinger

- [ ] `MVP` Studie-branding: studienavn, logo og kontaktinfo (e-mail, telefon og website).
- [ ] `v1` Cover-logo: en lys version af logoet til brug oven på coverbilleder, samt favicon.
- [ ] `MVP` Admin-konto: skift e-mail og adgangskode.
- [ ] `v1` Vandmærker af tekst eller billede med valg af position, størrelse og gennemsigtighed. Der kan være flere vandmærker. De lægges på billederne i `/cache`, aldrig på originalerne.
- [ ] `v1` Standardindstillinger for nye gallerier: design, download, favoritter, butik og sprog.
- [ ] `v1` Standardsprog for nye gallerier.
- [ ] `v1` Vis filnavne som standard (kan ændres per galleri).
- [ ] `v1` Søgemaskine-synlighed: Ingen (standard) eller Kun forsiden. Gallerier indekseres aldrig.
- [ ] `v1` Skarphed for visningskopier: Ingen, Standard eller Optimal. Originalerne ændres ikke.

## 21. Sprog

- [ ] `MVP` Al tekst i både kunde- og admininterfacet hentes fra oversættelsesfiler (i18n) fra første linje kode, så intet er hardcodet.
- [ ] `MVP` Engelsk er første sprog og standardsprog.
- [ ] `v1` Dansk.
- [ ] `v1` Sprog kan vælges per galleri for kundevisningen og separat for admin.
- [ ] `v1` Formatering af dato, tal og valuta følger sproget, fx `DKK 1,320.00` på engelsk og `1.320,00 kr.` på dansk.
- [ ] `Senere` Flere sprog, fx svensk, norsk og tysk. Det kræver kun en ny oversættelsesfil.

## 22. Sikkerhed og adgang

- [ ] `MVP` Admin-login med sikker hashing af adgangskoder og rate limiting.
- [ ] `MVP` Billeder serveres kun gennem appen med adgangskontrol. Originaler kan ikke hentes direkte uden tilladelse.
- [ ] `MVP` Rate limiting på galleri-adgangskoder og download-PIN.
- [ ] `v1` Delingslinks (hurtige delingslinks og delte favoritlister) bruger lange, tilfældige nøgler, som ikke kan gættes, og de kan tilbagekaldes. Serveren kontrollerer adgangen til hvert billede ud fra linkets rettigheder. Rate limiting gælder også kundeadgangskoden.
- [ ] `MVP` Gallerier og billeder bliver ikke indekseret af søgemaskiner (`noindex`).
- [ ] `MVP` CSRF-beskyttelse, sikre cookies og sikkerhedsheaders.
- [ ] `v1` Tofaktorgodkendelse (TOTP) til admin.
- [ ] `v1` GDPR: kundedata kan eksporteres og slettes, og der bruges ingen tredjeparts-tracking. Ordrer bevares af hensyn til bogføringen.

## 23. Drift: Docker, backup og opdateringer

- [ ] `MVP` Officielt multi-arch Docker-image (`amd64` og `arm64`), der publiceres automatisk.
- [ ] `MVP` Volumes til `/photos`, `/data` og `/cache` samt `PUID`, `PGID` og `TZ`.
- [ ] `MVP` Konfiguration via miljøvariabler, fx `BASE_URL`.
- [ ] `MVP` Opsætningsguide første gang: opret admin, angiv studienavn og vælg sprog.
- [ ] `MVP` Healthcheck og logs til stdout.
- [ ] `MVP` Automatiske databasemigreringer ved opdatering.
- [ ] `v1` Backup og gendannelse af `/data` fra admin.
- [ ] `v1` Eksempel på `docker-compose.yml` og guide til reverse proxy med HTTPS.
- [ ] `Senere` Besked i admin, når en ny version er udgivet.

---

## Ikke med

- Website-builder, Studio Manager (CRM, kontrakter, fakturaer og booking), Mobile Gallery App og Photo Editor.
- Video i gallerier og dermed også videodownload.
- PayPal og andre betalingsudbydere end Stripe.
- Automatisk fulfillment via printlab. Fotografen håndterer selv alle fysiske ordrer.
