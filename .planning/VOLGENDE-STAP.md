# Waar het werk staat, en wat er nog moet

Bijgewerkt op 6 september 2026. Bedoeld om in een nieuw gesprek verder te kunnen zonder de
hele geschiedenis te lezen.

## Klaar en online

Fases 1, 2, 2.1, 3, 4, 5 en 5.1 staan op `main`, de build is groen en de site is bijgewerkt.
1574 tests. De testlijst voor de gebruiker staat in `TESTEN-tennisschool.md`.

Drie SQL-bestanden die de gebruiker zelf draait, in deze volgorde:
1. `MIGRATIE-tennisschool.sql` — de tabellen. **Gedraaid op 6 september 2026**, door de gebruiker bevestigd als correct. Daarmee bestaan `lesson_groups`, `sick_leaves`, `bookings.group_id` en `bookings.taught_by_id`, is `bewaak_betaalvelden` bijgewerkt en staat `courts_write` op `is_admin()`.
2. `BANEN-toevoegen.sql` — terrein 1 t/m 11. **Gedraaid.**
3. `KALENDER-2026-2027.sql` — dertien vakantieperiodes. **Gedraaid op 6 september 2026**, geverifieerd: 13 periodes in `club_settings`.

Sinds fase 5.1 nog bijgekomen, buiten de fases om: het banenscherm compact (keuzelijst +
detail + overzichtslijst), een baan kunnen toevoegen, het banenscherm beheerder-only, de
komende lessen op het afvinkscherm, en de tegelpagina van zeventien naar elf tegels met
"Lessen beheren" als ingang naar de tennisschool.

## Wat er nog moet

### 1. Het tweede importformaat — GEBOUWD op 6 september 2026

De gebruiker leverde de volledige lijst van de club aan. Die heeft een **andere vorm** dan
`koen.xlsx` en de importer kan hem niet lezen. Geanalyseerd, cijfers hard:

- 192 groepen, **550 verschillende spelers**, 12 trainers, terreinen 7 t/m 11, 13 doelgroepen.
- Kolommen: `Doelgroep`, `Groep`, `Weekdag`, `Uur`, `Terrein(en)`, `Trainer(s)`, `Speler(s)`.
- **Eén regel per groep**, spelers komma-gescheiden in één cel. Niet één regel per les × leerling.
- **Geen datums.** Het is een weekschema. De lessen volgen uit de clubkalender hierboven,
  seizoen 7 september 2026 – 30 juni 2027.
- `Uur` is een reeks (`16:00 - 17:00`). Duur: 188× 60 min, 2× 30 min, 2× 90 min — de vaste
  60 minuten als clubinstelling klopt dus niet voor vier groepen.
- Twee regels hebben **meerdere terreinen** (`Terrein 10, Terrein 11, Terrein 8, Terrein 9`).
- Twee regels hebben **geen spelers**.
- `Doelgroep` en `Groep` spreken elkaar soms tegen ("Kidstennis rood" met groepsnaam
  "Kidstennis groen - Groep 4"). `Doelgroep` is dus geen betrouwbaar niveau.

**Sleuteltest op de echte lijst:**

| Sleutel | Botsingen |
| --- | --- |
| weekdag + uur + terrein | 5 |
| + trainer | 4 |
| + `Groep` | 0 |

**Beslissing van de gebruiker: de groepsnaam komt er alleen bij als tiebreak**, niet standaard
in de sleutel. Dus weekdag + uur + terrein, en de naam alleen op de momenten waar het anders
botst. Zo blijft hernoemen werken voor de 187 groepen zonder botsing.

**Wat er gebouwd is.** `lib/import-weekschema.ts` leest het clubformaat en vertaalt het naar
`GeplandeGroep`; op dat punt haakt het in de bestaande pijplijn en kent niets erna nog een
bestandsformaat. `planImportLessen` kiest de lezer. Het sjabloon van de app blijft werken.

De formaatkeuze gaat over de **datum** en niet over de weekdag. Dat was de eerste opzet en die
was fout: `koen.xlsx` heeft zélf een kolom `Weekdag` staan, naast `Weeknr`, `Locatie` en
`Indoor/Outdoor`. Erop kiezen stuurde dat bestand naar de verkeerde lezer en liet alle 1398
regels verdwijnen. De testsuite ving het.

