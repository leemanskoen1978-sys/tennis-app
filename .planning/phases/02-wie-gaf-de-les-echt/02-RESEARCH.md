# Phase 2: Wie gaf de les écht - Research

**Researched:** 2026-09-05
**Domain:** Attribution of a substitute teacher on an existing booking row, in a brownfield
Expo/React-Native + Supabase app with 985 passing tests and one guarded payment-write pattern
already proven (`planMethodChange`).
**Confidence:** HIGH — every claim below is grounded in the actual source files read during this
research (`lib/payments.ts`, `lib/reports.ts`, `supabase-schema.sql`, `lib/types.ts`,
`providers/SimpleDataProvider.tsx`, `components/BookingDetailSheet.tsx`,
`components/LessonCards.tsx`, `app/coaches/[id].tsx`, `app/admin/reports.tsx`), not from training
knowledge about Supabase/Postgres in general.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Het veld**
- **D-01:** De vervanger komt in een apart veld naast `bookings.coach_id`, dat nooit
  overschreven wordt. Overschrijven verliest wie er oorspronkelijk stond, en dan klopt noch het
  rooster noch de loonstaat. Dit is de kern van deze fase.
- **D-02:** Leeg betekent "de toegewezen trainer gaf de les zelf". Er hoeft dus niets ingevuld
  te worden voor de 99% van de lessen waar niets bijzonders aan is.
- **D-03:** De vervanger is een bestaande trainer. Geen vrije tekst — anders is er niets mee
  te rekenen.

**Het loon**
- **D-04:** Het loon gaat naar wie de les werkelijk gaf, tegen **diens eigen uurtarief** uit
  `coach_rates`. De vaste trainer krijgt niets voor een les die hij niet gaf.
- **D-05:** Er komt **één plek** in de code die de vraag "wie gaf deze les" beantwoordt — één
  functie in `lib/`, met een test eromheen. Elke plek die loon, uren of een trainersrapport
  uitrekent gaat daardoorheen. Dezelfde discipline als `planMethodChange` voor betalingen.
- **D-06:** Omzet verandert niet. Omzet loopt op het uurtarief van de **baan** (wat de speler
  betaalt); loon loopt op het uurtarief van de **trainer**. Die twee mogen nooit in elkaar
  geschoven worden. Een vervanging raakt alleen de loonkant.

**Zichtbaarheid**
- **D-07:** Waar een les getoond wordt, is te zien dát er een vervanger stond en wie de vaste
  trainer was. Beide namen, niet één die de andere vervangt.

**Toegang**
- **D-08:** Alleen een beheerder kan invullen wie de les werkelijk gaf. Een trainer die
  zichzelf als vervanger opgeeft, is v2.
- **D-09:** Het veld raakt geld en hoort dus bij de bewaakte velden. `bewaak_betaalvelden`
  bewaakt vandaag al welke velden een niet-beheerder mag aanraken; het nieuwe veld hoort in
  diezelfde bewaking, niet in een nieuwe ernaast.
- **D-10:** De schemawijziging komt als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. **De gebruiker draait hem zelf.** Niets in deze fase mag SQL draaien
  of de productiedatabank aanraken.

### Claude's Discretion
- De naam van het veld en van de functie.
- Waar in de schermen de vervanger getoond en ingevuld wordt.
- Of `lib/payments.ts` de functie zelf aanroept of hem aangereikt krijgt.

### Deferred Ideas (OUT OF SCOPE)
- Een trainer die zichzelf ziek meldt of zichzelf als vervanger opgeeft — v2.
- De werklijst en het vervangersvoorstel — fase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| VERV-01 | Bij elke les is vast te leggen wie hem werkelijk gaf, apart van de trainer aan wie de les is toegewezen. | New `bookings.taught_by_id` column (nullable, `on delete set null`), added after `coach_id` in `lib/types.ts`; write path via one new guarded provider action (`setTaughtBy`), never through the generic `updateBooking` patch. See "Storage Wiring" and the schema code example. |
| VERV-02 | Loon, urenoverzicht en rapport rekenen met wie de les werkelijk gaf, tegen diens eigen uurtarief — via één plek in de code. | `lib/lesgever.ts::lesgeverId(b)` as the single attribution function (D-05); exact call-site inventory of every function that must switch to it (`coachPayout`/`totalCoachPayout` callers, `payoutsByCoach`, `coachPayoutThisMonth`) versus every call site that correctly stays on `coach_id`. See "Code Examples" call-site table and "Common Pitfalls" 1-3. Test strategy included with the literal VERV-02 acceptance fixture. |
| VERV-03 | Waar een les getoond wordt, is zichtbaar dat er een vervanger stond en wie de vaste trainer was. | Smallest-change display proposal for `components/BookingDetailSheet.tsx` (both names, always) and `components/LessonCards.tsx` (compact marker + detail one tap away); flagged as Assumption A4 pending confirmation of exact card-level requirement. |
</phase_requirements>


## Summary

This phase adds exactly one nullable column to `bookings` (`taught_by_id`), one pure function in
`lib/` that answers "who actually taught this lesson," and rewires every payroll/report call site
that currently assumes `coach_id` *is* the teacher to go through that function instead. The
codebase already has the exact discipline this phase must repeat twice: `planMethodChange` (one
guarded path for a money field) and `lesson_groups`' RLS policies (admin-only, no
upsert-vs-insert-policy trap). The one place this phase's guard is *harder* than the
`lesson_groups` precedent is the `bewaak_betaalvelden` trigger: that trigger currently lets "the
coach of this booking" (`old.coach_id = app_user_id()`) change *any* field on his own row with no
further checks. Because D-08 requires `taught_by_id` to be admin-only — including for the coach
whose own lesson it is — the trigger needs a new, earlier check, not an addition to its existing
exclusion list. This is the one non-obvious wrinkle in an otherwise mechanical phase.

