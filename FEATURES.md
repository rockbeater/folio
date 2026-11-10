# Features

> **Status:** MVP er bygget. Afkrydsede punkter er implementeret.

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

### Plan for v1

v1 bygges i fire faser. Hver fase pushes til `main` og giver et nyt Docker-image. Næste fase startes først, når den forrige er godkendt.

1. **Galleriet færdigt:** dansk sprog, aktivitet, download-PIN og e-mailkrav, skjulte billeder, massehandlinger, vandmærker, auto-udløb med påmindelse, slideshow, kampagnebanner, presets og de øvrige `v1`-punkter i afsnit 1–9, 19–21 der ikke hører til en senere fase.
2. **Deling og adgang:** gæst- og kundeadgang, hurtige delingslinks, flere favoritlister med deling, favoritnoter og udvælgelsesgrænser samt forsiden.
3. **Butikken:** produkter, prislister, kurv, Stripe Checkout, ordrer, kunder, moms, fragt, rabatkoder og butiksmails.
4. **Resten:** tofaktorgodkendelse, GDPR, backup fra admin, søgemaskine-synlighed og skarphed.

**Beslutninger:**

- Digitale produkter, som kunden har købt, kan downloades, når fotografen har slået det til.
- Stripe testes i fotografens egen installation. Under udviklingen simuleres Stripe (signerede test-hændelser) så langt som muligt.
- Private billeder kommer aldrig med på delte favoritlister, og delte lister viser altid listens aktuelle indhold.

---

## 1. Admin: overblik

- [x] `MVP` Dashboard med to områder: **Gallerier** og **Butik**.
- [x] `MVP` Galleri-oversigt: alle gallerier som kort med cover, navn, dato, status og antal billeder.
- [x] `MVP` Opret galleri med navn og valgfri event-dato. Det opretter mappen i `/photos`.
- [x] `v1` Filtrér gallerier på status og kategori-tags, søg på navn, og sortér efter dato, navn eller oprettelse.
- [x] `v1` Søg i hele billedbiblioteket på tværs af gallerier (filnavn).
- [x] `v1` Nøgletal på dashboardet: nye ordrer og gallerier, der snart udløber.
- [x] `v1` Aktivitet bag en klokke i topbaren: betalte ordrer, indsendte udvalg, downloads og registreringer på tværs af gallerier, med antal nye siden sidst. En aktivitetsside viser det hele, grupperet pr. dag og med filtre.

## 2. Galleri og filsystem

- [x] `MVP` Hver mappe i `/photos` er et galleri, og hver undermappe er en sektion.
- [x] `MVP` Ændringer opdages automatisk med en filwatcher og periodisk scanning.
- [x] `MVP` "Scan nu"-knap per galleri og globalt.
- [x] `MVP` Nye gallerier fra filsystemet oprettes som kladde.
- [x] `MVP` En skjult `.folio-id`-fil sørger for, at omdøbte eller flyttede mapper genkendes.
- [x] `MVP` Advarsler i admin om ugyldigt indhold: dybere mapper, filer der ikke er billeder, og ulæselige filer.
- [x] `MVP` Thumbnails og webstørrelser genereres i `/cache` i flere bredder og moderne formater (WebP/AVIF). Det sker i en baggrundskø med fremdriftsvisning.
- [x] `MVP` Korrekt EXIF-rotation og konvertering til sRGB ved visning. Originalerne røres aldrig.
- [x] `MVP` Ændrede filer genbehandles automatisk, og slettede filer forsvinder fra galleriet.
- [x] `v1` Papirkurv: billeder og sektioner, der slettes via admin, flyttes til `/photos/.trash` og tømmes efter 30 dage.
- [x] `v1` Advarsel, hvis man sletter et billede, der indgår i en ubehandlet ordre.
- [ ] `Senere` Valgfri `galleri.yml`, der bruges som skabelon, når et galleri oprettes fra filsystemet.

## 3. Galleri-editor: billeder og sektioner

