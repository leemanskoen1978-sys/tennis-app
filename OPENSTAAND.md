# Openstaand werk — tennis app

Bijgewerkt op 20 augustus 2026. Dit bestand beschrijft waar het werk staat, welke
afspraken er gelden en wat er nog moet gebeuren. Bedoeld om in een nieuwe terminal
verder te kunnen zonder de hele geschiedenis te hoeven lezen.

## Waar staat het nu

*Bijgewerkt op 9 september 2026.*

- **`main`** staat op `4f8dfdf` en is gepusht naar
  <https://github.com/leemanskoen1978-sys/tennis-app>. Elke push naar `main` bouwt en zet de
  site online (`.github/workflows/deploy.yml`); de site draait op
  <https://leemanskoen1978-sys.github.io/tennis-app/>.
- Testsuite: **1804 tests**, allemaal in `lib/`. `npx tsc --noEmit`, `npm test` en
  `npx expo export -p web` horen bij elke oplevering.
- `koen.xlsx` is een **testfixture** en moet op de schijf blijven staan — 40 tests lezen dat
  bestand en slaan zichzelf stilzwijgend over als het weg is. Zie `.gitignore`.

### De Agenda-tab is opgeheven — alle vier de stukken zijn af

De zeven schermen van de Agenda-tab zijn herverdeeld over Home, Spelers, Trainers en Beheer.
De vier ontwerpen staan in `docs/superpowers/specs/`, onder de datum van 9 september 2026;
de besluiten die onderweg genomen zijn, staan in het eerste
(`2026-09-09-afvinken-vanaf-home-design.md`, onder "Besluiten voor stuk 2, 3 en 4").

| | wat | stand |
|---|---|---|
| 1 | Afvinken vanaf Home, standaard aanwezig, Klaar-knop | **af en live** |
| 2 | Aanwezigheid in het spelersdossier | **af en live** |
| 3 | Weekagenda naar de dossiers van speler en trainer | **af en live** |
| 4 | De tab opheffen: goedkeuren en de tegels naar Home, de bestanden naar Beheer | **af en live** |

**Waar de zeven schermen gebleven zijn:**

| was | is nu |
|---|---|
| `agenda/index` — goedkeuringswachtrij, vier tegels | Home: de wachtrij bovenaan, de tegels ertussen |
| `agenda/overzicht` | verdwenen; de dossiers nemen het over |
| `agenda/historiek` — lessen, bedragen, CSV/Excel | Beheer → Rapport (de twee bestanden); de lijst per persoon staat in het dossier |
| `agenda/komend` — lessen + `.ics` | het spelersdossier (persoonlijk) en Beheer → Kalender (clubbreed) |
| `agenda/week` — het weekraster | een tegel met een blad in beide dossiers |
| `agenda/afvinken` | `/afvinken`, bereikbaar vanaf Home |
| `agenda/new` | **blijft** — het is de tab Reserveren van een speler |

Een trainer houdt vier tabs: Home, Spelers, Trainers, Beheer. `/agenda/new` houdt zijn pad:
een map in de code is geen tabblad, en hernoemen zou elke verwijzing raken zonder dat iemand
er iets aan heeft.

`AANWEZIGHEID-VERLEDEN.sql` is **al gedraaid** op de databank van de club; die hoeft niet
opnieuw.

**Wat er onderweg opgelost is.** De beheerder had maar één weg naar het lesdetail van een
oude les — Beheer → Lesgroepen → groep → les — en die werkt alleen voor lessen aan een
lesgroep. Het weekraster in de dossiers opent hetzelfde blad en kent dat verschil niet:
blader naar de week van de les en tik hem aan.

**Wat een speler op Home ziet.** Zijn lessen van vandaag, en staat er vandaag niets, zijn
eerstvolgende les (`lesdagVanSpeler` in `lib/lesdag.ts`, getekend door
`components/lesdag/Lesdagspeler.tsx`). Zonder die terugval stond er zes dagen op zeven een
lege kop.