The money split itself is simple and already fully supported by existing data shapes: `coach_id`
never changes (whose lesson/roster slot it is, whose agenda it lives in, whose double-booking
check applies); `taught_by_id` is who gets paid, at their own `coach_rates` row. Revenue
(`lib/payments.ts::bookingPrice`/`totalRevenue`) is untouched — it runs on the court's rate and
never reads `coach_id` or `taught_by_id` at all. Only the payroll functions
(`coachPayout`, `totalCoachPayout`, `payoutsByCoach`, `coachPayoutThisMonth`) and one screen-level
filter (`app/coaches/[id].tsx`'s `coachBookings`→`earnedThisMonth` computation) need to switch
their attribution key from `coach_id` to the new function's result.

**Primary recommendation:** Add `bookings.taught_by_id` (nullable, `on delete set null`, admin-only
via a new early check in `bewaak_betaalvelden`), add `lib/lesgever.ts` exporting
`lesgeverId(b): string` (returns `taught_by_id ?? coach_id`) with its test, and change exactly four
functions/call sites in `lib/payments.ts`/`lib/reports.ts`/`app/coaches/[id].tsx` to key off it —
while leaving every agenda/scope/RLS/roster read on `coach_id` untouched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Record who actually taught a lesson | Database (`bookings.taught_by_id` column) | API/Backend (`lib/lesgever.ts` pure function) | The fact is a persisted attribute of the booking row; the *meaning* ("who gets paid") is business logic that must live in exactly one `lib/` function per D-05, never re-derived in a screen or a provider. |
| Enforce "only admin may set it" | Database (RLS trigger `bewaak_betaalvelden`) | Frontend Server/Client (screen hides the field for non-admins) | Per `lib/rechten.ts`'s own header and this codebase's repeated postmortems: the client-side check is UX only, the trigger is the actual enforcement. Both must exist; only the trigger is load-bearing. |
| Compute payout / hours / coach report | API/Backend (`lib/payments.ts`, `lib/reports.ts`) | — | Pure calculation, no I/O, per this repo's `lib/` layering rule. |
| Compute revenue (unaffected by this phase) | API/Backend (`lib/payments.ts::bookingPrice`/`totalRevenue`) | — | Explicitly out of scope per D-06 — included here only to make clear it is a *different* tier of the same file that must NOT be touched. |
| Show "X gave this lesson for Y" | Browser/Client (`components/BookingDetailSheet.tsx`, `components/LessonCards.tsx`) | — | Pure display; reads `lesgeverId`/`taught_by_id` and the two user names, computes nothing. |

## Standard Stack

No new libraries. This phase adds zero external dependencies — same conclusion as Phase 1's
research and threat model (`T-01-SC`). It modifies existing `lib/`, `providers/`, `components/`
files and appends to `supabase-schema.sql`.

### Package Legitimacy Audit

Not applicable — this phase installs no packages. Skipping `slopcheck`/registry verification per
the protocol's own scope (packages only). Nothing to flag, nothing to gate.

## Architecture Patterns

### System Architecture Diagram

```
Admin fills in "wie gaf deze les écht?" on the lesson detail screen (D-08: field only rendered/
editable for an admin user)
        │
        ▼
providers/SimpleDataProvider.tsx :: setTaughtBy(bookingId, coachId | null)
        │  (new provider action, mirrors setPaymentMethod's shape: one guarded write,
        │   NOT part of the generic updateBooking patch type)
        ▼
commit({ ...store, bookings: bookings.map(patch taught_by_id) })
        │
        ▼
lib/sync.ts :: diffStores → upsert on `bookings`
        │
        ▼
supabase-schema.sql :: bookings_update policy (unchanged — admin/coach already allowed to
        │   update the row) → bewaak_betaalvelden trigger (NEW early check: taught_by_id
        │   change requires is_admin(), evaluated BEFORE the existing coach-bypass)
        ▼
Postgres: taught_by_id persisted, or the whole statement rejected with a Dutch exception
        │
        ▼
Every screen reload / next load : providers read `bookings.taught_by_id` back in
        │
        ▼
┌───────────────────────────────┬─────────────────────────────────────────┐
│ Money & hours path             │ Display path                             │
│ lib/lesgever.ts::lesgeverId(b) │ components/BookingDetailSheet.tsx,       │
│  used by:                      │ components/LessonCards.tsx               │
│  - lib/payments.ts::coachPayout│  read booking.coach_id (vaste trainer)   │
│    /totalCoachPayout           │  AND booking.taught_by_id (vervanger)    │
│  - lib/reports.ts::payoutsBy-  │  and show BOTH names when taught_by_id   │
│    Coach/coachPayoutThisMonth  │  is set (D-07) — never one replacing     │
│  - app/coaches/[id].tsx        │  the other                               │
│    earnedThisMonth             │                                           │
└───────────────────────────────┴─────────────────────────────────────────┘
```

A reader can trace the primary case end to end: admin sets the field → one guarded write → one
DB trigger enforces who may write it → every payroll read and every display read pulls from the
same booking row through the one function or the two raw fields, never re-deriving "who taught
this" a second way.

### Recommended Project Structure

No new directories. New/changed files only:

```
lib/
├── lesgever.ts          # NEW — het antwoord op "wie gaf deze les écht", en de enige
│                         # plek die het beantwoordt (D-05)
├── lesgever.test.ts      # NEW — dekking zonder jest.mock, `now`/data als parameter
├── payments.ts           # CHANGED — coachPayout call sites key off lesgeverId
├── reports.ts            # CHANGED — payoutsByCoach groups by lesgeverId; coachPayoutThisMonth
│                          # filters by lesgeverId
├── types.ts              # CHANGED — Booking.taught_by_id
providers/
├── SimpleDataProvider.tsx # CHANGED — setTaughtBy action, updateBooking type gains one more
│                           # excluded field
├── supabaseStore.ts        # unchanged (taught_by_id rides along inside the existing `bookings`
│                            # row upsert — no new table, no new TABLES entry needed)
components/
├── BookingDetailSheet.tsx  # CHANGED — shows vaste trainer + vervanger; admin-only edit control
├── LessonCards.tsx         # CHANGED — short-card label reflects a substitution
supabase-schema.sql         # CHANGED — new column + trigger amendment, appended as
                              # `alter table ... if not exists` block per D-10/TOEG-03
```

### Pattern 1: The single-source query function (D-05), mirroring `planMethodChange`

**What:** One `lib/` function, `lesgeverId`, is the only place "who gets paid for this lesson" is
answered. Everything that computes money, hours, or a coach report imports it; nothing re-derives
it inline.

**When to use:** Any function that today reads `booking.coach_id` for a *payroll* purpose.

**Example (proposed, not yet written — matches this repo's `*.ts` header/JSDoc convention):**
```typescript
// lib/lesgever.ts
//
// "Wie gaf deze les écht" is precies één vraag met precies één antwoord, en dat antwoord
// hoort maar op één plek te staan. `coach_id` blijft altijd "van wie is deze les" — zijn
// agenda, zijn rooster, zijn dubbele-boekingscontrole. `taught_by_id` is de vervanger, leeg
// betekent "de vaste trainer gaf hem zelf" (D-02). Loon, uren en het trainersrapport lezen
// hier, en nergens anders, wie er werkelijk voor de klas — of op de baan — stond. Dezelfde
// discipline als `planMethodChange` in lib/beurtenkaart.ts: het gat dat daar gedicht werd,
// liet een speler twee keer betalen; hier zou het gat de vaste trainer laten uitbetalen voor
// een les die hij niet gaf, of de vervanger niets.

import type { Booking } from './types';

/** De velden die deze vraag nodig heeft; meer weet dit bestand niet van een les. */
export type LesgeverBoeking = Pick<Booking, 'coach_id' | 'taught_by_id'>;

/**
 * Wie deze les werkelijk gaf: de vervanger als die er is, anders de vaste trainer.
 * Dit is de ENIGE plek die deze vraag beantwoordt — zie het kopcommentaar hierboven.
 */
export function lesgeverId(b: LesgeverBoeking): string {
  return b.taught_by_id ?? b.coach_id;
}
```

### Pattern 2: `plan`-prefixed guarded write for an admin-only, payroll-relevant field

**What:** Follow `setPaymentMethod`/`planMethodChange`'s shape exactly: a provider action that is
the *only* way to set `taught_by_id`, with the generic `updateBooking` type excluding the field.

**When to use:** The write path for `taught_by_id`.

**Example (proposed):**
```typescript
// providers/SimpleDataProvider.tsx — context type
/** Wie een les werkelijk gaf. Alleen de beheerder mag dit zetten (D-08); `updateBooking`
 *  sluit `taught_by_id` daarom expliciet uit van zijn type, net als `payment_method`. */
setTaughtBy: (bookingId: string, coachId: string | null) => Promise<void>;
```
No `lib/` "plan" function is strictly required here (unlike `planMethodChange`, there is no
side-effect to reconcile — no card to release, no split to recompute). A direct patch through one
named provider action is sufficient and keeps the discipline: `updateBooking`'s type excludes
`taught_by_id`, so any code path that tries to sneak it through the generic patch fails to
compile, exactly like `payment_method` today.

### Anti-Patterns to Avoid

- **Filtering "this coach's payout" by `coach_id` instead of `lesgeverId`.** This is the single
  most likely regression. `app/coaches/[id].tsx` today does
  `bookings.filter((b) => b.coach_id === coach.id)` and feeds that into
  `coachPayoutThisMonth`/`totalCoachPayout`. If the filter stays on `coach_id`, a substituted
  lesson still counts toward the *assigned* coach's earnings even after `lesgeverId` is
  introduced elsewhere — the bug D-04 explicitly forbids. The fix must change the *filter*, not
  just the internal rate lookup.
- **Adding `taught_by_id` to `bewaak_betaalvelden`'s existing exclusion list.** That list
  (`- 'payment_method' - 'beurtenkaart_id' - 'attendance'`) exists to let *non-admin, non-coach*
  actors (a paying player) touch exactly those columns. Adding `taught_by_id` there would let a
  *player* change who taught the lesson — the opposite of D-08. The correct fix is a new,
  separate `is_admin()` check that runs even for the coach of the booking (see Pitfall/Trigger
  section below) — not a change to the exclusion list.
- **Overwriting `coach_id`.** Explicitly forbidden by D-01/PROJECT.md's own key-decision table;
  see `.planning/research/PITFALLS.md` Pitfall 2 for the full failure mode (roster/agenda
  corruption on top of payroll corruption).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Who gets paid for this lesson" | A second inline `booking.taught_by_id ?? booking.coach_id` ternary in `lib/reports.ts`, `app/coaches/[id].tsx`, or a future export/report screen | `lesgeverId(b)` from `lib/lesgever.ts` | D-05's entire point: two places computing "who taught this" will eventually disagree, exactly as `planMethodChange`'s header warns for payment method. Phase 3 (worklist) and Phase 4 (export "Uren per trainer") both need this same answer — building it once here means they only import it. |
| Admin-only column guard | A brand-new RLS `UPDATE` policy variant just for `taught_by_id` | The existing `bewaak_betaalvelden` trigger, extended with one new check | D-09 says explicitly: "hoort in diezelfde bewaking, niet in een nieuwe ernaast." RLS `UPDATE` policies can't restrict individual columns anyway (documented reason `coach_rates` exists as its own table) — the trigger is the only mechanism this schema already uses for column-level control. |

**Key insight:** Every "don't hand-roll" item here is really the same insight stated twice: this
codebase has already paid for the lesson that two independently-computed answers to the same
question drift apart (`payment_method` bugs, the RLS upsert-vs-insert class of bug). This phase's
entire job is to not repeat that lesson a third time, for coach attribution specifically.

## Common Pitfalls

### Pitfall 1: `bewaak_betaalvelden`'s coach-bypass defeats D-08 unless the new check runs first

**What goes wrong:** The trigger's very first content line is:
```sql
if is_admin() or old.coach_id = app_user_id() then return new; end if;
```
This means the assigned coach of a booking can currently change *any* column on his own row —
time, court, `coach_id` itself — with zero further checks. If a naive implementation simply adds
`taught_by_id` handling *after* this line (e.g., inside the exclusion-list comparison that only
runs for non-coach/non-admin actors), the coach of the lesson would still be able to set
`taught_by_id` on his own booking, directly violating D-08 ("Alleen een beheerder kan invullen
wie de les werkelijk gaf").

**Why it happens:** The `lesson_groups` precedent in this same schema (see the comment directly
above `create table lesson_groups`, lines 909-913) explicitly reasons that `group_id` needs *no*
trigger change specifically *because* "de beheerder en de trainer van de les mogen sowieso al
alles" — i.e., for `group_id`, letting the coach touch it too was fine. It would be easy to
copy that reasoning by analogy for `taught_by_id` and conclude no trigger change is needed. That
reasoning does not transfer: D-08 draws the line at admin-only specifically because the field is
payroll-relevant, and payroll fields in this codebase get a *stricter* line than "coach or admin"
(see `coach_rates`'s own `rates_write` policy, admin-only, no coach exception at all).

**How to avoid:** Add the admin check *before* the existing early return, so it applies
regardless of whether the actor is the booking's own coach:
```sql
if auth.uid() is null then return new; end if;

-- Loongevoelig: alleen de beheerder mag invullen wie de les werkelijk gaf, ook al mag de
-- trainer van de les verder alles aan zijn eigen boeking wijzigen (zie de regel hieronder).
-- Zonder deze vroege controle zou een trainer zichzelf of een collega als vervanger kunnen
-- invullen op zijn eigen les — precies wat D-08 uitsluit.
if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
  raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
end if;

if is_admin() or old.coach_id = app_user_id() then return new; end if;
```

**Warning signs:** A manual test where logging in as the assigned coach and calling
`setTaughtBy` on his own lesson succeeds — it must fail with the Dutch exception above.

**Phase to address:** This phase, in the same schema change that adds the column — the
`alter table ... if not exists` block and the trigger amendment must ship together (D-10 still
requires the user to run it; this phase only writes the SQL as text).

---

### Pitfall 2: Per-coach payout/report filters stay on `coach_id`, silently keeping the old (wrong) attribution

**What goes wrong:** `app/coaches/[id].tsx` filters `bookings` by `b.coach_id === coach.id` and
feeds the result into `coachPayoutThisMonth`. `lib/reports.ts::payoutsByCoach` groups its running
totals by `b.coach_id`. If `lesgeverId` is introduced only inside `coachPayout`'s rate lookup but
the *filtering/grouping key* upstream is left on `coach_id`, the visible symptom is: the report
correctly looks up the substitute's rate, but attributes the resulting amount to the wrong coach's
row (or, worse, sums it twice — once under each coach — if both a `coach_id` grouping and a
`taught_by_id` rate lookup are combined carelessly).

**Why it happens:** `coach_id` is the obvious, already-imported, already-filtered key in every one
of these call sites; `lesgeverId` is a new import that has to be threaded through the *grouping*
step, not just the *rate lookup* step, and those two steps are visually adjacent in the existing
code (`payoutsByCoach`'s `totals.get(b.coach_id)` and `coachPayout(b, coach?.hourly_rate)` sit two
lines apart).

**How to avoid:** Every place that currently does `bookings.filter(b => b.coach_id === X)` or
`totals.get(b.coach_id)` *for a money/hours purpose* must switch the key to
`lesgeverId(b) === X` / `totals.get(lesgeverId(b))`. Concretely, in this codebase that means:
`lib/reports.ts::payoutsByCoach` (grouping key), `lib/reports.ts::coachPayoutThisMonth` (the
`mine = bookings.filter(...)` line), and `app/coaches/[id].tsx`'s `earnedThisMonth` computation
(currently reuses `coachPayoutThisMonth` — fixing the `lib/` function fixes this call site for
free, but the `coachBookings` list used for the *agenda* display on the same screen must NOT be
changed, since that list answers a different question — see Pitfall 3).

**Warning signs:** A test booking with `coach_id = A`, `taught_by_id = B`, run through
`payoutsByCoach([booking], [A, B])`, showing a non-zero `amount` for A or a zero `amount` for B.

**Phase to address:** This phase — this is VERV-02's literal acceptance test
("een test bevestigt dat de vaste trainer niet uitbetaald wordt voor een vervangen les en de
vervanger wel").

---

### Pitfall 3: Conflating "whose agenda/lesson-list is this" with "who gets paid for it"

**What goes wrong:** It's tempting, once `lesgeverId` exists, to also switch `app/coaches/[id].tsx`'s
`coachBookings` (`b.coach_id === coach.id`, used for the upcoming/past lesson lists on a coach's
own profile) or `lib/payments.ts::bookingsFor`/`bookingsByCoach`/`pendingPaymentsFor`/
`bookingsBilledTo` (agenda scope, RLS-mirrored client filters, "who am I billing") to use
`lesgeverId` too, on the reasoning that "it's more correct now." This is explicitly wrong per
D-01/PROJECT.md and the `.planning/research/PITFALLS.md` Pitfall 2 analysis already on file: a
substituted lesson must stay on the *original* coach's agenda/roster (he's still the one whose
slot it is; the roster, the double-booking check against *his* calendar, and RLS `bookings_select`
all correctly key off `coach_id` and must keep doing so). Only the four payroll functions listed
under "The one place" below change.

**Why it happens:** Once one function's key changes, "grep for `coach_id` and consider each hit"
naturally surfaces every non-payroll use too, and without a clear list of which ones are
in-scope, it's easy to touch one that shouldn't move.

**How to avoid:** Keep an explicit, written list (see Research Question 2 below) of exactly which
call sites change, and treat everything else that reads `coach_id` as correctly unchanged.

**Phase to address:** This phase — get the list right once, in the plan, so execution doesn't
improvise it per-file.

## Code Examples

### The full call-site inventory for Research Question 2 ("the one place")

Every place in the codebase (excluding tests) that currently computes or assumes "the coach of
this booking" **for a money or hours purpose** — these are the ones that must switch to
`lesgeverId(b)`:

| # | File : line (approx.) | Current code | Change needed |
|---|------------------------|---------------|----------------|
| 1 | `lib/payments.ts:389` | `export function coachPayout(b: TimedBooking, hourlyRate: number \| undefined)` | No change to the function signature itself — it already takes a rate, not a booking+users. Its *callers* must pass the rate looked up via `lesgeverId`, not `coach_id`. |
| 2 | `lib/payments.ts:421-428` (`totalCoachPayout`) | `coachPayout(b, rateById.get(b.coach_id))` | `coachPayout(b, rateById.get(lesgeverId(b)))`. Note: the *sum total* across an unfiltered set of bookings is unaffected in aggregate correctness — it's the same total money regardless of key — but per-coach attribution downstream (`payoutsByCoach`) depends on this. |
| 3 | `lib/reports.ts:158-183` (`payoutsByCoach`) | `const coach = byId.get(b.coach_id); const row = totals.get(b.coach_id) ?? {...}` | Both the `coach` lookup and the `totals.get`/`totals.set` grouping key must become `lesgeverId(b)`. `row.name`/`missingRate` must reflect the *actual teacher's* record, not the assigned coach's. |
| 4 | `lib/reports.ts:276-284` (`coachPayoutThisMonth`) | `const mine = bookings.filter((b) => b.coach_id === coach.id);` | `bookings.filter((b) => lesgeverId(b) === coach.id)` — this is the line that makes VERV-02's acceptance test pass end-to-end for the profile-screen payout figure. |
| 5 | `app/coaches/[id].tsx:81` (`earnedThisMonth`) | `coachPayoutThisMonth(coach, bookings)` | No change needed at this call site once #4 is fixed inside `lib/reports.ts` — confirms the "one place" discipline is working: fixing the `lib/` function fixes every caller for free. |
| 6 | `app/admin/reports.tsx:83-84` | `totalCoachPayout(shown, users)`, `payoutsByCoach(shown, users)` | No change needed at the call site once #2/#3 are fixed inside `lib/`. |

Call sites that read `coach_id` and must **stay on `coach_id`** (confirmed correct, not to be
touched by this phase):

| File : line | Purpose | Why it stays on `coach_id` |
|---|---|---|
| `lib/payments.ts:192-201` (`bookingsFor`) | "Which lessons are mine" for agenda purposes | Agenda scope, not payroll — a substituted lesson still belongs to the original coach's calendar. |
| `lib/payments.ts:209-214` (`bookingsBilledTo`) | Billing scope for a coach viewing his own pending payments | Billing/collection is about who the *player's* money goes through the club's coach-facing screen for, unrelated to who taught. |
| `lib/payments.ts:232-235` (`bookingsByCoach`) | Trainer-filter dropdown on Agenda/Rapport/Historiek screens | Filtering "show me coach X's schedule" is inherently about the assigned coach, not the substitute — mirrors D-07's requirement to show both, not conflate them. |
| `lib/payments.ts:268-279` (`pendingPaymentsFor`) | Who must chase an open payment | Same reasoning as `bookingsBilledTo`. |
| `app/coaches/[id].tsx:60-67` (`coachBookings`, `upcoming`, `past`) | The lesson list shown on a coach's own profile page | This is "what's on his calendar," not "what he earned" — a substituted-away lesson correctly still shows here as his scheduled lesson (with the substitution visible per VERV-03), it just shouldn't count toward *his* `earnedThisMonth`. |
| `supabase-schema.sql` RLS (`bookings_select`/`update`/`delete`/`insert`) | Row-level access control | Access to the row is about whose lesson it is (`coach_id`), never about who substituted — untouched by this phase. |
| `lib/rechten.ts::magLoonZien` | "May this viewer see that coach's earnings" | Orthogonal permission question — a substitute's own earnings are governed by this same rule keyed on *his* identity, no change needed. |

### The `updateBooking` exclusion pattern, extended

```typescript
// providers/SimpleDataProvider.tsx — context type, current shape (line ~85):
updateBooking: (
  id: string,
  patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split' | 'attendance'>>,
) => Promise<void>;

// Proposed: add 'taught_by_id' to the same Omit union, exactly like the others —
// TypeScript then rejects any detour that tries to smuggle taught_by_id through the
// generic patch object, the same protection payment_method already has.
updateBooking: (
  id: string,
  patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split' | 'attendance' | 'taught_by_id'>>,
) => Promise<void>;
```
Answering Research Question 3 directly: **yes, the same trick applies cleanly and is worth doing.**
It costs one more identifier in an existing union type and buys the same compile-time guarantee
`payment_method` already has — no runtime cost, no new pattern to learn, and it is the literal
form D-05 asks to repeat. The one implementation note: `updateBooking`'s *actual* current
implementation (line ~702) only excludes four fields at runtime type-check time even though the
context-type comment above it lists five (`attendance` is missing from the implementation's own
inline type at line 703) — whoever implements this should fix that pre-existing drift in the same
edit that adds `taught_by_id`, so the interface comment and the implementation signature agree
again.

### The schema change (D-09/D-10) — text only, never executed by this phase

```sql
-- ---------------------------------------------------------------------------
-- Wie gaf de les écht
-- ---------------------------------------------------------------------------

-- Leeg betekent "de vaste trainer (coach_id) gaf de les zelf" (D-02). coach_id verandert
-- hierdoor NOOIT: dat blijft van wie de les is — zijn agenda, zijn rooster, zijn dubbele-
-- boekingscontrole. taught_by_id is alleen het antwoord op "wie stond er echt op de baan",
-- en dat antwoord is de enige plek waar loon, uren en het trainersrapport naar kijken (zie
-- lib/lesgever.ts). `on delete set null`, niet `cascade`: verwijdert de club een trainer die
-- ooit inviel, dan verdwijnt de les niet — hij valt terug op "de vaste trainer gaf hem zelf",
-- precies zoals een lege waarde altijd al betekende.
alter table bookings add column if not exists taught_by_id text references users(id) on delete set null;
create index if not exists bookings_taught_by_idx on bookings (taught_by_id);

-- Loongevoelig: alleen de beheerder mag invullen wie een les werkelijk gaf. Dit hoort bij
-- bewaak_betaalvelden (dezelfde bewaking als payment_method), niet bij een nieuwe trigger
-- ernaast (D-09). Belangrijk: dit MOET vóór de bestaande regel "de trainer van deze les mag
-- alles" komen — die regel is precies waarom group_id destijds GEEN aanpassing nodig had
-- (zie het commentaar boven `lesson_groups` hierboven) en waarom taught_by_id die WEL nodig
-- heeft: de trainer van de les mag hier expliciet niet alles.
create or replace function bewaak_betaalvelden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mijn text[];
  vandaag timestamptz;
begin
  if auth.uid() is null then return new; end if;

  if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
    raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
  end if;

  if is_admin() or old.coach_id = app_user_id() then return new; end if;

  if (to_jsonb(new) - 'payment_method' - 'beurtenkaart_id' - 'attendance')
     is distinct from (to_jsonb(old) - 'payment_method' - 'beurtenkaart_id' - 'attendance') then
    raise exception 'Alleen de betaalwijze en je eigen aanwezigheid mag je zelf wijzigen.';
  end if;

  if (new.payment_method is distinct from old.payment_method
      or new.beurtenkaart_id is distinct from old.beurtenkaart_id)
     and not (old.player_id = app_user_id() or is_mijn_kind(old.player_id)) then
    raise exception 'De betaalwijze zet de speler die de rekening krijgt.';
  end if;

  if new.attendance is distinct from old.attendance then
    vandaag := date_trunc('day', now() at time zone 'Europe/Brussels') at time zone 'Europe/Brussels';
    if old.start_time < vandaag then
      raise exception 'Wie er bij een les uit het verleden stond, noteert de trainer.';
    end if;
    mijn := array(
      select coalesce(app_user_id(), '')
      union
      select child_id from ouder_kind
        where parent_id = app_user_id() and status = 'approved'
    );
    if (coalesce(new.attendance, '{}'::jsonb) - mijn)
       is distinct from (coalesce(old.attendance, '{}'::jsonb) - mijn) then
      raise exception 'Je past alleen je eigen aanwezigheid aan.';
    end if;
  end if;

  return new;
end;
$$;
```
**Important note on this text:** the body above is a `create or replace function` of an
*existing* function — pasting it verbatim into the `alter table ... if not exists` block at the
bottom of `supabase-schema.sql` is safe and idempotent (the file already relies on
`create or replace function` for this exact function), but it must **replace** the current
`bewaak_betaalvelden` definition in place (same function name, same trigger already attached via
`bookings_betaalvelden_bewaakt`) rather than being appended as a second, conflicting definition.
No RLS policy on `bookings` needs any change — `bookings_update`'s `using`/`with check` already
allow the admin and the row's own coach to update the row; the trigger is where column-level
restriction happens in this schema, exactly as it does for `payment_method` today.

### Display (VERV-03/D-07) — smallest change per component

`components/BookingDetailSheet.tsx` (the only screen where a lesson's coach is currently shown in
prose, line 139/307): add a second line only when `booking.taught_by_id` is set — never replace
the "Trainer: {coachName}" line, so the assigned coach's identity is always still visible:
```tsx
const coachName = nameOf(booking.coach_id);
const taughtByName = booking.taught_by_id ? nameOf(booking.taught_by_id) : null;
// ...
<Text style={styles.partyLink}>{t('Trainer')}: {coachName}</Text>
{taughtByName ? (
  <Text style={styles.partyLink}>{t('Vervanger')}: {taughtByName}</Text>
) : null}
```
`components/LessonCards.tsx` (line 66, the short-card label: currently `nameOf(booking.coach_id)`
when viewed by a non-coach): when `taught_by_id` is set, append a short marker rather than
building a second full name lookup line — a compact card has no room for two names, but it must
never *silently* show only the substitute or only the original, per D-07 ("beide namen, niet één
die de andere vervangt"). Smallest change that satisfies D-07 without redesigning the card: show
the assigned coach's name as today, with a small "(vervangen)" suffix that opens the detail sheet
(which does show both names) for the full picture — a card is a summary, the detail sheet is the
source of truth, and D-07's requirement ("waar een les getoond wordt") is satisfied as long as
every place a lesson appears at least indicates a substitution occurred and the full detail is one
tap away. This is Claude's Discretion per CONTEXT.md ("Waar in de schermen de vervanger getoond en
ingevuld wordt") — the recommendation above is the smallest change; the planner may choose to show
both full names on the card too if there's room, but must not choose to show *only* the
substitute's name anywhere, which is the one hard constraint (D-07).

## Storage Wiring

Answering Research Question 7 directly, file by file:

- **`lib/types.ts`**: add `taught_by_id?: string;` to `interface Booking`, directly after
  `coach_id: string;`, with a Dutch doc comment following the `group_id`/`series_id` convention
  (why it's separate from `coach_id`, what empty means, pointer to `lib/lesgever.ts`).
- **`lib/sync.ts`**: **no change needed.** `taught_by_id` is a column on the existing `bookings`
  row, not a new table — it rides along inside the existing `changeFor('bookings', ...)` diff and
  the existing `SyncTable` union already includes `'bookings'`. This is a materially simpler
  wiring job than Phase 1's `lesGroepen` (which needed a whole new `SyncTable` entry, a new
  `before`-fallback key, and a new `TABLES` map entry in `supabaseStore.ts`) — there is no
  four-stop checklist here, only a type change and a provider action.
- **`providers/mockStore.ts`**: **no change needed** for the same reason — `bookings` rows already
  round-trip through `freshSeed`/`withDefaults` as opaque `Booking` objects; a new optional field
  on that type needs no explicit default (`undefined` is the correct "not set" value, matching
  `series_id?`/`group_id?`'s own pattern — no `?? []`-style fallback the way a new *array* field
  needs one).
- **`providers/supabaseStore.ts`**: **no change needed** — `bookings` is already loaded via the
  standard `TABLES.bookings = 'bookings'` / `selectAll<Booking>('bookings')` path (not
  `selectAllOptioneel`, since `bookings` is a foundational table that has always existed — unlike
  `lesson_groups`, there is no "migration might not have run yet" concern for a column on a table
  that's been there since the first schema). The new column simply appears in the selected rows
  once the migration runs, and is `undefined`/`null` on older rows until then, which
  `taught_by_id?: string` already models correctly.
- **`providers/SimpleDataProvider.tsx`**: add one new action, `setTaughtBy(bookingId, coachId |
  null)`, that patches only `taught_by_id` and commits — same shape as `setPaymentMethod` (see
  Pattern 2 above). Extend the `updateBooking` type's exclusion union with `'taught_by_id'`.
  Register the new action in the context type, the context value, and the `useMemo` dependency
  list — the plan's acceptance criteria should grep-check all three, exactly as Phase 1's
  `01-03-PLAN.md` did for its four new actions (that plan's own written warning: "Een vergeten
  regel daar is de meest voorkomende manier waarop een nieuwe actie stilzwijgend nooit op een
  scherm aankomt" applies verbatim here).

**Conflict with Phase 1 changes to the same files:** none found. Phase 1's `01-03-PLAN.md` touches
`lib/sync.ts`, `providers/mockStore.ts`, `providers/supabaseStore.ts`, and
`providers/SimpleDataProvider.tsx` to wire up `lesGroepen` as a *new collection*. This phase's
changes to the same four files are: (a) in `lib/types.ts`, a new optional scalar field on the
*existing* `Booking` interface — additive, does not touch `LesGroep` or `group_id`; (b) in
`SimpleDataProvider.tsx`, one new action alongside (not instead of) Phase 1's four new actions,
and one more entry in `updateBooking`'s existing exclusion union (a line Phase 1 does not touch —
Phase 1 adds `group_id` as a normally-patchable field, not an excluded one). **Sequencing:** this
phase depends on Phase 1 per `ROADMAP.md` and must execute after it lands, but there is no shared
line of code between the two phases' diffs in `lib/sync.ts`/`mockStore.ts`/`supabaseStore.ts` —
Phase 2 simply doesn't touch those three files at all, which removes any merge-order risk for
them. The only file both phases touch is `SimpleDataProvider.tsx`, and their edits are additive
in different, non-overlapping regions (Phase 1's four `lesGroepen` actions vs. this phase's one
`setTaughtBy` action and `updateBooking`'s type).

## Test Strategy

Answering Research Question 8 directly:

**Fixture shape.** Follow `lib/payments.test.ts`'s existing pattern exactly (no `jest.mock`
anywhere in this repo, confirmed by `grep -rn "jest.mock\|jest.fn" lib/*.test.ts` returning zero
hits): plain object literals for `Booking`/`User`, built with a small local factory function the
way `lib/series.test.ts` uses its `week()` helper. A minimal fixture for the core proof:

```typescript
const trainerVast: User = { id: 'u-vast', name: 'Vaste Trainer', role: 'coach', hourly_rate: 20, email: 'v@x.be' };
const trainerVervanger: User = { id: 'u-vervanger', name: 'Vervanger', role: 'coach', hourly_rate: 30, email: 'w@x.be' };
const les = (patch: Partial<Booking> = {}): Booking => ({
  id: 'b-1', player_id: 'p-1', coach_id: trainerVast.id, court_id: 'c-1',
  start_time: '2026-09-10T10:00:00.000Z', end_time: '2026-09-10T11:00:00.000Z',
  status: 'confirmed', payment_method: 'cash', ...patch,
});
```

**The decisive test (VERV-02's own acceptance criterion, made concrete):**
```typescript
describe('lesgeverId', () => {
  it('geeft de vervanger als die gezet is, anders de vaste trainer', () => {
    expect(lesgeverId(les())).toBe('u-vast');
    expect(lesgeverId(les({ taught_by_id: 'u-vervanger' }))).toBe('u-vervanger');
  });
});

describe('payoutsByCoach met een vervanging', () => {
  it('betaalt de vervanger tegen zijn eigen tarief, en de vaste trainer niets voor die les', () => {
    const vervangenLes = les({ taught_by_id: trainerVervanger.id });
    const result = payoutsByCoach([vervangenLes], [trainerVast, trainerVervanger]);
    const vast = result.find((r) => r.coachId === trainerVast.id);
    const vervanger = result.find((r) => r.coachId === trainerVervanger.id);
    expect(vast).toBeUndefined(); // geen enkele les toegerekend aan de vaste trainer
    expect(vervanger?.amount).toBe(30); // één uur tegen ZIJN tarief, niet dat van de vaste trainer
  });
});
```
This directly proves D-04 ("de vaste trainer krijgt niets voor een les die hij niet gaf") and the
"eigen uurtarief" requirement (the amount must be 30, the substitute's rate, never 20).

**Where these tests live:** `lib/lesgever.test.ts` (new, for `lesgeverId` itself — small, pure,
mirrors `lib/series.test.ts`'s size and style) and additions to the existing
`lib/reports.test.ts`/`lib/payments.test.ts` for the call-site changes (not a new file — these are
changes to existing tested functions, and per this codebase's module-design convention a genuinely
new file is only for a genuinely new concern).

**Regression check required:** `payoutsByCoach`/`totalCoachPayout`/`coachPayoutThisMonth`'s
*existing* tests (the ordinary, non-substituted case) must keep passing unchanged — `lesgeverId(b)`
for a booking with no `taught_by_id` returns exactly `b.coach_id`, so all current test fixtures
(which never set `taught_by_id`) are expected to produce byte-identical output. If any existing
test's expected value needs to change to make this phase's tests pass, that is itself a sign the
implementation broke the "leeg betekent de vaste trainer" (D-02) invariant.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 via `jest-expo` ~53.0.0 (pinned to Expo SDK 53) |
| Config file | `package.json` `"jest"` key (`preset: "jest-expo"`) |
| Quick run command | `npx jest lib/lesgever lib/payments lib/reports` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERV-01 | `taught_by_id` can be recorded on a booking without touching `coach_id` | unit | `npx jest lib/lesgever -t "vervanger"` | ❌ Wave 0 — `lib/lesgever.test.ts` new |
| VERV-02 | Payroll/report attribution follows `lesgeverId`, at the substitute's own rate, via one guarded function | unit | `npx jest lib/reports -t "vervanging"` | ❌ Wave 0 — additions to `lib/reports.test.ts` |
| VERV-02 | `coachPayout`/`totalCoachPayout` keyed correctly | unit | `npx jest lib/payments -t "coachPayout"` | ✅ existing tests, extend |
| VERV-03 | Detail sheet shows both names when substituted | manual (screen layer has zero automated coverage in this repo, confirmed in `CONCERNS.md`) | `npm run web`, open a substituted lesson's detail sheet | ❌ no screen tests exist anywhere in this repo — this is consistent with the existing gap, not a new one |
| D-08/D-09 | Non-admin cannot set `taught_by_id`, even the booking's own coach | manual, against a real Supabase project | insert a booking as coach A, attempt `update bookings set taught_by_id = ... where id = ...` as coach A via the app; must be rejected with the Dutch exception | ❌ RLS/trigger behavior is never exercised by Jest in this repo (confirmed: 44 suites, all pure TypeScript, zero database) |

### Sampling Rate

- **Per task commit:** `npx jest lib/lesgever lib/payments lib/reports` + `npx tsc --noEmit`
- **Per wave merge:** `npm test` (full suite, must stay above the current 985+ passing count)
- **Phase gate:** `npm test` green, `npx tsc --noEmit` clean, `npx expo export --platform web`
  succeeds, AND the manual Supabase upsert-and-RLS check below is performed by the user (per
  ROADMAP.md success criterion 4: "met de hand geverifieerd via de upsert-weg").

### Wave 0 Gaps

- [ ] `lib/lesgever.test.ts` — new file, covers REQ VERV-01 (the pure function itself)
- [ ] Additions to `lib/reports.test.ts` — covers REQ VERV-02 (`payoutsByCoach`,
      `coachPayoutThisMonth` with a substitution fixture)
- [ ] Additions to `lib/payments.test.ts` — covers REQ VERV-02 (`totalCoachPayout` with a
      substitution fixture; confirm `bookingPrice`/`totalRevenue` are unaffected — a regression
      test asserting revenue is IDENTICAL whether or not `taught_by_id` is set is worth adding
      explicitly, since D-06 is easy to violate silently)
- [ ] No test framework install needed — `jest`/`jest-expo` already configured and working.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged by this phase — Supabase Auth already in place. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | yes | Postgres RLS (`bookings_update` policy, unchanged) + the new admin-only check inside `bewaak_betaalvelden` (D-08/D-09) — this IS the access-control mechanism for this phase's one new writable field, there is no separate authorization library to reach for. |
| V5 Input Validation | yes | `taught_by_id` is a foreign key to `users(id)`; Postgres itself rejects a non-existent id via the `references` constraint (D-03: "een bestaande trainer, geen vrije tekst" is enforced by the FK, not by app-level validation). No new client-side validation library needed — `<select>`/picker UI should only ever offer existing coach ids, mirroring how `court_id`/`coach_id` pickers already work elsewhere in this app. |
| V6 Cryptography | no | Not applicable — no secrets or crypto involved in this phase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Upsert re-checks INSERT policy on every update, silently rejecting a legitimate write (this codebase's own documented recurring bug class — two prior incidents per `CONCERNS.md`) | Denial of Service | Not applicable to the *new* trigger check itself (it lives in `bewaak_betaalvelden`, a `before update` trigger, not an RLS `INSERT` policy), but the general write path (`lib/sync.ts`'s whole-store upsert) still applies to this column exactly as it does to every other `bookings` column — no new risk introduced, but the manual upsert-as-user-A-then-user-B verification step (ROADMAP success criterion 4) must specifically include a case where an admin sets `taught_by_id` on a booking created by someone else, to confirm the upsert path doesn't silently drop that legitimate admin write. |
| A non-admin bypassing the client-side field hiding by calling the provider action directly (not a real network attacker, but a real risk in a codebase with no automated screen tests) | Elevation of Privilege | `bewaak_betaalvelden`'s new check (Pitfall 1) is the actual backstop — per this codebase's own stated philosophy ("de app is niet de bewaker"), the client hiding the input field for non-admins is UX only and must never be treated as the security boundary. |
| A deleted coach's substitution silently vanishing vs. corrupting history | Tampering / Repudiation | `on delete set null` (not `cascade`) on `taught_by_id`'s foreign key, matching `court_id`'s and `created_by`'s existing pattern — deleting a user who once substituted must not delete the booking, and must fall back cleanly to "the assigned coach taught it" (D-02's own definition of empty) rather than leaving a dangling reference or an exception. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | The column name `taught_by_id` and the function name `lesgeverId`/file `lib/lesgever.ts` are proposals under "Claude's Discretion" (CONTEXT.md explicitly delegates field/function naming), not locked decisions. `taught_by_id` itself is pre-suggested in `ROADMAP.md`'s own Phase 2 success criteria text ("bv. `taught_by_id`"), which raises it above a pure guess but it is still not a `D-` decision. | Column/function naming throughout this document | Low — a naming choice, trivially renamed by the planner/implementer without affecting the architecture. |
| A2 | No RLS `UPDATE`/`SELECT` policy on `bookings` needs modification — only the trigger. This follows from reading the actual `bookings_update` policy text (admin/coach/player/participant already permitted to update the row) combined with the existing column-level pattern (`payment_method` is likewise unguarded at the RLS-policy level and guarded only by the trigger). | Pitfall 1, schema code example | Medium if wrong — if a future reviewer decides RLS should also change, the trigger-only approach still remains correct and necessary; an RLS change would be additive, not a replacement, so this assumption being wrong doesn't invalidate the trigger design, only means it's incomplete. |
| A3 | `providers/supabaseStore.ts`/`mockStore.ts`/`lib/sync.ts` need zero changes because `taught_by_id` is a column on an already-fully-wired table (`bookings`), not a new collection. This is inferred from how `series_id`/`group_id`/`rejected_at`/`created_by` (all optional scalar `Booking` fields added after the table's creation) required no changes to those three files either — confirmed by their absence from Phase 1's `01-03-PLAN.md` wiring checklist (which was needed only because `lesGroepen` is a brand-new top-level collection, unlike a field on an existing one). | Storage Wiring section | Low — this is a structural inference from how every other add-a-field-to-Booking change in this codebase's history was wired, and is easily double-checked with `npx tsc --noEmit` at implementation time (a missed wiring spot for a *field* would surface as a type error at the `Booking` usage site, not a silent runtime gap, unlike a missed *collection* wiring spot). |
| A4 | The smallest-change display recommendation for `LessonCards.tsx` (a short marker + full detail one tap away, rather than two full names on the compact card) satisfies D-07's "beide namen" requirement. D-07's literal text requires both names be *visible*, not necessarily on every single card — but this is an interpretation, not a directly-verified fact. | Code Examples → Display section | Medium — if the planner/user intends "beide namen" to mean literally on the card itself too, the recommended approach under-delivers and needs a wider card layout; flagged explicitly here so discuss-phase/planning can confirm before locking the UI approach. |

## Open Questions

1. **Does a substituted lesson's `earnedThisMonth` on the *substitute's* own profile
   (`app/coaches/[id].tsx`) correctly include lessons where he substituted for someone else,
   given that `coachBookings` (used for the on-screen agenda list on that same page) stays keyed
   on `coach_id`?**
   - What we know: `earnedThisMonth` is computed via `coachPayoutThisMonth(coach, bookings)`,
     which (after this phase's fix) filters `bookings` by `lesgeverId(b) === coach.id` — this
     picks up substituted-in lessons for the substitute correctly, independent of
     `coachBookings`.
   - What's unclear: whether the substitute's *own profile page* should also list the
     substituted-in lesson in its upcoming/past lesson list (`coachBookings`, currently
     `coach_id`-scoped) — today it would NOT appear there, since that list is intentionally
     `coach_id`-scoped per Pitfall 3's own reasoning (it's "whose agenda", not "who taught"), yet
     a substitute might reasonably expect to see the lesson he's covering on his own profile.
   - Recommendation: Out of scope for this phase per the phase boundary text itself ("Wat er NIET
     in zit: de werklijst ... fase 3") — Phase 3's substitution worklist is explicitly where a
     substitute-facing view of "your new lesson" would be designed. This phase should NOT expand
     `coachBookings`'s scope; flag it for Phase 3's own research/planning instead.

2. **Should `magLoonZien` (who may see a coach's earnings) be re-examined for the case where a
   coach substitutes for another — i.e., can the *substitute* see his own earned amount from that
   lesson even though the booking's `coach_id` still points at someone else?**
   - What we know: `magLoonZien(kijker, trainer)` checks `kijker.id === trainer.id || isAdmin`
     against a *user*, not a booking — it's not keyed on `coach_id` at all, so no change is
     needed: the substitute viewing his own profile page already passes `kijker.id ===
     trainer.id` when `trainer` is himself.
   - What's unclear: nothing functionally — this is resolved by the code itself, listed here only
     because Research Question 4 asked specifically to "prove understanding" and this
     confirmation is part of that proof.
   - Recommendation: No action needed; included for completeness of the research record.

## Sources

### Primary (HIGH confidence — read directly in this session)
- `lib/payments.ts` (full file) — `coachPayout`, `totalCoachPayout`, `bookingPrice`,
  `countsAsRevenue`, `lessonShares`, `bookingsFor`/`bookingsByCoach`/`bookingsBilledTo`/
  `pendingPaymentsFor`.
- `lib/reports.ts` (full file) — `payoutsByCoach`, `coachPayoutThisMonth`, revenue/payout
  separation commentary.
- `lib/beurtenkaart.ts` (header + `planMethodChange` neighbourhood) — the guarded-path pattern
  D-05 asks to repeat.
- `supabase-schema.sql` — `bookings` table (lines 63-89), `coach_rates` table (lines 187-197,
  330-345, 560-650), `bewaak_betaalvelden` trigger (lines 391-468), `bookings_select`/`_insert`/
  `_update`/`_delete` policies (lines 704-800), `lesson_groups` table and its own comment
  explaining why `group_id` needed no trigger change (lines 888-941).
- `lib/types.ts` — `Booking` interface (lines 155-215+), `User.hourly_rate` comment explaining the
  `coach_rates` split (lines 85-97).
- `providers/SimpleDataProvider.tsx` — `updateBooking` context type (line 85) and implementation
  (line 702), confirming the type/implementation exclusion-list drift.
- `providers/supabaseStore.ts`, `providers/mockStore.ts`, `lib/sync.ts` — read in the course of
  Phase 1's `01-03-PLAN.md` review to confirm no wiring changes are needed for a scalar field on
  an existing table.
- `components/BookingDetailSheet.tsx`, `components/LessonCards.tsx`, `app/coaches/[id].tsx`,
  `app/admin/reports.tsx` — every current display/computation site for a booking's coach.
- `.planning/phases/02-wie-gaf-de-les-echt/02-CONTEXT.md` — D-01 through D-10, Claude's
  Discretion, Deferred Ideas.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `OPENSTAAND.md` —
  phase scope, money rules, key decisions.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md` — naming/testing
  conventions, documented `bewaak_betaalvelden` fragility, zero screen-test/RLS-test coverage.
- `.planning/research/PITFALLS.md` — Pitfall 2 ("Substitution overwrites `coach_id`") and
  Pitfall 6 (RLS upsert-vs-insert trap), directly informing this phase's trigger design.
- `.planning/phases/01-lesgroepen/01-01-PLAN.md`, `01-03-PLAN.md` — confirmed no line-level
  conflict with this phase's changes to shared files.

### Secondary / Tertiary
None used — this phase's domain is entirely internal to the existing codebase; no external
library or web-sourced claim was needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; the "stack" here is 100% this app's own existing
  `lib/`/`providers/`/`supabase-schema.sql` conventions, verified by direct reading.
- Architecture: HIGH — every pattern proposed (single-function attribution, `updateBooking`
  exclusion, trigger-based admin-only guard) is a direct extension of an existing, already-shipped
  pattern in this same codebase, not a novel design.
- Pitfalls: HIGH for the trigger-bypass and filter-key pitfalls (both derived from reading the
  actual trigger SQL and the actual call sites, not inferred); MEDIUM for the exact UX shape of
  the `LessonCards.tsx` change (Assumption A4) since D-07's "both names visible" requirement
  admits more than one valid card-level design.

**Research date:** 2026-09-05
**Valid until:** No external time pressure (no library versions, no APIs) — valid until Phase 1's
actual implementation lands and can be diffed against the assumptions in the Storage Wiring
section (in particular A3), or until CONTEXT.md's discretion items are locked by discuss-phase/
planning into named decisions.
