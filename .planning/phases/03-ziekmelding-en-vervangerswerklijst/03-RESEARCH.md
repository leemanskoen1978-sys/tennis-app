# Phase 3: Ziekmelding en vervangerswerklijst - Research

**Researched:** 2026-09-05
**Domain:** Sick-leave worklist and substitute-availability computation in a live, brownfield
Expo/React-Native + Supabase tennis-club app. No new dependencies; this is pure composition of
existing `lib/` availability primitives (`boekingstijd.ts`, `vakanties.ts`, `recurrence.ts`) plus
one new admin-only table and one new pure availability function.
**Confidence:** HIGH — every claim below is grounded in the actual source read during this
session (`lib/boekingstijd.ts`, `lib/vakanties.ts`, `lib/recurrence.ts`, `lib/series.ts`,
`lib/period.ts`, `lib/rechten.ts`, `lib/types.ts`, `lib/sync.ts`, `providers/SimpleDataProvider.tsx`
(`overlaps`), `supabase-schema.sql` (`coach_rates`/`rates_write`, `lesson_groups`,
`bewaak_betaalvelden`, `bookings_insert`/`update`), `.planning/phases/02-.../02-RESEARCH.md`,
`.planning/phases/01-.../01-01-SUMMARY.md` and `01-03-SUMMARY.md`, `.planning/research/PITFALLS.md`,
`.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`). Only the exact shape of
`taught_by_id`/`lesgeverId` is unverified in the *codebase* (Phase 2 has not been executed yet —
see Assumption A1) but is HIGH confidence because it is the locked design in Phase 2's own
research and this phase depends on Phase 2 per the roadmap's execution order.

## Summary

This phase adds exactly one admin-only table (`sick_leaves`, or similar — a period on a trainer,
D-01/D-03), one pure availability function in `lib/` that composes three already-correct existing
modules (`lib/boekingstijd.ts`, `lib/vakanties.ts`, and the same overlap predicate already
duplicated once between `lib/recurrence.ts::collides` and `providers/SimpleDataProvider.tsx::overlaps`),
and a worklist screen that lets the admin resolve, per lesson, one of three outcomes (D-05).
Nothing here is exploratory: D-08's five reasons are already individually implemented and tested
elsewhere in this codebase; the only new work is composing them into one function that returns
*why not*, not just *whether*, and wiring one new table through the same four-stop pattern Phase 1
already established for `lesson_groups`.

The single highest-risk decision in this phase is **not** the availability logic — it's what
"zoekt vervanger" (D-06) *is*: a stored status value, a stored boolean, or a derived fact. The
`bookings.status` column has a five-value check constraint already read by every status switch in
the app; widening it is a real migration with real blast radius. The research recommends **not**
adding a status value and instead deriving "zoekt vervanger" from the sick-leave record plus
`taught_by_id`/`coach_id` — see Q5 below for the exact reasoning and the one place this bites
(D-06 also requires the marking to survive a *withdrawn* sick note for lessons *without* a
substitute, which a derived fact naturally handles and a stored boolean would need to unset by
hand).

The second-highest risk is D-07 (a single lesson from a series/group changes without touching the
rest) — this is **already solved** by the existing data model: `bookings` rows in a series/group
are independent rows sharing `series_id`/`group_id` (see `lib/series.ts`, `lib/lesgroepen.ts`);
assigning a substitute is a `taught_by_id` patch on one row, exactly like Phase 2's `setTaughtBy`.
No new "does this affect the series" logic is needed — the danger is only in *provider* code that
naively fans a change out via `seriesFrom`/`groupBookingsFrom` the way a genuine group-roster or
group-schedule edit does. This phase's writes must NOT call those functions.