## Afspraken over geld — niet zomaar wijzigen

Deze regels zijn met de gebruiker vastgelegd en zitten in de code met tests eromheen.

**Waarover ze gaan.** Over de lessen die in de app geboekt worden. De lesreeksen van de
tennisschool worden extern gefactureerd — de club rekent daar per lesvolger per seizoen per
lessoort, en de app houdt daar bewust geen rekening mee (beslist op 6 september 2026, zie
`.planning/VOLGENDE-STAP.md` punt 4). Het uurtarief van de baan hieronder is het tarief van
een los geboekte les: € 60/uur.

| Onderwerp | Regel |
| --- | --- |
| Betaalveld | Eén veld `payment_method` met zes waarden: `open`, `cash`, `invoice`, `qr`, `beurtenkaart`, `sponsor`. `open` = nog niets afgesproken en voedt de werklijst in Beheer → Betalingen. |
| Prijs voor de speler | Uurtarief van de **baan**, naar rato van de duur. Bij een groepsles: de tariefstaffel van die baan (`Court.group_rates`), als totaalbedrag voor de les. |
| Loon van de trainer | Uurtarief van de **trainer** (`User.hourly_rate`), naar rato van de duur. Geen tarief ingesteld = €0,00 mét zichtbare waarschuwing, nooit stil weglaten. |
| Omzet | `countsAsRevenue`: cash, factuur, QR, beurtenkaart én sponsor tellen mee. `open` niet. Geannuleerde en niet-bevestigde lessen tellen nooit mee. |
| Sponsor | Een sponsorcontract is betaald geld. De speler heeft een budget in euro's (`User.sponsor_budget`); elke sponsorles gaat eraf. Budget op = betaalwijze wordt geweigerd. **Alleen bij privélessen.** |
| Beurtenkaart | Tien beurten per kaart, hangt aan de betaler. **Alleen bij privélessen.** |
| Groepsles | Altijd op factuur, geen keuze. Samen betalen = één factuur voor het totaal aan de betaler; apart = ieder zijn deel, zo afgerond dat de som exact het totaal is. |

**Eén bewaakte weg.** Elke wijziging van een betaalwijze loopt via `planMethodChange` in
`lib/beurtenkaart.ts`, aangeroepen door `setPaymentMethod` in `providers/SimpleDataProvider.tsx`.
`updateBooking` sluit `payment_method` en `beurtenkaart_id` expliciet uit van zijn type, zodat
TypeScript elke omweg afkeurt. Houd dat zo — het gat dat daarmee gedicht werd, liet een speler
twee keer betalen.

## Wat er nog moet gebeuren

### 1. Groepslessen en herhalende lessen — af

Beide staan op main. Groepslessen: één boeking met `participant_ids`, altijd op factuur,
samen of apart verdeeld, tariefstaffel per baan (`Court.group_rates`). Herhalende lessen:
`lib/recurrence.ts` (welke datums, welke botsen), `lib/series.ts` (deze les en alle latere),
`addBookingSeries` / `cancelSeriesFrom` / `deleteSeriesFrom` in de provider, en de keuze in
`components/BookingModal.tsx` en `components/LessonDetailSheet.tsx`.

Wat nog niet met de hand in de browser is doorlopen: een reeks boeken die langer is dan de
beurtenkaart toelaat (de laatste lessen horen op "Open" te blijven, met melding), en
"deze en alle volgende" annuleren.

### 1b. Wat er op 22 augustus bij is gekomen en werkt

Met de hand doorlopen op de echte site, door de gebruiker:

- **De lesdag met de spraakmemo.** Opnemen op de baan, de uitwerklijst, en de notitie die
  eruit voortkomt. De tabel `memos` staat in Supabase.
