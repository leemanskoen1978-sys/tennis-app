---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 07
subsystem: de werklijst (drie keuzes per les, het vervangersvoorstel, de markering in de agenda)
tags: [ziekmelding, vervanger, werklijst, agenda, i18n, toegang]
requires: [lib/ziekmelding.ts, lib/vervanger.ts, lib/groups.ts, lib/hub.ts, lib/vakanties.ts, lib/datetime.ts, lib/rechten.ts, providers/SimpleDataProvider.tsx]
provides:
  - "app/admin/ziekmelding/[id].tsx: de werklijst van één melding, met per les drie keuzes en het vervangersvoorstel met redenen"
  - "components/LessonCards.tsx: de badge zoekt vervanger op de agendakaart"
  - "components/BookingDetailSheet.tsx: dezelfde markering op het lesdetailblad, met voor de beheerder de weg naar de werklijst"
  - "lib/i18n-en.ts: de Engelse kant van elke nieuwe zin"
affects: [components/LessonCards.tsx, components/BookingDetailSheet.tsx, lib/i18n-en.ts]
tech-stack:
  added: []
  patterns:
    - "de isAdmin-poort vóór elke andere return"
    - "afgeleid feit vers bevragen: openZiekmeldingen één keer per lijst, zoektVervanger per les"
    - "twee groepen tonen, niemand wegfilteren: === 'kan' én !== 'kan' allebei op het scherm"
    - "Record<VervangerReden, string> in plaats van een switch met default, zodat een zesde reden een typefout wordt"
key-files:
  created: ["app/admin/ziekmelding/[id].tsx"]
  modified: [components/LessonCards.tsx, components/BookingDetailSheet.tsx, lib/i18n-en.ts]
decisions:
  - "D-07 uitgevoerd: geen enkele reeks- of groepshelper in het werklijstbestand; elke handeling raakt precies één boeking"
  - "D-09 uitgevoerd: wie niet kan staat gedempt maar volledig in de lijst, met de reden als zin, en blijft aanklikbaar"
  - "De toestand van een rij komt volledig uit zoektVervanger: het scherm leidt hem niet af uit taught_by_id"
  - "De substituutnaam loopt via een lokale vervangerNaam, dezelfde vorm als op het lesdetailblad"
  - "VERV-05 t/m VERV-09 afgevinkt; VERV-04 en VERV-10 wachten op de handmatige bevestiging van plan 08"
metrics:
  duration: ~40 min
  completed: 2026-09-06
  tasks: 3
  tests_before: 1223
  tests_after: 1223
---

# Phase 3 Plan 07: De werklijst — Summary

De beheerder opent één ziekmelding en ziet elke les die ze raakt met datum, uur, baan, groep of
speler en het aantal spelers, kiest per les tussen koppelen, laten staan of afzeggen, en krijgt
bij het koppelen elke collega te zien — wie kan bovenaan, wie niet kan eronder mét de reden en
nog steeds aanklikbaar.

## Wat er gebouwd is

**`app/admin/ziekmelding/[id].tsx` (355 regels)**

| Blok | Wat het doet |
|---|---|
| Kopcommentaar | Waarom het scherm bestaat, dat elke rij op zichzelf staat (D-07), dat geen van de drie keuzes altijd het juiste antwoord is (D-05), en dat het scherm zelf niets uitrekent |
| De beheerderspoort | Hetzelfde blok als op het lijstscherm, met dezelfde zin, op regel 94 tegenover de laatste `return (` op regel 199 |
| Onbekende melding | Een gewone zin en stoppen — geen lege lijst, want die leest als "er is niets geraakt" |
| De kop | Naam van de zieke trainer, `periodeTekst`, de reden, en hoeveel lessen er nog een vervanger zoeken |
| De rijen | `lessenVoorZiekmelding(bookings, ziekmelding, settings.vakanties ?? [])`, al op tijd gesorteerd door lib/ — geen tweede sortering |
| Per rij | `formatDay` + `formatTimeRange`, de baan uit `courts`, de groep uit `lesGroepen` of anders de speler, en `groupSizeLabel(groupSize(booking))` |
| De toestand | `afgezegd` / `geregeld` / `zoekt`, waarbij "zoekt" volledig het antwoord van `zoektVervanger` is |
| Beide namen | Staat er een vervanger, dan staan de vaste trainer én de vervanger er allebei |
| De drie keuzes | "Vervanger koppelen" (opent de kiezer), "Laten staan" (schrijft niets weg, met commentaar dat dat opzet is), "Afzeggen" (`updateBooking(booking.id, { status: 'cancelled' })`) |
| De kiezer | `vervangersVoor(...)` met `coachesOf(users)` zonder de trainer van de les zelf; "Kan invallen" boven, "Kan niet, tenzij je het toch wil" eronder |

