---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 05
subsystem: opslagweg voor ziekmeldingen (sync, stores, provider)
tags: [ziekmelding, sync, opslag, provider, migratie-veilig]
requires: [lib/types.ts, lib/sync.ts, providers/mockStore.ts, providers/supabaseStore.ts, providers/SimpleDataProvider.tsx]
provides:
  - "lib/sync.ts: 'sickLeaves' als SyncTable, in SyncableStore, in de before-terugval en in de tables-lijst"
  - "providers/mockStore.ts: sickLeaves in StoreData, freshSeed en withDefaults"
  - "providers/supabaseStore.ts: sick_leaves via selectAllOptioneel, in TABLES en in het teruggegeven object"
  - "providers/SimpleDataProvider.tsx: sickLeaves op DataShape, meldZiek, trekZiekmeldingIn"
affects: [providers/SimpleDataProvider.tsx]
tech-stack:
  added: []
  patterns: ["de vier stops van een nieuwe tabel (fase 1: lesGroepen)", "selectAllOptioneel voor een tabel van na het schema", "lees storeRef, bouw, commit één keer"]
key-files:
  created: []
  modified: [lib/sync.ts, lib/sync.test.ts, providers/mockStore.ts, providers/supabaseStore.ts, providers/SimpleDataProvider.tsx]
decisions:
  - "D-14 uitgevoerd: sick_leaves wordt met selectAllOptioneel gelezen, nooit met selectAll"
  - "D-17 uitgevoerd: trekZiekmeldingIn noemt het woord bookings niet eens"
  - "D-02/D-07 gerespecteerd: geen tweede schrijfweg naar taught_by_id, geen reeksbegrip op dit pad"
  - "VERV-04/06/10 blijven Pending: er is nog geen scherm (plannen 06 en 07)"
metrics:
  duration: ~25 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1218
  tests_after: 1223
---

# Phase 3 Plan 05: De opslagweg — Summary

Een ziekmelding blijft nu staan: hij reist langs dezelfde vier stops als elke andere tabel,
wordt aangemaakt met `meldZiek` en ingetrokken met `trekZiekmeldingIn` — en dat intrekken raakt
geen enkele boeking.

## Wat er gebouwd is

**De vier stops, alle vier gedaan** (het `lesGroepen`-sjabloon van fase 1, end to end):

| Bestand | Wat erbij kwam |
|---|---|
| `lib/sync.ts` | `\| 'sickLeaves'` in de `SyncTable`-unie, `sickLeaves: SickLeave[]` in `SyncableStore`, `sickLeaves: []` in de `before`-terugval van `diffStores`, `changeFor('sickLeaves', …)` in de `tables`-lijst |
| `providers/mockStore.ts` | `sickLeaves: SickLeave[]` in `StoreData`, `sickLeaves: []` in `freshSeed()` (geen zaaidata), `sickLeaves: data.sickLeaves ?? []` in `withDefaults()` |
| `providers/supabaseStore.ts` | `sickLeaves: 'sick_leaves'` in `TABLES`, `selectAllOptioneel<SickLeave>('sick_leaves')` in de `Promise.all`, in de destructurering en in het teruggegeven object |
| `providers/SimpleDataProvider.tsx` | `sickLeaves: SickLeave[]` op `DataShape`, `sickLeaves: store?.sickLeaves ?? []` op de contextwaarde |

Het commentaar bij de `before`-terugval en bij `withDefaults` benoemt in beide gevallen de bug
die de regel voorkomt: zonder de terugval leest de eerste bewaaractie `undefined` in plaats van
een lege lijst (de melding zou stil nergens terechtkomen), en een opslag van vóór deze fase
crasht bij de eerste `.map(...)`. Het commentaar in `supabaseStore.ts` noemt `sick_leaves` nu bij
naam naast `lesson_groups`: de beheerder draait die migratie zelf en heeft dat nu nog niet
gedaan, dus de app hoort te laden met nul ziekmeldingen in plaats van te weigeren op te starten
(D-14). `saveToSupabase` is niet aangeraakt — die loopt al generiek over `change.tables` via
`TABLES[table]`.

**Twee acties in `providers/SimpleDataProvider.tsx`:**

`meldZiek(coachId, van, tot, reden?)` — de vorm van `addBooking`/`addLesGroep`: lees
`storeRef.current`, `null` als die er niet is, bouw `{ id: newId('z'), coach_id, van, tot,
reden, created_at: nowISO() }`, één `commit`, en geef de rij terug zodat het scherm er meteen de
werklijst van kan openen. De actie toetst geen bedrijfsregels: `ziekmeldingFout` wordt door het
scherm aangeroepen vóórdat het hier komt, precies zoals het lesgroepenformulier `lesGroepFout`
aanroept vóór `addLesGroep`.

`trekZiekmeldingIn(id)` — de vorm van `archiveLesGroep`/`setTaughtBy`: lezen, afbreken bij een
onbekende id, één `commit` die alleen `retracted_at` zet. **Geen boeking wordt aangeraakt**, met
een commentaarblok dat de reden geeft voor wie hier later "even netjes wil opruimen": `coach_id`
is nooit overschreven (D-02) en "zoekt nog een vervanger" is afgeleid door `zoektVervanger`
(D-16), dus zodra de melding niet meer open is, is dat antwoord vanzelf overal nee. Een `map`
over de boekingen zou de lessen terugdraaien waar de beheerder al een vervanger op gezet heeft.