- **Beheerder als vinkje** (`users.is_admin`): boeken, wijzigen en schrappen in elke agenda,
  en beslissen over de lesaanvragen van de hele club. Wie beheerder mag maken, bewaakt de
  trigger `bewaak_is_admin` — niet de app.
- **Uitloggen blijft uitgelogd**, ook op een telefoon.
- **Bladeren tussen de openstaande betalingen** in plaats van ze in volgorde te moeten
  afwerken.
- **Goedkeuren en weigeren werkt weer.** Zie de valkuil hieronder; het lag aan de RLS, niet
  aan het scherm.
- **De speler krijgt bericht als zijn aanvraag geweigerd is** (`bookings.rejected_at`,
  verdwijnt na een week).
- **Een trainer kan een les van vandaag én van vorige week nog inzetten**; een speler begint
  bij morgen.

### 1c. Lessen zonder trainer overnemen — af, op het handwerk na

Een trainer ziet onder **Trainers → Lessen zonder trainer** elke les die zonder trainer staat
en neemt er zelf een over. Twee manieren waarop een les daar komt: de vaste trainer is ziek
gemeld, of iemand heeft de les vrijgegeven met de knop op het lesdetail (`bookings.zoekt_trainer`).

- **Wie de vraag beantwoordt:** `lib/openstaand.ts` — `staatOpen`, `openstaandeLessen`,
  `claimBezwaar`, `teruggeefBezwaar`, met 24 tests. De ziektekant komt uit `zoektVervanger`
  (`lib/ziekmelding.ts`) en wordt niet nagebouwd.
- **Schrijfwegen:** `claimLes` en `geefLesTerug` in de provider. Ze geven de reden terug als het
  niet mag — een collega die je voor was, een les die al begonnen is — en nooit stil niets.
- **Er wordt niets weggefilterd.** Een les die niet bij je uren past staat er ook, met de reden
  van `kanVervangen` eronder, en claimen mag toch. Een les die niemand ziet blijft zonder
  trainer staan, en dat is precies de fout die dit moet voorkomen.
- **De databank:** `ZOEKT-TRAINER.sql`. Eén nauwe opening in `bewaak_betaalvelden` — een trainer
  mag `taught_by_id` van leeg naar zichzelf zetten op een openstaande les die nog moet beginnen,
  en terug naar leeg — met de harde eis dat er verder niets aan de rij verandert. Nagekeken op
  een echte Postgres 16 met vijftien scenario's, inclusief de bestaande wegen (beheerder wijst
  aan, trainer verzet zijn baan, speler zet zijn betaalwijze).

**Wat de gebruiker nog met de hand moet doen.** `ZOEKT-TRAINER.sql` draaien in de Supabase
SQL-editor — ná `AANWEZIGHEID-VERLEDEN.sql`, want die herschikte dezelfde trigger — en daarna de
app hard herladen. Vóór die SQL werkt het scherm wel en het claimen niet. Daarna met de hand
doorlopen: een les vrijgeven, met een tweede traineraccount de lijst openen, de les nemen, en
hem teruggeven.

### 1d. Lesmateriaal doorsturen per periode — af, op het handwerk na

De beheerder stuurt onder **Beheer → Lessen beheren → Lesplanning** lesmateriaal door voor een
periode, aan een trainer en/of een lesgroep. De trainer ziet het bij zijn les staan.

- **Wie de vraag beantwoordt:** `lib/lesplanning.ts` — `lesplanningFout`, `geldtVoor`,
  `materiaalVoor`, met 18 tests. Er wordt niets op de boeking geschreven: welk materiaal geldt is
  een afgeleid feit uit trainer, groep en datum, net als `zoektVervanger` en `staatOpen`. Zo krijgt
  een les die later in die periode nog bijgeboekt wordt het materiaal vanzelf.
- **`geldtVoor` vergelijkt `coach_id` en met opzet niet `lesgeverId`.** Neemt een collega een les
  over van een zieke trainer, dan blijft het de les van die groep en hoort er hetzelfde materiaal
  bij; de vervanger ziet het gewoon.