Beslissingen die erin verwerkt zitten:

| Onderwerp | Wat het werd |
| --- | --- |
| Sleutel | weekdag + beginuur + baan-**ID**, met de groepsnaam alleen als tiebreak. Het ID en niet de baannaam: `groepSleutel` in lib/lesgroepen sleutelt bestaande groepen op `court_id`, en met "terrein 7" tegenover "c7" was er elk seizoen 192 keer een nieuwe groep bijgekomen. |
| Seizoen | Uit de clubinstellingen (`season_start`/`season_end`), niet uit het bestand. Zonder ingesteld seizoen weigert de import het weekschema met een melding. |
| Lesduur | Uit de kolom `Uur` (`16:00 - 17:00`), per groep bewaard in `lesson_groups.duration_minutes`. Leeg = de clubinstelling. |
| Meerdere terreinen / trainers | De eerste wint, de rest in een waarschuwing. |
| Regels zonder spelers | De groep komt er met een leeg rooster; geen lessen tot er iemand in zit. |
| Trainers | Onbekende trainers wórden aangemaakt (rol `coach`, demo-adres). Dit draait D-07 om — zie hieronder. |

**Twee dingen die onderweg gevonden zijn en de import zouden hebben laten stranden:**

1. **`users.email` is `unique not null`.** De clublijst heeft geen e-mailkolom, dus zonder
   ingreep zouden 550 leden een leeg adres krijgen en zou de tweede daarvan de hele import laten
   stranden — halverwege, met leerlingen zonder groep als restant. Nooit opgevallen omdat
   `koen.xlsx` wél adressen heeft; een bestaande test legde `email: ''` zelfs vast. Elk nieuw lid
   krijgt nu een adres afgeleid van zijn naam op `example.com` (RFC 2606: dat domein kan nooit
   post ontvangen).
2. **Zonder trainer plant `lessenUitGroep` geen enkele les**, want `Booking.coach_id` is
   verplicht. De clublijst noemt twaalf trainers die de club niet als account heeft — dat waren
   192 groepen zonder één les. Op verzoek van de eigenaar worden ze nu aangemaakt. Van D-07
   blijft overeind dat het niet stilletjes mag: de namen staan in de droogloop, ze krijgen geen
   uurtarief, en hun login is een aparte handeling.

**Twee SQL-bestanden die de gebruiker zelf draait:**

- `SEIZOEN-EN-LESDUUR.sql` — vóór de import. Zet het seizoen (7 september 2026 t/m 30 juni 2027,
  overgenomen uit de kalenderfoto: het groen begint in week 37 en eindigt op 30 juni) en voegt
  `duration_minutes` toe aan `lesson_groups`. De dertien vakantieperiodes stonden er al en
  kloppen; het wit in die kalender is geen vakantie maar buiten het seizoen, en dat verschil
  stond nergens in de databank.
- `TRAINERS-LOGIN.sql` — ná de import. Geeft de aangemaakte trainers een login met wachtwoord
  `123`, mét de rij in `auth.identities` die Supabase nodig heeft (zonder die rij is het "Invalid
  login credentials" ook al klopt het wachtwoord — de valkuil waar `leslie-login.sql` ook op
  stuitte). Onderaan staat een uitgecommentarieerd blok dat de wachtwoorden ongeldig maakt zodra
  de club er echt mee gaat werken.

**Droogloop op de échte clublijst, 6 september 2026.** Het bestand staat in `~/Downloads/
Lesgroepen.xlsx` en niet in de repository. Uitkomst: 193 groepen, 12 trainers, 552 spelers,
6461 lessen, 1732 overgeslagen wegens vakantie, 301 gemelde overlappingen, **nul fouten**. De
duren kloppen: 189 × 60 minuten, 2 × 30, 2 × 90. Elke groep krijgt lessen (32 tot 35, mediaan 33).

Die droogloop haalde er drie dingen uit die op verzonnen testgegevens niet te zien waren:

