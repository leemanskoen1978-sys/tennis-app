---
phase: 01-lesgroepen
plan: 01
subsystem: domain-rules
tags: [lesgroepen, typescript, jest, pure-functions, temporal-propagation]

# Dependency graph
requires: []
provides:
  - "LesGroep als eigen begrip in lib/types.ts (naam, niveau, vast moment, trainer, baan, seizoen, rooster, archief)"
  - "Booking.group_id — naast series_id, niet in plaats daarvan"
  - "Settings.lesson_duration_minutes met 60 als beginwaarde in lib/seed.ts"
  - "lib/lesgroepen.ts: lesGroepFout, lessenVanGroep, groupBookingsFrom, komendeLessen, planRosterChange, groepSleutel, actieveGroepen, gearchiveerdeGroepen, GroepBoeking, RosterChangePlan"
  - "Regressiedekking die bewijst dat group_id niets breekt aan groepslessen en reeksen"
affects: [01-02 (SQL-schema), 01-03 (opslag/provider), 01-04 (schermen), 05-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "groupBookingsFrom als structurele tweelingbroer van seriesFrom, met kruisverwijzing in het commentaar"
    - "plan-voorvoegsel: planRosterChange rekent uit, schrijft niets, muteert niets"
    - "now als parameter in plaats van een mock"

key-files:
  created:
    - lib/lesgroepen.ts
    - lib/lesgroepen.test.ts
  modified:
    - lib/types.ts
    - lib/seed.ts
    - lib/groups.test.ts
    - lib/series.test.ts

key-decisions:
  - "groupBookingsFrom filtert status niet (tellen en tonen), komendeLessen laat afgezegde lessen weg en planRosterChange gebruikt komendeLessen — RESEARCH.md aanname A3, hier expliciet beslecht"
  - "Geen uniciteitscontrole op (naam, weekdag, beginuur): die sleutel herkent bij de import, hij weigert niet"
  - "planRosterChange kopieert newRoster per boeking, zodat groep en boekingen nooit dezelfde array delen"
  - "Trainer verplicht in lesGroepFout, veld optioneel op het type — de import mag een groep zonder gekoppelde trainer opleveren"

patterns-established:
  - "Elke lib/*.ts heeft zijn lib/*.test.ts ernaast, zonder jest.mock of jest.fn"
  - "Het kopcommentaar van een lib-bestand benoemt de grens die het bewaakt en de bug die die grens voorkomt"

requirements-completed: [GROEP-01, GROEP-02, GROEP-03, GROEP-04, GROEP-05, GROEP-06, GROEP-07]

# Metrics
duration: 18min
completed: 2026-09-05
---

# Phase 1 Plan 01: Lesgroepen — het model Summary

**Het lesgroepmodel staat als puur, testbaar rekenwerk in `lib/`: een wijziging aan een groep werkt vooruit en raakt nooit een les die al geweest is.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 van 3
- **Files modified:** 6 (2 nieuw, 4 gewijzigd)
- **Tests:** 1020 (was 985) — 45 suites, alles groen

## Accomplishments

### Taak 1 — `LesGroep`, `Booking.group_id`, `Settings.lesson_duration_minutes`

`lib/types.ts` draagt nu `LesGroep` met exact de velden en volgorde uit het `<interfaces>`-blok,
zodat plan 02 er kolom voor kolom op kan aansluiten. Het doc-commentaar volgt `OuderKind`: het
legt uit waaróm een groep bestaat (blijvend, los van één les), waarom één groep één vast moment
heeft (twee trainingen per week zijn twee groepen), en het zet de grens die de hele fase draagt —
`roster` is wie er nú in de groep zit, `Booking.participant_ids` is wie er die dag bij stond.

`group_id?: string` staat direct ná `series_id`, met het parallelle commentaar dat de twee naast
elkaar bestaan en nooit in elkaar (D-12). `lesson_duration_minutes?: number` volgt de
`vakanties`-vorm ("afwezig betekent 60") en zegt expliciet dat een wijziging alleen voor nieuw
ingeplande lessen geldt (D-05). `lib/seed.ts` geeft 60 als beginwaarde.

### Taak 2 — `lib/lesgroepen.ts` met zijn test (TDD)

Tests eerst geschreven en zien falen (module bestond niet), daarna de implementatie. 29 tests,
geen `jest.mock`/`jest.fn`, `now` gaat er als parameter in.

De acht exports plus `GroepBoeking` en `RosterChangePlan` staan er, elk klein en apart.
Het kopcommentaar doet de twee dingen die het plan eist: het bewaakt de grens tussen
`LesGroep.roster` en `Booking.participant_ids`, en het benoemt `groupBookingsFrom` als bewuste
tweelingbroer van `seriesFrom` — zelfde `>=`-grens, zelfde sortering, andere sleutel — met een
verwijzing zodat de twee niet uit elkaar groeien (T-01-02 uit het dreigingsregister).

De afgezegde-lessen-keuze (aanname A3) is expliciet vastgelegd in plaats van aan het toeval
overgelaten: `groupBookingsFrom` filtert `status` niet zodat hij letterlijk parallel blijft aan
`seriesFrom`; `komendeLessen` laat de afgezegde lessen wél weg; `planRosterChange` gebruikt
`komendeLessen`, met de reden erbij in het commentaar.

### Taak 3 — bewijzen dat `group_id` niets breekt

`lib/groups.test.ts` legt vast dat `participantIdsOf`, `groupSize`, `isGroupLesson`,
`lessonPlayerIds` en `playsIn` met een `group_id` op de boeking exact hetzelfde antwoorden als
zonder. `lib/series.test.ts` legt vast dat een hele reeks mét `group_id` zich identiek gedraagt,
en dat een boeking met alleen een `group_id` en géén `series_id` nog steeds alleen zichzelf
oplevert uit `seriesFrom`. Boven beide blokken staat GROEP-04 als Nederlandse zin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende controle] `start_minute` werd nergens gevalideerd**
- **Gevonden bij:** Taak 2
- **Probleem:** `lesGroepFout` controleerde volgens het `<behavior>`-blok wel `weekday` en
  `start_hour`, maar niet `start_minute`. Het SQL-schema uit 01-PATTERNS.md heeft er wél een
  `check (start_minute between 0 and 59)` op staan, dus een waarde erbuiten zou pas door de
  databank geweigerd worden — met een onleesbare foutmelding in plaats van een zin op het scherm.