- **Er wordt niets weggelaten** als er twee dingen gelden (een groepsplanning én een
  trainersplanning): ze staan er beide, de bijzonderste bovenaan.
- **De speler ziet het niet, met opzet.** Dit is werkinstructie voor de trainer. De spelerskant
  zou twee openingen in de bewaking kosten: `lessons_select` laat een speler alleen materiaal
  lezen dat aan hemzelf hangt, en `lesson_groups_select` is alleen voor de beheerder.
- **De databank:** `LESPLANNING.sql` — de tabel `les_planning`, een `check` die een rij zonder
  trainer én zonder groep weigert, `on delete cascade` op de drie verwijzingen, lezen voor elke
  trainer en schrijven alleen voor de beheerder. Nagekeken op een echte Postgres 16.

**Wat de gebruiker nog met de hand moet doen.** `LESPLANNING.sql` draaien in de Supabase
SQL-editor en daarna de app hard herladen. Vóór die SQL werkt het scherm wel en het opslaan niet.
Daarna doorlopen: materiaal doorsturen voor een groep en een periode, en met een traineraccount
nakijken of het bij de juiste lessen staat en niet bij de andere.

### 2. Achterstallig klein werk

- **Verwijderen in het detailblad** verschijnt alleen bij een les uit een reeks. Bij een losse
  les kan het niet — dat was er nooit, maar het is nu inconsistent.
- **`BookingModal`** heeft als enig blad geen maximale breedte; op een breed scherm rekt het uit.
- **Trainer krijgt betaald ook bij een openstaande les.** Bewuste keuze (het uur is gegeven).
  Betaalt de club pas na inning, dan moet er een filter bij in `totalCoachPayout`.
- **`clubMargin`** in `lib/payments.ts` is gebouwd en getest maar staat op geen enkel scherm.
- **Genest venster**: een onbekende speler aanmaken vanuit de spelerskeuzelijst opent een modal
  binnen een modal. Werkt op web; nog niet op een telefoon getest.
- **Memo's blijven liggen als je ze nooit uitwerkt.** Dat is met opzet (het is een werklijst,
  geen postvak dat opruimt), maar er staat geen grens op. Een trainer die een half jaar niets
  uitwerkt, sleept al die audio bij elke start mee. Zodra dat gebeurt is Supabase Storage het
  antwoord — zie de spec van 22 augustus.
- **Spraak-naar-tekst** zou het uitwerken van een memo bijna overbodig maken, maar bestaat
  in deze app nog niet. De lege plaatshouder `components/SpeechToText.tsx` is weggehaald bij
  de opruimronde: een bestand dat "binnenkort" zegt en nergens getoond wordt, is geen begin
  van een functie maar ruis. De weg ernaartoe staat in `docs/voice-memo-native.md`.

### 3. Grotere dingen die nog niet besproken zijn

Op volgorde van wat ik als eerste zou doen:

1. ~~**Echte opslag.**~~ Gedaan: met sleutels in `.env` staat alles in Supabase, zonder
   sleutels lokaal zoals vroeger. Zie README om aan te koppelen.
2. ~~**Inloggen met wachtwoord.**~~ Gedaan bij de Supabase-opzet, met strikte RLS: een
   speler ziet alleen wat van hemzelf is. Zonder sleutels blijft het de profielkeuze.
