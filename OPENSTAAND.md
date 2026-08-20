# Openstaand werk — tennis app

Bijgewerkt op 20 augustus 2026. Dit bestand beschrijft waar het werk staat, welke
afspraken er gelden en wat er nog moet gebeuren. Bedoeld om in een nieuwe terminal
verder te kunnen zonder de hele geschiedenis te hoeven lezen.

## Waar staat het nu

- **`main`** staat op `27af679` — alles tot en met de herhalende lessen. Getest en gecontroleerd.
- **Werkbranch `feat/lesoverzicht-historiek`** staat gelijk met main en mag weg
  (`git branch -d feat/lesoverzicht-historiek`).
- Er is **geen remote**; alles staat lokaal. Pushen kan pas als er een remote is gekoppeld.
- Testsuite: 483 tests, allemaal in `lib/`. `npx tsc --noEmit` en `npx expo export --platform web` horen bij elke oplevering.

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

### 3. Grotere dingen die nog niet besproken zijn

Op volgorde van wat ik als eerste zou doen:

1. ~~**Echte opslag.**~~ Gedaan: met sleutels in `.env` staat alles in Supabase, zonder
   sleutels lokaal zoals vroeger. Zie README om aan te koppelen.
2. ~~**Inloggen met wachtwoord.**~~ Gedaan bij de Supabase-opzet, met strikte RLS: een
   speler ziet alleen wat van hemzelf is. Zonder sleutels blijft het de profielkeuze.
3. **Herinneringen** naar spelers voor hun les, en naar de trainer voor lessen die te lang op
   Open staan.
4. **Annuleringsregels** — te laat afgezegd is nu gratis en wist de betaalwijze.
5. **Verzetten** in plaats van annuleren en opnieuw boeken (regen, binnenbaan).
6. **Facturen** — "Factuur" bestaat als betaalwijze, maar er komt geen document uit.
7. **Voortgang over tijd** — ratings staan er, maar het verloop per speler is nergens te zien.
8. **Tests op de schermen** — alle 483 tests zitten in `lib/`, geen enkele op een scherm. Twee
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

## Losse bestanden die niet in git horen

`PHOTO-2026-08-20-13-13-44.jpg` en `PHOTO-2026-08-20-13-13-45.jpg` in de projectmap zijn
schermafbeeldingen van de Rork-versie, gebruikt als voorbeeld voor het profielscherm en het
voortgangsvenster. Verwijder ze of zet ze in `.gitignore`.
