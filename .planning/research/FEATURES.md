# Feature Research

**Domain:** Tennis-school admin module (lesson groups, substitution, Excel import/export) for one admin at a small club
**Researched:** 2026-09-05
**Confidence:** MEDIUM (general patterns HIGH — verified across multiple club/school/swim-school products; tennis-specific substitute-matching detail LOW — vendors don't publish algorithm detail)

## Feature Landscape

Scope note: this file covers only the six target capabilities from PROJECT.md (lesson groups,
who-really-taught, sick-leave worklist, substitute suggestion, season import, period export).
The existing booking/attendance/payment system is out of scope — already built and validated.

### Table Stakes (Users Expect These)

Features an admin assumes exist once you say "tennis school module." Missing these makes the
admin go back to Excel/WhatsApp for that one thing.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Lesson group as a named, persistent entity (name, level, day/time, fixed coach, season, roster) | Every club-management, music-school and swim-school product treats "the Tuesday 17:00 U9 group" as a first-class thing you can look up, not a pattern you re-derive from bookings. Admins think in groups, not in individual lesson rows. | MEDIUM | Matches Key Decision in PROJECT.md: own table, `bookings` rows reference it by id. Roster (who's in the group) must be separately editable from "who's in this one lesson" — a player can join/leave a group mid-season without touching past lessons. |
| Group edits apply forward-only, history untouched | Confirmed pattern across recurring-series software (music lesson schedulers, swim class systems): changing a class's coach/time from "today" doesn't rewrite last month's attendance/payroll records. | LOW | Already the app's own `seriesFrom` rule — this capability literally reuses it, per Key Decisions. |
| Roster view per group (list of players, add/remove) | Table stakes in every group-lesson product (iClassPro, Teachworks, Jumbula) — "who's in this class" is the first screen an admin opens. | LOW | Read-only in v1 is acceptable if roster changes flow through Excel re-import; but *some* in-app add/remove is expected once groups exist as an entity, otherwise every roster tweak needs a spreadsheet round-trip. |
| Field to record who actually taught the lesson, separate from assigned coach | Every payroll-adjacent scheduling tool (Coacha timesheets, ClubReady payroll report, Frontline substitute management for schools) keeps "scheduled staff" and "actual staff" as two separate facts specifically so payroll/hours reports are correct after a swap. | LOW-MEDIUM | PROJECT.md Key Decision: separate field, never overwrite `coach_id`. This is the single most load-bearing table-stakes feature — sick-leave and substitute-suggestion both depend on it existing first. |
| Sick-leave / absence report over a date range that lists every affected lesson | Standard shape of "absence management" in every substitute-teacher product (Frontline, Tyler, Docendo, TCP Software): admin reports an absence range once, system finds every scheduled session in that range for that person, not per lesson. | MEDIUM | Must include lessons from *both* the coach's own one-off bookings and any groups where they're the fixed coach — a worklist that misses group lessons defeats the "within a minute" core value. |
| Per-lesson resolution choice in the worklist: assign substitute / leave as-is / cancel | Universal shape of absence-management UIs (Frontline "propose a coverage plan an admin can approve", Docendo substitute management) — bulk absence report, per-item decision, nothing is silently auto-resolved. | MEDIUM | "Leave as-is" matters for clubs where the admin will handle a lesson manually later, or where the coach isn't actually unavailable for that specific slot (e.g. half-day sick leave). |
| Substitute suggestions filtered to genuinely free coaches | Table stakes the moment sick leave exists — showing a coach who's double-booked or off that day is worse than showing no suggestion, it erodes trust in the whole feature (this is exactly the failure mode "qualified subs only" language in school substitute-management products is designed to prevent). | MEDIUM-HIGH | Must reuse the app's *existing* availability logic (`lib/boekingstijd.ts` booking periods, deviating periods, vacations) plus a live double-booking check against `bookings` — do not build a second, parallel "is this coach free" concept. |
| Excel import with a template the app defines, plus a dry-run/preview before writing | The app already has this exact pattern for members (`lib/import-leden.ts`) and it's also how every serious bulk-import feature works elsewhere (SwimTopia roster import, generic bulk-upload UX): show a diff/preview screen (rows to create, rows to update, rows with errors) and require explicit confirmation before any write. | MEDIUM-HIGH | Reuse the `lib/import-leden.ts` pattern directly rather than inventing new import UX — this is an explicit instruction in PROJECT.md, not just good practice. |
| Re-import updates existing groups/players instead of duplicating | Universal expectation once any import exists — a coach's spreadsheet changes every season (new group, renamed group, added player) and admins *will* re-run the same file. Systems that create duplicates on re-import get abandoned within one season. | HIGH | Needs a stable matching key per row (e.g. group name — or a hidden id column the app writes back into the sheet on export, matching the SwimTopia round-trip pattern of "export, edit, re-import"). This is the hardest of the six capabilities — flag for phase-specific research on matching-key design. |
| Excel export of a period: lesson list, hours per coach, attendance per group, group overview | Named directly as four required sheets in PROJECT.md. This mirrors ClubReady's payroll report (name, hours, rate, total pay) and generic attendance-sheet shape (participant rows, per-date columns, present/absent). | MEDIUM | Reuse `lib/xlsx.ts` (already hand-rolled, no new dependency). "Hours per coach" must use *who actually taught*, not assigned coach, or the export contradicts capability #2. |
| Exported attendance sheet is printable and fillable by hand | Multiple sources (Vertex42, class-templates.com, generic attendance-sheet UX) converge on the same shape: one row per player, one column per lesson date, a checkbox/mark cell — because many clubs still take attendance on paper courtside and enter it later, or print a blank sheet for a substitute who has no app access. | LOW | Directly relevant here: a substitute teaching a one-off group lesson has no reason to be given app access (Out of Scope in PROJECT.md) — the printed attendance sheet is *their* interface, not a nice-to-have. |

### Differentiators (Competitive Advantage)

These aren't required to feel "complete," but they're where this module can clearly beat the
spreadsheet-and-WhatsApp status quo the admin uses today.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One cross-coach worklist instead of five separate agendas | This *is* the Core Value statement in PROJECT.md — "within a minute" instead of hunting through each trainer's calendar. No competitor-feature research needed; it's the differentiator by design, not by benchmarking. | MEDIUM | Depends on lesson groups existing (capability #1) and correct availability logic (capability #4). |
| Substitute suggestion ranked/filtered by real constraints, not just "list of all coaches" | Most small-club tools stop at "here is a list of your staff, go check their calendar yourself" (confirmed gap in the tennis-specific search — none of the tennis club platforms found publish an automated substitute-matching feature). Doing the actual availability math is a genuine step above what tennis-specific competitors currently offer. | HIGH | Depends entirely on capability #1 (groups) and the existing `lib/boekingstijd.ts`/`lib/vakanties.ts` modules already being correct — this is composition of existing rules, not new domain logic. |
| Re-importable season template that treats the coach's real spreadsheet as the source of truth | The project context explicitly notes real files (`koen.xlsx`, a PDF planning) exist as design reference — building the import to match how a real coach *already* structures a season (rather than forcing them into a generic CSV) is the differentiator over generic products, which typically only import flat rosters (players/members), not a full season of grouped, recurring, multi-coach trainings. | HIGH | Highest-value, highest-risk item — should get its own phase-specific research pass on the actual `koen.xlsx` structure before building the template. |
| Loon/payroll figures that self-correct after a substitution, with zero manual reconciliation | Generic payroll-export products (ClubReady, Coacha) export hours, but still require a human to notice a substitution happened and adjust; here, because "who really taught" is a first-class field feeding directly into the existing `lib/payments.ts`/`coach_rates` pipeline, the correction is automatic. | MEDIUM | This is the direct payoff of capability #2 — worth stating explicitly to the admin in the export ("uren-per-trainer" sheet reflects actual teacher, so no manual correction needed). |

### Anti-Features (Commonly Requested, Often Problematic)

Things that sound like natural next steps for this module but should be deliberately excluded —
scaled correctly for one admin at one small club, not a franchise chain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Automatic notifications to players/parents when a substitute is assigned | Every enterprise substitute-management product (Frontline, Tyler) leads with "instant notifications." Feels like an obvious extension of the worklist. | The app explicitly has no mail/message-sending capability (`lib/contact.ts` only opens the native mail app); building notification infra is a large, separate feature (templates, delivery, opt-outs) that PROJECT.md already marks Out of Scope. | Admin opens the affected player's contact via existing `lib/contact.ts` (opens mail/WhatsApp) if they choose to notify — manual, not automated. |
| Coach self-service sick-leave reporting (coach reports their own absence) | Natural-feeling parity with school "teacher reports absence" flows. | PROJECT.md is explicit: the module is admin-only; extending RLS/`magInElkeAgenda` to let a plain coach write into another coach's schedule multiplies the permission surface for a capability with no current requirement. | Coach tells the admin (phone/in person, as today); admin enters the sick-leave range. Revisit only if this becomes a real pain point. |
| Auto-assign the "best" substitute without admin confirmation | Sounds efficient — why show a list, just pick one? | A wrong auto-pick (wrong level group, coach who technically has a free slot but doesn't teach that age group, personal preference) erodes trust fast in a small club where the admin knows the roster personally; also there's no qualification/level data model yet to rank on. | Show filtered, genuinely-free candidates; admin clicks to assign. Ranking/"suggested best match" can come later once there's real usage data on what the admin actually picks. |
| Waitlists / enrollment / inschrijvingen for lesson groups | Naturally adjacent once "groups" exist — many competitor products (iClassPro, Jumbula) bundle enrollment management with class management. | Explicitly Out of Scope in PROJECT.md — "nieuw domein, niet nodig om ziekte op te vangen." Enrollment brings its own workflow (capacity, payment triggers, wait-list promotion) unrelated to the sick-leave core value. | Roster stays a simple list the admin edits directly or via re-import; no enrollment workflow. |
| A pre-season "sanity check" report (double-booked courts, lessons scheduled during a vacation) | Feels like it should ship alongside import/export since the data is right there. | PROJECT.md marks this Out of Scope for *this* milestone — "komt er logisch bij, maar pas als groepen en import staan." Building it now couples two milestones and delays the sick-leave core value. | Defer to a follow-up milestone once groups + import are stable and real usage surfaces which checks actually matter. |
| Clubwide weekly grid/timetable view across all coaches and courts | The most requested "just show me everything at once" view once cross-coach data exists — tempting to build alongside the worklist since the data model is now there. | PROJECT.md explicitly defers this: "waardevol, maar een eigen brok werk; eerst deze zes." It's a genuinely separate UI investment (grid rendering, court-conflict detection) that isn't required for any of the six capabilities. | The sick-leave worklist and group list give the admin the cross-coach visibility they need for *this* milestone; a full grid view is its own future milestone. |
| Real substitute-availability "smart ranking" using ML/heuristics beyond hard constraints | Sounds impressive, and once filtering exists it's a small conceptual step to "rank by best fit." | No qualification/preference data exists yet to rank on meaningfully; premature optimization for a one-admin, small-roster club where the admin already knows every coach personally and can pick from a short filtered list in seconds. | Hard-filter only (free / not free), let the admin's own judgment do the ranking. Revisit only if the coach roster grows large enough that a short list stops being "obviously the right answer at a glance." |
| Multi-tenant / multi-club support in the import-export templates | Reasonable-sounding "future proofing" since Excel templates are being designed now. | The whole app, RLS model, and this module are scoped to one club (`club_settings`, `is_admin` as a flag not a role). Designing for multi-club now adds template complexity with zero current users. | Design the Excel template around this club's real files (`koen.xlsx`) as PROJECT.md instructs; generalize later only if a second club ever appears. |

## Feature Dependencies

```
Lesson groups (persistent entity)
    └──requires──> forward-only edit rule (reuse seriesFrom)

"Who actually taught" field
    └──requires──> lesson groups existing conceptually (a group lesson has one assigned coach to
                    deviate from) — but also applies to one-off bookings, so it does NOT strictly
                    require groups to be built first; it can land in parallel or slightly before.

Sick-leave worklist
    └──requires──> lesson groups (to find "all lessons where coach X is the fixed coach")
    └──requires──> "who actually taught" field (the worklist's substitute assignment writes to it)

Substitute suggestion
    └──requires──> sick-leave worklist (it's invoked per affected lesson, not standalone)
    └──requires──> existing availability logic (lib/boekingstijd.ts, lib/vakanties.ts) — already built

Season Excel import
    └──requires──> lesson groups (import creates/updates group rows, not just bookings)
    └──enhances──> roster management (import becomes the primary way to bulk-edit rosters)

Period Excel export
    └──requires──> "who actually taught" field (hours-per-coach sheet must reflect reality)
    └──requires──> lesson groups (group overview + attendance-per-group sheets need the entity)

Substitute suggestion ──conflicts──> auto-assign anti-feature (deliberately stops short of it)
Season import ──conflicts──> multi-tenant template anti-feature (deliberately scoped to one club)
```

### Dependency Notes

- **Sick-leave worklist requires lesson groups:** without a first-class group entity, "find every
  lesson this coach is responsible for" would need to re-derive group membership from ad-hoc
  booking patterns every time — exactly the kind of duplicated computation the codebase's own
  anti-pattern warning (`lib/groups.ts` comment) already flags as a bug source. Build groups first.
- **Sick-leave worklist requires "who actually taught":** the worklist's whole output is "assign a
  substitute to this lesson" — that assignment has nowhere correct to be written without this
  field existing first. This is the true foundation of the whole milestone, even though it looks
  like the smallest of the six items.
- **Substitute suggestion requires the worklist, not the other way around:** suggestion is a lookup
  triggered *from* a worklist row ("who's free for this specific lesson"), it has no independent
  entry point or value on its own.
- **Export requires both groups and "who actually taught":** two of its four required sheets
  (group overview, hours-per-coach) are meaningless without them — export should be built last of
  the six, once the underlying data actually exists to export.
- **Import enhances but doesn't strictly require the worklist or substitute suggestion:** a season
  import could, in principle, land before sick-leave handling. But PROJECT.md's stated Core Value
  is the sick-leave flow, so sequence by value even where a dependency doesn't force it.

## MVP Definition

Scaled deliberately for one admin at one small club — not a chain, not a franchise.

### Launch With (v1)

The three capabilities that directly deliver "within a minute" — PROJECT.md's Core Value.

- [ ] Lesson groups as a persistent entity with forward-only edits — foundation everything else needs
- [ ] "Who actually taught" field, wired into existing payment/hours logic — smallest change, biggest payroll-correctness payoff
- [ ] Sick-leave worklist with per-lesson assign/leave/cancel choice — this is the feature the Core Value sentence is literally describing
- [ ] Substitute suggestion filtered to genuinely free coaches — without this the worklist just relocates the "go check five agendas" problem into one screen instead of removing it

### Add After Validation (v1.x)

- [ ] Season Excel import with dry-run preview and update-not-duplicate re-import — add once groups exist and the admin has a real season to load; don't block the sick-leave flow on getting the import template exactly right
- [ ] Period Excel export (four sheets) — add once there's real group/substitution data worth exporting; an export of an empty/synthetic dataset teaches nothing

### Future Consideration (v2+)

- [ ] Pre-season sanity-check report (double bookings, lessons in vacation) — explicitly deferred in PROJECT.md until groups + import are proven
- [ ] Clubwide weekly grid view across coaches/courts — explicitly deferred in PROJECT.md as its own body of work
- [ ] Coach self-service sick-leave reporting — only if the admin-only bottleneck becomes a real pain point in practice

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Lesson groups (entity + forward-only edit) | HIGH | MEDIUM | P1 |
| "Who actually taught" field | HIGH | LOW | P1 |
| Sick-leave worklist | HIGH | MEDIUM | P1 |
| Substitute suggestion (hard-filtered) | HIGH | MEDIUM-HIGH | P1 |
| Season Excel import (dry-run + re-import) | HIGH | HIGH | P2 |
| Period Excel export (4 sheets) | MEDIUM-HIGH | MEDIUM | P2 |
| Pre-season sanity-check report | MEDIUM | MEDIUM | P3 |
| Clubwide weekly grid view | MEDIUM | HIGH | P3 |
| Coach self-service sick-leave reporting | LOW (no current demand) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch — delivers the stated Core Value
- P2: Should have, add once P1 is stable and there's real data to import/export
- P3: Explicitly deferred in PROJECT.md's Out of Scope section — future milestone

## Competitor Feature Analysis

Tennis-specific club platforms (Picktime, Waresport, RacquetDesk, 360Player, wod.guru) were
searched directly; none publish a documented automated substitute-matching feature — they stop
at "coach sets availability" and leave finding cover to a human. The stronger reference points
are adjacent domains with more mature absence/substitution tooling:

| Feature | K-12 substitute mgmt (Frontline/Tyler/Docendo) | Swim/music class software (iClassPro/Teachworks/SwimTopia) | Our Approach |
|---------|------------------------------------------------|--------------------------------------------------------------|--------------|
| Absence → affected-session worklist | Report absence once, system flags every scheduled session in range | Not typically present — these focus on enrollment/scheduling, not absence coverage | Adopt the K-12 pattern: date-range sick-leave report generates a worklist of affected lessons |
| Substitute matching | Matches against qualifications/certifications, notifies only eligible subs | Not present | Match against *availability only* (booking periods, deviating periods, vacations, no double-booking) — no qualification model exists yet, and none is needed at this club's size |
| Bulk roster import | Not applicable (staffing, not class rosters) | Excel/CSV roster import is standard (SwimTopia); typically flat player lists, not full season structures with groups+coaches+recurrence | Extend the pattern further than swim-school competitors do: import a full season (groups, players, coaches, recurring schedule) in one template, reusing the existing `lib/import-leden.ts` dry-run approach |
| Hours/payroll export | N/A (staff attendance, not payroll) | ClubReady-style payroll report: name, hours, rate, total pay, exportable CSV/PDF/Excel | Match this shape for the "hours per coach" sheet, but source hours from "who actually taught" rather than assigned coach — a correctness improvement over what generic competitors export |

## Sources

- [Free Tennis Scheduling Software for Clubs & Coaches | Koalendar](https://koalendar.com/scheduling-software-for/tennis)
- [19 Awesome Tennis Club Software Solutions | Wild Apricot](https://www.wildapricot.com/blog/19-tennis-club-software-solutions)
- [Tennis Club Management Software | 360Player](https://en-us.360player.com/sports-software/tennis)
- [6 Best Tennis Club Software in 2026 | WodGuru](https://wod.guru/blog/tennis-club-software/)
- [Best tennis scheduling software in 2026 | Anolla](https://anolla.com/en/best-tennis-software)
- [Tennis Club Management Software | Waresport](https://www.waresport.com/sports-we-serve/tennis)
- [The Best Tennis Club Software | RacquetDesk](https://racquetdesk.com/best-tennis-club-software/)
- [Substitute Teacher Management Software Guide | OpenEduCat](https://openeducat.org/articles/substitute-teacher-management-software-guide/)
- [Top 7 Absence and Substitute Management Software (2026) | TCP Software](https://tcpsoftware.com/articles/best-substitute-teacher-software/)
- [Music School Scheduling & Management Software | Teachworks](https://www.teachworks.com/music-school-management-software)
- [Absence & Substitute K-12 Software | Tyler Technologies](https://www.tylertech.com/products/absence-substitute)
- [Substitute management | Docendo](https://docendo.co/features/substitute-management)
- [Substitute management system | Frontline Education](https://www.frontlineeducation.com/school-hcm-software/absence-management/substitute-management-system)
- [Excel Spreadsheet - Roster Import | SwimTopia Help Center](https://help.swimtopia.com/hc/en-us/articles/4402529192717-Excel-Spreadsheet-Roster-Import-xlsx-xls-csv) (link returned 403 on direct fetch; content summarized via search snippet only — LOW confidence on exact column list, treat as directional)
- [Swim School Management Software Features | iClassPro](https://www.iclasspro.com/swim-software-features)
- [Managing Coach Timesheets | Coacha](https://coachasupport.zendesk.com/hc/en-us/articles/360016114378-Managing-Coach-Timesheets)
- [Time Clock Payroll Report | ClubReady Support](https://clubready.zendesk.com/hc/en-us/articles/360041092092-Time-Clock-Payroll-Report)
- [Visual Registration: Smart Staff Scheduling, Attendance & Payroll for Sports Clubs](https://www.visualregistration.com/industries/sports-clubs)
- [Free Printable Attendance Sheets | Vertex42](https://www.vertex42.com/ExcelTemplates/attendance-sheets.html)
- [Printable Lesson Attendance Sheet | class-templates.com](https://www.class-templates.com/printable-lesson-attendance-sheet.html)
- Internal: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` — existing codebase patterns (`lib/import-leden.ts`, `lib/groups.ts`, `lib/series.ts`, `lib/boekingstijd.ts`, `lib/vakanties.ts`, `lib/xlsx.ts`, `lib/payments.ts`)

---
*Feature research for: tennis-school admin module (lesson groups, substitution, Excel import/export)*
*Researched: 2026-09-05*