3. ~~**Leden importeren uit Excel.**~~ Gedaan. Beheer → Leden importeren: een CSV met
   `naam`, `email`, `rol`, `telefoon`, `uurtarief`, waarvan alleen naam en email verplicht
   zijn. Het scherm toont eerst wat er gaat gebeuren en schrijft pas weg als de trainer
   bevestigt. Wie zo is ingevoerd, stelt zijn wachtwoord zelf in op het loginscherm
   ("Eerste keer hier?"); de bestaande trigger `link_auth_user` koppelt dat aan zijn rij,
   dus zijn lessen en dossier komen mee. Het schema is niet gewijzigd.

   Wat er bewust níét in zit: uitnodigingsmails (vraagt een Edge Function met de
   service-role sleutel), echte `.xlsx` lezen (dat is een zip, dus decompressie), en
   verwijderen via de import — een naam die uit het bestand valt, verdwijnt niet uit de
   club. De rol van een bestaand lid wijzigen kan alleen met de hand in Beheer, want
   `updateUser` sluit `role` uit van zijn type. Drie samengestelde foutmeldingen staan nog
   niet in het Engels; dat kan pas als ze een vorm met plaatshouders krijgen.

   **Zet in Supabase "Confirm email" aan** voordat je importeert — zie README. Zonder die
   bevestiging kan iemand die het adres van een clublid kent dat account claimen voordat
   het lid zelf komt.
4. **Herinneringen** naar spelers voor hun les, en naar de trainer voor lessen die te lang op
   Open staan.
5. **Annuleringsregels** — te laat afgezegd is nu gratis en wist de betaalwijze.
6. **Verzetten** in plaats van annuleren en opnieuw boeken (regen, binnenbaan).
7. **Facturen** — "Factuur" bestaat als betaalwijze, maar er komt geen document uit.
8. **Voortgang over tijd** — ratings staan er, maar het verloop per speler is nergens te zien.
9. **Oefenstof toewijzen aan trainers.** De beheerder bepaalt voor meerdere trainers
   tegelijk welke les ze die week geven. Gevraagd en uitgevraagd op 9 september 2026; nog
   niet ontworpen.

   **Het gaat om lesmateriaal, niet om lesuren.** Een `Lesson` is in dit model een pagina
   uit het lessenboekje — titel, oefeningen, aandachtspunten, materiaal (`lib/types.ts:317`)
   — en niet een uur op de baan; dat is een boeking. De wens gaat dus over "welke oefenstof
   staat er deze week op het programma", niet over wie wanneer lesgeeft. De eerste notitie
   hier nam dat laatste aan en dat was verkeerd.

   Vastgelegd met de gebruiker:

   - **Per week, één losse les.** Geen toewijzing voor een heel seizoen.
   - **De agenda blijft ongemoeid.** De boeking die er stond blijft staan: dit is een
     toelichting, geen verplichting. Er verschuift niets en er wordt niets overschreven.
   - **De trainer krijgt het te zien.** Hij hoeft niets te bevestigen en niets te doen.

   Wat er al ligt om op te bouwen: `Lesson` heeft al een `coach_id` én een `student_id`, en
   `components/AssignLessonModal.tsx` hangt al een les uit de gedeelde bibliotheek aan een
   speler. Dit is dezelfde handeling met een andere ontvanger, voor meer dan één tegelijk.

   Nog open voor het ontwerp: waar de trainer het te zien krijgt (op Home bij zijn lesdag,
   of onder Mijn lessen), en of een toewijzing aan een weeknummer hangt of aan een datum.