- [x] `MVP` Topbar med redigerbart galleri-navn, event-dato, statusvælger (Kladde / Publiceret / Skjult), søgning i galleriet, Preview og Del.
- [x] `MVP` Venstre panel med cover-billede og fanerne **Billeder**, **Design**, **Indstillinger** og **E-mail**. Fanen **Aktivitet** kommer med afsnit 6.
- [x] `MVP` Sektionsliste med antal billeder. Tilføj sektion (opretter en undermappe), omdøb (omdøber mappen) og slet.
- [x] `MVP` Træk og slip for at ændre sektionernes rækkefølge.
- [x] `MVP` Upload ved at trække filer eller hele mapper ind, med fremdriftsvisning. En mappe bliver til en ny sektion.
- [x] `MVP` Sortering per sektion: filnavn (naturlig sortering, så `IMG_2` kommer før `IMG_10`), optagelsesdato (EXIF) eller manuelt med træk og slip.
- [x] `MVP` Valg af thumbnail-størrelse i admin-visningen.
- [x] `MVP` Vælg cover-billede fra galleriet.
- [x] `v1` Robust upload af store mængder: chunked upload, der kan genoptages, og håndtering af dubletter (spring over / erstat / omdøb).
- [x] `v1` Fokuspunkt på coveret, så beskæringen rammer rigtigt på både mobil og desktop.
- [x] `v1` Massehandlinger: vælg flere billeder og flyt, kopier, skjul, slet, download dem eller opret et hurtigt delingslink (se afsnit 7).
- [x] `v1` Skjul enkelte billeder for kunden uden at slette filen.
- [x] `v1` "Mere"-menu: anvend preset, kopier indstillinger fra et andet galleri, download originaler og slet galleri.

## 4. Galleri-editor: design

- [x] `MVP` Live preview i editoren med skift mellem desktop og mobil.
- [x] `MVP` **Cover:** flere cover-layouts med titel, dato, fotografens navn og en "Se galleri"-knap.
- [x] `MVP` **Grid-stil:** Vertikal (masonry i kolonner) og Horisontal (rækker med ens højde).
- [x] `v1` **Typografi:** kuraterede skrifttype-par til overskrift og brødtekst.
- [x] `v1` **Farve:** farvetemaerne Lys, Sand, Mørk og Sort samt en valgfri accentfarve.
- [x] `v1` **Thumbnail-størrelse:** Normal / Stor.
- [x] `v1` **Grid-afstand:** Normal / Stor.
- [x] `v1` **Navigationsstil:** Kun ikon / Ikon og tekst.
- [x] `v1` Design-presets: gem et design og brug det som standard for nye gallerier.
- [x] `v1` Presets husker sorteringen af billeder (filnavn eller optagelsesdato). Nye gallerier og sektioner, der kommer til senere, får samme sortering. Ellers følger nye sektioner den sortering, der sidst blev valgt i galleriet.

De konkrete layouts, skrifttyper og farver beskrives i [DESIGN.md](DESIGN.md).

## 5. Galleri-editor: indstillinger

Indstillingerne er delt op i Generelt, Privatliv, Download, Favoritter og Butik. Download, Favoritter og Butik viser deres TIL/FRA-status direkte i menuen.

### 5.1 Generelt

- [x] `MVP` Galleri-URL (slug): unik og autogenereret ud fra navnet med korrekt translitterering af æ, ø og å, så "Rørvig" bliver til `roervig` og ikke `rrvig`.
- [x] `v1` Kunde tilknyttet galleriet (navn og e-mail). Bruges til deling og notifikationer, ikke som CRM.
- [x] `v1` Kategori-tags, fx bryllup, familie eller udendørs.
- [x] `v1` Standard-vandmærke: vælg blandt vandmærkerne fra de globale indstillinger, eller intet.
- [x] `v1` Auto-udløb: galleriet skjules automatisk på en bestemt dato, og kunden kan få en påmindelsesmail et antal dage før.
- [x] `v1` E-mailregistrering: besøgende angiver e-mail, før de får adgang. Registreringerne vises under Aktivitet.
- [x] `v1` Galleri-guide: introkort, der viser nye besøgende, hvordan man favoritmarkerer, downloader og køber.
- [x] `v1` Slideshow til/fra.
- [x] `v1` Vis filnavne til/fra, så kunden kan henvise til et bestemt billede.
- [x] `v1` Sprog for kundevisningen per galleri. Standardsproget kommer fra de globale indstillinger.

### 5.2 Privatliv

- [x] `MVP` Galleri-adgangskode med en "Generer"-knap.
- [x] `v1` Vis på forsiden til/fra (standard: fra).

**Gæsteadgang og kundeadgang:**

Et galleri kan have to adgangsniveauer. **Gæster** (fx bryllupsgæster og familie) bruger det almindelige galleri-link og eventuelt galleri-adgangskoden. **Kunden** (fx brudeparret) logger ind med en separat kundeadgangskode og ser mere end gæsterne.

