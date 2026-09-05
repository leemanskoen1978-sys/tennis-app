# Pitfalls Research

**Domain:** Adding lesson groups, coach substitution, and Excel season import/export to a live Expo/React-Native + Supabase tennis-club scheduling app
**Researched:** 2026-09-05
**Confidence:** HIGH for codebase-specific pitfalls (grounded in `lib/`, `supabase-schema.sql`, `.planning/codebase/CONCERNS.md`); MEDIUM for general Postgres RLS/DST claims (verified against Postgres docs/mailing list and known JS Date/DST issue reports, not against this project's own Postgres instance)

## Critical Pitfalls

### Pitfall 1: The group becomes a second source of truth for "who's in the lesson"

**What goes wrong:**
A `lesson_groups` table gets a `player_ids`/`roster` column, and individual `bookings` rows keep their own `participant_ids`. The two drift: a player is removed from the group roster but stays in `participant_ids` on already-generated bookings (or vice versa), so the attendance sheet, the payment split, and the group export each show a different set of players for "the same" Tuesday 17:00 group.

**Why it happens:**
The codebase already computes group membership two ways for one entity (`Booking.participant_ids` is per-lesson). A new `lesson_groups` table naturally wants its own player list because the roster needs to exist even when no booking is generated yet (e.g. before the season is imported, or for future weeks not yet materialized). It's tempting to store the roster on the group *and* trust `participant_ids` per booking, because that's the existing pattern (`lib/groups.ts`) and touching every call site that reads `participant_ids` feels riskier than adding a new field.

**How to avoid:**
Decide, in writing, which one is authoritative and never let the other be edited directly:
- The `lesson_groups` table (or a `lesson_group_members` join table) is the **only** place a group's current roster is edited. `PROJECT.md`'s own decision table already says "group changes work from today forward" — mirror `seriesFrom`'s pattern exactly: a roster change writes forward from today's date, past bookings' `participant_ids` are historical snapshots and are never rewritten.
- Each `bookings` row generated from a group carries a `group_id` and a **copy** of the roster into `participant_ids` at generation time (or at attendance time) — this copy is explicitly documented as "what actually happened for this lesson," distinct from "who is currently in the group." `lib/groups.ts` functions (`participantIdsOf`, `groupSize`, `playsIn`) keep working unchanged on the booking-level copy; a new `lib/lesgroepen.ts` (or similar) owns the group-level roster and its own tests.
- Never let a screen read `lesson_groups.player_ids` to answer "who is in this specific lesson" — that question is always answered by the booking's own `participant_ids`, exactly as the existing anti-pattern warning in `ARCHITECTURE.md` already states for `lib/groups.ts`. Extend that same anti-pattern entry to cover the new table.

**Warning signs:**
- A screen or export function reads `lesson_groups.*` roster fields directly instead of going through a `lib/` accessor.
- A bug report where "the export says 6 players but the attendance sheet for the same lesson shows 5."
- Any code path that mutates `participant_ids` on a *past* booking when a group roster changes.

**Phase to address:**
Phase introducing lesson groups as an entity (before substitution or import touch it).

---

### Pitfall 2: Substitution overwrites `coach_id`, corrupting payroll and the roster

**What goes wrong:**
The simplest-looking fix for "who taught this lesson" is to just set `bookings.coach_id = <substitute>` for the affected rows. This is exactly what `PROJECT.md`'s Key Decisions table already flags as wrong ("Vervanging als apart veld, niet door coach_id te overschrijven") — but it's worth stating why concretely: `coach_id` is read everywhere as "whose agenda is this" (`agendaScope`, `magInElkeAgenda`, the `bookings_select`/`bookings_update`/`bookings_delete` RLS policies, `overlaps()` double-booking checks, `totalCoachPayout`). Overwriting it:
- makes the substitute's own double-booking check compare against the *original* coach's other lessons instead of the substitute's,
- makes the original coach's calendar silently lose the lesson (it moves to the substitute's agenda), and
- makes `totalCoachPayout` for the *original* coach undercount and for the *substitute* overcount in a way that can't be distinguished from "the substitute always had this lesson."

**Why it happens:**
`coach_id` is a single foreign key and every existing query already filters on it — adding a second field (`taught_by_id` or similar) means updating every payroll/report query, plus the RLS `bookings_select`/`update` policies, to consider *both* fields depending on context (agenda visibility vs. payout attribution vs. "whose regular lesson is this for rebooking purposes"). That's real, non-trivial work that overwriting `coach_id` sidesteps — at the cost of correctness.

