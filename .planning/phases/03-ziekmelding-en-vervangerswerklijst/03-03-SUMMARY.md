---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 03
subsystem: database
tags: [supabase, postgres, rls, ziekmelding, schema]

requires:
  - phase: 03-ziekmelding-en-vervangerswerklijst
    provides: "lib/types.ts: interface SickLeave (plan 02)"
provides:
  - "supabase-schema.sql: sick_leaves-tabel, index, admin-only RLS-policies (tekst, niet uitgevoerd)"
affects: [03-ziekmelding-en-vervangerswerklijst plan 05 (sync/store), plan 08 (migratie door de gebruiker)]

tech-stack:
  added: []
  patterns: ["admin-only RLS zonder created_by, in de vorm van rates_write/lesson_groups_write"]

key-files:
  created: []
  modified: [supabase-schema.sql]

key-decisions:
  - "coach_id gebruikt on delete cascade (niet set null zoals lesson_groups.coach_id): een ziekmelding heeft geen betekenis meer zonder zijn trainer"
  - "geen trigger op sick_leaves — RLS is de hele bewaking, zoals bij coach_rates en lesson_groups"
  - "beide taken van het plan (het blok schrijven, en het herdraaibaar/volledig nalopen) zijn in één schrijfbeurt en één commit afgehandeld: het blok is meteen in de geverifieerde vorm geschreven, dus taak 2 leverde geen wijziging op, alleen bevestiging via de acceptatiecriteria"

requirements-completed: []

duration: ~15min
completed: 2026-09-06
---

# Phase 3 Plan 03: Ziekmeldingentabel in het schema — Summary

**`sick_leaves` staat als idempotent SQL-tekst onderaan `supabase-schema.sql`: tabel, index en twee `is_admin()`-only policies in de vorm van `rates_write`/`lesson_groups_write` — geen SQL uitgevoerd, geen verbinding met Supabase.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (uitgevoerd als één schrijfbeurt, zie Deviations)
- **Files modified:** 1

## Accomplishments

- `create table if not exists sick_leaves` met alle zeven velden van `interface SickLeave`
  (plan 02): `id`, `coach_id`, `van`, `tot`, `reden`, `created_at`, `retracted_at`.
- Index op `coach_id`, RLS aan, twee policies (`sick_leaves_select`, `sick_leaves_write`)
  in exact de vorm van `rates_write`: `is_admin()` op zowel `using` als `with check`, geen
  eigenaarschapscontrole.
- Commentaar boven de tabel legt drie dingen uit: de D-03-grens met `booking_periods`, waarom
  `retracted_at` bestaat in plaats van een `delete`, en de upsert-val met expliciete verwijzing
  naar `bookings_insert`.
- Apart commentaarregel bij `on delete cascade` die het verschil met `lesson_groups.coach_id`
  (`on delete set null`) verantwoordt.
- Commentaarregel over D-14: de gebruiker draait dit blok zelf; `providers/supabaseStore.ts`
  moet daarom `selectAllOptioneel` gebruiken, niet `selectAll`.

## Task Commits

1. **Taak 1 + Taak 2: het `sick_leaves`-blok, meteen herdraaibaar en volledig** - `54af282` (feat)

_Beide taken van het plan raken hetzelfde ene blok tekst; het blok is in de geverifieerde,
herdraaibare vorm in één keer geschreven (zie Deviations), dus er is één commit._

## Files Created/Modified

- `supabase-schema.sql` - 55 regels toegevoegd onderaan: `sick_leaves`-tabel, index,
  RLS-policies, en het verklarende commentaar erboven. Niets bestaands gewijzigd of verwijderd.

## Decisions Made

- `coach_id ... on delete cascade`, bewust anders dan `lesson_groups.coach_id`'s
  `on delete set null` — verantwoord in een eigen commentaarregel in het bestand zelf.
- Geen trigger op `sick_leaves`: RLS (`is_admin()` op beide kanten) is de volledige bewaking,
  zoals bij `coach_rates` en `lesson_groups`. `bewaak_betaalvelden` blijft ongemoeid.
- Policyvorm is een letterlijke kopie van `rates_write`/`lesson_groups_write`: geen
  `created_by`, om de upsert-val (al twee keer eerder stilzwijgend geraakt via
  `bookings_insert`) niet opnieuw te introduceren.

## Deviations from Plan

**Taken 1 en 2 samengevoegd tot één schrijfbeurt.** Taak 2 vraagt om het zojuist toegevoegde
blok regel voor regel na te lopen tegen `lesson_groups` op herdraaibaarheid, volledigheid
(alle zeven `SickLeave`-velden) en volgorde (na `bewaak_betaalvelden`), en om er een
D-14-commentaarregel over `selectAllOptioneel` bij te zetten. Het blok is in taak 1 al
geschreven met al deze eigenschappen erin verwerkt (de exacte vorm stond woordelijk in
`03-PATTERNS.md`), dus de nalooprol van taak 2 leverde bij controle geen enkele afwijking op
— alleen bevestiging via de acceptatiecriteria hieronder. Geen inhoudelijke wijziging, dus
geen aparte commit.

