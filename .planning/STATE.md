---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 01-lesgroepen-04-PLAN.md
last_updated: "2026-09-05T22:45:00.000Z"
last_activity: 2026-09-05 — Plan 01-04 uitgevoerd (lesgroepenscherm, tegel, routes, Engels)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 11
  completed_plans: 4
  percent: 36
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-05)

**Core value:** Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat
raakt en hangt hij er een vervanger aan die dat uur écht kan — zonder in vijf agenda's te zoeken.
**Current focus:** Phase 1 — Lesgroepen

## Current Position

Phase: 1 of 5 (Lesgroepen)
Plan: 5 of 7 (01-05-PLAN.md — groepsdetail)
Status: In progress — golf 3 klaar: de beheerder maakt een lesgroep aan en ziet zijn lijst
Last activity: 2026-09-05 — Plan 01-04 uitgevoerd (lesgroepenscherm, tegel, routes, Engels)

Progress: [████░░░░░░] 36%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: ~14 min
- Total execution time: ~0,9 uur

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-lesgroepen P02 | 8min | 1 tasks | 1 files |
| Phase 01-lesgroepen P04 | 16min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all currently "Pending" — to be
confirmed as phases ship).

- Roadmap: lesgroepen first (foundation for all else), "wie gaf de les écht" second and small
  (must precede substitution UI), sick-leave/substitute worklist third (Core Value), export
  fourth (decided before import, carries the round-trippable group identifier), import last.

- [Phase 01-lesgroepen]: `lesson_groups` wordt geladen met `selectAllOptioneel`, niet met
  `selectAll` — de migratie uit plan 02 is nog niet gedraaid, en een club zonder die tabel
  hoort gewoon te laden met nul groepen in plaats van niet op te starten (D-11)

- [Phase 01-lesgroepen]: `updateLesGroepRoster` schrijft de groep en de geraakte komende lessen
  in één `commit()`; het rekenwerk blijft in lib/lesgroepen

- [Phase 01-lesgroepen]: het smalle boekingstype in lib/lesgroepen heet `GroepBoeking` en niet
  `GroupBooking` — die naam was al bezet in lib/groups

- [Phase 01-lesgroepen]: lesson_groups RLS kopieert rates_write (geen ownership-check op beide policies) — de tabel is volledig admin-only, geen 'dit is van mij'-tak zoals coach_rates
- [Phase 01-lesgroepen]: de beheerdersgrens ligt op het lesgroepenscherm zelf, vóór elke andere return — de tegel in Beheer verbergen is wellevendheid, geen toegangscontrole (TOEG-01)

### Pending Todos

None yet.

### Blockers/Concerns

- De migratie voor `lesson_groups` is geschreven maar nog niet gedraaid (plan 01-07). Tot dan
  bestaat de tabel niet in productie; de app laadt door dankzij `selectAllOptioneel`, maar een
  aangemaakte groep kan nog nergens heen in Supabase-modus.

- Every phase adding a table/column must carry a manual RLS upsert-verification step
  (insert as user A, update as user B) — `tsc`/Jest cannot catch this; this bug class has hit
  the project twice already (see .planning/codebase/CONCERNS.md).

- No separate dev Supabase project exists — dev server talks to real club data. Use
  mock-store mode for `lib/` development; treat manual Supabase testing (especially bulk
  Excel import) as touching production unless a second project is stood up first.

- Excel import (Phase 5) must be tested with a DST-boundary fixture and a
  "re-import same file twice = no-op" / "re-import after manual edit" test pair.

- Export format (Phase 4) must land before import (Phase 5) so the group identifier
  round-trips instead of relying on fuzzy name matching.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2 | RASTER-01 (clubbreed weekraster) | Deferred | Requirements definition |
| v2 | CONTR-01 (controlelijst vóór seizoen) | Deferred | Requirements definition |
| v2 | BERICHT-01 (automatisch berichten sturen) | Deferred | Requirements definition |
| v2 | ZIEK-01 (trainer meldt zichzelf ziek) | Deferred | Requirements definition |
| v2 | INHAAL-01 (inhaalplek zoeken) | Deferred | Requirements definition |

## Session Continuity

Last session: 2026-09-05T22:45:00.000Z
Stopped at: Completed 01-lesgroepen-04-PLAN.md
Resume file: .planning/phases/01-lesgroepen/01-05-PLAN.md
