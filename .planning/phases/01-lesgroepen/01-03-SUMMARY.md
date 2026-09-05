---
phase: 01-lesgroepen
plan: 03
subsystem: storage-provider
tags: [lesgroepen, sync, mockstore, supabase, provider, wiring]

# Dependency graph
requires:
  - phase: 01-lesgroepen
    provides: "LesGroep, Booking.group_id, Settings.lesson_duration_minutes (plan 01)"
  - phase: 01-lesgroepen
    provides: "planRosterChange, lesGroepFout (plan 01)"
  - phase: 01-lesgroepen
    provides: "lesson_groups-tabel als tekst in supabase-schema.sql (plan 02, nog niet gedraaid)"
provides:
  - "'lesGroepen' als SyncTable: nieuwe, gewijzigde en verdwenen groepen komen in de StoreChange"
  - "lesGroepen in StoreData, freshSeed en withDefaults van de lokale opslag"
  - "lesGroepen -> lesson_groups in supabaseStore, geladen met selectAllOptioneel"
  - "addLesGroep, updateLesGroep, updateLesGroepRoster, archiveLesGroep in useSimpleData()"
  - "lesGroepen als leesbare lijst op de context, zodat een scherm de groepen kan tonen"
  - "lesson_duration_minutes: 60 in de terugval voor de instellingen"