- [x] `v1` Kundeadgang til/fra per galleri.
- [x] `v1` Indgangsskærm over coverbilledet, når kundeadgang er slået til: "Fortsæt som gæst" eller "Fortsæt som kunde". Kunden kan logge ind direkte fra galleri-linket.
- [x] `v1` Kundeadgangskode med en "Generer"-knap, adskilt fra galleri-adgangskoden. Er der også en galleri-adgangskode, skal gæster stadig bruge den.
- [x] `v1` Sektioner kun for kunden: fotografen vælger sektioner, som kun kunden kan se, fx "Forberedelser".
- [x] `v1` Kunden kan markere enkelte billeder som private. De skjules for gæster, men er stadig synlige for kunden med et låse-ikon. Kunden kan fjerne markeringen igen.
- [x] `v1` Fotografen kan slå kundens mulighed for at markere private billeder til og fra.
- [x] `v1` Download kan indstilles forskelligt for gæster og kunden, fx kan kun kunden downloade i høj opløsning.
- [x] `v1` Gæster kan aldrig se, finde, downloade eller købe private billeder og sektioner kun for kunden. Det gælder også via direkte billed-URL'er, søgning, slideshow, delte favoritlister og ZIP-downloads. Adgangen kontrolleres på serveren.

### 5.3 Download

- [x] `MVP` Fotodownload til/fra.
- [x] `MVP` Downloadstørrelser: Høj opløsning (Original eller 3600px) og/eller Webstørrelse (2048, 1024 eller 640px). Fotografen bestemmer, hvilke kunden kan vælge imellem.
- [x] `v1` Download-PIN: kunden skal indtaste en 4-cifret PIN for at downloade.
- [x] `v1` Avancerede indstillinger: begræns download til udvalgte sektioner.
- [x] `v1` Download af enkeltbilleder til/fra, adskilt fra "download alle".
- [x] `v1` Kræv e-mail ved download, så downloads kan spores per person.
- [x] `v1` Vandmærke på downloads i webstørrelse til/fra.
- [ ] `Senere` Begrænset antal gratis downloads, fx maks. N billeder.

### 5.4 Favoritter

- [x] `MVP` Favoritter til/fra.
- [x] `MVP` Favoritter knyttes til en e-mail (kunden bliver spurgt første gang), så fotografen kan se, hvem der har valgt hvad.
- [x] `v1` Favoritnoter: kunden kan skrive en note til et favoritmarkeret billede.
- [x] `v1` Foruddefinerede favoritlister med en grænse for antal valg, fx "Album: vælg 30", "Retouchering: vælg 5" og "Gratis downloads: vælg 10".
- [x] `v1` Eksport af en favoritliste som filnavne, klar til at indsætte i en søgning i Lightroom, eller som CSV.
- [x] `v1` Flere favoritlister: kunden kan oprette flere lister med eget navn, fx "Til væggen" eller "Til farmor". Listerne gemmes under kundens e-mail, så de er der igen ved næste besøg.
- [x] `v1` "Send til fotografen": kunden markerer en liste som færdig, og fotografen får besked.
- [x] `v1` Favoritter hører til e-mailen, så de findes igen ved næste besøg. Med én liste tilføjer hjertet direkte; med flere lister spørger hjertet, hvilken liste billedet skal på.

**Deling af favoritlister:**

- [x] `v1` Kunden kan dele en favoritliste via et link. I delingsdialogen vælger kunden, om delingen skal være privat:
  - **Privat deling (standard: til):** modtageren ser **kun** billederne på listen og hverken resten af galleriet, sektionerne eller andre billeder. Linket virker uden galleriets adgangskode, men giver kun adgang til listens billeder.
  - **Åben deling:** linket åbner listen, men modtageren kan også gå videre til resten af galleriet med de samme rettigheder som en gæst. Galleri-adgangskoden kræves stadig, hvis galleriet har en.
- [x] `v1` Linket viser altid listens aktuelle indhold, og kunden kan stoppe delingen når som helst. Så holder linket op med at virke.
- [x] `v1` En delt liste viser kun billeder, som en gæst må se. Private billeder og sektioner kun for kunden kommer aldrig med, og kunden får at vide, hvor mange billeder der er udeladt.
- [x] `v1` Download og køb fra en delt liste følger galleriets indstillinger for gæster. Download-PIN gælder stadig. Har galleriet en butik, kan modtageren bestille print af listens billeder (kun dem) og betale uden galleriets adgangskode.
- [x] `v1` Fotografen kan slå deling af favoritlister til og fra per galleri og vælge, om privat deling er standard.

### 5.5 Butik

- [x] `v1` Butik til/fra per galleri.
- [x] `v1` Vælg prisliste for galleriet.
- [ ] `Senere` Personaliseret produktforhåndsvisning, hvor kundens billede vises på produktet, fx i en ramme eller på et lærred.