**Primary recommendation:** One new table `sick_leaves` (period + optional reason on a trainer,
admin-only RLS in `rates_write`'s exact shape), one new pure function
`lib/vervanger.ts::kanVervangen(kandidaat, slot, context)` returning a typed reason enum (not a
boolean) that composes `urenOp`/`boekbaarOp` (working hours + exception periods),
`vakantieOpMoment` (club holidays), the existing overlap predicate (own bookings), and open sick
leaves — and a derived (not stored) "zoekt vervanger" marking computed from
`{ open sick leave covers this lesson } AND { taught_by_id is still null } AND { status !== 'cancelled' }`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Record a sick-leave period on a trainer | Database (`sick_leaves` table) | API/Backend (`lib/ziekmelding.ts` pure validation) | A period-with-reason is a persisted fact about the trainer, structurally identical to `Boekingsperiode`/`Vakantie` — same tier as those. |
| Compute "which lessons are affected" | API/Backend (`lib/ziekmelding.ts`) | — | Pure filter over existing `bookings` + the sick-leave period; no I/O, must be unit-testable per D-11. |
| Compute "can trainer X actually teach slot Y, and why not" | API/Backend (`lib/vervanger.ts`) | — | D-11 is explicit: this belongs in `lib/`, reusable by later phases/screens, with zero store/screen coupling. |
| Resolve one lesson (substitute / mark open / cancel) | API/Backend (provider action, one per outcome) | Browser/Client (worklist row UI) | The decision is business-relevant (payroll via `taught_by_id`, visibility via derived marking) and must go through a guarded provider path, mirroring `setTaughtBy`/`setPaymentMethod`. The screen only presents the three choices; it computes nothing. |
| Enforce admin-only read/write on sick-leave data | Database (RLS `is_admin()` both `using`/`with check`) | Frontend Client (`isAdmin`/`magInElkeAgenda` gate on the screen) | Per `lib/rechten.ts`'s own header: the database is the actual guard; the screen check only prevents offering a dead button. |
| Show the worklist (one row per affected lesson) | Browser/Client (`app/admin/` screen) | — | Pure display over data already computed by `lib/ziekmelding.ts`/`lib/vervanger.ts`. |

## Standard Stack

No new libraries. Same conclusion as Phase 1 and Phase 2: this phase adds zero external
dependencies — it composes existing `lib/` modules and extends `supabase-schema.sql`.

### Package Legitimacy Audit

Not applicable — no packages installed this phase. Skipped per protocol scope.

## User Constraints

<user_constraints>
### Locked Decisions (verbatim from 03-CONTEXT.md)

**De ziekmelding**
- D-01: Een ziekmelding is een periode (van–tot) op een trainer, met eventueel een reden. Niet
  één dag: een griep duurt drie dagen en dat moet je één keer kunnen invoeren.
- D-02: Een ziekmelding is intrekbaar. Lessen die nog geen vervanger hebben, gaan dan terug naar
  de vaste trainer; lessen waar al een vervanger op staat, blijven zoals ze zijn — die afspraak
  is gemaakt.
- D-03: Een ziekmelding is niet hetzelfde als een afwijkende boekingsperiode
  (`users.booking_periods`). Die laatste zegt "hij geeft die weken geen les" en is vooruit
  gepland; een ziekmelding is een gebeurtenis met lessen die al gepland stonden en nu opgelost
  moeten worden. Ze mogen niet in elkaar geschoven worden, maar het vervangersvoorstel moet ze
  allebei kennen.

**De werklijst**
- D-04: Eén ziekmelding levert één werklijst op met alle geraakte lessen van die trainer in die
  periode. Per les: datum, uur, baan, groep of speler, en het aantal spelers.
- D-05: De beheerder kiest per les uit drie dingen: vervanger koppelen, laten staan met de
  markering "zoekt vervanger", of de les afzeggen. Expliciet door de gebruiker gekozen.
- D-06: Een les zonder vervanger blijft zichtbaar gemarkeerd in de agenda én blijft in de
  werklijst staan tot hij is opgelost of afgezegd. Hij verdwijnt nooit stil.
- D-07: Een les uit een reeks (`series_id`) of uit een lesgroep (`group_id`) die een vervanger
  krijgt, raakt de rest van de reeks of de groep niet. Alleen die ene les verandert.

**Het vervangersvoorstel**
- D-08: Voorgesteld worden alleen collega's die dat uur werkelijk kunnen. Alle vijf de redenen
  tellen mee: geen eigen les op dat moment, binnen hun boekingstijden (`working_hours`/
  `working_days`), niet in een afwijkende periode (`booking_periods`), niet in een clubvakantie
  (`vakanties`), en zelf niet ziek gemeld.
- D-09: Trainers die niet kunnen zijn opvraagbaar mét de reden waarom niet.
- D-10: Geen rangschikking op geschiktheid, voorkeur of ervaring. "Kan hij of niet" is genoeg.
- D-11: Het rekenwerk "wie kan dit uur" hoort puur in `lib/`, met een test eromheen — zonder
  store en zonder scherm.

**Toegang en databank**
- D-12: Alleen de beheerder. Een trainer meldt zich niet zelf ziek in deze versie.
- D-13: De nieuwe tabel krijgt admin-only RLS-policies in dezelfde vorm als `coach_rates`
  (`is_admin()` op zowel `using` als `with check`, geen eigenaarschapscontrole), en de
  upsert-weg wordt met de hand nagelopen.
- D-14: Schemawijzigingen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. De gebruiker draait ze zelf. Niets in deze fase mag SQL draaien of de
  productiedatabank aanraken.

### Claude's Discretion
- De vorm van de markering "zoekt vervanger" — een status, een veld, of iets afgeleids.
- De schermindeling van de werklijst.
- Of de ziekmelding een eigen tabel is of een uitbreiding van iets bestaands.

### Deferred Ideas (OUT OF SCOPE)
- Spelers en ouders automatisch verwittigen — de app verstuurt niets.
- Automatisch toewijzen zonder bevestiging.
- Een trainer die zichzelf ziek meldt — v2 (ZIEK-01).
- Inhaallessen voor een afgezegde speler — v2 (INHAAL-01).
</user_constraints>

## Phase Requirements

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|-------------------|
| VERV-04 | Beheerder meldt trainer ziek over een periode (van–tot, eventueel reden). | New `sick_leaves` table (Q1) + `lib/ziekmelding.ts::ziekmeldingFout` validation mirroring `vakantieFout`/`periodeFout`. |
| VERV-05 | Eén werklijst met alle geraakte lessen (datum, uur, baan, groep/speler, aantal spelers). | `lib/ziekmelding.ts::lessenVoorZiekmelding` — enumerated edge cases in Q4; row shape in Q9. |
| VERV-06 | Beheerder kiest per les: vervanger koppelen / "zoekt vervanger" / afzeggen. | Three provider actions in Q9; each a guarded single-row `taught_by_id`/derived-marking/`status` write, never a bulk series/group write (Q4, D-07). |
| VERV-07 | Les zonder vervanger blijft gemarkeerd in agenda en in werklijst tot opgelost/afgezegd. | Derived "zoekt vervanger" fact (Q5) — computed the same way everywhere the lesson is shown, never a value that can silently drift from the sick-leave record. |
| VERV-08 | Vervangersvoorstel toont alleen wie dat uur écht kan: 5 redenen. | `lib/vervanger.ts::kanVervangen` (Q2) composing `boekbaarOp`/`urenOp`, `vakantieOpMoment`, overlap check, sick-leave check. |
| VERV-09 | Niet-beschikbare trainers opvraagbaar mét reden. | `kanVervangen`'s return type is a reason enum, not boolean (Q2) — every candidate gets an entry, never filtered out silently. |
| VERV-10 | Ziekmelding intrekbaar; lessen zonder vervanger terug naar vaste trainer. | Q6 — precise undo rule: delete/close the sick-leave row; no `bookings` row needs any write at all because the marking is derived (Q5), not stored. |
</phase_requirements>

## Standard Stack — table extension

### Core (schema)
| Item | Purpose | Why this shape |
|------|---------|-----------------|
| `sick_leaves` (new table) | One row per ziekmelding: trainer, van, tot, reden, ingetrokken-op | Mirrors `Boekingsperiode`/`Vakantie` shape exactly (D-01, D-03) — same team already knows this pattern. |
| `sick_leaves` RLS (`is_admin()` both clauses) | Admin-only per D-12/D-13 | Copies `rates_write` verbatim — the one policy shape in this codebase already proven safe against the upsert trap (no ownership check to trip it). |

### Supporting (lib)
| Module | Purpose | Reused, not rebuilt |
|--------|---------|----------------------|
| `lib/boekingstijd.ts` (`urenOp`, `boekbaarOp`, `periodeOp`) | Trainer's own hours + exception periods | D-08 reasons 2 & 3 |
| `lib/vakanties.ts` (`vakantieOpMoment`) | Club holiday check | D-08 reason 4 |
| Overlap predicate (currently duplicated: `lib/recurrence.ts::collides` / `providers/SimpleDataProvider.tsx::overlaps`) | Candidate's own existing bookings | D-08 reason 1 — see Pitfall 3 in PITFALLS.md: do not write a *third* copy |
| `lib/series.ts` (`seriesFrom`), `lib/lesgroepen.ts` (`groupBookingsFrom`) | Read-only reference only — NOT called for a substitute assignment | D-07 — a substitute write touches exactly one row |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Derived "zoekt vervanger" | New `bookings.status` value (`'needs_substitute'`) | Requires a migration to the `check` constraint, touches every existing `switch (booking.status)`, and cannot represent "was open, then the sick leave got withdrawn but a lesson already has `taught_by_id='x'`" without extra bookkeeping. Rejected — see Q5. |
| Derived "zoekt vervanger" | New `bookings.needs_substitute: boolean` column | Requires the trigger/RLS/provider to remember to *unset* it on withdrawal (D-02) and on substitute assignment — two more places that can drift out of sync than a pure derivation. Rejected — see Q5. |
| One new `lib/vervanger.ts` composing existing modules | Reimplementing hours/vakantie/overlap checks inline in the worklist screen | Violates D-11 explicitly and repeats the exact bug class flagged in PITFALLS.md Pitfall 3 (a substitute check that "looks right" but silently omits vakanties). |

## Architecture Patterns

### System Architecture Diagram

```
Admin (only — magInElkeAgenda) opens "Ziekmelding" in app/admin/
        │
        ▼
Admin fills in trainer + periode (van–tot) + optional reden
        │
        ▼
lib/ziekmelding.ts :: ziekmeldingFout(trainer, van, tot)   ── validates, no write (D-01)
        │  (pattern: identical shape to vakantieFout/periodeFout)
        ▼
providers/SimpleDataProvider.tsx :: meldZiek(trainerId, van, tot, reden)
        │  (new guarded action — inserts one sick_leaves row, single commit())
        ▼
lib/sync.ts → supabase upsert on `sick_leaves` (admin-only RLS, rates_write shape)
        │
        ▼
lib/ziekmelding.ts :: lessenVoorZiekmelding(bookings, sickLeave, now)
        │  pure filter: bookings of that coach, start_time in [van, tot], status != cancelled,
        │  taught_by_id still null OR already substituted (both shown, D-04/D-07)
        ▼
┌────────────────────────── Werklijst (one row per affected lesson) ──────────────────────┐
│  datum · uur · baan · groep-of-speler · aantal spelers            [D-04]                 │
│  → per rij, drie keuzes (D-05):                                                          │
│      (a) vervanger koppelen  → kanVervangen() suggests candidates, WITH reasons (D-08/09) │
│      (b) laten staan          → geen actie; "zoekt vervanger" blijft afgeleid zichtbaar   │
│      (c) afzeggen             → existing cancel path (bookings.status = 'cancelled')      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
        │ (a) chosen: providers/SimpleDataProvider.tsx :: setTaughtBy(bookingId, coachId)  [Phase 2]
        │      — ONE row patch, never seriesFrom/groupBookingsFrom (D-07)
        ▼
Every screen reload: "zoekt vervanger" is DERIVED, not stored (Q5) —
  zoektVervanger(booking, openSickLeaves) := covered by an open sick-leave AND
  taught_by_id is still null AND status !== 'cancelled'
        │
        ▼
Same derivation feeds: (1) the worklist's own filter, (2) the agenda's visible marker
  (components/BookingDetailSheet.tsx / LessonCards.tsx), (3) VERV-10's withdrawal check —
  one function, three call sites, per this codebase's "one place answers one question" rule.

Withdrawal (VERV-10): admin retracts the sick-leave row (or sets an intrekt-op timestamp).
  No bookings row is touched. Every lesson whose taught_by_id is still null now reads as
  "not sick anymore" the next time zoektVervanger() runs — the derivation itself is the undo.
  Lessons that already have taught_by_id set keep it (D-02) because nothing ever wrote to them
  on the sick-leave's account in the first place.
```

A reader can trace the primary use case end to end: admin marks a coach sick → one pure filter
finds affected lessons → one worklist screen → three explicit per-lesson choices, each going
through an existing or new single-row guarded write → the "zoekt vervanger" fact is never stored
so it can never go stale, and withdrawal is a no-op on `bookings` by construction.

### Recommended Project Structure

```
lib/
├── ziekmelding.ts        # NEW — sick-leave validation + "which lessons are affected" +
│                          # de afgeleide "zoekt vervanger"-vraag (zoektVervanger)
├── ziekmelding.test.ts    # NEW
├── vervanger.ts           # NEW — kanVervangen(kandidaat, slot, context): reason enum, D-08/09/10
├── vervanger.test.ts       # NEW — one test per reason, per D-11
providers/
├── SimpleDataProvider.tsx  # CHANGED — meldZiek, trekZiekmeldingIn (new); reuses setTaughtBy
│                            # from Phase 2 for "vervanger koppelen"; reuses existing cancel
│                            # path for "afzeggen"
├── supabaseStore.ts         # CHANGED — sickLeaves: 'sick_leaves' in TABLES, selectAllOptioneel
├── mockStore.ts              # CHANGED — sickLeaves: SickLeave[] in StoreData/freshSeed/withDefaults
lib/sync.ts                   # CHANGED — 'sickLeaves' added to SyncTable/SyncableStore/diffStores
app/admin/
├── ziekmelding/               # NEW — mirrors app/admin/lesgroepen/ structure
│   ├── index.tsx               # meld een trainer ziek + lijst van actieve/verleden ziekmeldingen
│   └── [id].tsx                 # de werklijst voor één ziekmelding
supabase-schema.sql            # CHANGED — sick_leaves table + admin-only RLS, appended block
```

### Pattern 1: The reason-returning availability function (D-08/D-09)

**What:** One pure function answers "can this coach teach this slot" for every candidate,
returning *why not* when the answer is no — never filtering silently.

**When to use:** Any substitute-suggestion UI, this phase and later.

**Example (proposed, matching this repo's header/JSDoc convention exactly):**
```typescript
// lib/vervanger.ts
//
// "Wie kan dit uur echt vervangen" is precies vijf vragen (D-08), en het antwoord op elke
// vraag bestaat al ergens in lib/ — dit bestand bouwt niets opnieuw, het stelt de vijf
// vragen na elkaar en onthoudt welke het eerst nee zei. Nooit een collega stil wegfilteren
// (D-09): een lijst die iemand zonder reden weglaat is een lijst waar de beheerder aan gaat
// twijfelen of de app het wel goed ziet.

import type { Booking, Boekingsperiode, User, Vakantie } from './types';
import { urenOp, periodeOp, type BoekingsTrainer } from './boekingstijd';
import { vakantieOpMoment } from './vakanties';

export interface VervangerSlot {
  start_time: string; // ISO
  end_time: string;   // ISO
}

/** Waarom een collega niet kan, of dat hij wél kan. Nooit stil weglaten — zie D-09. */
export type VervangerReden =
  | 'kan'
  | 'eigen_les'       // botst met een bestaande les van hemzelf
  | 'buiten_uren'     // valt buiten working_hours/working_days op die dag
  | 'afwijkende_periode' // een booking_periode zegt "geen les" op dat moment
  | 'clubvakantie'    // de club is dicht
  | 'zelf_ziek';      // hij heeft zelf een open ziekmelding die dit moment dekt

export interface VervangerUitkomst {
  coach: Pick<User, 'id' | 'name'>;
  reden: VervangerReden;
}

/** De velden die deze vraag van een ziekmelding nodig heeft. */
export type OpenZiekmelding = { coach_id: string; van: string; tot: string };

/**
 * Kan deze collega dit specifieke, al bestaande lesuur overnemen? Vijf vragen, in vaste
 * volgorde — de eerste die nee zegt, wint (D-08). Geen rangschikking op geschiktheid
 * (D-10): dit geeft precies één reden terug, geen score.
 */
export function kanVervangen(
  kandidaat: BoekingsTrainer & Pick<User, 'id' | 'name'>,
  slot: VervangerSlot,
  bestaandeLessen: Booking[],
  vakanties: Vakantie[],
  openZiekmeldingen: OpenZiekmelding[],
  clubEinde: string,
): VervangerUitkomst {
  const dag = new Date(slot.start_time);

  // 1. Zelf niet ziek gemeld op dit moment.
  const dagStr = slot.start_time.slice(0, 10);
  if (openZiekmeldingen.some((z) =>
    z.coach_id === kandidaat.id && z.van <= dagStr && dagStr <= z.tot)) {
    return { coach: kandidaat, reden: 'zelf_ziek' };
  }

  // 2 & 3. Binnen zijn boekingstijden, en geen afwijkende periode die "geen les" zegt.
  const uren = urenOp(kandidaat, dag, clubEinde);
  if (uren === null) {
    const periode = periodeOp(kandidaat, dag);
    return { coach: kandidaat, reden: periode ? 'afwijkende_periode' : 'buiten_uren' };
  }
  // (uur-vergelijking van slot.start_time tegen uren.start/uren.end hier — zelfde vorm als
  // urenTussen/slotsOp gebruiken, niet een tweede versie van "valt dit uur binnen die uren")

  // 4. Niet in een clubvakantie.
  if (vakantieOpMoment(vakanties, slot.start_time)) {
    return { coach: kandidaat, reden: 'clubvakantie' };
  }

  // 5. Geen eigen les op dat moment — dezelfde botsingsregel als lib/recurrence.ts::collides
  // en providers/SimpleDataProvider.tsx::overlaps. Niet een derde versie schrijven.
  const botst = bestaandeLessen.some((b) => {
    if (b.status === 'cancelled' || b.coach_id !== kandidaat.id) return false;
    const aStart = new Date(slot.start_time).getTime();
    const aEnd = new Date(slot.end_time).getTime();
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  });
  if (botst) return { coach: kandidaat, reden: 'eigen_les' };

  return { coach: kandidaat, reden: 'kan' };
}
```

**Note for the planner:** the overlap check is written inline above rather than imported, because
today `collides`/`overlaps` are private (unexported) in their respective files. The plan should
either (a) export one of them and import it here, or (b) extract a tiny shared
`lib/overlap.ts::botsen(a, b)` that all three call sites (`recurrence.ts`, `SimpleDataProvider.tsx`,
`vervanger.ts`) import — the second option is the more correct fix and directly closes the
already-flagged "two implementations of the same overlap test" risk (PITFALLS.md Pitfall 3)
before a third copy makes it worse. Recommend (b).

### Pattern 2: The derived fact, not the stored flag

**What:** "Zoekt vervanger" is computed on read, from the sick-leave table plus `taught_by_id`,
never written to `bookings`.

**Example (proposed):**
```typescript
// lib/ziekmelding.ts
/**
 * Zoekt deze les nog een vervanger? Geen kolom, geen status — een afgeleid feit uit de
 * ziekmelding zelf (D-06). Dat is precies waarom intrekken (D-02/VERV-10) geen enkele
 * boeking hoeft aan te raken: zodra de ziekmelding weg is, is de vraag hier vanzelf nee.
 */
export function zoektVervanger(
  booking: Pick<Booking, 'coach_id' | 'start_time' | 'status' | 'taught_by_id'>,
  openZiekmeldingen: OpenZiekmelding[],
): boolean {
  if (booking.status === 'cancelled') return false;
  if (booking.taught_by_id) return false;
  const dag = booking.start_time.slice(0, 10);
  return openZiekmeldingen.some((z) =>
    z.coach_id === booking.coach_id && z.van <= dag && dag <= z.tot);
}
```

### Anti-Patterns to Avoid

- **Reimplementing the overlap check a third time inside `lib/vervanger.ts`.** See Pattern 1's
  note — extract a shared helper instead.
- **Calling `seriesFrom`/`groupBookingsFrom` when assigning a substitute.** Those functions exist
  to propagate a *structural* change (the series/group itself changed) forward. A substitute
  assignment is not a structural change to the series/group — it is a one-row `taught_by_id`
  patch. Using them here would silently violate D-07.
- **Storing "zoekt vervanger" as a new `bookings.status` enum value.** Requires a `check`
  constraint migration and touches every existing `switch (status)` in the app (agenda rendering,
  reports, payments) for a fact that's cheaper and safer to derive. See Q5.
- **Suggesting a substitute list that silently omits unavailable colleagues.** D-09 requires every
  candidate to appear, with a reason. `kanVervangen` must be called for every coach, not filtered
  before calling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this coach free at this hour" (working hours + exceptions) | A second copy of the three-layer logic in `boekingstijd.ts` | `urenOp`/`boekbaarOp` from `lib/boekingstijd.ts` | Already correct, already tested, already documents the club→trainer→periode precedence. |
| "Is the club closed that day" | Re-deriving from `Settings.vakanties` inline | `vakantieOpMoment` from `lib/vakanties.ts` | `boekingstijd.ts`'s own header explicitly says vakanties are the *caller's* job — this is that caller. |
| "Do these two time ranges overlap for this coach" | A third inline overlap check | Extract the existing predicate (currently duplicated in `recurrence.ts`/`SimpleDataProvider.tsx`) into one shared helper and import it | Three independent implementations of the same 4-line comparison is exactly the drift risk `recurrence.ts`'s own comment warns about. |
| "Which lessons does a series/group change touch" | New propagation logic for substitutes | Nothing — a substitute assignment never touches more than one row; `seriesFrom`/`groupBookingsFrom` are not called at all in this phase | D-07 requires *no* propagation; the existing model already gives every booking its own row. |

**Key insight:** This phase's entire `lib/` surface is composition, not invention. Every one of
D-08's five reasons already has a correct, tested answer somewhere in this codebase; the risk is
entirely in *forgetting one of the five when composing them* (Pitfall 3 in PITFALLS.md), not in
getting any individual one wrong.

## Common Pitfalls

### Pitfall 1: Composing D-08's five checks and silently dropping one

**What goes wrong:** A `kanVervangen`-equivalent is written that checks working hours and
existing bookings but forgets club vakanties (because `boekingstijd.ts` deliberately excludes them
and reads as "complete" in isolation) or forgets "is the candidate himself sick" (because that
data lives in a brand-new table nothing else references yet).

**Why it happens:** `boekingstijd.ts`'s header explicitly documents that vakanties are excluded on
purpose — a new caller has to know that and add the check itself. The sick-leave table is new in
this exact phase, so there's no existing call site to copy from.

**How to avoid:** Write `lib/vervanger.test.ts` with one test per D-08 reason *before* the
implementation (D-11 asks for a test anyway) — a candidate whose hours cover the slot but who is
on a club vakanti that day; a candidate in an exception `booking_periode` set to "no lessons"; a
candidate with an overlapping booking; a candidate with an open sick leave covering the date; and
the "kan" case with none of the five true. Five red tests, one function, five green tests.

**Warning signs:** A `kanVervangen` implementation that doesn't import `vakanties.ts`, or that
never reads the sick-leave list at all.

### Pitfall 2: Treating "zoekt vervanger" as three different facts in three places

**What goes wrong:** The worklist screen computes "still needs a substitute" one way, the agenda
marker (`BookingDetailSheet.tsx`/`LessonCards.tsx`) computes it another way (e.g. checking a
locally-cached "is this coach currently sick" flag instead of re-deriving), and the two disagree
after a withdrawal.

**Why it happens:** It's tempting to pass a boolean down as a prop once it's been computed for the
worklist, rather than calling `zoektVervanger()` again at every display site.

**How to avoid:** `zoektVervanger()` is the *only* place this question is answered (same discipline
as `lesgeverId`/`planMethodChange`). Every display site calls it fresh against the booking and the
current list of open sick leaves — never passes a cached boolean across a screen boundary.

### Pitfall 3: A substitute-assignment write path that reaches for `updateBooking` directly

**What goes wrong:** "Vervanger koppelen" is implemented as `updateBooking(id, { taught_by_id: x })`
via the generic patch path instead of calling Phase 2's `setTaughtBy` action.

**Why it happens:** By the time this phase is planned, `setTaughtBy` already exists (Phase 2 is a
hard dependency per the roadmap) — but it's an easy shortcut to reach for the generic patch,
especially since the worklist also needs to set other fields (nothing else, in fact — this is the
*only* field a substitute assignment touches).

**How to avoid:** Per Phase 2's own research, `updateBooking`'s TypeScript type excludes
`taught_by_id` specifically so this can't compile. If Phase 2 shipped that exclusion, `tsc` catches
this by construction; if it didn't (verify at plan time — see Assumption A1), this phase's plan
must add the same exclusion or the same guard.

### Pitfall 4 (from PITFALLS.md, reiterated for this phase specifically): RLS upsert trap on `sick_leaves`

**What goes wrong:** Same failure class as `bookings_insert`/`lesson_groups`: a `WITH CHECK`
referencing who created the row would silently reject the admin's own later edit (e.g. adding a
reason after the fact, or setting an "ingetrokken_op" timestamp) via the upsert path.

**How to avoid:** Copy `rates_write` verbatim — `is_admin()` on both `using` and `with check`, no
ownership clause at all. Manually verify: insert a sick-leave row as admin session A, update it
(e.g. add `reden`) as admin session B, confirm it succeeds against a real Supabase project (D-13).

## Runtime State Inventory

Not applicable — this is a greenfield table addition, not a rename/refactor/migration. No
existing runtime state references a "ziekmelding" concept anywhere in the codebase, config, or
external services.

## Research Questions — Answers

### Q1. Where does a sick note live?

**Recommendation: its own table, `sick_leaves`.** D-03 is explicit that a ziekmelding and a
`Boekingsperiode` are different concepts and must not merge — a `Boekingsperiode` is "planned
absence, no lessons ever scheduled for these dates," a ziekmelding is "lessons already exist and
now need resolving." Extending `booking_periods` (a jsonb array on `users`) would also make the
worklist's own "which lessons does this cover, and is it still open" query awkward (jsonb array
scans instead of an indexed table), and would give a *speler-visible* `users` row a payroll/HR-
adjacent field it has no reason to expose (see Security Mistakes in PITFALLS.md re: sick-leave
reasons leaking).

