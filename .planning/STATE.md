---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 03-05-PLAN.md (de opslagweg voor ziekmeldingen)
last_updated: "2026-09-06T00:08:21.584Z"
last_activity: 2026-09-06
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 36
  completed_plans: 21
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-05)

**Core value:** Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat
raakt en hangt hij er een vervanger aan die dat uur écht kan — zonder in vijf agenda's te zoeken.
**Current focus:** Phase 3 — Ziekmelding en vervangerswerklijst (het rekenwerk staat, het scherm nog niet)

## Current Position

Phase: 3 of 6 (Ziekmelding en vervangerswerklijst)
Plan: 5 of 8 af (03-05-PLAN.md — de opslagweg: de vier stops, meldZiek en trekZiekmeldingIn)
Status: Ready to execute
Last activity: 2026-09-06

Nog open uit fase 2.1: taak 3 van 02.1-02 is een handmatige controle in een draaiende app.
Nog open uit fase 4: taak 3 van 04-05 is een handmatige controle — het bestand in Excel openen,
de kolommen optellen, en een niet-beheerder /admin/export laten intikken.

Progress: [██████░░░░] 58%

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
| Phase 04-excel-export P01 | ~20min | 2 tasks | 4 files |
| Phase 04 P02 | ~25min | 2 tasks | 2 files |
| Phase 04 P03 | ~20min | 2 tasks | 2 files |
| Phase 04 P04 | ~25min | 2 tasks | 2 files |
| Phase 04 P05 | ~20min | 2 tasks | 4 files |
| Phase 03-ziekmelding P02 | ~40min | 3 tasks | 4 files |
| Phase 03 P03 | 15min | 2 tasks | 1 files |
| Phase 03 P04 | ~35min | 2 tasks | 4 files |
| Phase 03 P05 | ~25 min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (all currently "Pending" — to be
confirmed as phases ship).

- Roadmap: lesgroepen first (foundation for all else), "wie gaf de les écht" second and small
  (must precede substitution UI), sick-leave/substitute worklist third (Core Value), export
  fourth (decided before import, carries the round-trippable group identifier), import last.

- [Phase 03-ziekmelding]: `vervangersVoor` filtert nooit — er komen er even veel uit als
  er kandidaten in gingen, elk met `'kan'` of met de reden die nee zei (D-09). Sorteren of
  filteren gebeurt hooguit in het scherm, als presentatie.

- [Phase 03-ziekmelding]: `ziekOp` staat apart in lib/ziekmelding, zodat `zoektVervanger`
  en `kanVervangen` dezelfde periodevergelijking gebruiken en er geen vierde kopie van
  `van <= dag <= tot` bij komt.

- [Phase 01-lesgroepen]: `lesson_groups` wordt geladen met `selectAllOptioneel`, niet met
  `selectAll` — de migratie uit plan 02 is nog niet gedraaid, en een club zonder die tabel
  hoort gewoon te laden met nul groepen in plaats van niet op te starten (D-11)

- [Phase 01-lesgroepen]: `updateLesGroepRoster` schrijft de groep en de geraakte komende lessen
  in één `commit()`; het rekenwerk blijft in lib/lesgroepen

- [Phase 01-lesgroepen]: het smalle boekingstype in lib/lesgroepen heet `GroepBoeking` en niet
  `GroupBooking` — die naam was al bezet in lib/groups

- [Phase 04-excel-export]: de spelersrijen van blad "Aanwezigheid" komen uit `lessonPlayerIds`
  over de lessen van de periode en nooit uit het roosterveld van de lesgroep — anders schuift
  een export van vorig seizoen mee met elke roosterwijziging van vandaag

- [Phase 04-excel-export]: "leeg afdrukbaar" is één codepad en geen vlag of tweede blad (D-12):
  een periode waarin nog niets is afgevinkt levert vanzelf de lege, afdrukbare tabel op

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
- [Phase 04-excel-export]: buildWorkbook komt als nieuwe functie náást het onveranderde buildXlsx — lib/csv.ts en Historiek roepen buildXlsx vandaag aan met hun eigen tests eromheen (D-07)
- [Phase 04-excel-export]: bij één blad levert buildWorkbook byte-voor-byte hetzelfde bestand als buildXlsx; die gelijkheid ligt als test vast en bewijst dat er in de lussen niets is weggevallen
- [Phase 04-excel-export]: de tabnamen worden binnen de werkmap uniek gemaakt door een niet-geëxporteerde helper; bladnaam() blijft één naam schoonmaken zonder van zijn buren te weten
- [Phase 04-excel-export]: het ISO-weeknummer staat in lib/datetime.ts met de jaarwissel als eigen test — 1 januari 2027 is week 53 van 2026 en 31 december 2025 is week 1 van 2026 (D-11)
- [Phase 04-excel-export]: de koprij en de tabnaam van blad "Lessen" zijn vaste Nederlandse literals en gaan niet door t() — de import van fase 5 leest die koprij, dus een Engelse kop maakt een export onleesbaar voor de app die hem schreef
- [Phase 04-excel-export]: de beheerdersgrens van het exportscherm staat in een buitenste component vóór elke hook, met de schermlogica in een tweede component erachter — deze fase voegt geen tabel toe, dus er is geen policy die de fout alsnog opvangt (D-06)
- [Phase 04-excel-export]: het exportscherm gebruikt useSimpleData rechtstreeks en geen useAgendaScope/CoachFilter — de export is club-breed, want de import van fase 5 leest een heel seizoen terug (D-01)
- [Phase 04-excel-export]: de Nederlandse weekdagnamen komen uit een vaste tabel in lib/export-trainingen.ts en niet uit toLocaleDateString, zodat hetzelfde seizoen op twee toestellen twee gelijke bestanden oplevert
- [Phase 04-excel-export]: Blad Uren per trainer rekent geen bedrag zelf uit: trainer, lessen en loon komen regel voor regel uit payoutsByCoach
- [Phase 04-excel-export]: Blad Groepen draagt het Groep-ID, zodat een herimport de bestaande groep herkent in plaats van een tweede aan te maken
- [Phase 03]: sick_leaves.coach_id gebruikt on delete cascade (niet set null zoals lesson_groups): een ziekmelding heeft geen betekenis meer zonder zijn trainer
- [Phase 03]: sick_leaves-policies kopiëren rates_write exact: is_admin() op using en with check, geen created_by, tegen de upsert-val
- [Phase 03]: D-14 uitgevoerd: sick_leaves wordt met selectAllOptioneel gelezen, nooit met selectAll
- [Phase 03]: D-17 uitgevoerd: trekZiekmeldingIn raakt geen enkele boeking

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

- "Zoekt vervanger" is een afgeleid feit (D-16): `zoektVervanger` in lib/ziekmelding is de enige plek die de vraag beantwoordt, er is geen kolom en geen nieuwe `bookings.status`-waarde. Daardoor raakt het intrekken van een ziekmelding (D-17) geen enkele boeking.

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

Last session: 2026-09-06T00:08:15.273Z
Stopped at: Completed 03-03-PLAN.md (sick_leaves-tabel in het schema)
Resume file: None