affects: [01-04 (lijstscherm), 01-05 (groepsdetail), 01-06 (les aan groep hangen), 01-07 (migratie draaien)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vierstopswiring: types, sync, beide stores, provider — of geen van alle"
    - "selectAllOptioneel voor elke tabel waarvan de migratie nog bij de club op de plank ligt"
    - "twee verzamelingen in één commit() voor alles wat niet half mag landen"

key-files:
  created: []
  modified:
    - lib/sync.ts
    - lib/sync.test.ts
    - providers/mockStore.ts
    - providers/supabaseStore.ts
    - providers/SimpleDataProvider.tsx

key-decisions:
  - "lesGroepen is óók als leesbare lijst op de context gezet; zonder dat zijn de vier acties onbereikbaar nuttig — je kan schrijven maar niets tonen"
  - "updateLesGroepRoster bouwt een Map van de bookingPatches en loopt store.bookings één keer door, zodat de volgorde van de boekingen niet verandert"
  - "Het rekenwerk over geraakte lessen blijft volledig in lib/lesgroepen; de provider past alleen het plan toe"

patterns-established:
  - "Elke nieuwe verzameling krijgt in diffStores' before-terugval een eigen regel commentaar over waarom de lege lijst daar staat"

requirements-completed: []
requirements-in-progress: [GROEP-01, GROEP-02, GROEP-05, GROEP-06, GROEP-07]

# Metrics
duration: 14min
completed: 2026-09-05
---

# Phase 1 Plan 03: Beide opslagwegen Summary

**Een lesgroep aanmaken, wijzigen, van rooster veranderen en archiveren werkt nu in beide opslagmodi, in één snapshot per actie — en een club die de migratie nog niet draaide laadt gewoon door met nul groepen.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 3 van 3
- **Files modified:** 5
- **Tests:** 1024 (was 1020) — 45 suites, alles groen

## Accomplishments

### Taak 1 — `lib/sync.ts` kent `lesGroepen`

Alle vier de plekken gezet: `'lesGroepen'` in de `SyncTable`-union, `lesGroepen: LesGroep[]` in
`SyncableStore` met eigen commentaar, `lesGroepen: []` in de `before`-terugval van `diffStores`,
en `changeFor('lesGroepen', ...)` in de `tables`-array. `LesGroep` erbij in het `import type`-blok.

De terugval heeft de reden erbij staan: zonder die lege lijst leest de allereerste bewaaractie
`before.lesGroepen` als `undefined` in plaats van als "er stond nog niets in", en dan valt het
verschil weg dat er nu wél een groep is.

Vier nieuwe testgevallen in `lib/sync.test.ts`: een nieuwe groep als upsert op tabel `lesGroepen`,
een verdwenen groep als `remove`, een gewijzigd rooster als upsert (en niet als iets nieuws), en
stilte als er niets veranderde.

### Taak 2 — beide opslagwegen

`providers/mockStore.ts`: `lesGroepen: LesGroep[]` in `StoreData` met verwijzing naar
`lib/types: LesGroep`, `lesGroepen: []` in `freshSeed()` (geen zaaigegevens — een club die begint
heeft haar groepen nog niet ingedeeld), en `lesGroepen: data.lesGroepen ?? []` in `withDefaults()`
met "Een opslag van vóór de lesgroepen heeft dit veld niet." Dat laatste dekt T-01-08 af.

`providers/supabaseStore.ts`: `lesGroepen: 'lesson_groups'` in de `TABLES`-map, en de tabel wordt
in het bestaande `Promise.all` geladen met `selectAllOptioneel<LesGroep>('lesson_groups')`. Het
"deze kwamen later dan de rest van het schema"-commentaar is uitgebreid van twee naar drie tabellen,
met de reden voor `lesson_groups` erbij: de beheerder draait die migratie zelf en heeft dat op dit
moment misschien nog niet gedaan, en dan hoort de app te laden met nog geen enkele groep in plaats
van te weigeren op te starten (D-11, T-01-09).

`saveToSupabase` is niet aangeraakt — nagekeken en bevestigd: de lus over `change.tables` handelt
elke `SyncTable` al uniform af via `TABLES[table]`.

### Taak 3 — de vier provideracties

- `addLesGroep` — roept `lesGroepFout` aan, zet bij een melding `setError` en geeft `null` terug
  (dezelfde vorm als `addBooking` bij een dubbele boeking). Anders `newId('lg')`, `created_at` op
  nu, één commit, de gemaakte groep terug.
- `updateLesGroep` — patcht alleen de groepsrij. Het type sluit `roster` uit
  (`Partial<Omit<LesGroep, 'id' | 'roster'>>`), met dezelfde reden in het commentaar als waarom
  `payment_method` buiten `updateBooking` blijft: aan het rooster hangt meer dan de rij zelf.
- `updateLesGroepRoster` — de enige met echt rekenwerk, en dat rekenwerk staat niet hier:
  `planRosterChange(groep, nieuwRooster, store.bookings, new Date())` levert het plan, en de
  groep én de gepatchte boekingen gaan in één `commit()` de opslag in. Het commentaar noemt de
  reden: half doorgevoerd zou een groep opleveren die niet klopt met haar eigen lessen — het
  rooster zegt wie erin zit, terwijl volgende week nog de oude namen op de afvinklijst staan
  (T-01-10).
- `archiveLesGroep` — zet uitsluitend `archived` om, met het commentaar dat archiveren geen
  boeking raakt en het rooster niet wist (GROEP-07).

Alle vier staan in het contexttype, in de context-waarde en in de `useMemo`-afhankelijkheidslijst.
De terugval voor de instellingen kreeg `lesson_duration_minutes: 60` erbij (D-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende functionaliteit] `lesGroepen` was nergens leesbaar vanaf de context**
- **Gevonden bij:** Taak 3
- **Probleem:** Het plan vroeg alleen de vier schrijfacties. Maar `DataShape` geeft naast de acties
  ook elke verzameling door (`relaties`, `memos`, `goals`, ...), en zonder `lesGroepen` daarin kan
  plan 04 wel een groep aanmaken en nergens één tonen. De vier acties zouden dan schrijven in een
  lijst die geen enkel scherm kan lezen.
- **Oplossing:** `lesGroepen: LesGroep[]` toegevoegd aan `DataShape` en
  `lesGroepen: store?.lesGroepen ?? []` aan de context-waarde, precies zoals `relaties`.
- **Bestanden:** `providers/SimpleDataProvider.tsx`
- **Commit:** `2e91058`

### Afwijkingen van de acceptatiecriteria

**1. `npx tsc --noEmit` was niet schoon aan het eind van taak 1.** Dat kon ook niet: zodra
`lesGroepen` een verplicht veld van `SyncableStore` is, klaagt TypeScript over `StoreData` in
`providers/supabaseStore.ts` tot taak 2 die stores bijwerkt. Precies de "beide of geen van beide"
die dit plan als doel heeft. `npx jest lib/sync` slaagde wel (19 tests). Vanaf het einde van taak 2
is `tsc` schoon en dat is hij daarna elke commit gebleven.

**2. `grep -c "planRosterChange" providers/SimpleDataProvider.tsx` geeft 2, niet 1.** De twee zijn
de import uit `../lib/lesgroepen` (die het criterium er zelf naast vraagt) en de ene aanroep. Eén
zou betekenen dat de import er niet is. Er is precies één aanroepplek, wat de bedoeling van het
criterium is; een derde vermelding in een doc-commentaar is weggehaald om er niet verder van af te
liggen.

**3. GROEP-01 t/m GROEP-07 staan op "In Progress", niet op "Complete".** Het plan claimt deze
requirements, maar ze zijn stuk voor stuk geformuleerd als "de beheerder kan ...", en er is nog
geen scherm — dat is plan 04/05. Ze op Complete zetten zou een onwaarheid in de traceerbaarheid
zetten. De regel eronder in `REQUIREMENTS.md` legt uit wat er wel al staat en wanneer ze omgaan.

## Threat Flags

Geen. Dit plan voegt geen nieuw netwerkpad en geen auth-pad toe: `lesson_groups` reist over
dezelfde `supabase.from(...).upsert(...)`-lus als elke andere tabel, met de RLS-policies uit plan
02 als bewaking. T-01-11 (een niet-beheerder die `addLesGroep` aanroept) blijft bewust bij de
databank en het scherm liggen — de provider is nergens in dit bestand een bewaker, en dat blijft zo.

## Known Stubs

Geen. Elke actie schrijft echt weg en elke lijst wordt echt geladen. Wat er nog niet is, is het
scherm — dat is de golfindeling, geen stub.

## Verification

| Controle | Uitslag |
|---|---|
| `npx tsc --noEmit` | schoon, geen enkele fout |
| `npm test` | 45 suites, 1024 tests, alles groen (was 1020) |
| `npx expo export --platform web` | `Exported: dist` |
| `grep -c "lesGroepen" lib/sync.ts` | 6 (eis: minstens 4) |
| `grep -c "changeFor('lesGroepen'" lib/sync.ts` | 1 |
| `grep -c "lesGroepen" providers/mockStore.ts` | 3 |
| `grep "selectAllOptioneel<LesGroep>('lesson_groups')" providers/supabaseStore.ts` | 1 regel |
| `grep "selectAll<LesGroep>('lesson_groups')" providers/supabaseStore.ts` | niets |
| `git diff` binnen `saveToSupabase` | geen enkele wijziging |
| `grep -c "addLesGroep\|updateLesGroep\|updateLesGroepRoster\|archiveLesGroep"` | 14 (eis: minstens 12) |
| `grep "lesson_duration_minutes: 60" providers/SimpleDataProvider.tsx` | 1 regel |
| SQL gedraaid of met Supabase verbonden | nee — geen enkele taak van dit plan raakt de databank |

## Commits

- `382a4ac` feat(lesgroepen): een nieuwe of gewiste lesgroep vertrekt naar de databank
- `042a07a` feat(lesgroepen): lesgroepen worden bewaard, ook zonder gedraaide migratie
- `2e91058` feat(lesgroepen): een lesgroep aanmaken, met de reden op het scherm als hij niet klopt
- `95d1e9d` feat(lesgroepen): de gegevens van een groep bijstellen, het rooster langs zijn eigen weg
- `ce30776` feat(lesgroepen): wie in de groep zit wijzigen, en de komende lessen gaan mee
- `6ee0554` feat(lesgroepen): een groep archiveren zonder haar geschiedenis te wissen
- `9dfac39` fix(instellingen): een lesuur duurt 60 minuten zolang de club niets anders koos

## Notes for Next Phase

- Plan 04/05 lezen `lesGroepen` van `useSimpleData()` en roepen de vier acties aan; de
  beheerdersgrens moet daar nog op het scherm gelegd worden, de provider legt hem bewust niet.
- `addLesGroep` zet `created_at` zelf; een scherm hoeft dat veld niet mee te sturen.
- In Supabase-modus komt een aangemaakte groep pas echt aan zodra de migratie uit plan 02 gedraaid
  is (plan 07). Tot dan werkt alles in mock-modus en laadt Supabase-modus door met nul groepen.

## Self-Check: PASSED

Alle genoemde bestanden bestaan en alle zeven commits staan in de geschiedenis.