A dedicated table also gives VERV-10 (withdrawal) a natural, cheap implementation: either delete
the row or set a `retracted_at` timestamp (recommend the latter — an audit trail of "this coach
was sick from X to Y, later retracted" is strictly more useful than a silent delete, and costs
nothing).

**Exact schema, as TEXT — never executed by this research or any agent:**

```sql
-- ---------------------------------------------------------------------------
-- Ziekmeldingen
-- ---------------------------------------------------------------------------

-- Een ziekmelding is een periode op een trainer, los van zijn boekingstijden
-- (users.booking_periods) en los van de clubvakanties. Zie D-03 in
-- .planning/phases/03-ziekmelding-en-vervangerswerklijst/03-CONTEXT.md: een
-- boekingsperiode is vooruit gepland ("hij geeft die weken geen les"), een ziekmelding is
-- een gebeurtenis met lessen die al gepland stonden en nu opgelost moeten worden. Ze
-- staan daarom in een eigen tabel, niet als extra velden op `booking_periods`.
--
-- `retracted_at` in plaats van verwijderen: intrekken (D-02/VERV-10) is iets dat gebeurd
-- is en blijft zichtbaar, net zoals `rejected_at` op een boeking. Een ziekmelding met
-- `retracted_at` gezet telt nergens meer mee als "open" — niet in de werklijst, niet in
-- het vervangersvoorstel — maar de rij zelf blijft bestaan.
--
-- Alleen de beheerder ziet en beheert deze tabel — dezelfde grens als `coach_rates` en
-- `lesson_groups`, en om dezelfde reden geen "created_by"-kolom of -conditie. Lees eerst
-- het commentaar boven `bookings_insert` voordat je hier een eigenaarscontrole aan
-- toevoegt: de app schrijft met een upsert en dat brak deze aanpak al twee keer eerder.
create table if not exists sick_leaves (
  id text primary key,
  coach_id text not null references users(id) on delete cascade,
  van date not null,
  tot date not null,
  reden text,
  created_at timestamptz not null default now(),
  retracted_at timestamptz
);

create index if not exists sick_leaves_coach_idx on sick_leaves (coach_id);

alter table sick_leaves enable row level security;

drop policy if exists sick_leaves_select on sick_leaves;
create policy sick_leaves_select on sick_leaves for select
  to authenticated using (is_admin());

drop policy if exists sick_leaves_write on sick_leaves;
create policy sick_leaves_write on sick_leaves for all
  to authenticated using (is_admin()) with check (is_admin());
```