**How to avoid:**
- Add a new nullable column, e.g. `taught_by_id uuid references users(id)`, defaulting to null (meaning "taught by `coach_id` as planned"). `coach_id` always remains "whose regular lesson/roster slot this is."
- `totalCoachPayout` and any coach-rate lookup must use `taught_by_id ?? coach_id` for **who gets paid**, but `coach_id` for **whose agenda/roster** the lesson appears under and for double-booking checks against the *substitute's* own calendar (a substitute check needs `overlaps()` run against the substitute's existing bookings using `taught_by_id`, not `coach_id`).
- `coach_rates` lookup for pay must key off `taught_by_id ?? coach_id`, per the Key Decision "vervanger krijgt zijn eigen uurtarief" — write this as one small `lib/` function (e.g. `effectiveCoachId(booking)`) used everywhere payroll reads it, so there's exactly one place this ternary lives, mirroring the `planMethodChange` single-path pattern already used for payment method changes.
- Extend `bewaak_betaalvelden`'s exclusion-list thinking (see `CONCERNS.md` Tech Debt) explicitly: decide whether `taught_by_id` belongs to "the coach" (settable by any coach on their own lesson) or "the admin only" (since it's a payroll-relevant field, it should almost certainly be admin-only, like `coach_rates`/`rates_write`) and update the trigger's exclusion list and the RLS `bookings_update` policy together, in the same change, with a matching `lib/rechten.ts` rule.

**Warning signs:**
- Any grep for `coach_id =` (assignment) inside a substitution flow — should not exist.
- A test where a substituted lesson still shows up correctly on the *original* coach's calendar but the payout report gives the substitute credit — if this isn't independently testable, the split is done wrong.
- `totalCoachPayout` changed in a way that isn't guarded by a new `lib/*.test.ts` covering "substitute paid, original coach not paid for that lesson."

**Phase to address:**
Phase introducing "actually taught by," before or same phase as substitution worklist — this must land before any substitute-suggestion UI, since the suggestion feature is worthless if the attribution underneath it is wrong.

---

### Pitfall 3: Substitute availability check reuses the trainer's own booking-time rules incorrectly

**What goes wrong:**
`lib/boekingstijd.ts` answers "can a *new* booking be placed at this time for this trainer" (used when a player books a lesson). Substitute suggestion needs a related but different question: "is this *other* trainer free and willing to teach at this specific already-existing time slot." Naively calling `boekbaarOp(trainer, dag, clubEinde)` and then separately checking `overlaps()` looks right but silently omits club-wide vakanties (`club_settings.vakanties`) if the caller forgets to intersect them, because `boekingstijd.ts`'s own header explicitly documents that vakanties are deliberately excluded from that module ("De vakanties van de club staan hier bewust niet in"). A substitute-suggestion function that copies this module's logic without also checking `vakantieOpMoment` will suggest a colleague who is, in fact, on a club holiday during that slot — a suggestion nobody should ever see.

**Why it happens:**
`boekingstijd.ts` was correctly designed to leave vakanties to the caller (screens already layer them in for the booking flow). A new "who can substitute" function is a *new* caller and it's easy to forget this contract because the existing module reads as complete in isolation.