**Wat het scherm bewust niet doet.** Er staat nul keer `retracted_at`, nul keer een reeks- of
groepshelper, nul keer een eigen `if` over boekingstijden, periodes, vakanties of botsingen, en
nergens een patch met het lesgeversveld: koppelen loopt uitsluitend over `setTaughtBy`, en het
patch-type van `updateBooking` sluit dat veld per `Omit<>` uit, zodat `tsc` een tweede
schrijfweg zelf tegenhoudt. Elke handeling raakt precies de boeking van die ene regel.

**De redenen als zinnen.** Een `Record<VervangerReden, string>` en geen `switch` met een
`default`: komt er ooit een zesde reden bij, dan is dat hier een typefout in plaats van een lege
regel op het scherm waar de beheerder de reden verwacht. `kan` staat erin om de lijst volledig
te houden, met commentaar dat het die kant nooit haalt.

**De markering (taak 3).** In `components/LessonCards.tsx` staat "Zoekt vervanger" nu in de
`badgeRow`; `openZiekmeldingen(sickLeaves)` wordt één keer per lijst uitgerekend en
`zoektVervanger` per kaart vers gesteld. De bestaande `(vervangen)`-markering uit fase 2 is niet
aangeraakt — dat is een ander feit, en de twee sluiten elkaar uit. In
`components/BookingDetailSheet.tsx` staat dezelfde markering als korte zin bij de vervangerregel,
met voor de beheerder één zin erbij die naar de werklijst wijst; het blok "Wie gaf deze les?" is
ongewijzigd. Beide bestanden schrijven niets weg.

**De Engelse kant**: twee toevoegingen aan `lib/i18n-en.ts` — het gegroepeerde blok voor de
werklijst en de twee zinnen van de markering. De `MIST`-lussen uit de acceptatiecriteria zijn
alle drie leeg.

## Deviations from Plan