1. **De koprij staat op rij 3.** Rij 1 is een titel ("Aanbod: Tennis - Jaarcyclus 2026 - 2027"),
   rij 2 is leeg. De lezer keek alleen naar rij 1 en meldde "de koprij mist een verplichte kolom"
   over een bestand dat helemaal in orde is. `vindKopregelWeekschema` zoekt hem nu in de eerste
   tien rijen.
2. **Er is een tweede blad**, `groepsleden`, met 669 regels: per lid per groep, mét
   `E-mailadres` en `Gsm-nummer`. Dat wordt er nu bij gelezen, dus geen enkele speler krijgt nog
   een verzonnen adres. Het rooster komt er uitdrukkelijk níét uit — dat blijft de kolom
   `Speler(s)` van het eerste blad, want twee bronnen voor hetzelfde rooster is twee antwoorden.
3. **552 spelers staan op 451 adressen**: gezinnen delen het adres van een ouder, en
   `users.email` is `unique not null`. De import zou op het tweede kind van elk gezin gestrand
   zijn. `uniekAdres` maakt er plus-adressering van (`ouder+2@gmail.com`) — uniek in de databank,
   en de post komt nog steeds bij de ouder aan.

Na die drie: **552 spelers, 552 verschillende adressen, alle 552 met telefoonnummer, nul
verzonnen.**

**De 301 overlappingen vallen op zes momenten, en alle zes zijn ze goed.** Vijf op Terrein 7 —
het kleutertennis dat al bekend was — en één op Terrein 8. Die zesde stond niet in de eerdere
analyse; de gebruiker bevestigde op 6 september 2026: *"zaterdag 10 uur terrein 8 is ook een
halve baan"*. Er hoeft dus niets aan: ze horen in het rood te staan en door te gaan, precies wat
er gebeurt.

```
wo 14:00  Terrein 7   3 groepen        za 09:00  Terrein 7   3 groepen
wo 15:00  Terrein 7   2 groepen        za 10:00  Terrein 7   3 groepen
wo 16:00  Terrein 7   2 groepen        za 10:00  Terrein 8   2 groepen
```

Eén ding dat de gebruiker zelf moet beoordelen en dat de app niet kan zien: **de club rekent 30
lesweken, de kalender geeft er 33.** Voor de app maakt het niets uit — betalen gebeurt extern —
maar de agenda toont straks ~33 lessen per groep waar de factuur er 30 noemt.

**Geverifieerd:** `npx tsc --noEmit` exit 0, `npx jest` 56 suites en 1703 tests groen (was 1591).

Wat nog niet met de hand is doorlopen: de échte clublijst door de droogloop halen. Verwacht 192
groepen, 550 spelers, 12 trainers, en botsingen op vijf momenten op Terrein 7 — die vijf zijn
goed en horen in het rood te staan. Let op dat de dev-server op de productiedatabank praat.

Het plan met alle vijftien taken staat in
`docs/superpowers/plans/2026-09-06-importer-clubweekschema.md`.

### 1a. De clublijst staat in de databank — 6 september 2026

De import is gedraaid op de productiedatabank. Wat er nu in staat:

| | |
| --- | --- |
| Lesgroepen | 193 |
| Spelers | 555 (510 nieuw, 45 stonden er al) |
| Trainers | 13 (10 nieuw, 3 stonden er al) |
| Lessen vanaf 7 september 2026 | 6396 |

**6396 en niet 6461.** Het verschil van 65 zijn de lessen van twee groepen zonder spelers —
"Privéles - Groep 18" (zondag 15:00) en "GTTA - Groep 57" (zaterdag 16:00). Een groepsles zonder
deelnemer kan niet bestaan: `Booking.player_id` is verplicht. De groepen staan er wel; zet er
spelers in en lees het bestand opnieuw, dan komen hun lessen er alsnog bij.

**Wat er vooraf opgeruimd moest worden.** In de agenda stonden 325 lessen uit de eerste import
(`koen.xlsx`), allemaal op één trainer en allemaal **zonder lesgroep** — dat bestand is ingelezen
voordat `lesson_groups` bestond, dus er viel niets te koppelen. Diezelfde lessen zitten ook in de
clublijst, en sinds een overlap niet meer blokkeert zou de import ze een tweede keer inplannen.
De droogloop verried het: 301 overlappingen tegen een lege club, 626 tegen deze — precies 325
meer. Ze zijn verwijderd met `CLUBLIJST-OPRUIMEN.sql` en kwamen via de clublijst terug, nu mét
hun lesgroep en deelnemers.

