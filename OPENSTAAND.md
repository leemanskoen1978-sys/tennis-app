# Openstaand werk — tennis app

Bijgewerkt op 20 augustus 2026. Dit bestand beschrijft waar het werk staat, welke
afspraken er gelden en wat er nog moet gebeuren. Bedoeld om in een nieuwe terminal
verder te kunnen zonder de hele geschiedenis te hoeven lezen.

## Waar staat het nu

- **`main`** staat op `27af679` — alles tot en met de herhalende lessen. Getest en gecontroleerd.
- **Werkbranch `feat/lesoverzicht-historiek`** staat gelijk met main en mag weg
  (`git branch -d feat/lesoverzicht-historiek`).
- Er is **geen remote**; alles staat lokaal. Pushen kan pas als er een remote is gekoppeld.
- Testsuite: 676 tests, allemaal in `lib/`. `npx tsc --noEmit` en `npx expo export --platform web` horen bij elke oplevering.

## Afspraken over geld — niet zomaar wijzigen

Deze regels zijn met de gebruiker vastgelegd en zitten in de code met tests eromheen.

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

### 2. Achterstallig klein werk

- **Verwijderen in het detailblad** verschijnt alleen bij een les uit een reeks. Bij een losse
  les kan het niet — dat was er nooit, maar het is nu inconsistent.
- **`BookingModal`** heeft als enig blad geen maximale breedte; op een breed scherm rekt het uit.
- **Trainer krijgt betaald ook bij een openstaande les.** Bewuste keuze (het uur is gegeven).
  Betaalt de club pas na inning, dan moet er een filter bij in `totalCoachPayout`.
- **`clubMargin`** in `lib/payments.ts` is gebouwd en getest maar staat op geen enkel scherm.
- **Genest venster**: een onbekende speler aanmaken vanuit de spelerskeuzelijst opent een modal
  binnen een modal. Werkt op web; nog niet op een telefoon getest.
- **De tabel `memos` moet nog in Supabase aangemaakt worden** door het bijgewerkte
  `supabase-schema.sql` te draaien. Zolang dat niet gebeurd is, werkt de app gewoon maar
  doen de spraakmemo's niets: `selectAllOptioneel` slikt alleen "die tabel bestaat niet".
- **Memo's blijven liggen als je ze nooit uitwerkt.** Dat is met opzet (het is een werklijst,
  geen postvak dat opruimt), maar er staat geen grens op. Een trainer die een half jaar niets
  uitwerkt, sleept al die audio bij elke start mee. Zodra dat gebeurt is Supabase Storage het
  antwoord — zie de spec van 22 augustus.
- **Spraak-naar-tekst** zou het uitwerken van een memo bijna overbodig maken, maar bestaat
  in deze app nog niet. De lege plaatshouder `components/SpeechToText.tsx` is weggehaald bij
  de opruimronde: een bestand dat "binnenkort" zegt en nergens getoond wordt, is geen begin
  van een functie maar ruis. De weg ernaartoe staat in `docs/voice-memo-native.md`.
- **De memoknop is nog niet met een echte microfoon doorlopen**: opnemen, te kort loslaten,
  de aftelling voorbij 50 seconden en de afkap op 60. Dat vraagt een baan met een les erop
  en toestemming voor de microfoon in de browser.

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
9. **Tests op de schermen** — alle 676 tests zitten in `lib/`, geen enkele op een scherm. Twee
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