**Confidence:** HIGH for the table-vs-field decision (directly derived from D-03's own stated
reasoning). MEDIUM for the exact column set (`retracted_at` vs. hard delete is a judgment call
left to Claude's discretion per CONTEXT.md — flagged as Assumption A2 below).

### Q2. The availability function

**Signature:**

```typescript
export function kanVervangen(
  kandidaat: BoekingsTrainer & Pick<User, 'id' | 'name'>,
  slot: VervangerSlot,                 // { start_time: ISO, end_time: ISO }
  bestaandeLessen: Booking[],          // all bookings, filtered internally to kandidaat's own
  vakanties: Vakantie[],
  openZiekmeldingen: OpenZiekmelding[], // { coach_id, van, tot } — only non-retracted
  clubEinde: string,                    // Settings.booking_end_time
): VervangerUitkomst;                   // { coach, reden: VervangerReden }
```

See Pattern 1 above for the full implementation sketch. `VervangerReden` is a five-plus-one union
(`'kan' | 'eigen_les' | 'buiten_uren' | 'afwijkende_periode' | 'clubvakantie' | 'zelf_ziek'`) —
this directly satisfies VERV-09/D-09: every candidate produces exactly one `VervangerUitkomst`,
never a silent omission.

**What it composes, not reimplements:**
- `urenOp`/`periodeOp` from `lib/boekingstijd.ts` — reasons 2 & 3 (own hours + exception periods).
- `vakantieOpMoment` from `lib/vakanties.ts` — reason 4 (club holiday).
- The overlap predicate — reason 1 (own existing booking). Recommend extracting the currently
  duplicated `collides`/`overlaps` logic into one shared `lib/overlap.ts` (see Pattern 1 note);
  if the plan chooses not to do this extraction, it must at minimum copy the *exact* comparison
  (`aStart < bEnd && bStart < aEnd`, cancelled bookings excluded) rather than inventing a new one.
- A new, small check against `openZiekmeldingen` — reason 5 (candidate himself sick). This one
  piece is genuinely new; everything else is reuse.

A separate function, `lib/ziekmelding.ts::lessenVoorZiekmelding`, answers "which bookings does
this sick leave affect" (VERV-05) — this is a plain filter over `bookings` (coach + date range +
not cancelled), not part of `kanVervangen`.