10. ~~**Het spelersdossier staat open voor medespelers.**~~ Gevonden op 9 september 2026,
    dicht op 9 september 2026 — in de app. In de databank nog niet; zie het staartje hieronder.

    Wat er was: in een groepsles is elke medespeler aanklikbaar in het lesdetail ("Open
    dossier van {naam}") en `app/players/` had geen enkele rolcontrole. Een speler opende
    dus zijn eigen les, tikte op een medespeler, en zag diens e-mailadres, telefoonnummer,
    de opmerking voor de trainer, zijn doelen en zijn voortgangsnotities. Bij 555 leden,
    veel kinderen.

    Wat het geworden is: `magDossierZien(kijker, lid, relaties)` in `lib/rechten.ts` —
    trainer of beheerder, jezelf, of de ouder van dít kind, met een goedgekeurde aanvraag.
    Diezelfde regel stond al in het scherm, maar één laag te laat: hij bepaalde welke
    knoppen er verschenen en niet of je binnen mocht. Nu leest `app/players/[id].tsx` hem
    vóór het iets tekent en toont het anders alleen de naam met één zin erbij.

    Drie plekken die erop aansluiten:
    - `components/BookingDetailSheet.tsx` toont een medespeler nog steeds bij naam — je
      speelt samen — maar zonder doorklik en zonder chevron voor wie hem niet mag volgen.
    - `app/players/index.tsx` blijft voor een speler de ledenlijst, alleen zijn de regels
      die nergens heen gaan niet meer aanklikbaar.
    - `magContactZien` is nu één regel die `magDossierZien` doorgeeft, in plaats van
      dezelfde vier voorwaarden een tweede keer. Een test legt die gelijkheid vast, zodat
      het adres later bewust krapper gezet kan worden en niet per ongeluk ruimer.

    De tegel Weekagenda had sinds stuk 3 een eigen rechtentest omdat het scherm nog openstond;
    die is weg, want hij zit nu in de deur.

    **Wat hier níét mee opgelost is:** de databank geeft de rij van elk lid nog aan iedereen
    die inlogt. `users_select` staat op `using (true)` (`supabase-schema.sql:584`) omdat
    iedereen elkaars naam moet kunnen zien, en RLS schermt rijen af en geen kolommen —
    dezelfde rij draagt e-mail, telefoon, bio en sponsorbudget mee. Dit sluit de dagelijkse
    weg, niet de API. Het patroon om dat wél dicht te zetten staat in punt 11 hieronder
    (`coach_rates`: een eigen tabel met een eigen select-policy).

11. **Sponsor en betaalwijzen uit de app.** Op de plank gezet op 9 september 2026: hoe een
    les betaald wordt gebeurt buiten deze app, dus dit heeft geen prioriteit.

    Wat er ligt als het ooit opgepakt wordt: `sponsor_budget` staat als kolom op `users` en
    is daardoor voor elk ingelogd lid leesbaar — het zegt in feite welke gezinnen niet de
    volle prijs betalen. Het patroon om dat af te schermen bestaat al in dit schema
    (`coach_rates`, `supabase-schema.sql:187` en de policy op `:640`): een eigen tabel met
    een eigen select-policy, want RLS schermt rijen af en geen kolommen.

    Eén valstrik voor wie dat doet: `LEEGMAAKBAAR` in `providers/supabaseStore.ts:250` noemt
    `sponsor_budget`. Verdwijnt de kolom zonder dat die lijst meeverandert, dan faalt élke
    schrijfactie op `users` — ook een trainer die alleen zijn telefoonnummer bijwerkt.

    **De grootste valkuil zit niet in het budget maar in de betaalwijze.** Haal je
    `'sponsor'` uit `PAYMENT_METHODS` (`lib/payments.ts:11`), dan valt elke bestaande boeking
    met die betaalwijze door `isPaymentMethod` heen (`lib/migrate.ts:26`) en zet
    `migrateBooking` hem **stilzwijgend terug op `'open'`** bij het laden. Historische
    sponsorlessen verliezen zo hun betaalwijze en verdwijnen uit de omzet, zonder
    foutmelding. Wie dit oppakt moet `PAYMENT_METHODS` (de keuzelijst) en de lijst die
    `isPaymentMethod` toetst uit elkaar trekken.

    Tweede gevolg van dezelfde ingreep: de betaalwijze-chips markeren de huidige waarde met
    `selected={m === method}` en voegen geen chip toe voor een waarde die niet in de lijst
    staat. Een bestaande sponsorles toont dan een kiezer waarin níéts aangevinkt lijkt.
    Vier schermen doen dat zo (`app/players/[id].tsx:402`, `components/BookingModal.tsx:516`,
    `components/PaymentMethodSheet.tsx:48`, `components/LidBewerken.tsx:325`).

    En `lib/sponsor.ts` komt volledig dood te staan zodra de betaalwijze verdwijnt: al zijn
    oproepers hangen aan `method === 'sponsor'`. Dat is ruim 40 tests over vijf bestanden.

    Het telefoonnummer zit in dezelfde categorie als het budget: 47 plekken. Het scherm is
    inmiddels wel dicht (`magContactZien` in `lib/rechten.ts`), maar de databank geeft het
    veld nog aan elk ingelogd lid.

12. **Tests op de schermen** — alle 676 tests zitten in `lib/`, geen enkele op een scherm. Twee
   echte fouten van vandaag zaten daar: een opslagknop die op web nooit vuurde
   (`onEndEditing` bestaat niet in react-native-web) en een stijl die niet geïmporteerd was.

## Werkwijze die tot nu toe is aangehouden

- **Nederlands** in de UI en in commentaar; commentaar legt het *waarom* uit, niet het *wat*.
- **Rekenwerk in `lib/` met tests ernaast**, schermen blijven dun. Zit er logica in een scherm
  die je niet kunt testen, dan hoort ze in `lib/`.
- **Voor elke commit**: `npx tsc --noEmit`, `npm test`, en `npx expo export --platform web
  --output-dir .webbuild-check` gevolgd door `rm -rf .webbuild-check`.
- **Eén agent per bestand.** Twee agents in hetzelfde bestand overschrijven elkaars werk.
- **De dev-server draait** (`npx expo start --web`, poort 8081) en herlaadt bij elke opslag —
  laat dus nooit een half bestand achter dat naar iets verwijst dat nog moet komen.
- Bestaande vormgeving hergebruiken: `components/ui/ActionTile.tsx` (tegels),
  `StatCard.tsx` (cijfers), `Screen.tsx` + `useIsWide()` (breedte), `constants/theme.ts` en
  `constants/tennis-colors.ts` (maten en kleuren). Geen nieuwe kleuren of maten verzinnen.

## Eén valkuil in de RLS-regels

De app schrijft met een **upsert**. Postgres controleert daarbij niet alleen de
`update`-policy maar ook de `insert`-policy — óók als de rij allang bestaat. Alles wat een
insert-policy eist over de *maker* van een rij, geldt dus bij elke latere wijziging door
iemand anders.

Daar zijn twee fouten uit voortgekomen, allebei stil: een trainer kon een lesaanvraag van
een speler niet goedkeuren, en een speler kon zijn eigen profiel niet bijwerken. Beide
opgelost op 22 augustus. Wie hier een policy aanpast: lees eerst de opmerking boven
`bookings_insert` in supabase-schema.sql.

## Opruimronde van 22 augustus

Wat er weg is: `components/SpeechToText.tsx` (nergens geïmporteerd), `currentLanguage` in
lib/i18n, `paymentEntryFor` in lib/payments, en drie vertalingen zonder plek in de code.
Negentien exports die alleen binnen hun eigen bestand gebruikt werden, zijn geen export meer
— zo is van buitenaf te zien wat een module aanbiedt en wat er zijn eigen huishouding is.

Wat er bewust bleef staan: alles wat alleen nog in tests voorkomt. Dat zijn bouwstenen die
apart getest worden (`sameRow`, `splitEvenly`, `crc32`, `leesKopregel` en dertig andere);
niet-geëxporteerd zijn ze niet te testen, en dat is de prijs waard.

## Losse bestanden die niet in git horen

`PHOTO-2026-08-20-13-13-44.jpg` en `PHOTO-2026-08-20-13-13-45.jpg` in de projectmap zijn
schermafbeeldingen van de Rork-versie, gebruikt als voorbeeld voor het profielscherm en het
voortgangsvenster. Verwijder ze of zet ze in `.gitignore`.