- **Oplossing:** Controle toegevoegd ("Kies een beginminuut tussen 0 en 59.") met een eigen test,
  in dezelfde vorm als de andere.
- **Bestanden:** `lib/lesgroepen.ts`, `lib/lesgroepen.test.ts`
- **Commit:** 382cb1b / eee27ce

**2. [Rule 1 - Bug] Overtollige-eigenschapfout in de nieuwe regressietest**
- **Gevonden bij:** Taak 3
- **Probleem:** `isGroupLesson({ ...base, group_id: 'g-1' })` gaf een objectliteral rechtstreeks
  mee aan een parameter van het smalle type `GroupBooking`. Jest zag het niet (Babel gooit types
  weg), `npx tsc --noEmit` wel: `TS2353`.
- **Oplossing:** De boeking eerst als `Booking` benoemd en die meegegeven.
- **Bestanden:** `lib/groups.test.ts`
- **Commit:** 33f5927

### Bewuste afwijking van 01-PATTERNS.md

PATTERNS.md stelde `GroupBooking` voor als naam van het smalle invoertype, maar `lib/groups.ts`
exporteert die naam al. Het `<interfaces>`-blok van het plan schrijft `GroepBoeking` voor, en dat
is aangehouden — het plan wint, en het voorkomt twee verschillende `GroupBooking`s in `lib/`.

## Verification

| Controle | Uitslag |
|---|---|
| `npx tsc --noEmit` | schoon, geen enkele fout |
| `npm test` | 45 suites, 1020 tests, alles groen (was 985) |
| `npx jest lib/lesgroepen` | 29 tests groen (eis: minstens 14) |
| `npx expo export --platform web` | `Exported: dist` |
| `grep -c "jest.mock\|jest.fn" lib/lesgroepen.test.ts` | 0 |
| `grep -rn "from '../providers\|from '../components\|from '../app" lib/lesgroepen.ts` | niets |
| `grep -c "^export " lib/lesgroepen.ts` | 10 (eis: minstens 9) |
| SQL gedraaid of Supabase aangeraakt | nee — geen enkele taak van dit plan raakt de databank |

## Known Stubs

Geen. Dit plan levert alleen puur rekenwerk; opslag (plan 02/03) en schermen (plan 04) hangen er
nog niet aan, precies zoals de golfindeling het bedoelt.

## Threat Flags

Geen. Dit plan voegt geen netwerkpad, geen auth-pad en geen schemawijziging toe — `lib/` kent
geen gebruiker en geen sessie. T-01-01 (een les die al geweest is die toch een patch krijgt) is
afgedekt door de test `raakt nooit een les die al geweest is`; T-01-02 (twee uiteengroeiende
"vanaf vandaag"-regels) door de kruisverwijzing plus de grenstest op `now`.

## Commits

- `bbbf5e9` feat(lesgroepen): een lesgroep is een blijvend gegeven, los van één les
- `eee27ce` test(lesgroepen): vastleggen wat een groepswijziging wel en niet mag raken (RED)
- `382cb1b` feat(lesgroepen): een wijziging aan de groep gaat vooruit, nooit achteruit (GREEN)
- `33f5927` test(lesgroepen): een les uit een groep blijft een gewone les

## TDD Gate Compliance

Taak 2 draaide de volle cyclus: een `test(...)`-commit met falende tests (module bestond nog
niet), daarna een `feat(...)`-commit die ze groen maakte. Geen refactorstap nodig.

## Notes for Next Phase

- Plan 02 (SQL) kan de kolommen één op één van `LesGroep` overnemen; `start_minute` heeft nu ook
  aan de app-kant een controle op 0-59, dus die matcht de `check`-constraint.
- Plan 03 (provider) roept `planRosterChange` aan en zet `plan.group` én `plan.bookingPatches` in
  één `commit()` weg — het plan muteert zelf niets en deelt geen arrays met de invoer.
- `lesGroepFout` weigert bewust géén groep op grond van een bestaande combinatie van naam,
  weekdag en beginuur. Fase 5 gebruikt `groepSleutel` om te herkennen, niet om te weigeren.

## Self-Check: PASSED

Alle genoemde bestanden bestaan en alle vier de commits staan in de geschiedenis.