### Q3. DST and local time

`lib/recurrence.ts::shiftDays` steps a `Date` by adding to the **day** field only
(`d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), ...`) —
never by adding milliseconds. This is why a 10:00 Tuesday lesson stays at 10:00 across the
March/October DST boundary: `Date`'s day/hour/minute fields are read and written in the *local*
timezone by definition, so incrementing only the day field leaves the wall-clock hour untouched
regardless of how many actual UTC-elapsed hours that day contained (23 or 25).

**What this phase must do to stay consistent:**
- Every date comparison in `lib/ziekmelding.ts` and `lib/vervanger.ts` must compare on the same
  `jjjj-mm-dd` local-day string basis already used by `vakanties.ts::dagSleutel`/`parseDag` and
  `boekingstijd.ts::periodeOpDag` — a sick-leave's `van`/`tot` should be stored and compared as
  `date` (Postgres) / `jjjj-mm-dd` string (TypeScript), exactly like `Vakantie.van`/`.tot` and
  `Boekingsperiode.van`/`.tot`. **Never** convert a sick-leave boundary to a UTC timestamp and
  compare with `.getTime()`.
- The one place an ISO timestamp *is* involved — checking "is this booking's `start_time` within
  the ziekmelding's day-range" — must extract the local day first (`.slice(0, 10)` is safe *only*
  if `start_time` is always constructed via `new Date(y, m, d, h, min).toISOString()` without a
  timezone offset trick; safer to reuse `dagSleutel(new Date(booking.start_time))` from
  `vakanties.ts` rather than string-slicing an ISO value, since `toISOString()` always renders in
  UTC and a late-evening local booking near midnight could shift to the next UTC day). **This is
  a real, concrete trap distinct from the `shiftDays` pattern** — flag it explicitly in the plan's
  test cases.

**Test fixture crossing DST (for `lib/ziekmelding.test.ts`/`lib/vervanger.test.ts`):**
```typescript
// Belgium: last Sunday of March (spring forward, 2027-03-28) and last Sunday of October
// (fall back, 2027-10-31). A sick leave from 2027-03-25 to 2027-04-01 covers a coach's
// two Tuesday-20:00 lessons on 2027-03-30 (post-spring-forward) — both must be found by
// lessenVoorZiekmelding and both must show 20:00 in the worklist, not 19:00 or 21:00.
const ziekmelding = { coach_id: 'c-1', van: '2027-03-25', tot: '2027-04-01' };
const lesVoorDeWissel = les('b-1', '2027-03-23T20:00:00', { coach_id: 'c-1' }); // buiten periode
const lesNaDeWissel = les('b-2', '2027-03-30T20:00:00', { coach_id: 'c-1' });   // binnen periode
```

**Confidence:** HIGH — `shiftDays`'s mechanism is read directly from source; MEDIUM on the exact
midnight-boundary trap (reasoned from the code's own conventions, not independently verified
against a real DST-crossing production booking in this app).

### Q4. The worklist — what counts as "affected," and edge cases

A lesson is **affected** by a sick leave if: `booking.coach_id === sickLeave.coach_id` AND
`booking.start_time`'s local day falls within `[sickLeave.van, sickLeave.tot]` inclusive AND
`booking.status !== 'cancelled'`.

| Edge case | What it should do |
|-----------|---------------------|
| Lesson already cancelled | **Excluded** from the worklist — nothing to resolve; VERV-05 says "geraakte lessen," a cancelled lesson raakt niemand meer. |
| Lesson already has a substitute (`taught_by_id` set, from an earlier resolution or a pre-existing one) | **Included**, per D-04's "alle geraakte lessen" and the roadmap's success criteria #1 ("inclusief lessen uit lesgroepen"). Shown with its current resolution visible (not re-offered the three choices as if unresolved) — the row shows "vervanger: X" and lets the admin change it, rather than defaulting back to "zoekt vervanger." |
| Lesson in a club holiday (`vakantieOpMoment` true for that slot) | **Excluded.** If the club is closed, the lesson was never going to happen regardless of the sick trainer — it's not "affected by the ziekmelding," it's affected by the vakantie. Including it would offer a substitute for a lesson that doesn't occur. |
| Lesson from a group (`group_id` set) | **Included as an individual row** — per D-07, resolving it touches only that one `bookings` row; the group entity itself is never touched. The row's "groep of speler" column (D-04) shows the group name. |
| Lesson from a series (`series_id` set) | **Included as an individual row**, same reasoning as group — resolving one occurrence must never call `seriesFrom` or otherwise propagate. |
| Lesson the sick coach teaches *for another coach* (i.e., this coach is already the `taught_by_id` substitute on someone else's booking, and now *he* is sick) | **Included** — `lessenVoorZiekmelding` must filter on `taught_by_id === sickLeave.coach_id` in addition to `coach_id === sickLeave.coach_id` (an OR), otherwise a lesson this coach is actually going to teach (as someone else's substitute) would be silently missed. This is not explicitly named in D-04 but follows directly from VERV-05's "alle lessen van die trainer in die periode" read as "lessons this trainer would actually be teaching." **Flagged as Assumption A3** — confirm with the user or default to "yes, include" since the safer failure mode is showing one extra row, not silently missing one. |