**1. [Rule 3 - Blokkerend] De reeksnamen mochten ook niet in het commentaar staan.**
- **Gevonden bij:** taak 1, bij de acceptatiegrep `grep -c "seriesFrom\|groupBookingsFrom"`.
- **Probleem:** het kopcommentaar legde D-07 uit door de twee helpers bij naam te noemen ("die
  komen hier niet voor"). De grep telt commentaar mee en gaf `2` in plaats van `0`.
- **Oplossing:** dezelfde uitleg zonder de identifiers ("geen enkele helper die de hele reeks of
  de hele groep bij elkaar zoekt"). Geen gedragsverschil; de regel staat er even hard.
- **Commit:** 063f4b0

**2. [Rule 1 - Bug] De toestand van een rij leunde nog op `taught_by_id`.**
- **Gevonden bij:** taak 3, bij de fasebrede controle op `taught_by_id`.
- **Probleem:** `toestandVan` deed eerst `if (booking.taught_by_id) return 'geregeld'` en pas
  daarna `zoektVervanger`. Dat is een tweede antwoord op dezelfde vraag — precies wat D-16 en
  lib/lesgever verbieden. Praktisch gevolg bij D-15: een les waar de zieke trainer alléén als
  vervanger stond, kreeg "Geregeld" te zien terwijl juist die vervanger ziek is.
- **Oplossing:** `toestandVan` vraagt het alleen nog aan `zoektVervanger`. De naam van de
  vervanger loopt via een lokale `vervangerNaam`, dezelfde vorm als op het lesdetailblad, zodat
  het veld alleen nog gelezen wordt om een naam te tonen.
- **Commit:** eef2318

## Verificatie

```
npx tsc --noEmit                → schoon (exit 0, geen uitvoer)
npm test                        → 49 suites, 1223 tests, alles groen (was 49 / 1223)
npx expo export --platform web  → geslaagd ("Exported: dist")
```

Greps uit de acceptatiecriteria:

```
wc -l app/admin/ziekmelding/[id].tsx                        355   (>= 250)
seriesFrom|groupBookingsFrom in het bestand                   0
taught_by_id: (een patch met dat veld)                        0
zoektVervanger( in het scherm                                 1   (>= 1)
retracted_at in het scherm                                    0
lessenVoorZiekmelding(                                        1
groupSize(                                                    1   (>= 1)
participant_ids.length                                        0
formatDay / formatTimeRange / courts / lesGroepen / groupSize  geen MIST
"Ziekmeldingen zijn alleen voor de beheerder."                1, op regel 94
laatste "return (" in het bestand                            regel 199  (94 < 199)
nameOf(booking.coach_id)                                      2   (>= 1)
vervangersVoor(                                               1   (>= 1)
working_hours|booking_periods|vakantieOpMoment|botsen(        0
=== 'kan' / !== 'kan'                                         1 / 1
eigen_les buiten_uren afwijkende_periode clubvakantie zelf_ziek  geen MIST
setTaughtBy(                                                  2   (>= 1)
zoektVervanger( in LessonCards / BookingDetailSheet           1 / 1
retracted_at in beide componenten                             0 / 0
"vervangen" in LessonCards                                    2, geen verwijderde regel
nieuwe setTaughtBy|updateBooking|commit( in de componenten    0
taught_by_id buiten de toegestane vormen in app/ + components/  2 (beide van vóór deze fase)
de MIST-lussen over alle t()-zinnen                          alle drie leeg
```

Fasebrede controle uit `<verification>`:

```
grep -rn "seriesFrom|groupBookingsFrom" app/admin/ziekmelding/   niets
grep -rn "retracted_at" app/ components/                          0
grep -rn "aStart < bEnd" lib/ providers/ components/ app/         1
```

## Known Stubs

Geen. Elk blok op dit scherm is aan echte gegevens gehangen.

Wat er nog niet in een draaiende app te zien is: de `sick_leaves`-migratie is nog steeds bewust
niet gedraaid. Tot de gebruiker dat doet leest `selectAllOptioneel` een lege lijst, blijft
`sickLeaves` leeg, en toont dus geen enkele agendakaart de markering en heeft de werklijst geen
melding om te openen. Dat is de opzet van de fase: plan 08 draait de migratie en bevestigt het
fasedoel met de hand. Om diezelfde reden staan VERV-04 en VERV-10 nog open, terwijl VERV-05 t/m
VERV-09 met dit plan zijn afgevinkt.

## Threat Flags

Geen nieuw aanvalsoppervlak buiten het dreigingsmodel van het plan. T-03-25 en T-03-26 zijn
afgedekt met de greps op de reeks- en groepshelpers en op het lesgeversveld, plus het
`Omit<>`-type van `updateBooking`; T-03-27 met de twee takken `=== 'kan'` en `!== 'kan'` die
allebei op het scherm staan en met knoppen die niet uitgeschakeld worden; T-03-29 met de
beheerderspoort vóór elke andere `return`; T-03-30 met de beide namen op een geregelde rij.
T-03-28 blijft zoals aanvaard: de badge op de agendakaart zegt alleen dat de les nog een
vervanger zoekt — geen naam, geen reden, geen gezondheidsinformatie.

## Self-Check: PASSED

- `app/admin/ziekmelding/[id].tsx` — bestaat, 355 regels
- `components/LessonCards.tsx`, `components/BookingDetailSheet.tsx`, `lib/i18n-en.ts` — gewijzigd en gecommit
- Commits 063f4b0, 79b1c01 en eef2318 — alle drie gevonden in `git log`