Let op bij een volgende keer: **de app houdt de lessen in het geheugen.** Wie met SQL opruimt
terwijl de tab openstaat, ziet de droogloop nog met de oude cijfers rekenen. Hard herladen.

**En één bug die de import blootlegde: de app haalde per tabel maar 1000 rijen op.** PostgREST
geeft nooit meer terug per verzoek, zonder foutmelding en zonder waarschuwing. Met 6396 lessen
kreeg de app er 1000 en keek een trainer naar een lege agenda terwijl zijn tien groepen en 335
lessen gewoon in de databank stonden. Bevestigd op het scherm: "996 geplande lessen" — 1000
opgehaald, waarvan vier van vóór het seizoen.

Dat gold voor élke tabel en niet alleen voor `bookings`; tot vandaag stonden er 325 lessen en 45
spelers in en bleef het onzichtbaar. Opgelost in `lib/paginering` (ophalen in stukken tot de
tabel op is, met tests) en `providers/supabaseStore.ts`, dat nu ook op de sleutel sorteert —
zonder `order` mag Postgres elke volgorde geven en kan een rij in twee stukken zitten terwijl een
andere nergens in belandt. Na de reparatie: 6396 geplande lessen op het scherm.

Wat nog niet gebeurd is: `TRAINERS-LOGIN.sql` draaien voor de logins van de tien nieuwe trainers.

### 2. Een terrein kan meerdere groepen dragen — GEBOUWD op 6 september 2026

De gebruiker: *"op 1 terrein kunnen idd verschillende groepen staan. Blauw en rood
bijvoorbeeld hebben maar een half terrein nodig."*

De app gaat vandaag uit van één groep per terrein. `botstMet` in `lib/recurrence.ts` — de ene
regel voor "is dat uur bezet", en met opzet de enige — meldt een botsing zodra twee lessen op
hetzelfde terrein overlappen. Het probleem zat niet in die regel maar in wat de aanroepers
ermee deden — zij weigerden. Gevolg, zolang dat zo was:

- De import weigerde op die vijf momenten in te plannen ("Terrein 7 is bezet"), en dat is
  precies het kleutertennis.
- Het vervangersvoorstel meldde een trainer bezet die op een halve baan staat.
- `planGroepWijziging` blokkeerde een verzetting op valse gronden.

De vijf plekken, alle vijf Terrein 7:

```
woensdag 14:00   wit/Multimove Gr1 (Lasoen)  | blauw Gr1 (Devries)  | rood Gr3 (Devries)
woensdag 15:00   wit/Multimove Gr2 (Lasoen)  | blauw Gr4 (Devries)
woensdag 16:00   blauw Gr2 (Devries)         | rood Gr7 (Devries)
zaterdag 09:00   wit/Multimove Gr3 (Devries) | blauw Gr2 (Devries)  | rood Gr1 (Devries)
zaterdag 10:00   wit/Multimove Gr4 (Lasoen)  | blauw Gr3 (Devries)  | rood Gr7 (Devries)
```

Merk op dat dezelfde trainer (Devries Ann) twee groepen tegelijk draait. De trainerbotsing is
dus óók geen harde fout bij kleutertennis.

**BESLIST door de gebruiker, 6 september 2026 — en het is één regel voor allebei:**

> Een overlap **blokkeert nooit** en **waarschuwt altijd**. Het mag, maar het moet in het rood
> staan.

Dat geldt voor de trainer die twee groepen tegelijk draait ("Devries Ann" is bovendien een
voorlopige naam, dus dezelfde naam kan twee keer op hetzelfde moment voorkomen — dat mag) én
voor twee groepen op één terrein (blauw en rood hebben elk maar een halve baan nodig).

Geen capaciteit per baan dus, geen veld op `Court`. Gewoon: laat het door en toon het.