**Wat er expliciet níet bijkwam:** geen tweede schrijfweg naar `taught_by_id` — "vervanger
koppelen" is de bestaande `setTaughtBy`, die ongewijzigd is gebleven; "afzeggen" is de bestaande
`updateBooking(id, { status: 'cancelled' })`, waarvan het `Omit<>`-patchtype `taught_by_id`
blijft uitsluiten. Er is geen `seriesFrom` of `groupBookingsFrom` op dit pad (D-07).

**Wat de tests vastleggen** (5 nieuwe in `lib/sync.test.ts`, `describe('diffStores —
sickLeaves')`, geen `jest.mock`/`jest.fn`): een nieuwe melding is een `upsert`, een verdwenen rij
een `delete`, een ingetrokken melding een `upsert` en géén verwijdering (de club hoort te kunnen
terugzien dat de melding er geweest is), twee identieke opslagen leveren niets op, en
`diffStores(null, next)` — de allereerste bewaaractie — vindt de melding wél.

## Deviations from Plan

Geen. De vier stops, de twee acties en alle greps uit de acceptatiecriteria zijn uitgevoerd zoals
beschreven. Er is geen bestaande verwachting gewijzigd en geen bestaande actie aangepast.

Eén bewuste voortzetting van de lijn van plan 02 en 04: **VERV-04, VERV-06 en VERV-10 blijven
"Pending" in REQUIREMENTS.md.** Alle drie zijn geformuleerd als iets dat *de beheerder kan doen*
("kan een trainer ziek melden", "kiest per les in de werklijst", "kan een ziekmelding
intrekken"). Dit plan levert de opslagweg en de acties; er is nog geen scherm dat ze bereikbaar
maakt (plannen 03-06 en 03-07). Afvinken zou beweren dat de club het al kan gebruiken.

## Verificatie

```
npx tsc --noEmit                → schoon (exit 0, geen uitvoer)
npm test                        → 49 suites, 1223 tests, alles groen (was 49 / 1218)
npx expo export --platform web  → geslaagd (1 bundle, 3.79 MB, exit 0)
npx jest lib/sync               → 24 tests groen (was 20)
  -t "sickLeaves"               → 5 geslaagd, 19 overgeslagen
```

`npx tsc --noEmit` is hier de scherpste controle: `TABLES` is een `Record<SyncTable, string>`,
dus een vergeten stop zou een typefout zijn geweest en geen stille bug.

Greps uit de acceptatiecriteria:

```
sickLeaves in lib/sync.ts                                    5   (≥ 4)
sickLeaves in providers/mockStore.ts                         3   (≥ 3)
data.sickLeaves ?? [] in providers/mockStore.ts              1
selectAllOptioneel<SickLeave>('sick_leaves')                 1
selectAll<SickLeave> | selectAll('sick_leaves')              0
sick_leaves in providers/supabaseStore.ts                    3   (≥ 2)
'+saveToSupabase' in de diff van supabaseStore.ts            0
meldZiek in SimpleDataProvider.tsx                           4   (≥ 3)
trekZiekmeldingIn in SimpleDataProvider.tsx                  4   (≥ 3)
sickLeaves: store?.sickLeaves ?? []                          1
meldZiek / trekZiekmeldingIn in de useMemo-deps              1 / 1
"bookings" in de body van trekZiekmeldingIn                  0
taught_by_id in SimpleDataProvider.tsx                       6   (ongewijzigd)
'+taught_by_id' in de diff                                   0
'+seriesFrom|groupBookingsFrom' in de diff                   0
'-setTaughtBy' in de diff                                    0
await commit( in meldZiek / trekZiekmeldingIn                1 / 1
taught_by_id in providers/ (buiten setTaughtBy en Omit<)     4   (ongewijzigd)
```

## Known Stubs

Geen. De opslagweg is compleet in beide modi. Er is nog geen aanroeper: het formulier en de lijst
staan in plan 03-06, de werklijst in 03-07. `meldZiek` en `trekZiekmeldingIn` zijn dus wel
bereikbaar op de context maar worden nog nergens aangeroepen — dat is de opzet van deze fase.

De `sick_leaves`-migratie is bewust nog niet gedraaid; tot de gebruiker dat doet, geeft
`selectAllOptioneel` een lege lijst met een `console.warn`, en blijft de app werken.

## TDD Gate Compliance

| Taak | RED (falend gezien) | GREEN |
|---|---|---|
| 1 | ccd4c2e — 4 gefaald, 20 geslaagd | 47d29aa (24 groen) |
| 2 | — (geen `tdd="true"` op deze taak; het plan schrijft er geen testsuite voor) | d848d2f |

## Threat Flags

Geen nieuw aanvalsoppervlak buiten het dreigingsmodel van het plan. T-03-16 is afgedekt met
`data.sickLeaves ?? []` plus de grep erop; T-03-17 met `selectAllOptioneel` en de grep die
`selectAll` op deze tabel verbiedt; T-03-18 met de grep die bewijst dat het woord `bookings` niet
in de body van `trekZiekmeldingIn` staat; T-03-19 met de ongewijzigde `taught_by_id`-telling en
het intacte `Omit<>` op `updateBooking`. T-03-20 blijft `accept`: de acties kennen geen
rolcontrole, de grens staat in `sick_leaves_write` in Postgres en wordt met de hand nagelopen in
plan 03-08.

## Self-Check: PASSED

- `lib/sync.ts` — `'sickLeaves'` aanwezig op alle vier de stops
- `providers/mockStore.ts` — alle drie de stops aanwezig
- `providers/supabaseStore.ts` — `selectAllOptioneel<SickLeave>('sick_leaves')` aanwezig
- `providers/SimpleDataProvider.tsx` — `meldZiek`, `trekZiekmeldingIn` en `sickLeaves` aanwezig
- Commits ccd4c2e, 47d29aa, d848d2f — alle drie gevonden in `git log`