## 6. Galleri-editor: aktivitet

- [x] `v1` Download-aktivitet: hvem (e-mail), hvad (galleri, sektion eller billede), hvilken størrelse og hvornår.
- [x] `v1` Favorit-aktivitet: lister per e-mail med noter og mulighed for eksport.
- [x] `v1` E-mailregistreringer.
- [x] `v1` Private billeder: de billeder, kunden har markeret som private, med mulighed for at fjerne markeringen.
- [x] `v1` Delingslinks: hurtige delingslinks og delte favoritlister med antal visninger og downloads. Hvert link kan kopieres igen, redigeres eller deaktiveres.
- [x] `v1` Ordrer fra dette galleri.
- [x] `v1` Simpel optælling af besøg uden tredjeparts-tracking.

## 7. Deling og preview

- [x] `MVP` Kopier galleri-link (og eventuelt adgangskode).
- [x] `MVP` Preview: se galleriet som kunden. Det tæller ikke med i aktiviteten.
- [x] `MVP` Send galleriet til kunden via e-mail direkte fra admin (se afsnit 19). Ved kundeadgang kan gæstelinket og kundeadgangskoden sendes hver for sig.
- [x] `v1` **Hurtige delingslinks:** vælg billeder i admin og opret et link, der kun viser de valgte billeder. Det er nyttigt til leverandører, samarbejdspartnere og presse.
- [x] `v1` Hvert hurtige delingslink har et navn, download til/fra (med valg af størrelse) og eventuelt en udløbsdato og en adgangskode.
- [x] `v1` Hurtige delingslinks er uafhængige af galleriets adgangskode og status. Modtageren ser kun de valgte billeder og kan ikke komme videre til resten af galleriet.
- [ ] `Senere` QR-kode til galleriet og til hurtige delingslinks.

## 8. Kundeoplevelse

- [x] `MVP` Cover-side med titel, dato, fotografens navn og logo samt en "Se galleri"-knap.
- [x] `MVP` Topbar med galleri-navn, sektionsnavigation og ikoner for butik, kurv, favoritter, download og del.
- [x] `MVP` Responsivt grid med lazy loading, responsive billedstørrelser og slørede pladsholdere.
- [x] `MVP` Lightbox i fuldskærm: swipe på mobil, piletaster på desktop, pinch-zoom samt knapper til favorit, download og køb.
- [x] `MVP` Favoritmarkering fra både grid og lightbox, og en visning af kun favoritter.
- [x] `MVP` Adgangskodeside for beskyttede gallerier.
- [x] `v1` Slideshow.
- [x] `v1` Kampagnebanner øverst i galleriet, fx "Gratis fragt på ordrer over 499 kr. Brug koden FRAGT". Det kan lukkes.
- [x] `v1` Side for udløbne gallerier med kontaktinfo til fotografen.
- [x] `v1` Del-knap: kopier link, eller brug den indbyggede delingsfunktion på mobil.
- [x] `v1` "Log ind som kunde" i menuen. Når kunden er logget ind, vises det diskret i headeren, og "Markér som privat" findes i lightboxen og i massevalg.
- [x] `v1` Favoritlister: opret, omdøb, skift mellem og del lister direkte fra favoritvisningen.
- [x] `v1` Visning af en privat delt liste: en enkel side med listens navn, fotografens navn og listens billeder. Der er ingen navigation til resten af galleriet.

## 9. Download-flow for kunden

- [x] `MVP` Download hele galleriet, en sektion, favoritterne eller et enkelt billede.
- [x] `MVP` Valg af størrelse blandt dem, fotografen har tilladt.
- [x] `MVP` ZIP-filen streames, så downloaden starter med det samme uden ventetid på pakning.
- [x] `MVP` På mobil kan et enkelt billede gemmes direkte i fotoappen via den indbyggede delingsfunktion.
- [x] `v1` Download-PIN og e-mailkrav håndteres i samme flow uden at forlade siden.
- [x] `v1` Meget store downloads kan deles op i flere ZIP-filer.
- [x] `v1` Smart download pr. enhed: del-menu i omgange på iPhone/iPad (direkte i Fotos), én fil pr. billede på Android, gem i mappe i Chrome/Edge og ZIP ellers. Kan vælges pr. enhed i indstillingerne med anbefalede standarder og justerbar omgangsstørrelse. Gælder alle downloads, også delte lister, hurtige links og købte billeder. Downloads bevarer optagelsesdatoen.
- [x] `v1` Langt tryk, højreklik eller PrintScreen på et billede viser en boks, der peger på download-knappen (fuld kvalitet i stedet for screenshot).