**Wat er per aanroeper gebeurd is** (commits `a075cae`, `3bde515`, `9bcb200`, `867e475`):

| Plek | Was | Is nu |
| --- | --- | --- |
| `addBooking` in `providers/SimpleDataProvider.tsx` | weigert de boeking bij overlap | boekt, met de waarschuwing zichtbaar |
| `planSeries` in `lib/recurrence.ts` | slaat botsende momenten over | plant ze in, gemarkeerd |
| `planGroepWijziging` in `lib/lesgroepen.ts` | les blijft staan, reden `'bezet'` | verzet mee, gemarkeerd |
| `lessenUitGroep` in `lib/import-trainingen.ts` | plant de les niet in | plant in, in de droogloop in het rood |
| `kanVervangen` in `lib/vervanger.ts` | reden `eigen_les` | ongewijzigd — die lijst toont niet-beschikbaren al mét reden en laat je toch kiezen |

`botstMet` zelf blijft wat het is: de ene plek die zegt óf er overlap is. Alleen wat de
aanroepers ermee doen verandert — van weigeren naar melden. Let op dat de vakantieregel wél
blokkerend blijft: een les op een dag dat de club dicht is, hoort niet ingepland te worden.

Er is één module bijgekomen: `lib/botsingen.ts`, die van een gevonden botsing één zin maakt
("Devries Ann staat dan al op Terrein 7, op woensdag 14:00–15:00"). Vier schermen gebruiken
dezelfde formulering — het boekingsvenster, de droogloop van de import, de voorvertoning van
een groepsverzetting en de reeks. Die module vergelijkt zelf géén tijdvakken en mag dat nooit
gaan doen; `botstMet` blijft de enige plek in de codebase die twee tijdvakken tegen elkaar
legt.

De knop in het boekingsvenster gaat nog wél op slot als een reeks nul bruikbare lessen
oplevert. Dat kan sinds deze wijziging alleen nog door vakantie, niet meer door overlap.

**Geverifieerd op 6 september 2026:** `npx tsc --noEmit` exit 0, `npx jest` 54 suites en 1591
tests groen (was 1574; zeventien tests bijgekomen, waaronder `lib/botsingen.test.ts`).

Wat nog niet met de hand in de browser is doorlopen: de vijf momenten op Terrein 7 daadwerkelijk
zien verschijnen na een import, en de rode melding in het boekingsvenster bij een echte overlap.

### 3. De doorlichting van de hele app

Door de gebruiker gevraagd: een consultantsblik op de volledige app, met cijfers per onderdeel
en waar het beter kan. Afgesproken opzet: aparte reviewagenten per domein (correctheid en
geld, beveiliging en RLS, architectuur, gebruik, tests, bedrijfsvoering), elk een cijfer met
onderbouwing en wat verbeteren zou kosten. Expliciet afgesproken dat de bevindingen
ongefilterd doorgegeven worden, ook waar ze het gebouwde werk tegenspreken.

Aandachtspunten die nu al bekend zijn en in die review horen:
- 1574 tests, allemaal op `lib/`. Nul op de schermen, nul op de RLS-policies.
- De build stond een dag rood zonder dat het opviel — er wordt lokaal geverifieerd, niet op de
  server. GitHub meldt ook dat Node 20 afgeschreven is.
- De dev-server praat met de échte productiedatabank van de club; er is geen tweede omgeving.
- `bookings` doet viervoudig werk (les, aanvraag, betaling, aanwezigheid).
- De export werkt alleen op web, niet op de telefoon.
- Een losse boeking controleert alleen de trainer op bezetting, niet de baan.
- `newGoalId` in `lib/goals.ts` leunt op `Date.now()` plus vier tekens toeval.

## Waar de gegevens staan

`koen.xlsx` en de clubijst met 550 namen staan **niet** in de repository en horen daar niet:
de repo is publiek. `koen.xlsx` is gitignored; de clubijst stond alleen in het gesprek. Het
testbestand `lib/__fixtures__/lessen-voorbeeld.xlsx` is een geanonimiseerde kopie met
verzonnen namen, met een test die bewaakt dat er geen echte naam in terechtkomt.

---

