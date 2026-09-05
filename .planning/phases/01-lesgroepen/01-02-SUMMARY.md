---
phase: 01-lesgroepen
plan: 02
subsystem: database
tags: [postgres, supabase, rls, sql-migration]

requires:
  - phase: 01-lesgroepen
    provides: LesGroep-interface uit plan 01 (kolomnamen die dit blok spiegelt)
provides:
  - "lesson_groups-tabel als tekst onderaan supabase-schema.sql, nog niet gedraaid"
  - "bookings.group_id kolom + index, admin-only RLS zonder eigenaarscontrole"
affects: [01-lesgroepen plan 03 (selectAllOptioneel), 01-lesgroepen plan 07 (migratie zelf draaien)]

tech-stack:
  added: []
  patterns:
    - "admin-only RLS zonder created_by (kopie van coach_rates/rates_write) voor tabellen die immuun moeten zijn voor de upsert-val"

key-files:
  created: []
  modified:
    - supabase-schema.sql

key-decisions:
  - "Beide policies (select en write) op is_admin() alleen, geen ownership-check, exact zoals rates_write"
  - "roster als jsonb, geen koppeltabel, conform ontwerpkeuze 3 bovenaan het bestand"
  - "bewaak_betaalvelden blijft ongewijzigd: group_id valt vanzelf onder de bestaande rij-vergelijking"

patterns-established:
  - "Nieuw idempotent SQL-blok onderaan het bestand met kruisverwijzing naar bookings_insert voor elke nieuwe admin-only policy"

requirements-completed: [TOEG-03]

duration: 8min
completed: 2026-09-05
---

# Phase 01 Plan 02: Lesgroepen-schema als tekst Summary

**Idempotent SQL-blok (tabel, kolom, index, RLS) onderaan supabase-schema.sql voor lesson_groups — geschreven, niet gedraaid.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-09-05T21:34:00Z
- **Completed:** 2026-09-05T21:42:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `create table if not exists lesson_groups` met alle elf kolommen van de `LesGroep`-interface, inclusief `check`-beperkingen op `weekday`, `start_hour`, `start_minute`
- `bookings.group_id` als nullable FK met `on delete set null`, plus index
- `lesson_groups_select` en `lesson_groups_write`, allebei zuiver `is_admin()`, geen `created_by`
- Commentaar boven het blok legt uit wat een lesgroep is (D-01/D-02), waarom `roster` jsonb is (ontwerpkeuze 3), waarom er geen eigenaarscontrole staat (kruisverwijzing naar `bookings_insert`/de upsert-val), en waarom `bewaak_betaalvelden` niet hoeft te veranderen

## Task Commits

1. **Taak 1: lesson_groups, bookings.group_id en de admin-only policies** - `bbbf5e9` (feat)

**Plan metadata:** (dit document + STATE.md wordt apart gecommit)

## Files Created/Modified
- `supabase-schema.sql` - nieuw blok onderaan: `lesson_groups`-tabel, `bookings.group_id`-kolom + index, RLS aan + twee admin-only policies

## Decisions Made
- Policies kopiëren de vorm van `rates_write` (geen ownership-check op beide), niet van `rates_select`, omdat `lesson_groups` — anders dan `coach_rates` — geen enkele "dit is van mij"-tak heeft: alles is admin-only.
- `bewaak_betaalvelden` bewust niet aangeraakt: de trigger vergelijkt de hele rij minus drie velden, dus de nieuwe kolom `group_id` valt er vanzelf onder, en de trainer/beheerder mogen toch al alles.

## Deviations from Plan

None - plan executed exactly as written. Het blok volgt letterlijk het aanbevolen SQL uit `01-PATTERNS.md`, met het commentaar uitgebreid zoals de taakomschrijving vereiste (drie punten + de notitie over `bewaak_betaalvelden`).

### Opmerking over de commit

Door een gelijktijdig lopende agent die in `lib/` werkte (plan 01, taak over `LesGroep`/`lib/seed.ts`), is deze wijziging aan `supabase-schema.sql` in dezelfde commit terechtgekomen als hun wijzigingen aan `lib/seed.ts` en `lib/types.ts` (commit `bbbf5e9`), buiten mijn toedoen — ik heb alleen `supabase-schema.sql` gestaged en gewijzigd, zoals opgedragen. De inhoud van het SQL-blok is exact zoals in dit plan gespecificeerd; er is niets in `lib/` door mij aangeraakt of gecommit. Geen `git reset`/geschiedenis-herschrijving toegepast om dit niet te verstoren, aangezien de andere agent mogelijk nog actief was.

## Issues Encountered
Racecondition bij het committen doordat twee agents tegelijk in dezelfde werkboom werkten (zie hierboven). Geen inhoudelijk probleem; de SQL zelf is correct en compleet volgens de acceptatiecriteria.

## User Setup Required

None - no external service configuration required. Dit blok is tekst; de gebruiker draait het zelf in de SQL-editor van Supabase in plan 07. Er is niet verbonden met Supabase en er is geen SQL uitgevoerd.

## Next Phase Readiness
- Plan 03 kan `selectAllOptioneel` gebruiken voor `lesson_groups`, want de tabel bestaat nog niet in productie tot de gebruiker dit blok zelf draait (D-11).
- Plan 07 kan dit blok direct kopiëren naar de SQL-editor; alles staat als `if not exists` of met `drop policy if exists` ervoor.

---
*Phase: 01-lesgroepen*
*Completed: 2026-09-05*

## Self-Check: PASSED
- FOUND: supabase-schema.sql
- FOUND: bbbf5e9 (task commit)
- grep -c "create table if not exists lesson_groups" supabase-schema.sql → 1