## 10. Forside

- [x] `v1` Offentlig forside med de gallerier, der har "Vis på forside" slået til, samt fotografens logo, navn og kontaktinfo.
- [x] `v1` Gallerier på forsiden kan stadig være beskyttet med adgangskode.
- [x] `v1` Forsideindstillinger: titel, introtekst, kontaktinfo og links til sociale medier.
- [x] `v1` Forsiden er slået fra som standard.

## 11. Butik: produkter og prislister

### Prislister

- [x] `v1` Flere prislister, fx "Nordic Digital self fulfill". Én prisliste er markeret som standard og bruges til nye gallerier. Prislisten vælges per galleri.
- [x] `v1` Detaljer for en prisliste: navn, hvor mange gallerier den er tildelt (med link til dem), minimumsordre og antal produkter.
- [x] `v1` Minimumsbeløb per prisliste: kunden kan ikke gå til betaling, før kurven når beløbet.
- [x] `v1` Dupliker, omdøb og slet prislister, og vælg standard.
- [x] `v1` "Tildel alle gallerier" på en prisliste: alle gallerier bruger prislisten med ét klik, og butikken kan slås til i dem samtidig.

### Produkter

- [x] `v1` Produkterne vises grupperet efter kategori (fx Prints, Vægbilleder og Digitalt) med billede, navn og "Fra"-pris.
- [x] `v1` Et produkt har navn, kategori, op til 5 produktbilleder (kvadratiske anbefales) og en beskrivelse med simpel formatering (fed, kursiv, understreget og links).
- [x] `v1` Produktoptioner, fx Størrelse (10x15, 13x18, 18x24, 20x30, A4, A3, 30x40, 30x45, 40x60, 50x70) og Papir (Glossy, Semi glossy). Optionerne kan sorteres med træk og slip, redigeres og slettes.
- [x] `v1` Variationsmatrix: alle kombinationer af optionerne oprettes automatisk. Hver kombination har sin egen pris, ekstra fragt og synlighed, så enkelte kombinationer kan skjules uden at blive slettet. Matrixen kan filtreres på alle, synlige og skjulte.
- [x] `v1` Produkter uden optioner har én pris og én ekstra fragt.
- [x] `v1` Fysiske produkter håndteres altid af fotografen selv. Digitale produkter kan kunden downloade straks efter betaling.
- [x] `v1` Digitale produkter: enkeltbillede (høj opløsning eller web), hel sektion eller helt galleri.
- [x] `v1` "Kræver intet billede": produktet kan lægges direkte i kurven uden et valgt billede, fx en USB-nøgle eller en ekstra ydelse.
- [x] `v1` "Momsfritaget" per produkt.
- [x] `v1` "Maks. én per køb" per produkt.
- [x] `v1` "Køb til flere billeder": kunden kan vælge flere billeder til samme produkt i ét trin.
- [x] `v1` Beskæringsværktøj: kunden vælger et udsnit, når billedets format ikke passer til printformatet.
- [x] `v1` Passer billedet ikke til printformatet, skal kunden vælge udsnittet, før der kan bestilles. Printfilen downloades i fuld opløsning med udsnittet lagt på.

## 12. Butik: kurv og checkout

- [x] `v1` "Køb"-knap på billedet: vælg produkt og variant, og læg i kurven.
- [x] `v1` Kurven huskes på tværs af besøg.
- [x] `v1` Ret antal, fjern varer og se samlet pris inkl. moms og fragt før betaling.
- [x] `v1` Kunden får sit land valgt på forhånd: ud fra IP-adressen, når en proxy eller CDN sender landet (fx Cloudflare), ellers ud fra browserens sprog og region. Kunden kan altid ændre det.
- [x] `v1` Felt til rabatkode i kurven.
- [x] `v1` Valg af leveringsadresse og fragtmetode. Rene digitale ordrer kræver ingen adresse.
- [x] `v1` Tydelig besked, hvis kurven ikke når prislistens minimumsbeløb.
- [x] `v1` Kunden accepterer handelsbetingelserne og, ved køb af digitale produkter, også billedlicensen.
- [x] `v1` Betaling via Stripe Checkout. Ordrer på 0 kr. (fx med 100 % rabat) gennemføres uden Stripe.
- [x] `v1` Kvitteringsside og ordrebekræftelse. Digitale produkter kan downloades straks fra kvitteringssiden og via et link i mailen.

## 13. Butik: ordrer

