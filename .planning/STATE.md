# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-05)

**Core value:** Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat
raakt en hangt hij er een vervanger aan die dat uur écht kan — zonder in vijf agenda's te zoeken.
**Current focus:** Phase 1 — Lesgroepen

## Current Position

Phase: 1 of 5 (Lesgroepen)
Plan: TBD (not yet planned)
Status: Ready to plan
Last activity: 2026-09-05 — Roadmap created, 35/35 v1 requirements mapped

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all currently "Pending" — to be
confirmed as phases ship).

- Roadmap: lesgroepen first (foundation for all else), "wie gaf de les écht" second and small
  (must precede substitution UI), sick-leave/substitute worklist third (Core Value), export
  fourth (decided before import, carries the round-trippable group identifier), import last.

### Pending Todos

None yet.

### Blockers/Concerns

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

Last session: 2026-09-05
Stopped at: ROADMAP.md and STATE.md created; REQUIREMENTS.md traceability updated
Resume file: None
