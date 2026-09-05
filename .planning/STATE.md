---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02.1-groep-verzetten-02-PLAN.md
last_updated: "2026-09-06T00:00:00.000Z"
last_activity: 2026-09-06
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 23
  completed_plans: 12
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-05)

**Core value:** Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat
raakt en hangt hij er een vervanger aan die dat uur écht kan — zonder in vijf agenda's te zoeken.
**Current focus:** Phase 2.1 — Een groep verzetten (afgerond op de handmatige controle na)

## Current Position

Phase: 2.1 of 6 (Een groep verzetten)
Plan: 2 of 2 (02.1-02-PLAN.md — de schrijfweg en de melding)
Status: Awaiting human verification (taak 3 van 02.1-02)
Last activity: 2026-09-06

Progress: [█████░░░░░] 52%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: ~16 min
- Total execution time: ~1,6 uur

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
| Phase 01-lesgroepen P05 | 22min | 2 tasks | 2 files |
| Phase 01-lesgroepen P06 | 18min | 2 tasks | 3 files |
| Phase 02-wie-gaf-de-les-echt P02 | 12min | 2 tasks | 1 files |
| Phase 02 P01 | 25min | 3 tasks | 6 files |
| Phase 02-wie-gaf-de-les-echt P03 | 20min | 3 tasks | 4 files |
| Phase 02.1-groep-verzetten P01 | 30min | 2 tasks | 4 files |
| Phase 02.1-groep-verzetten P02 | 25min | 2 tasks | 3 files |

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
- [Phase 01-lesgroepen]: het groepsdetail bewerkt de gegevens met één formulier en één Bewaren-knop, terwijl het rooster meteen wegschrijft — de groepsrij patchen en deelnemers over de komende lessen verplaatsen zijn twee verschillende gevolgen en horen niet achter dezelfde knop
- [Phase 01-lesgroepen]: de lessen van een groep worden getoond met de bestaande LessonCards en zijn detailblad; geen eigen lesregel, zodat dezelfde les er niet per scherm anders uitziet
- [Phase 01-lesgroepen]: een les aan een groep hangen gaat via het bestaande updateBooking en niet via een nieuwe provideractie — group_id valt binnen het patchtype, en elke extra weg die zelf een Partial<Booking> samenstelt is een weg langs planMethodChange heen
- [Phase 01-lesgroepen]: het groepsblok op het lesdetailblad staat achter isAdmin(currentUser) en niet achter canManage — canManage laat ook de trainer van de les toe, en die beheert zijn eigen lessen maar niet de indeling van de club (D-09)
- [Phase 01-lesgroepen]: koppelen zet uitsluitend group_id en nooit series_id — een reeks is een aanmaakbatch, een groep een blijvende identiteit; ze staan naast elkaar (D-12)
- [Phase 01-lesgroepen]: de lesduur is een clubinstelling met 45/60/75/90 als keuze en 60 als terugval; een wijziging telt vanaf de volgende ingeplande les en nooit met terugwerkende kracht (D-05)
- [Phase 02-wie-gaf-de-les-echt]: de taught_by_id-controle in bewaak_betaalvelden staat vóór de coach-bypass, niet in de to_jsonb-uitsluitingslijst — anders kan de trainer van de les zijn eigen loon zetten
- [Phase 02-wie-gaf-de-les-echt]: taught_by_id gebruikt on delete set null, niet cascade — een verwijderde invaltrainer laat de les bestaan en valt terug op coach_id
- [Phase 02-wie-gaf-de-les-echt]: setTaughtBy is de enige schrijfweg naar taught_by_id; het veld staat in dezelfde Omit<>-uitsluiting van updateBooking als payment_method, in het contexttype én in de implementatie, zodat een omweg niet compileert
- [Phase 02-wie-gaf-de-les-echt]: de keuzeknoppen voor de vervanger staan achter isAdmin(currentUser) en niet achter canManage — canManage laat de trainer van de les toe, en die zou daarmee zijn eigen loonstaat zetten (D-08)
- [Phase 02-wie-gaf-de-les-echt]: op de compacte leskaart blijft de naam van de vaste trainer staan met "(vervangen)" erachter; twee volledige namen staan alleen op het detailblad (D-07)
- [Phase 02.1-groep-verzetten]: updateLesGroep geeft GroepWijzigingPlan | null terug in plaats van void — een aanroeper die niet weet wat er gebeurd is kan de geblokkeerde lessen ook niet melden
- [Phase 02.1-groep-verzetten]: de voorvertoning op het groepsdetail en het bewaren gaan door dezelfde planGroepWijziging met dezelfde patchVan; twee eigen patches zouden een botsing kunnen tonen die er bij het bewaren niet meer is
- [Phase 02.1-groep-verzetten]: de groepsrij en haar komende boekingen gaan in één commit(), met de hele VerzetPatch via { ...b, ...p } erover — wat er niet in het type staat kan er niet in belanden

### Pending Todos

None yet.

### Blockers/Concerns

- De migratie voor `lesson_groups` is geschreven maar nog niet gedraaid (plan 01-07). Tot dan
  bestaat de tabel niet in productie; de app laadt door dankzij `selectAllOptioneel`, maar een
  aangemaakte groep kan nog nergens heen in Supabase-modus.

- De migratie voor `bookings.taught_by_id` en de vervangen `bewaak_betaalvelden` is geschreven
  maar nog niet gedraaid (plan 02-04). Tot dan blijft het veld overal leeg, rekent alles als
  vóór deze fase, en heeft de vervangerknop op het detailblad in Supabase-modus nog geen kolom
  om naartoe te schrijven.

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

- Het verzetten van een groep is nog niet met de hand nagelopen: taak 3 van plan 02.1-02 is een checkpoint met zes stappen in een draaiende app (uur wijzigen, botsing, andere trainer, alleen de naam). Tot dat gedaan is, is GROEP-05 wel af volgens tests en typecheck, maar nog niet met eigen ogen gezien.

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

Last session: 2026-09-06T00:00:00.000Z
Stopped at: Completed 02.1-groep-verzetten-02-PLAN.md (taak 3: handmatige controle open)
Resume file: .planning/phases/02.1-groep-verzetten/02.1-02-PLAN.md