- [x] `v1` Ordreoversigt med kolonnerne ordrenummer, status, kunde, galleri, type (fysisk/digital), dato og beløb.
- [x] `v1` Filtrering per kolonne (nummer, status, kunde, galleri og type) og paginering.
- [x] `v1` Ordrestatus: Afventer betaling, Behandles, Afsendt, Fuldført, Annulleret og Refunderet.
- [x] `v1` Ubetalte checkouts tæller ikke som ordrer: de vises ikke i admin, får først ordrenummer ved betaling (uden huller) og ryddes op efter tre dage. Ordrer kan slettes fra admin.
- [x] `v1` Ordredetalje: produkter med billede og filnavn, adresse, fragt, rabat, moms og betalingsstatus fra Stripe.
- [x] `v1` Download ordrens filer samlet til print som en ZIP, hvor filerne er navngivet efter produkt, størrelse og antal.
- [x] `v1` Markér som afsendt med trackingnummer, hvilket sender en mail til kunden.
- [x] `v1` Hel eller delvis refundering direkte fra admin via Stripe.
- [x] `v1` Interne noter på ordren.
- [x] `v1` Eksport af ordrer til CSV til bogføring.
- [ ] `Senere` Faktura og kvittering som PDF.

## 14. Butik: kunder

- [x] `v1` Kundeliste ud fra ordrerne: navn, e-mail, antal ordrer, samlet køb og seneste ordre.
- [x] `v1` Kundedetalje med ordrehistorik.
- [x] `v1` Eksport til CSV.

## 15. Butik: moms

- [x] `v1` Momssatser per land, som fotografen selv opretter (fx Danmark 25 %). For hver sats vælges, om den også gælder fragt og digitale produkter.
- [x] `v1` Priser angives og vises inkl. moms, og momsbeløbet specificeres på ordren og kvitteringen.
- [x] `v1` Produkter kan fritages for moms (se afsnit 11).
- [x] `v1` Momsrapport: omsætning og opkrævet moms per periode, med eksport til CSV til momsangivelsen.

## 16. Butik: shipping

- [x] `v1` Fragtmetoder med navn, fast gebyr per ordre og forventet leveringstid, fx "Hjemmelevering, 55 kr., Danmark".
- [x] `v1` Hver fragtmetode gælder for ét land eller for resten af verden (international). Der kan være flere metoder per land, og der skal være mindst én metode for hvert land, man sælger til.
- [x] `v1` Ekstra fragt per produkt eller variation lægges oven i ordrens fragtgebyr, fx ved store vægbilleder.
- [x] `v1` Gratis fragt over et bestemt beløb, sat op som rabatkode (se afsnit 17).
- [x] `v1` Afhentning hos fotografen som en fragtmetode til 0 kr.
- [x] `v1` Rene digitale ordrer kræver ingen fragt.
- [ ] `Senere` Fragtpris efter antal eller vægt.

## 17. Butik: rabatkoder, kampagner og gavekort

- [x] `v1` Rabattyper: procent, fast beløb, gratis fragt og gratis produkt (fx et gratis print). De kan kombineres, fx 100 % rabat og gratis fragt.
- [x] `v1` Hver rabatkode har navn, kode, beskrivelse, startdato og eventuelt slutdato.
- [x] `v1` Betingelser: minimumsbeløb (fx gratis fragt over 499 kr.), maks. antal brug i alt, maks. ét brug per galleri og begrænsning til bestemte gallerier eller produkter.
- [x] `v1` Oversigt med fanerne Aktive, Planlagte og Inaktive og kolonnerne navn, kode, status, periode, antal brug og banner.
- [x] `v1` Kampagnebanner: en rabatkode kan vises som banner øverst i gallerierne.
- [ ] `Senere` Gavekort: salg og indløsning af gavekort med saldo, samt en redigerbar mail til at dele gavekortet.
- [ ] `Senere` Automatiske rabatter uden kode, fx mængderabat.

## 18. Butik: indstillinger og Stripe