### Q5. The "zoekt vervanger" marking

**Recommendation: derived, not stored.** Reasoning:

`bookings.status` has a five-value `check` constraint (`pending | confirmed | cancelled |
completed | synchronized`) read by every existing status switch in the app (agenda rendering,
payments, reports). Adding a sixth value means: (1) a migration to the constraint, (2) auditing
every `switch`/`if (status === ...)` in the codebase to confirm it degrades safely for an unknown
new value (CONVENTIONS.md doesn't document a "default" branch convention for this — real risk),
and (3) deciding how "zoekt vervanger" composes with the *existing* five values (is a
zoekt-vervanger lesson still 'confirmed'? What if it's also 'pending'?). A parallel boolean column
avoids the constraint migration but still requires the write path to remember to *unset* it in two
places: when a substitute is assigned, and when the sick leave is withdrawn (D-02) — two more
places for the "two things that must stay in sync" bug class already flagged twice in this
codebase's own history (PITFALLS.md, CONCERNS.md).

A **derived fact** — `zoektVervanger(booking, openZiekmeldingen)` (Pattern 2 above) — has none of
these costs: it reads `sick_leaves` (already the source of truth) and `booking.taught_by_id`
(already the source of truth for "is this resolved"), and is automatically correct the instant a
sick leave is withdrawn, with zero writes to `bookings`. This is the same "one function answers
one question" discipline already established for `lesgeverId` (Phase 2) and `seriesFrom`/
`groupBookingsFrom` (Phase 1).

**The one place this needs care:** every screen that shows a booking (agenda, `LessonCards.tsx`,
`BookingDetailSheet.tsx`) needs `openZiekmeldingen` available to call `zoektVervanger`. This is a
new cross-cutting read (like `vakanties` already is for the booking screens) — the provider must
expose `sickLeaves` (or a pre-filtered `openZiekmeldingen`) on the context alongside `bookings`,
the same way Phase 1 had to add `lesGroepen` to `DataShape` for screens to read it (see
01-03-SUMMARY.md's "Auto-fixed Issue 1" — the exact same gap is highly likely to recur here if
not planned for explicitly).

**Confidence:** HIGH — this is a direct application of a pattern (derive, don't store) already
proven three times in this exact codebase (`lesgeverId`, `seriesFrom`, `groupBookingsFrom`), and
avoids a `check`-constraint migration with a wide, hard-to-fully-audit blast radius.

### Q6. Withdrawing a sick note (D-02/VERV-10)

**Exact rule:** Set `sick_leaves.retracted_at = now()` on that one row (or delete it — see
Assumption A2). **Nothing else is written.** Specifically:

- **Undone:** The `zoektVervanger()` derivation, on its very next evaluation, no longer returns
  `true` for any lesson that only had "zoekt vervanger" because of this now-retracted sick leave
  (its `openZiekmeldingen` filter excludes retracted rows). This is the entire undo — no
  `bookings` row is touched, per D-02: "Lessen die nog geen vervanger hebben, gaan dan terug naar
  de vaste trainer" is already true, because `coach_id` was *never changed* in the first place
  (Phase 2's D-01: the substitute lives in `taught_by_id`, `coach_id` never overwritten). There is
  no "terugzetten" write to perform — the vaste trainer was always still `coach_id`.
- **Left alone:** Any lesson where `taught_by_id` was already set by an earlier admin decision
  (D-02: "lessen waar al een vervanger op staat, blijven zoals ze zijn — die afspraak is
  gemaakt"). Because `zoektVervanger()`'s first check is `if (booking.taught_by_id) return false`,
  these lessons already read as "resolved" regardless of the sick-leave's retraction status — no
  special-casing needed in the withdrawal action itself.
- **Left alone:** Any lesson that was explicitly cancelled during the worklist flow (VERV-06's
  third option). Retracting the sick leave must never un-cancel a booking — `status: 'cancelled'`
  is a separate, deliberate admin decision that the ziekmelding's existence or non-existence has
  no bearing on.

This is a notably clean answer *because* Q5's recommendation (derive, don't store) was followed —
if "zoekt vervanger" had been a stored boolean, withdrawal would need an explicit sweep to unset
it on every affected `bookings` row, which is exactly the kind of "two places must agree" bug this
codebase has already paid for twice (RLS upsert trap, `payment_method` double-write).

### Q7. Storage wiring (four-stop checklist, using Phase 1's `lesGroepen` as template)

| Stop | `lesGroepen` (Phase 1, for reference) | `sick_leaves` (this phase) |
|------|----------------------------------------|------------------------------|
| 1. `lib/types.ts` | `LesGroep` interface | `SickLeave` interface: `{ id, coach_id, van, tot, reden?, created_at?, retracted_at? }` |
| 2. `lib/sync.ts` | `'lesGroepen'` added to `SyncTable` union, `SyncableStore`, `diffStores`'s `before` fallback (`lesGroepen: []`), and the `tables` array (`changeFor('lesGroepen', ...)`) | `'sickLeaves'` added to all four of the same spots |
| 3a. `providers/mockStore.ts` | `lesGroepen: LesGroep[]` in `StoreData`, `freshSeed()` (`[]`), `withDefaults()` (`data.lesGroepen ?? []`) | `sickLeaves: SickLeave[]` in the same three spots |
| 3b. `providers/supabaseStore.ts` | `lesGroepen: 'lesson_groups'` in `TABLES`, loaded via `selectAllOptioneel<LesGroep>('lesson_groups')` | `sickLeaves: 'sick_leaves'` in `TABLES`, loaded via `selectAllOptioneel<SickLeave>('sick_leaves')` — **use `selectAllOptioneel`, not `selectAll`**, because the migration is user-run (D-14) and the app must load with zero sick leaves until then |
| 4. `providers/SimpleDataProvider.tsx` | Four actions (`addLesGroep`, `updateLesGroep`, `updateLesGroepRoster`, `archiveLesGroep`) + `lesGroepen` exposed on context (`DataShape`) | `meldZiek`, `trekZiekmeldingIn` actions + `sickLeaves` exposed on context — **do not skip the context-exposure step**; 01-03-SUMMARY.md's own "Auto-fixed Issue 1" documents this exact gap being caught only after the fact for `lesGroepen`, so the plan should include it explicitly from the start rather than relying on a self-correction pass |

**What Phase 1 changed that this must not conflict with:** `Booking.group_id` (Phase 1) and
`Booking.taught_by_id` (Phase 2, pending) are both additive, independent columns on the same
`bookings` row this phase reads from — no conflict, but `lessenVoorZiekmelding`'s row shape (D-04:
"groep of speler") must read `booking.group_id` to resolve a group name, exactly as Phase 1's own
`groepSleutel`/group lookups do, rather than re-deriving a group label a second way.

### Q8. RLS

See Q1 for the full `sick_leaves` policy text (`is_admin()` on both `using` and `with check`,
`rates_write` shape, no ownership check). **Manual upsert-trap verification steps** (per D-13):

1. Log in as admin user A (or use the SQL editor authenticated as A). Insert a sick-leave row via
   the app's normal write path (`lib/sync.ts`'s upsert, not a raw `insert`).
2. Log in as a *different* admin user B (or the same admin from a second session/device).
   Update the same row (e.g. add a `reden`, or set `retracted_at`) via the app's normal write path.
3. Confirm the update **succeeds** and is visible on reload. (This is the case
   `rates_write`'s no-ownership-check shape is specifically designed to pass, unlike the fixed
   `bookings_insert` bug.)
4. Separately: log in as a **non-admin** coach or player account and attempt to read/write
   `sick_leaves` directly (e.g. via the Supabase table editor with that session, or by
   temporarily pointing a test script at the anon key with that session's JWT). Confirm both
   `select` and any write are rejected.
5. Record the outcome in the plan's verification checklist — this cannot be automated (no RLS
   coverage in the Jest suite, per CONCERNS.md) and must be a named manual QA step, not implied by
   `tsc`/`npm test` passing.

### Q9. Screen shape

**Where:** `app/admin/ziekmelding/` (new directory, mirroring `app/admin/lesgroepen/`'s existing
structure of `index.tsx` for the list/create screen). `app/admin/index.tsx` gets one new tile
(same pattern as the existing admin tiles, gated by `isAdmin(currentUser)`).

**Two screens, not one wizard:**
- `app/admin/ziekmelding/index.tsx` — form to report a trainer sick (trainer picker, van/tot,
  optional reden) + a list of past/active sick leaves (mirrors `app/admin/vakanties.tsx`'s list
  pattern). Submitting navigates to the worklist for the newly created sick leave.
- `app/admin/ziekmelding/[id].tsx` — the worklist for one sick leave. One row per affected lesson
  (Q4's definition), each row showing (D-04): datum, uur, baan, groep-of-speler-naam, aantal
  spelers. Per row, D-05's three choices are **inline actions on the row itself, not a wizard
  step** — e.g. three `ActionTile`s (reuse `components/ui/ActionTile.tsx` per CONVENTIONS.md's
  "Reusable UI Primitives" section) or a compact button row: "Vervanger koppelen" (opens the
  existing coach-picker, pre-filtered/annotated via `kanVervangen`'s reasons per VERV-08/09),
  "Laten staan" (no-op — the row already shows "zoekt vervanger" and stays that way), "Afzeggen"
  (existing cancel action). Each choice resolves that row immediately and independently — there is
  no "next" button and no multi-step flow, satisfying D-05's "expliciet door de gebruiker gekozen,
  geen van de drie is altijd het juiste antwoord" without forcing a sequential wizard through
  potentially twenty lessons (per CONTEXT.md's "Specific Ideas": rarely more than twenty).

**The vervanger-picker itself:** reuse whatever coach-picker component already exists for
`coach_id` selection (check `components/` for an existing combobox pattern used in
`BookingModal.tsx`/`BookingDetailSheet.tsx`), extended to show `kanVervangen`'s per-candidate
reason inline (e.g. greyed out with the reason as a subtitle, rather than removed from the list) —
this directly satisfies D-09 without inventing a new UI primitive.

### Q10. Scope check — anything really Phase 4/v2 in disguise?

Reviewing VERV-04 through VERV-10 against the deferred list:

- **Nothing found that belongs in Phase 4 (Excel-export).** Phase 4 needs `taught_by_id` (Phase 2)
  for its "Uren per trainer" sheet but has no dependency on the sick-leave table itself — a
  substitute recorded via this phase's worklist is indistinguishable, to Phase 4's export, from
  any other substitute recorded via Phase 2's mechanism directly. No leakage either direction.
- **One item worth flagging as scope-adjacent, not scope-creep:** VERV-09's "opvraagbaar mét de
  reden" implies some UI surface to *view* the unavailable list, not just the available one. This
  is in-scope (D-09 is explicit) but easy to under-scope as "just grey them out" vs. genuinely
  showing the reason text — the plan should treat this as a real UI requirement, not an
  afterthought.
- **Confirmed correctly deferred (already excluded per CONTEXT.md, verified against this
  research):** self-service sick reporting (ZIEK-01, v2) — correctly excluded since D-12 requires
  admin-only; make-up lessons for a cancelled slot (INHAAL-01, v2) — correctly excluded, this
  phase's "afzeggen" option per D-05 needs no make-up logic, it's just `status: 'cancelled'`, same
  as any other cancellation; notifying players/parents — correctly excluded, `lib/contact.ts`
  already establishes the pattern of "the app opens the mail/WhatsApp app, it never sends
  anything," and nothing in VERV-04..10 requires more than that if a "contact the group" affordance
  is ever added as a nice-to-have (not required by any VERV-0x item).
- **No hidden Phase-4/v2 item found.** VERV-04..10 as written map cleanly onto exactly what D-01
  through D-14 describe; the scope is tight.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (`jest-expo` preset, pinned `~53.0.0`) |
| Config file | `package.json` (`"test": "jest"`) — no separate `jest.config.js` found beyond the Expo preset |
| Quick run command | `npx jest lib/vervanger lib/ziekmelding` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERV-04 | Sick-leave period validation (van/tot required, valid dates) | unit | `npx jest lib/ziekmelding -t "ziekmeldingFout"` | ❌ Wave 0 |
| VERV-05 | `lessenVoorZiekmelding` finds exactly the affected lessons, excludes cancelled/vakantie, includes group/series rows individually | unit | `npx jest lib/ziekmelding -t "lessenVoorZiekmelding"` | ❌ Wave 0 |
| VERV-06 | Each of the three per-lesson resolutions writes exactly one guarded change (`setTaughtBy` / no-op / cancel) and never propagates via `seriesFrom`/`groupBookingsFrom` | unit (provider-adjacent logic kept in `lib/` where possible; the provider wiring itself is manual-QA per this codebase's existing pattern — see CONCERNS.md "No screen-level tests at all") | `npx jest lib/ziekmelding` + manual smoke test on `app/admin/ziekmelding/[id].tsx` | ❌ Wave 0 (lib) / manual (screen) |
| VERV-07 | `zoektVervanger()` returns true only while unresolved and the sick leave is not retracted; false once `taught_by_id` is set or the sick leave is retracted | unit | `npx jest lib/ziekmelding -t "zoektVervanger"` | ❌ Wave 0 |
| VERV-08 | `kanVervangen()` returns the correct reason for each of the five D-08 conditions, independently | unit | `npx jest lib/vervanger` | ❌ Wave 0 |
| VERV-09 | Every candidate coach appears in the suggestion list, with a reason if unavailable — never silently filtered | unit | `npx jest lib/vervanger -t "geen kandidaat valt stil weg"` | ❌ Wave 0 |
| VERV-10 | Withdrawing a sick leave: `zoektVervanger()` flips to false for unresolved lessons, stays whatever it was for resolved/cancelled lessons | unit | `npx jest lib/ziekmelding -t "intrekken"` | ❌ Wave 0 |
| DST regression (VERV-05/08 correctness) | A sick leave spanning the March/October DST boundary finds the correct lessons with unchanged local hours | unit (fixture) | `npx jest lib/ziekmelding -t "zomertijd"` | ❌ Wave 0 |
| RLS upsert trap on `sick_leaves` | Insert as admin A, update as admin B, succeeds; non-admin read/write rejected | manual | See Q8 steps 1-5 | manual only — no automated harness exists (CONCERNS.md: zero RLS test coverage) |

### Sampling Rate
- **Per task commit:** `npx jest lib/vervanger lib/ziekmelding` (fast, ~seconds)
- **Per wave merge:** `npm test` (full suite, currently 1024+ tests)
- **Phase gate:** Full suite green, `npx tsc --noEmit` clean, `npx expo export --platform web`
  succeeds, and the manual RLS upsert verification (Q8) is explicitly recorded as done — before
  `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `lib/ziekmelding.ts` + `lib/ziekmelding.test.ts` — does not exist yet.
- [ ] `lib/vervanger.ts` + `lib/vervanger.test.ts` — does not exist yet.
- [ ] Decide and implement the shared overlap helper extraction (Pattern 1 note) before writing
      `lib/vervanger.ts`'s reason-5 check, to avoid a third divergent copy.
- [ ] `SickLeave` type in `lib/types.ts` — does not exist yet.
- Framework install: none — Jest/`jest-expo` already configured and used by 1024+ existing tests.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (unchanged) | Existing Supabase Auth / `app_user_id()`, untouched by this phase |
| V3 Session Management | No (unchanged) | — |
| V4 Access Control | Yes | `is_admin()` RLS on `sick_leaves` (both `using`/`with check`), `magInElkeAgenda`/`isAdmin` gate on the screen — same dual-layer pattern as every other admin-only table in this codebase |
| V5 Input Validation | Yes | `ziekmeldingFout` mirrors `vakantieFout`/`periodeFout`'s validation shape: reject unparseable dates, allow "not yet finished typing" states without crashing |
| V6 Cryptography | No | Not applicable — no secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| RLS upsert-vs-insert-policy silent rejection (documented twice already in this codebase) | Denial of Service (legitimate write silently fails) | Copy `rates_write`'s no-ownership-check shape exactly; manual upsert verification per Q8 |
| Sick-leave reason (health-adjacent data) exposed beyond admin | Information Disclosure | `sick_leaves_select` restricted to `is_admin()` only — no coach/player-facing read policy at all, per D-12 and PITFALLS.md's explicit Security Mistakes entry on this exact risk |
| A non-admin reaching the worklist screen via a stale UI state or direct route | Elevation of Privilege (UI-only, backstopped by RLS) | Screen-level `isAdmin(currentUser)` gate (client convenience only) + RLS as the actual enforcement — same dual pattern as `app/admin/leden.tsx` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Phase 2's `taught_by_id` column and `setTaughtBy`/`lesgeverId` exist and match 02-RESEARCH.md's design by the time Phase 3 is planned/executed. | Throughout — this phase's "vervanger koppelen" write path assumes `setTaughtBy` already exists. | If Phase 2 shipped a different field name, function name, or guard shape, every reference to `taught_by_id`/`setTaughtBy` in this research needs a find-replace at plan time. Low risk of the *concept* being wrong (D-01 in Phase 2's context locks the shape), moderate risk of exact naming drift. |
| A2 | `sick_leaves.retracted_at` (soft-close) is preferred over hard-deleting the row on withdrawal. | Q1, Q6 | If the user/planner prefers a hard delete instead, `zoektVervanger()`'s "open sick leaves" query changes from "not retracted" to "row exists at all" — a small, contained change, not a redesign. |
| A3 | A lesson where the sick coach is *substituting* for someone else (i.e., `taught_by_id === sickLeave.coach_id` on a booking whose `coach_id` is a different, healthy trainer) should also appear in the worklist. | Q4 | If wrong (i.e., only `coach_id` matches should count), the worklist under-reports by omitting a lesson this sick trainer was actually about to teach — a silent gap in exactly the kind of situation VERV-05 exists to prevent. Recommend confirming with the user during plan-check/discuss if not already covered by an existing decision. |
| A4 | The worklist screen structure (`app/admin/ziekmelding/index.tsx` for reporting + `[id].tsx` for the per-sick-leave worklist) is the right split, rather than one combined screen. | Q9 | Low risk — this is explicitly Claude's discretion per CONTEXT.md ("De schermindeling van de werklijst"), so any reasonable split is acceptable; flagged only so the planner knows it's a discretionary choice, not a locked decision. |
| A5 | The overlap-check duplication across `lib/recurrence.ts::collides` and `providers/SimpleDataProvider.tsx::overlaps` should be resolved by extracting a shared helper as part of this phase, rather than copying the logic a third time. | Q2, Pattern 1 | If the plan instead copies the logic a third time (lower short-term effort), the codebase now has three independent overlap implementations that can drift — exactly the risk PITFALLS.md Pitfall 3 already names. Recommend the extraction; flagged as an assumption because it's a scope decision the planner must explicitly make, not something D-01..D-14 dictates. |

## Open Questions

1. **Should `lessenVoorZiekmelding` include lessons where the sick coach is only the substitute
   (`taught_by_id`), not the assigned coach?**
   - What we know: VERV-05's literal wording ("alle lessen van die trainer in die periode") most
     naturally reads as `coach_id` only; the roadmap's Phase 3 success criteria #1 explicitly adds
     "inclusief lessen uit lesgroepen waar die trainer de vaste trainer is" — again `coach_id`
     framing.
   - What's unclear: whether the intent extends to "any lesson this trainer would actually be
     teaching," which would also include lessons where he's the substitute for someone else.
   - Recommendation: Default to including both (Assumption A3) since the cost of a false positive
     (one extra worklist row, easily dismissed) is far lower than the cost of a false negative (a
     lesson silently uncovered because the sick trainer was supposed to sub for it). Confirm
     during plan-check.

2. **Does the RLS/upsert manual verification for `sick_leaves` (Q8) require the second Supabase
   project CONCERNS.md recommends, or can it be done safely against production?**
   - What we know: PITFALLS.md Pitfall 7 explicitly warns against exploratory bulk-write testing
     against production; this phase's writes are single-row and low-volume (a sick-leave row, a
     `taught_by_id` patch), unlike the Excel-import phase's bulk risk.
   - What's unclear: whether the club's admin user is comfortable with two throwaway `sick_leaves`
     rows appearing/disappearing in production during verification, versus standing up a second
     project.
   - Recommendation: Low-volume, easily-cleaned-up manual verification (insert two test rows,
     confirm upsert behavior, delete them) is likely acceptable directly against production for
     this specific narrow check, unlike Excel import — but this is the user's call, not a research
     conclusion. Surface it explicitly at plan time rather than assuming either way.

## Sources

### Primary (HIGH confidence — read directly this session)
- `lib/boekingstijd.ts`, `lib/vakanties.ts`, `lib/recurrence.ts`, `lib/series.ts`, `lib/period.ts`,
  `lib/rechten.ts`, `lib/hub.ts`, `lib/slots.ts`, `lib/sync.ts`, `lib/types.ts` — read in full or
  in relevant part.
- `providers/SimpleDataProvider.tsx` (`overlaps`) — read directly.
- `supabase-schema.sql` — `coach_rates`/`rates_select`/`rates_write`, `lesson_groups` block and
  its comment, `bookings_insert`/`bookings_update`/`bookings_delete`, `bewaak_betaalvelden` — read
  directly.
- `.planning/phases/02-wie-gaf-de-les-echt/02-CONTEXT.md` and `02-RESEARCH.md` — the `taught_by_id`
  design this phase depends on (not yet implemented — see Assumption A1).
- `.planning/phases/01-lesgroepen/01-01-SUMMARY.md`, `01-03-SUMMARY.md` — the actual four-stop
  wiring pattern as executed, including its self-corrected gap (context exposure).
- `.planning/research/PITFALLS.md` — Pitfalls 2, 3, 4, 6, 7 directly inform this phase.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`.
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/PROJECT.md`.
- `.planning/phases/03-ziekmelding-en-vervangerswerklijst/03-CONTEXT.md`.
- `app/admin/` directory listing, `app/admin/leden.tsx`/`leden-import.tsx`/`boekingstijden.tsx`/
  `index.tsx` (grep for `isAdmin` usage pattern).

### Secondary (MEDIUM confidence)
- The exact midnight/UTC-day-boundary trap for `start_time`-to-local-day extraction (Q3) is
  reasoned from this codebase's own stated conventions, not independently reproduced against a
  live booking crossing midnight in this session.

### Tertiary (LOW confidence)
- None — no unverified claims from web search were used; this research is entirely grounded in
  the local codebase and its own planning documents.

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps, composition-only): HIGH — directly verified, zero external
  packages involved.
- Architecture (derived-fact pattern, table shape, four-stop wiring): HIGH — every pattern cited
  is copied from an already-shipped or already-researched precedent in this exact codebase.
- Pitfalls: HIGH for codebase-specific pitfalls (RLS upsert trap, D-07 propagation risk, overlap
  duplication) — all directly grounded in source or in `.planning/research/PITFALLS.md`'s own
  HIGH-confidence codebase-specific findings.
- Phase-2 dependency (`taught_by_id`/`setTaughtBy` exact shape): MEDIUM — Phase 2 has not been
  executed yet at research time; the design is locked in Phase 2's own CONTEXT/RESEARCH but not
  yet verified in actual source.

**Research date:** 2026-09-05
**Valid until:** Effectively tied to Phase 2's completion — re-verify `taught_by_id`/`setTaughtBy`
naming against actual Phase 2 output before finalizing this phase's plan. Otherwise stable
(internal composition of long-stable `lib/` modules); no external dependency to go stale.