**VERV-04 blijft "Pending" in REQUIREMENTS.md**, ondanks dat het in de frontmatter van dit plan
staat. VERV-04 luidt "de beheerder kan een trainer ziek melden" — dat is een handeling in de
app, en die bestaat nog niet: er is nog geen scherm en geen schrijfweg (die komen in latere
plannen van deze fase). Dit plan levert alleen de tabel als tekst, nog niet eens uitgevoerd.
Afvinken zou beweren dat de club het al kan gebruiken, wat dezelfde reden is waarom plan 02
VERV-04/05/07/10 ook liet staan. Het vinkje gaat om zodra het scherm en de schrijfweg er zijn.

Verder: geen. Het blok volgt woordelijk het doelblok uit
`.planning/phases/03-ziekmelding-en-vervangerswerklijst/03-PATTERNS.md`.

## Issues Encountered

None.

## User Setup Required

None voor dit plan. **Belangrijk voor plan 08:** dit blok is uitsluitend tekst. De gebruiker
moet het zelf in de Supabase SQL-editor draaien (D-14) — dit plan heeft geen SQL uitgevoerd en
geen verbinding met Supabase gemaakt.

## Next Phase Readiness

- `sick_leaves` staat klaar als tekst voor de migratie die de gebruiker zelf draait (plan 08).
- Plan 05 (sync/store) kan bouwen op de exacte kolomnamen van dit blok, die één-op-één matchen
  met `interface SickLeave`.
- Geen blockers.

## Verificatie

```
grep -c "create table if not exists sick_leaves" supabase-schema.sql        → 1
grep -c "create index if not exists sick_leaves_coach_idx" supabase-schema.sql → 1
grep -c "alter table sick_leaves enable row level security" supabase-schema.sql → 1
grep -c "drop policy if exists sick_leaves" supabase-schema.sql             → 2
grep -c "^create policy sick_leaves" supabase-schema.sql                    → 2
grep -A2 "create policy sick_leaves_write" | grep -c "using (is_admin()) with check (is_admin())" → 1
git diff supabase-schema.sql | grep '^+' | grep -c created_by               → 1 (alleen de
  toelichtende commentaarzin "geen created_by-kolom of -conditie"; geen ownership-check)
git diff --stat                                                             → alleen supabase-schema.sql, 55 insertions(+)
git diff supabase-schema.sql | grep -c '^-[^-]'                             → 0 (niets verwijderd)
git diff supabase-schema.sql | grep '^+' | grep -c "bewaak_betaalvelden|create trigger" → 0
blok staat na bewaak_betaalvelden                                          → bevestigd (regelnummer-vergelijking)
alle zeven kolommen (id, coach_id, van, tot, reden, created_at, retracted_at) aanwezig → bevestigd
npx tsc --noEmit                                                            → schoon
npm test                                                                    → 48 suites, 1185 tests, alles groen
git status --short vóór commit                                             → alleen supabase-schema.sql gewijzigd
```

Er is in dit hele plan geen SQL uitgevoerd en geen verbinding met Supabase gelegd: geen enkele
`psql`- of `supabase`-aanroep komt voor in de uitvoering, alleen `grep`, `git`, `npx tsc` en
`npm test`.

## Known Stubs

Geen. Dit plan levert alleen schema-tekst; de tabel bestaat pas na de handmatige migratie in
plan 08, en de app-kant (`selectAllOptioneel` in plan 05) is expliciet ontworpen om zonder de
tabel te blijven werken.

## Threat Flags

Geen nieuw aanvalsoppervlak buiten het dreigingsmodel van het plan. T-03-07 (elevation of
privilege via de upsert-val) en T-03-08 (information disclosure van de ziekteredenen) zijn
gemitigeerd via de `is_admin()`-only policyvorm, identiek aan `coach_rates`. T-03-11
(schrijven naar de productiedatabank) is voorkomen: er is geen SQL uitgevoerd.

## Self-Check: PASSED

- `supabase-schema.sql` bevat `create table if not exists sick_leaves` — FOUND (1 treffer)
- Commit `54af282` — FOUND in `git log --oneline`
- `git diff --stat` bevestigt uitsluitend `supabase-schema.sql` gewijzigd, 55 insertions, 0
  deletions

---
*Phase: 03-ziekmelding-en-vervangerswerklijst*
*Completed: 2026-09-06*