- [x] `v1` Butikken kan slås til og fra globalt for alle gallerier.
- [x] `v1` Butiksnavn, kontakt-e-mail og valuta, som vælges ved opsætningen.
- [x] `v1` Handelsbetingelser med simpel formatering, vist ved checkout.
- [x] `v1` Digital billedlicens med simpel formatering, vist ved checkout, når kurven indeholder digitale produkter.
- [x] `v1` Stripe-opsætning: indsæt nøgle, se den valideret med kontonavn, få webhooken oprettet automatisk, og skift mellem test mode og live mode.
- [x] `v1` Status for Stripe-forbindelsen: forbundet eller ej, test eller live, og hvornår den seneste webhook blev modtaget.
- [x] `v1` Ordrer markeres først som betalt, når betalingen er bekræftet via webhook.
- [x] `v1` Betalingsmetoder (kort, Apple Pay, Google Pay, MobilePay m.fl.) styres i Stripes dashboard uden ekstra kode. Folio angiver ikke selv betalingsmetoderne, så Checkout automatisk viser dem, der er slået til og passer til valuta og land. MobilePay kræver fx valutaen DKK, EUR, NOK eller SEK og en virksomhed i EØS.
- [x] `v1` Webhooken oprettes via Stripes API med de hændelser, Folio bruger. Signing secret returneres kun ved oprettelsen og gemmes med det samme. Går den tabt, sletter Folio endpointet og opretter et nyt.
- [x] `v1` Der kan bruges en begrænset nøgle (restricted key) i stedet for den hemmelige nøgle. Guiden viser de nødvendige rettigheder: skrive-adgang til Checkout Sessions, Webhook Endpoints og Refunds samt læse-adgang til betalinger og hændelser.
- [ ] `Senere` Offline-betaling: kunden afgiver ordren uden at betale online, og fotografen markerer den som betalt manuelt, fx efter bankoverførsel.
- [ ] `Senere` Ordreforsinkelse: digitale ordrer frigives først efter en valgt periode (fx 6 timer), så fotografen kan nå at gennemgå dem.

## 19. E-mail: levering og notifikationer

Levering af gallerier via e-mail er en kernefunktion. Mailen er ofte kundens første møde med galleriet, så den skal være lige så gennemført som galleriet selv.

### 19.1 Afsendelse og opsætning

- [x] `MVP` SMTP-opsætning i admin: server, port, kryptering (TLS/STARTTLS), brugernavn og adgangskode. Kan også sættes via miljøvariabler.
- [x] `MVP` Afsenderen vises med studiets navn (fx "Fotograf Sebastian") og egen afsenderadresse. Svar fra kunden går direkte til fotografens e-mail (Reply-To).
- [x] `MVP` "Send testmail" med en tydelig og forståelig fejlbesked, hvis opsætningen ikke virker.
- [x] `MVP` Mails sendes i baggrunden og forsøges igen automatisk ved midlertidige fejl.
- [x] `v1` Forudfyldte indstillinger og en kort guide for almindelige udbydere (fx Google Workspace, Microsoft 365, Simply, One.com, Brevo og Postmark), herunder SPF og DKIM, så mails ikke havner i spam.

### 19.2 Levering af galleri

- [x] `MVP` "Send galleri" fra Del-knappen i admin: modtagere (én eller flere, forudfyldt med kundens e-mail), skabelon, emne og besked.
- [x] `MVP` Fotografen vælger, hvad mailen indeholder: link til galleriet og eventuelt adgangskoden. Ved kundeadgang (afsnit 5.2) kan kundeadgangskoden sendes til kunden og gæstelinket til andre.
- [x] `MVP` Forhåndsvisning af mailen præcis som kunden ser den, og "Send test til mig selv", før den sendes.
- [x] `MVP` En smuk HTML-mail med studiets logo eller navn, galleriets titel med versaler, coverbilledet, beskeden og en tydelig knap, "Se galleriet". Coverbilledet er indlejret i mailen, så det vises med det samme.
- [x] `MVP` Mailen ser godt ud i både lys og mørk tilstand og på mobil og har en ren tekstversion.
- [x] `MVP` "Publicer og send" i ét trin, hvis galleriet stadig er en kladde.
- [x] `MVP` Afsendelseslog per galleri: modtager, tidspunkt, skabelon og status (sendt eller fejlet), og mulighed for at sende igen.
- [x] `v1` Send senere: planlæg afsendelsen til et bestemt tidspunkt.
- [x] `v1` Kopiér invitationsteksten med link til brug i SMS eller Messenger.

### 19.3 Skabeloner

- [x] `MVP` Flere navngivne skabeloner til levering af gallerier, fx "Tidlig levering" og "Bryllup", hver med emne og besked. Én skabelon er standard.
- [x] `MVP` Flettefelter i emne og besked: `{client_name}`, `{gallery_name}`, `{gallery_link}`, `{password}`, `{studio_name}` og `{event_date}`.
- [x] `MVP` Skabelonerne administreres under Indstillinger → E-mail-skabeloner.
- [x] `v1` Skabelon til udløbspåmindelse.
- [x] `v1` Skabeloner til butikken: ordrebekræftelse, digital levering, afsendt og refundering.
- [x] `v1` Skabeloner per sprog, så mailen automatisk følger galleriets sprog.