**How to avoid:**
Write one new pure function, e.g. `lib/vervanger.ts::kanVervangen(kandidaat, slot, existingBookings, vakanties)`, that explicitly composes all four checks in one place and is unit-tested for each: (1) `boekbaarOp` / `urenOp` for the candidate's working hours and any `booking_periods` exception active on that day, (2) `vakantieOpMoment` for the club calendar, (3) `overlaps`-equivalent against the candidate's own existing bookings (reusing the exact same collision predicate as `lib/recurrence.ts::collides` and `SimpleDataProvider`'s `overlaps()` — do not write a third, slightly different version of "do these two time ranges overlap"), and (4) exclude the original coach and anyone already marked unavailable for that date (e.g. also sick). Test cases should specifically include: a candidate whose `working_hours` cover the slot but who's on a club vakantie that day, and a candidate in an exception `booking_periode` that overrides their normal hours to "no lessons."

**Warning signs:**
- A substitute-suggestion function that doesn't import `vakanties.ts`.
- Two different overlap-detection implementations existing simultaneously (`collides` in `recurrence.ts`, `overlaps` in `SimpleDataProvider.tsx`, and a new one in the substitution module) — the codebase's own comment in `recurrence.ts` already flags this exact risk ("Wijkt deze versie ooit af, dan meldt het scherm een reeks die de provider vervolgens weigert — daarom moeten de twee gelijk zijn"); a third divergent copy is the same bug class.
- Suggesting a coach who has a `booking_periode` marked as "no lessons this week" (vacation/leave), because that periode type wasn't checked.

**Phase to address:**
Substitute-suggestion phase. Should have its own `lib/*.test.ts` before any UI is built on top of it.

---

### Pitfall 4: Recurrence/import date math breaks across a DST transition

**What goes wrong:**
`lib/recurrence.ts::shiftDays` is deliberately written to add days via `Date` field manipulation (`getFullYear/getMonth/getDate` + fixed hour/minute) specifically so a 10:00 lesson stays at 10:00 across an hour change — this is correct and already documented in the file's header comment. The risk for the *new* Excel import feature is different: an import reads a season's worth of lesson dates/times from spreadsheet cells (often serial date numbers or locale-formatted strings) and must convert them into the same kind of "local wall-clock time, day-stepped" representation `planSeries` expects. If the importer instead parses a spreadsheet date into a UTC `Date` (a common mistake with naive `new Date(isoString)` parsing of a bare date, or with libraries that assume UTC for date-only cells) and then calls `.toISOString()` before storage, every generated lesson can silently be off by one hour for the half of the season that falls on the other side of the March/October DST boundary — while looking "close enough" to pass a casual visual check, since only the date needing adjustment shifts, not obviously outside its display column.

**Why it happens:**
Excel/xlsx date cells are stored as serial numbers relative to a locale-agnostic epoch, and there is no single "obviously correct" way to turn that number into a JS `Date` — the existing hand-rolled `lib/xlsx.ts` writer means there is no library doing this conversion consistently either; a new import path (reading, not writing) has to add its own cell-to-`Date` conversion, which is new code with no existing test coverage to lean on.

**How to avoid:**
- The importer must produce the same shape `planSeries`/`shiftDays` already consume: explicit `{year, month, day, hour, minute}` local components, never a UTC timestamp derived by string-splitting an ISO string with a `Z`. Write one `lib/import-lessen.ts` (or similar) function that turns "a spreadsheet cell" into `{jaar, maand, dag}` and a separate one for time-of-day, and unit-test both against cells straddling the actual Belgian DST dates (last Sunday of March, last Sunday of October) for the season being imported — e.g. a weekly Tuesday 20:00 group that has occurrences both before and after the switch.
- Never call `Date.UTC(...)` or append `Z` when constructing the lesson start time from imported data — construct with `new Date(year, month - 1, day, hour, minute)` exactly as `shiftDays`/`parseUntil` already do, so the local-time semantics match the rest of the recurrence engine.
- Add a regression test asserting that a lesson series spanning a DST boundary, generated via import, has identical local hour/minute for every occurrence — this is the concrete, automatable version of the qualitative claim in `recurrence.ts`'s comment.

**Warning signs:**
- Any new code in the import path calling `.toISOString()` on a `Date` built from `Date.UTC(...)` or parsed from an unqualified ISO string.
- A manual test importing a season that crosses late March or late October showing lessons at 19:00 or 21:00 instead of the intended 20:00 for roughly half the dates.
- xlsx cell reading code that doesn't have its own dedicated `*.test.ts` separate from `planImport`'s row-validation tests.

**Phase to address:**
Excel import phase (dry-run + real import). Must be tested with fixture data that deliberately spans a DST boundary, not just "next Tuesday."

---

### Pitfall 5: Idempotent re-import "matches" the wrong existing rows and duplicates or corrupts them

**What goes wrong:**
`lib/import-leden.ts` already solves the "match existing vs. create new" problem for one entity (players/coaches) keyed on normalized email, and it does so carefully: it detects duplicate existing records sharing a key and refuses rather than guessing, tracks "seen in this file" separately from "existed before," and only ever proposes additive changes for a blank cell (never destructive). Lesson import needs to match at **three levels simultaneously** — the group ("is this the same Tuesday-17:00-U9 group as last time"), the season's individual lesson slots ("is this the same occurrence"), and unknown players ("is this the same new player mentioned in two different group sheets"). There is no single natural key across all three the way `email` is natural for a person. A naive implementation keys a group match on `(name, day, time)` and a lesson-slot match on `(group_id, date)` — but if the admin renames a group between seasons, or the club shifts every Tuesday group from 17:00 to 17:30, the "same" group/lesson silently becomes "new," duplicating every future lesson instead of updating it, which is exactly the "verdubbelen" failure `PROJECT.md` explicitly calls out as the thing to avoid.

**Why it happens:**
Spreadsheet-driven re-import is inherently a fuzzy-matching problem dressed up as an exact one; the deceptively simple `import-leden.ts` pattern (exact key match, propose plan, execute) works because email is a stable, unique, externally-assigned identifier. Lesson groups and individual lesson slots have no equivalent stable external identifier — the spreadsheet itself is the only record, and its authoring conventions (a coach retyping a group name slightly differently each season) will vary.

**How to avoid:**
- Give the import template its own explicit identifier column for groups (e.g. a "group code" or, more robustly, have the app assign an internal `group_id` on first import and require the *exported* template for re-import to carry that id back — i.e. export and import share one round-trippable format, so "re-import" really means "import a file the app itself produced or extended," not "import an arbitrary spreadsheet a coach typed from scratch every season"). This sidesteps fuzzy matching entirely for the common case and matches the project's own "the app decides the template" decision.
- For a first-time import with no `group_id` column populated, match groups on an exact tuple decided up front (e.g. name, normalized) and treat any ambiguity the same way `import-leden.ts` treats a duplicate email: refuse and surface it in the dry-run plan rather than guessing, with a clear message ("group 'U9 dinsdag' matches two existing groups; resolve in Beheer first").
- For individual lesson-slot matching within an already-matched group, match on `(group_id, start_time)` exactly — never on array position/row order in the sheet — because row order in a re-exported-then-edited sheet is not guaranteed stable.
- Dry-run correctness requires the plan-computation function to be **pure and total**: given the same file bytes and the same current DB state, it always produces the identical plan, with zero side effects, so what the admin approves is provably what will execute — follow `planImport`'s existing pattern (`lib/` function returns a plan object, a separate `pasImportToe`-equivalent executes it) rather than any streaming/incremental approach that computes-and-writes in the same pass.
- Partial failure: follow `pasImportToe`'s existing sequencing exactly — one row/group at a time, `try/catch` per unit, tally successes/failures, never wrap the whole import in one transaction that the app itself manages (there is no cross-network transaction available to a Supabase client doing sequential calls anyway). Decide up front what "50 lessons created, then row 51 fails" means for the admin — surface a partial-success summary (mirroring `ImportUitslag`), not a silent partial commit or a rollback the app can't actually perform.
- Re-import drift specifically: define what happens when a previously-imported lesson was **manually edited** in the app since (time moved, a participant added) and the season file is re-imported. Decide and document one rule — e.g. "re-import never touches a lesson whose `updated_at`/an edit-marker shows manual changes since generation, only reports it as skipped" — otherwise a re-import can silently clobber a manual correction, which is worse than doing nothing.

**Warning signs:**
- No dedicated identifier for a group survives a round trip through export → manual edit → re-import.
- The dry-run plan function has any `await`/database call in it (a sign it's not pure, and thus not safely re-runnable for preview).
- A re-import test suite that doesn't include "re-import the exact same file twice" (must be a no-op the second time) and "re-import after a manual edit to one lesson" (must not silently discard the edit).

**Phase to address:**
Excel import phase. The group-identifier round-trip decision should be made before the export format is finalized, since export and import need to agree on it.

---

### Pitfall 6: New RLS policies on `lesson_groups` (and any join table) hit the same upsert/insert-policy trap already recorded twice in this codebase

**What goes wrong:**
`CONCERNS.md` already documents this exact bug class occurring twice in production ("coach couldn't approve a request, player couldn't update own profile") on the existing `bookings` table: because `lib/sync.ts`'s whole-store diff always writes via `insert ... on conflict do update`, Postgres re-checks the **INSERT** policy's `WITH CHECK` clause even on rows that already exist and are only being updated through the conflict path. A policy like `WITH CHECK (created_by = app_user_id())` — intuitively meant to mean "you can only create your own group" — will also silently block a legitimate *update* to an existing group by anyone other than its original creator, because Postgres treats the whole upsert statement as needing to satisfy the INSERT policy for the statement to be valid at all when a conflict path exists. Per Postgres's own semantics (confirmed against the CREATE POLICY docs and Postgres mailing-list discussion of this exact upsert/RLS interaction): all applicable INSERT and UPDATE policies must pass regardless of which path is actually taken, and if RLS is enabled with no permissive INSERT policy present, an `INSERT ... ON CONFLICT DO UPDATE` is rejected before ever reaching the UPDATE path — the failure is exactly as unhelpful and silent as `CONCERNS.md` describes: no error surfaces to the UI in this app's error-handling pattern, the write is simply dropped by `commit()`'s snapshot rollback.

**Why it happens:**
Every new table this milestone adds (`lesson_groups`, a group-membership join table if used, a `sick_leave`/substitution worklist table) will be written to via the exact same `lib/sync.ts` whole-store-diff-then-upsert mechanism as every existing table, because that's the only write path `supabaseStore.ts` has. Anyone writing a new RLS policy from first principles (rather than starting from the existing `bookings_insert` comment block) will naturally write "who is allowed to create this row" as an ownership check, without realizing that same check will re-fire on every subsequent update to that row by someone else.

**How to avoid:**
- Before writing any new RLS policy for `lesson_groups` or related tables, read the comment block directly above `bookings_insert` in `supabase-schema.sql` (lines ~726-749 per `CONCERNS.md`) — it documents the already-fixed version of this exact trap and the pattern used to fix it (removing/loosening the creator check on the coach/admin branches).
- Design new INSERT policies for these tables to check "is this admin" (per the Key Decision that this module is admin-only, i.e. `magInElkeAgenda`-equivalent) rather than "is this the creator" — an admin-only check is stable under upsert re-evaluation because it doesn't depend on who originally created the row, sidestepping the whole class of bug.
- If any policy *does* need a creator/owner check (e.g. if a future phase lets a coach self-report sick leave), explicitly write and test the upsert case: insert as user A, then have user B legitimately update the same row, and confirm the update isn't silently rejected — this is not covered by the Jest suite (`CONCERNS.md` notes zero automated RLS coverage) and must be manually verified against a real Supabase project per row-owning scenario before shipping.
- Add a code comment cross-referencing `bookings_insert`'s comment, matching the existing convention where `lib/rechten.ts` and `supabase-schema.sql` cross-reference each other by name.

**Warning signs:**
- A new RLS `WITH CHECK` clause referencing `created_by`/`user_id = app_user_id()` on any table written via the standard `sync.ts` upsert path, without an explicit test of the "someone else updates this existing row" case.
- Any UI action that silently does nothing (no error, no state change) right after this milestone's tables go live — treat this as the default hypothesis first, given it has happened twice before on this exact write path.
- A manual QA pass that only tests "admin creates a group" and never tests "admin edits a group that already exists" or "a substitution is recorded for a lesson, then edited again."

**Phase to address:**
Every phase that adds a new table (lesson groups, substitution/sick-leave worklist). Verification should be a named manual QA step in each such phase's acceptance criteria, not assumed from `tsc`/Jest passing.

---

### Pitfall 7: Testing new group/substitution/import features against the dev server touches real club data

**What goes wrong:**
`CONCERNS.md` and the user's own memory note both already flag this: there is no separate dev/staging Supabase project, so running the app locally with `.env` present reads and writes the club's real production database. This milestone is unusually high-risk for this specific pitfall because two of its six features are *inherently bulk-write* operations by design — Excel import can create dozens of groups, players, and lessons in one pass, and testing "does re-import correctly update vs. duplicate" requires running the import multiple times against the same data to observe the diff, which is exactly the kind of repeated, exploratory, bulk-mutation testing most likely to leave the club's live schedule and member list polluted with test groups/lessons/players if run against production.

**Why it happens:**
There's no technical barrier stopping it — `providers/backend.ts` picks Supabase whenever `.env` keys are present, with no separate "test project" mode, and the friction of setting up a second Supabase project is easy to defer indefinitely.

**How to avoid:**
- For this milestone specifically, use the local mock-store fallback (remove/rename `.env` temporarily) to exercise `planImport`-equivalent logic and group/substitution `lib/` functions purely in-memory wherever possible — this is already how the 985 existing `lib/` tests avoid touching Supabase at all, and the same discipline (pure functions, no I/O, tested with fixtures) should extend to every new rule module this milestone adds (group roster changes, substitution attribution, import planning, export generation).
- RLS-policy verification (Pitfall 6) is the one thing that *cannot* be tested in mock-store mode, since the mock store has no RLS at all. For that narrow purpose, recommend — as `CONCERNS.md` already does — standing up a second free-tier Supabase project loaded with the same `supabase-schema.sql`, specifically before this milestone's new tables are exercised interactively, given that manual RLS verification is now required (Pitfall 6) and would otherwise necessarily run against production.
- If a second project is not stood up, at minimum: never run an *actual* Excel import against the production Supabase project except with genuine club data intended to be kept, and treat every "let's just try importing this test file to see what happens" impulse as a red flag requiring the mock-store fallback instead.

**Warning signs:**
- A test group, test player, or test lesson appearing in the live app that a real coach or player can see.
- Running the import dry-run repeatedly is safe (it's pure/no-write by design per Pitfall 5's dry-run requirement) — but running the *actual* import ("droogloop vóór er iets wegschrijft" only protects up to the point of execution) more than once against production is not.

**Phase to address:**
Applies across every phase of this milestone, but is most acute in the Excel-import phase given its bulk-write nature. Should be a standing constraint noted in that phase's plan, not a one-time reminder.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Match re-import groups by exact name string instead of a round-tripped `group_id` | Ships without changing the export format first | Every season, a slightly retyped group name creates a duplicate group instead of updating the existing one | Never for the general case; only acceptable as an explicit "first import has no prior group_id" fallback, with duplicates surfaced (not silently created) in the dry-run |
| Store `taught_by_id` but skip updating `bewaak_betaalvelden`'s exclusion list because "it's just a new column, not a payment field" | Saves touching the trigger this phase | Reopens the exact `bewaak_betaalvelden` fragility already flagged in `CONCERNS.md` — either too permissive (anyone can silently change who gets paid) or an opaque save failure | Never — `taught_by_id` is payroll-relevant by definition (Pitfall 2) |
| Skip a real Supabase RLS test for new tables and rely on `tsc`+Jest passing | Faster to ship | RLS is this app's actual enforcement layer (`lib/rechten.ts`: "de app is niet de bewaker") and the upsert trap has zero automated coverage — the exact gap that produced two prior silent bugs | Never for a table with any ownership-based (non-admin-only) policy; borderline acceptable only if every new policy is provably admin-only and mirrors an already-verified pattern |
| Generate all of a season's lessons synchronously in one `commit()` during import | Simple to write, matches the "one commit per action" architectural constraint | A season import of hundreds of lessons is a large single diff for `lib/sync.ts`'s whole-store diff (see `CONCERNS.md` Performance Bottlenecks); at club scale (tens of groups × dozens of weeks) this is probably fine, but a large club could see a slow, all-or-nothing commit | Acceptable at current club scale; watch if `bookings` grows into the low thousands from a single import |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|-----------------|-------------------|
| Supabase upsert write path (`lib/sync.ts`) | Writing a new RLS policy with an ownership check (`created_by = app_user_id()`) on any newly-added table | Prefer admin-only checks for this module's tables (matches "module is for the beheerder only" decision); if ownership is ever needed, explicitly test the upsert-of-existing-row case against a real Postgres/Supabase instance |
| Excel/xlsx cell parsing for dates | Treating a spreadsheet date/time cell as UTC and calling `.toISOString()` on a `Date.UTC(...)`-constructed value | Convert to local `{year, month, day, hour, minute}` and construct with `new Date(y, m-1, d, h, min)`, matching `shiftDays`'s existing local-time convention |
| Existing `lib/import-leden.ts` reuse for import of unknown players found in the season sheet | Writing a second, slightly different player-matching/creation function for lesson import instead of calling the existing `planImport`-style logic | Reuse `leesRol`/normalizeEmail/`nameExists`-style helpers directly; don't fork a parallel "create player if unknown" path with different duplicate-detection rules |
| `coach_rates` lookup for payroll | Looking up the rate by `coach_id` even when `taught_by_id` is set | Always resolve via a single `effectiveCoachId(booking)` helper before any rate/payout lookup |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Whole-store diff (`lib/sync.ts`) applied to a large season import in one commit | Import spinner hangs noticeably longer than the dry-run took to compute | Consider batching the import's `commit()` calls per group or per week rather than one commit for the entire season, if `bookings`/`lessons` array sizes grow into the thousands | Already flagged generally in `CONCERNS.md`; this milestone's import feature is the first concrete workload likely to exercise it at any real scale |
| Substitute-suggestion recomputing all coaches' full-day availability on every keystroke/render in the sick-leave worklist | UI feels sluggish when scrolling through many affected lessons | Compute suggestions per affected lesson on demand (when the admin opens that lesson's substitute picker), not eagerly for the whole worklist at once | At current club scale (a handful of coaches) unlikely to be a real problem, but avoid the eager-all-lessons-all-coaches cross product as a default implementation shape |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Excel import creating "unknown players" without checking the "Confirm email" auth setting reminder | Same risk `CONCERNS.md` already documents for `leden-import.tsx` — a bulk-created player account can be claimed by anyone who knows the email before the real member signs up — but now triggered by *lesson* import, not just member import | Route unknown-player creation during lesson import through the exact same `addUser` path member import uses, so the existing README/checklist reminder about "Confirm email" applies uniformly; don't build a second player-creation code path that bypasses this |
| New `lesson_groups`/substitution tables readable by any authenticated user by default (e.g. a permissive `select using (true)` written "temporarily" to unblock development) | Exposes club-wide payroll-adjacent data (who substitutes, who's sick) beyond the admin-only scope decided for this module | Write the restrictive (admin-only, matching `magInElkeAgenda`) policy from the start, mirroring `rates_select`'s existing pattern for another admin/coach-only concern |
| Substitution worklist exposing why a coach is unavailable (sick leave reason/dates) to non-admin roles via a join or a computed availability field | A trainer or player could infer a colleague's medical leave dates from an over-broad `select` | Keep sick-leave period data behind the same admin-only RLS as the rest of this module; if a substitute-facing view of "your new lesson" is ever added, expose only the resulting assignment, never the underlying leave record |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Substitute suggestion list includes coaches who are technically free but implausible (e.g. a coach who has never taught this age group, or is on the far side of the club) | Admin has to manually filter an unhelpful list under time pressure ("binnen een minuut" is the stated core value) | Even if not filtering by skill/level formally this milestone, sort suggestions sensibly (e.g. coaches who already teach other groups at similar levels first) rather than an arbitrary order; at minimum, exclude the sick coach and anyone already assigned as a substitute elsewhere in that same worklist run |
| Dry-run import plan shown is huge (hundreds of rows) with no way to see just the problems | Admin can't find the 3 actual errors among 200 "no change" rows | Follow `leden-import.tsx`'s existing pattern of surfacing `fouten`/`waarschuwingen` distinctly and prominently, and extend it: for a season import, group the dry-run summary by group/week, with errors/warnings surfaced first, matching the existing UX rather than reinventing it |
| Re-import silently overwrites a manually-corrected lesson time with the (now stale) spreadsheet value | Admin's manual fix "disappears" after the next re-import with no explanation | Dry-run plan must explicitly call out "this lesson was manually changed since it was imported; re-importing will [overwrite / skip] it" per whatever rule is chosen (Pitfall 5) — never a silent overwrite |

## "Looks Done But Isn't" Checklist

- [ ] **Lesson groups:** Often missing a decision on what happens to *future, not-yet-generated* lessons when a group's schedule (day/time) changes mid-season — verify the "changes work from today forward" rule (mirroring `seriesFrom`) is actually implemented for group edits, not just for the group's own name/level fields.
- [ ] **Substitution attribution:** Often missing a `coach_rates` lookup fix — verify `totalCoachPayout` (and any report built on it) was audited and updated to use the substitute's rate, with a dedicated test, not just a schema column that nothing reads yet (echoing the existing dead-`clubMargin` pattern in `CONCERNS.md`).
- [ ] **Sick-leave worklist:** Often missing handling for a lesson that's part of a recurring series — verify marking one occurrence's substitute doesn't accidentally propagate to the whole `series_id`, and that "leave it standing" vs. "cancel" vs. "assign substitute" per lesson is genuinely per-row, not per-series.
- [ ] **Excel import dry-run:** Often missing an end-to-end idempotency test — verify "import file, then immediately re-import the identical file" produces zero changes in the second run, as an actual automated test, not just a manual spot-check.
- [ ] **Excel export:** Often missing consistency with the group/substitution model — verify the "hours per coach" sheet uses `taught_by_id ?? coach_id` (same as payroll) so the export doesn't contradict what the app's own payout screen shows for the same period.
- [ ] **RLS on new tables:** Often missing manual upsert verification — verify someone actually ran "insert as user A, then update as user B" against a real Supabase project for every new table's policies, since Jest cannot catch this (Pitfall 6).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| Group roster and booking `participant_ids` have drifted apart | MEDIUM | Write a one-off reconciliation script (or admin screen) that, for each future booking with a `group_id`, recomputes `participant_ids` from the current group roster as of that booking's date; run it once, then ensure Pitfall 1's write discipline prevents recurrence |
| `coach_id` was overwritten instead of using `taught_by_id` for already-recorded substitutions | HIGH | Requires manually reconstructing "who was originally scheduled" from external records (the old agenda, `.ics` exports, memory) since the original value is gone; going forward, backfill `taught_by_id` for any substitutions and never overwrite `coach_id` again |
| A re-import duplicated lessons/groups instead of updating them | MEDIUM | Because `series_id`/`group_id` link duplicated rows, a cleanup script can find groups with near-identical name/day/time and merge or delete the duplicate cohort; costly primarily in the manual review needed to confirm which copy is authoritative |
| A silently-rejected RLS upsert (Pitfall 6) shipped and an admin's edits to a group have been silently failing | LOW–MEDIUM | Once diagnosed (matches the known bug class exactly), the fix mirrors the existing `bookings_insert` fix: loosen the INSERT policy's `WITH CHECK` for the admin path; no data is lost since the failed writes never persisted, only user trust/time is |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Group/booking roster drift (Pitfall 1) | Lesson-groups entity phase | New `lib/*.test.ts` proving group roster edits never mutate past bookings' `participant_ids`, and that generation copies the roster forward at creation time |
| `coach_id` overwritten for substitution (Pitfall 2) | "Actually taught by" phase | Test asserting original coach's calendar and payout are unaffected by a substitution recorded via `taught_by_id`, and substitute's payout/rate is correctly attributed |
| Availability check omits vakanties/exception periods (Pitfall 3) | Substitute-suggestion phase | `lib/vervanger.ts`-equivalent test suite covering working hours, exception `booking_periodes`, club vakanties, and existing-booking collision, each independently |
| DST-crossing import dates (Pitfall 4) | Excel-import phase | Fixture-based test importing a series that spans the March/October DST boundary, asserting identical local hour across all occurrences |
| Fuzzy re-import matching/drift (Pitfall 5) | Excel-import phase (export format decided first) | "Re-import same file twice = no-op" and "re-import after manual edit" tests; dry-run function purity verified (no I/O) |
| RLS upsert trap on new tables (Pitfall 6) | Every phase adding a table | Manual test against a real Supabase project: insert as one user, update as another, for every new policy; named as an explicit QA step, not implied by green Jest |
| Testing against production (Pitfall 7) | All phases, especially Excel-import | Mock-store-mode used for all `lib/` development; any interactive Supabase testing of bulk import/RLS explicitly called out and minimized/confirmed with the user beforehand |

## Sources

- `.planning/PROJECT.md` — this milestone's scope, constraints, and pre-made key decisions (group-as-table, `coach_id` unchanged, substitute's own rate, taught-by as separate field, import dry-run pattern, admin-only module)
- `.planning/codebase/CONCERNS.md` — documented history of the `bewaak_betaalvelden` trigger fragility, the RLS upsert-vs-insert-policy bug class (two prior real incidents), dev-server-touches-production risk, and zero RLS test coverage
- `.planning/codebase/ARCHITECTURE.md` — existing `lib/groups.ts`/`lib/series.ts` computed-on-demand pattern and its documented anti-pattern warning against duplicating group/series computation inline
- `lib/recurrence.ts`, `lib/boekingstijd.ts`, `lib/import-leden.ts` (read directly) — existing local-time date-stepping convention (`shiftDays`), the deliberate exclusion of vakanties from `boekingstijd.ts`, and the existing dry-run/plan/execute import pattern (`planImport`/`pasImportToe`) this milestone should extend rather than reinvent
- [PostgreSQL BUG #19359 — Row level security: Upserts require insert policies in the update path](https://www.postgresql.org/message-id/19359-fb1d273ab01b8b22%40postgresql.org) — confirms INSERT policy `WITH CHECK` and required-policy behavior on `INSERT ... ON CONFLICT DO UPDATE`
- [Supabase Discussion #28122 — During an Upsert which RLS policies apply?](https://github.com/orgs/supabase/discussions/28122) — community confirmation of the same upsert/RLS interaction in a Supabase context specifically
- [PostgreSQL CREATE POLICY documentation](https://www.postgresql.org/docs/current/sql-createpolicy.html) — authoritative statement that all applicable SELECT/INSERT/UPDATE policies must pass for an upsert regardless of which path executes
- DST/recurring-event date bugs (general web research, MEDIUM confidence, used to corroborate — not substitute for — the codebase's own correct existing handling in `shiftDays`): [Mozilla Bugzilla #365349](https://bugzilla.mozilla.org/show_bug.cgi?id=365349), [Luxon issue #1089](https://github.com/moment/luxon/issues/1089), [DHTMLX forum: recurring events and DST](https://forum.dhtmlx.com/t/recurring-events-and-dst/26105)

---
*Pitfalls research for: lesson groups, substitution, and spreadsheet import/export in a live Expo/Supabase tennis-club scheduling app*
*Researched: 2026-09-05*