## 4. HET PRIJSMODEL — uitgezocht en afgesloten, 6 september 2026

Eerder op deze dag stond hier dat het prijsmodel van de club niet op dat van de app past, met
vier openstaande ontwerpvragen. **Dat is uitgepraat en het antwoord is: hier hoeft niets aan
gebouwd te worden.**

### Wat de club heeft, zijn twee modellen naast elkaar

De gebruiker: *"de tarieven dat ik je net doorstuurde dat is het totaal bedrag voor een
lessereeks in de winter. wanneer je een prive les boekt apart betaal je 60 euro."*

| | Wat | Bedrag hangt aan |
| --- | --- | --- |
| **A. Lesreeks** | winter, ~30 weken, vaste plaats in een lesgroep | de **lessoort**, per lesvolger, voor de hele reeks (wit € 450 … privé € 2.000) |
| **B. Losse les** | iemand boekt zelf een uur | de **baan**, per uur — € 60 |

Het tarievenblad van de club, model A, per lesvolger voor 30 lesweken:

| Aanbod | Per lesvolger, 30 lesweken |
| --- | --- |
| Kidstennis wit | € 450 |
| Kidstennis blauw | € 500 |
| Kidstennis rood | € 500 |
| Kidstennis oranje | € 575 |
| Kidstennis groen | € 600 |
| Tienertennis | € 600 |
| Tienertennis voor starters | € 600 |
| Groepslessen voor volwassenen | € 600 |
| Groepslessen voor (her)starters | € 600 |
| Duoles | € 1.150 |
| Groepsles 3 spelers | € 800 |
| Privéles | € 2.000 |

Merk op dat een duoles de club méér opbrengt dan een privéles (2 × € 1.150 tegen € 2.000).
Geen enkele staffel op een baan levert dat op — een staffel gaat naar beneden naarmate de
groep groeit. Model A is dus echt niet te herleiden uit model B, en dat hoeft nu ook niet.

Daarmee vervalt de conclusie dat `bookingPrice` in `lib/payments.ts` fout stond. Het is model
B, en het klopt: de € 60/uur op terrein 1 t/m 11 ís de losse privéles. Het kende model A niet,
en dat hoeft ook niet.

### De beslissing

> **De betalingen gebeuren steeds extern. De app hoeft er geen rekening mee te houden.**

Gevolgen, en het zijn er vooral geen:

- **Geen prijsveld op de lessoort of de lesgroep.** Geen nieuwe tabel lessoort→prijs.
- **Geen seizoensbijdrage per speler.** De vraag "per les of per seizoen" is niet aan de app.
- **`bookingPrice`, `totalRevenue` en Beheer → Rapport blijven zoals ze zijn.** Ze werken,
  ze zijn getest, en ze gelden voor de losse boekingen waar het baanmodel wél het echte model
  is. De gebruiker koos hier bewust voor laten staan en niet uitbreiden, boven weghalen.
- **De geldregels in `OPENSTAAND.md` blijven ongewijzigd.** Ze golden als vast, en ze blijven
  vast. Er is alleen een regel bijgekomen die zegt waarover ze gaan: losse boekingen.
- **`payment_split` hoeft niet herzien.** Geen vast bedrag per lesvolger in de app, dus geen
  reden om 'separate' af te dwingen.
- Het tarievenblad van de club is **documentatie**, geen invoer. Het staat hierboven bewaard
  zodat een volgend gesprek niet opnieuw gaat rekenen.

### Wat dit deblokkeert

De import van de clublijst wachtte hier mede op: elke boeking draagt een betaalwijze, en het
leek onverantwoord om 550 spelers in te lezen voor het prijsmodel vaststond. Dat bezwaar is
weg. De ingelezen lessen krijgen `payment_method: 'invoice'` — de bestaande regel dat een
groepsles altijd op factuur gaat — en verder is het bedrag niemands zorg binnen de app.

Punt 2 hierboven — een terrein dat meerdere groepen draagt — is diezelfde dag gebouwd.
**Daarmee is de import op niets meer geblokkeerd.** Wat er nog rest is punt 1: de importer
leert het tweede bestandsformaat lezen, één regel per groep met de spelers komma-gescheiden.