### 19.4 Automatiske mails og notifikationer

- [x] `v1` Udløbspåmindelse et valgt antal dage før galleriet udløber. Den kan sendes til kunden og/eller til alle, der har registreret sig, favoritmarkeret eller downloadet.
- [x] `v1` Butiksmails: ordrebekræftelse, digital levering, afsendt (med trackingnummer) og refundering.
- [x] `v1` Notifikationer til fotografen: ny ordre og indsendt favoritliste.
- [x] `v1` Alle mails sendes på galleriets sprog.

## 20. Globale indstillinger

- [x] `MVP` Studie-branding: studienavn, logo og kontaktinfo (e-mail, telefon og website).
- [x] `v1` Cover-logo: en lys version af logoet til brug oven på coverbilleder, samt favicon.
- [x] `MVP` Admin-konto: skift e-mail og adgangskode.
- [x] `v1` Vandmærker af tekst eller billede med valg af position, størrelse og gennemsigtighed. Der kan være flere vandmærker. De lægges på billederne i `/cache`, aldrig på originalerne.
- [x] `v1` Standardindstillinger for nye gallerier: design, download, favoritter, butik og sprog.
- [x] `v1` Standardsprog for nye gallerier.
- [x] `v1` Vis filnavne som standard (kan ændres per galleri).
- [x] `v1` Søgemaskine-synlighed: Ingen (standard) eller Kun forsiden. Gallerier indekseres aldrig.
- [x] `v1` Skarphed for visningskopier: Ingen, Standard eller Optimal. Originalerne ændres ikke.

## 21. Sprog

- [x] `MVP` Al tekst i både kunde- og admininterfacet hentes fra oversættelsesfiler (i18n) fra første linje kode, så intet er hardcodet.
- [x] `MVP` Engelsk er første sprog og standardsprog.
- [x] `v1` Dansk.
- [x] `v1` Sprog kan vælges per galleri for kundevisningen og separat for admin.
- [x] `v1` Formatering af dato, tal og valuta følger sproget, fx `DKK 1,320.00` på engelsk og `1.320,00 kr.` på dansk.
- [ ] `Senere` Flere sprog, fx svensk, norsk og tysk. Det kræver kun en ny oversættelsesfil.

## 22. Sikkerhed og adgang

- [x] `MVP` Admin-login med sikker hashing af adgangskoder og rate limiting.
- [x] `MVP` Billeder serveres kun gennem appen med adgangskontrol. Originaler kan ikke hentes direkte uden tilladelse.
- [x] `MVP` Rate limiting på galleri-adgangskoder og download-PIN.
- [x] `v1` Delingslinks (hurtige delingslinks og delte favoritlister) bruger lange, tilfældige nøgler, som ikke kan gættes, og de kan tilbagekaldes. Serveren kontrollerer adgangen til hvert billede ud fra linkets rettigheder. Rate limiting gælder også kundeadgangskoden.
- [x] `MVP` Gallerier og billeder bliver ikke indekseret af søgemaskiner (`noindex`).
- [x] `MVP` CSRF-beskyttelse, sikre cookies og sikkerhedsheaders.
- [x] `v1` Tofaktorgodkendelse (TOTP) til admin.
- [x] `v1` GDPR: kundedata kan eksporteres og slettes, og der bruges ingen tredjeparts-tracking. Ordrer bevares af hensyn til bogføringen.

## 23. Drift: Docker, backup og opdateringer

- [x] `MVP` Officielt multi-arch Docker-image (`amd64` og `arm64`), der publiceres automatisk.
- [x] `MVP` Volumes til `/photos`, `/data` og `/cache` samt `PUID`, `PGID`, `TZ` og `PORT`.
- [x] `MVP` Konfiguration via miljøvariabler, fx `BASE_URL`.
- [x] `MVP` Opsætningsguide første gang: opret admin, angiv studienavn og vælg sprog.
- [x] `MVP` Healthcheck og logs til stdout.
- [x] `MVP` Automatiske databasemigreringer ved opdatering.
- [x] `v1` Backup og gendannelse af `/data` fra admin.
- [x] `v1` Eksempel på `docker-compose.yml` og guide til reverse proxy med HTTPS.
- [ ] `Senere` Besked i admin, når en ny version er udgivet.

---

## Ikke med

- Website-builder, Studio Manager (CRM, kontrakter, fakturaer og booking), Mobile Gallery App og Photo Editor.
- Video i gallerier og dermed også videodownload.
- PayPal og andre betalingsudbydere end Stripe.
- Automatisk fulfillment via printlab. Fotografen håndterer selv alle fysiske ordrer.
