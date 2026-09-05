# Phase 1: Lesgroepen - Research

**Researched:** 2026-09-05
**Domain:** New persistent domain entity (`lesson group`) in an existing Expo/React-Native + Supabase app, admin-only, backing an existing `bookings` table that already carries recurring-series and group-lesson semantics.
**Confidence:** HIGH (all findings grounded in direct reads of this codebase's `lib/`, `providers/`, and `supabase-schema.sql`; no external library research needed — this phase adds no new dependency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Het groepsmodel

- **D-01:** Een lesgroep is een eigen tabel, geen veld op `bookings`. Een groep bestaat los van
  één les: hij heeft een naam, een niveau en een seizoen, en overleeft het verzetten of
  schrappen van een losse les.
- **D-02:** Een les blijft een rij in `bookings`, met een verwijzing naar zijn groep. De hele
  app rekent op `bookings` (agenda, betalingen, afvinken, omzet); een tweede soort les ernaast
  zou al die code splijten. Een les uit een groep moet te verzetten, af te zeggen en af te
  vinken zijn als elke andere les.
- **D-03:** Een groep heeft één vast moment: dag + beginuur. Een club die dezelfde mensen twee
  keer per week laat trainen, krijgt twee groepen. Dit volgt uit de sleutel die fase 5
  gebruikt (`Groep` + weekdag + beginuur) — zie `.planning/IMPORT-SJABLOON.md`, met het bewijs
  uit de echte seizoensplanning erbij.
- **D-04:** Een groep heeft een seizoensperiode (van–tot) en is archiveerbaar aan het einde
  daarvan, zonder de gegeven lessen of hun geschiedenis te raken.
- **D-05:** De lesduur is 60 minuten, als clubinstelling in `club_settings` — niet
  hardgecodeerd en niet per groep. Een wijziging geldt voor nieuw ingeplande lessen en nooit
  met terugwerkende kracht.

### Wijzigen en geschiedenis

- **D-06:** Een wijziging aan een groep (speler erbij of eraf, ander uur, andere trainer) werkt
  door in alle lessen van vandaag en later. Lessen die al geweest zijn blijven staan zoals ze
  waren. Dit is dezelfde regel als `seriesFrom` in `lib/series.ts` — één regel voor twee
  begrippen, en die regel hoort in `lib/` te staan met een test eromheen.
- **D-07:** Elke les houdt zijn eigen deelnemerslijst op het moment van de les
  (`Booking.participant_ids` blijft leidend voor die ene les). De groep is "het roster van nu";
  de boeking is "wie er die dag bij stond". Zonder dit verandert de groepsprijs en de
  aanwezigheid van een oude les zodra iemand vandaag de groep aanpast.
- **D-08:** De groep is nooit een tweede waarheid over een reeds ingeplande les. Bij elke
  vraag over een les die al bestaat, wint de boeking.

### Toegang

- **D-09:** De hele tennisschool-module is voor de beheerder alleen (`users.is_admin`). Een
  gewone trainer houdt zijn eigen agenda en ziet deze schermen niet. Dat houdt de rechtenvragen
  klein: `magInElkeAgenda` in `lib/rechten.ts` regelt dit al.
- **D-10:** Elke nieuwe tabel krijgt admin-only RLS-policies, van meet af aan zo geschreven —
  niet met eigenaarschapscontroles die later moeten worden bijgesteld. De upsert-weg wordt met
  de hand nagelopen: die val heeft dit project al twee keer geraakt en noch `tsc` noch de
  testsuite ziet hem.
- **D-11:** Schemawijzigingen komen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`, met de policies erbij. **De gebruiker draait ze zelf** in de Supabase
  SQL-editor. Geen enkele taak mag aannemen dat de migratie al toegepast is, en niets in deze
  fase mag ongevraagd de productiedatabank aanraken.

### Claude's Discretion

De gebruiker heeft expliciet gezegd dat ik het formaat en de vormgeving bepaal. Vrij in te
vullen bij het plannen:
- De precieze tabel- en kolomnamen, en of het roster een `jsonb`-lijst op de groep is of een
  koppeltabel.
- De schermindeling: lijst van groepen, detail per groep, hoe spelers toegevoegd worden.
  `components/ParticipantPicker.tsx` en `components/LidBewerken.tsx` bestaan al.
- Waar de tegel in `app/admin/index.tsx` komt te staan en onder welke groep ("Club" ligt voor
  de hand).
- Of het inplannen van de lessen van een groep in deze fase al meekomt of pas bij de import.

### Deferred Ideas (OUT OF SCOPE)

- Wachtlijsten en inschrijven op een groep — v2.
- Clubbreed weekraster — v2.
- Trainers die hun eigen groepen beheren — bewust buiten scope, zie D-09.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| GROEP-01 | De beheerder kan een lesgroep aanmaken met naam, niveau, vaste dag en uur, vaste trainer, baan en seizoensperiode (van–tot). | `lesson_groups` table design (RQ1, RQ6 SQL); `lib/lesgroepen.ts::validateLesGroep`; Open Question 2 on required vs. optional coach/court |
| GROEP-02 | De beheerder kan spelers aan een lesgroep toevoegen en eruit halen. | `components/ParticipantPicker.tsx` reuse; `jsonb` roster design (RQ1); `planRosterChange` (Pattern 2) |
| GROEP-03 | De beheerder ziet per lesgroep welke lessen ervan ingepland staan en hoeveel er nog komen. | `bookings.group_id` query (RQ2); `groupBookingsFrom` (RQ4); Scope call (RQ10) — read-only, no scheduler needed |
| GROEP-04 | Een les die uit een lesgroep is ontstaan, verwijst naar die groep en blijft een gewone boeking. | RQ2 (`group_id` FK), RQ3 (group vs. series coexistence); regression tests on `lib/groups.ts`/`lib/series.ts` with `group_id` fixtures |
| GROEP-05 | Een wijziging aan een lesgroep werkt door in alle lessen van vandaag en later; wat geweest is blijft staan. | Pattern 1 (`groupBookingsFrom`), RQ4 (location/reuse), Validation Architecture test map |
| GROEP-06 | Elke les houdt zijn eigen deelnemerslijst op het moment van de les. | Pattern 2 (`planRosterChange`), RQ5 (invariant test), Pitfall 1 |
| GROEP-07 | De beheerder kan een lesgroep archiveren zonder de gegeven lessen of hun geschiedenis te raken. | RQ8 (boolean flag design, what must not change) |
| TOEG-01 | De hele tennisschool-module is bereikbaar vanuit Beheer en alleen zichtbaar voor een beheerder. | `lib/rechten.ts::isAdmin` reuse; Architecture Anti-Patterns (screen-level gate, not just tile); Code Examples |
| TOEG-02 | Elke nieuwe tabel en elk nieuw veld heeft een RLS-policy die schrijven beperkt tot beheerders, ook langs de upsert-weg. | RQ6 (SQL + upsert-trap explanation + manual verification steps); Security Domain |
| TOEG-03 | Alle schemawijzigingen staan als `alter table ... if not exists`-blok, klaar om door de gebruiker gedraaid te worden. | RQ6 SQL block; D-11 compliance note |
</phase_requirements>

## Summary

Phase 1 adds exactly one new persistent entity — a lesson group — to a codebase that already
has two closely related, non-persistent concepts: recurring series (`bookings.series_id`, a
plain shared string, computed on demand by `lib/series.ts::seriesFrom`) and group lessons
(`bookings.participant_ids`, computed on demand by `lib/groups.ts`). The group must not become
a second source of truth for either. The codebase's own architecture — pure `lib/` rule
modules, a single `SimpleDataProvider` snapshot, two storage backends (`mockStore`/
`supabaseStore`) that must both be updated for any new table, and a dual-guard permission model
(client check in `lib/rechten.ts` + real enforcement in Postgres RLS) — dictates the shape this
new entity must take, and the codebase has already hit the exact RLS upsert trap this phase
must avoid, twice, on file (`supabase-schema.sql` lines ~726-749 above `bookings_insert`).

The right shape: `lesson_groups` as its own table (D-01, confirmed), holding a `jsonb` roster
array (matching the codebase's own stated convention for lists that only have meaning as a
whole — see `supabase-schema.sql`'s design-note #3), keyed on `naam + weekdag + beginuur`
(D-03, matches `.planning/IMPORT-SJABLOON.md`), with lessons remaining ordinary `bookings` rows
that carry a new `group_id` column (D-02). The "changes apply from today forward" rule (D-06)
is a generalization of `seriesFrom`'s existing filter-and-sort pattern and should be extracted
into a small, shared `lib/vanaf-vandaag.ts` (or similar) helper that both `seriesFrom` and a new
`groupBookingsFrom`-style function can call, rather than being reimplemented from scratch.
Point-in-time roster integrity (D-07/D-08) is enforced entirely by never writing to a past
booking's `participant_ids` and by treating the group roster purely as "the plan for the next
lesson to be generated" — a design already proven safe by how `participant_ids` behaves today.

**Primary recommendation:** Add `lesson_groups` as a new table with a `jsonb` player-id array
for the roster, add a nullable `group_id text references lesson_groups(id)` column to
`bookings`, write one new pure module `lib/lesgroepen.ts` (group CRUD invariants + the
"forward from today" propagation rule reusing `seriesFrom`'s pattern) with its full test suite,
extend `SyncTable`/`StoreData`/`diffStores` the same way `relaties`/`ouder_kind` was added, and
write the new table's RLS policies exactly like `coach_rates`'s `rates_write` (`is_admin()` on
both `USING` and `WITH CHECK`, no creator/ownership check at all) — which is provably immune to
the upsert trap because it has no notion of "creator." Scheduling the group's own lessons
(generating `bookings` rows for a season) is **out of scope for this phase** — recommend
deferring to Phase 5 (import), with this phase instead supporting **manual, one-lesson-at-a-
time** linking of an existing/new booking to a group (needed to satisfy GROEP-03's "which
lessons are planned" view without building a second recurrence engine here).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Group CRUD (name, level, day/hour, coach, court, season) | `lib/` (pure validation) + `providers/` (storage) | Database (RLS) | Follows existing pattern: `lib/` validates/computes, `providers/SimpleDataProvider.tsx` orchestrates one `commit()`, Postgres RLS is the real enforcer |
| Roster edit (add/remove player) + "forward from today" propagation | `lib/` (pure function, new `lib/lesgroepen.ts`) | `providers/` (calls it, commits) | Same shape as `seriesFrom`/`planMethodChange`: compute a plan, provider applies it in one snapshot |
| Group → booking link (`group_id`) | Database (`bookings.group_id` column) | `lib/groups.ts`, `lib/series.ts` (unchanged consumers) | `bookings` remains the single lesson record per D-02; existing group/series accessors keep working untouched |
| Access control (admin-only module) | Database (RLS `is_admin()`) | `lib/rechten.ts` (mirrored client check) | Dual-guard pattern already used everywhere else in this app |
| Archiving a group | Database (`lesson_groups.status`/flag) | `lib/lesgroepen.ts` (read-side filter) | No lesson/history data lives on the group row, so archiving never touches `bookings` |
| Lesson duration setting | Database (`club_settings.value` jsonb) | `lib/types.ts` (`Settings` interface) | Exactly the existing `Settings`/`club_settings` mechanism already used for `booking_end_time`, `vakanties` |
| Admin tile / screens | Browser/Client (Expo Router screens) | `components/ParticipantPicker.tsx` (reused) | Pure UI composition; no new architectural tier needed |

## Standard Stack

This phase introduces **no new external dependency**. Everything needed already exists in the
codebase: `@react-native-async-storage/async-storage`, `@supabase/supabase-js`, the hand-rolled
`lib/xlsx.ts` (not needed this phase), `lucide-react-native` for icons. No `npm install` step
applies to this phase's plan.

### Core (existing, reused)
| Module | Purpose | Why it's the standard for this phase |
|--------|---------|---------------------------------------|
| `lib/series.ts` (`seriesFrom`) | "This and every later booking in the same series" | D-06 explicitly names this as the pattern to reuse/parallel |
| `lib/groups.ts` | Per-booking roster math (`participantIdsOf`, `groupSize`, `playsIn`) | Must NOT be duplicated; the new group entity answers a different question ("who is in the group *now*"), not this one ("who was in *this lesson*") |
| `lib/rechten.ts` (`isAdmin`, `magInElkeAgenda`) | Admin-only gating | D-09/TOEG-01 reuse this verbatim, no new permission concept needed |
| `components/ParticipantPicker.tsx` | Multi-select player picker with pill UI | Directly reusable for group roster editing (CONTEXT.md explicitly flags it) |
| `lib/students.ts` (`normalizeName`, `nameExists`) | Name matching | Not needed by this phase's own scope, but the group's player-adding flow can reuse the same combobox/creation pattern as `import-leden.ts` if "add unknown player while editing a group" comes up |

### Supporting (new, small)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/lesgroepen.ts` (new) | Group invariants: roster diff, "forward from today" propagation, key derivation (`naam+weekdag+beginuur`), archive check | Core rule module for this phase; every group-mutation path in `SimpleDataProvider` calls into this, nothing else computes group rules |
| `lib/lesgroepen.test.ts` (new) | Full coverage per Validation Architecture below | Written alongside, no `jest.mock` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsonb` roster array on `lesson_groups` | A `lesson_group_members` join table (`group_id`, `player_id`, PK on the pair) | A join table is queryable/indexable and matches "normalized" instinct, but this codebase's own schema-design note #3 explicitly rejects a join table for "lists that only have meaning as a whole" (the exact phrase used for `participant_ids`, `beurten`, exercises) — the roster is never queried independently of its group, and a join table would need its own RLS policy, its own sync-table entry, and its own upsert-trap audit for zero practical benefit at "a handful of players per group, a few dozen groups" scale |
| Admin-only `is_admin()`-based RLS (no ownership check) | Ownership check (`created_by = app_user_id()`) allowing a coach to manage "their own" groups | D-09 makes the whole module admin-only; an ownership check would also reopen the exact upsert-vs-insert trap this codebase has already been bitten by twice — there is no scenario in this phase's scope where anyone but an admin edits a group |
| Extending `SyncTable`/`diffStores` generically for `lesson_groups` | The `coach_rates` "side-channel" pattern (bespoke load/save function outside `diffStores`) | `coach_rates` needed a side-channel because it splits security from `users` at the row level (a leaky-join problem) and is keyed 1:1 by `coach_id`, not an independent id. `lesson_groups` is a normal id-keyed collection of many rows created/updated/removed over time — exactly what `diffStores`'s generic array-diff mechanism already handles for `users`/`bookings`/`relaties`. Forcing it through the `coach_rates` side-channel would duplicate `changeFor`'s logic for no reason |

**Installation:** none — no new packages this phase.

## Package Legitimacy Audit

Not applicable — this phase adds zero external packages. No `slopcheck`/registry verification
required.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌───────────────────────────────────────────┐
                     │   app/admin/lesgroepen/  (new screens)     │
                     │   list → group detail → roster edit        │
                     └───────────────┬─────────────────────────────┘
                                     │ useSimpleData()
                                     ▼
        ┌────────────────────────────────────────────────────────────┐
        │   providers/SimpleDataProvider.tsx                          │
        │   addLesGroep / updateLesGroep / archiveLesGroep /          │
        │   updateLesGroepRoster  — each: read store, call lib/,      │
        │   commit() once                                             │
        └───────────────┬───────────────────────────┬────────────────┘
                         │ delegates rules to          │ links existing
                         ▼                              ▼
        ┌───────────────────────────────┐   ┌─────────────────────────────┐
        │ lib/lesgroepen.ts (new, pure)  │   │ bookings rows (existing)    │
        │  - validateLesGroep()          │   │  gain group_id column;      │
        │  - lesGroepenFrom() ("forward  │   │  lib/groups.ts, lib/series  │
        │    from today", mirrors        │   │  .ts keep working unchanged │
        │    seriesFrom)                 │   │  on the per-booking copy    │
        │  - rosterDiff()                │   └─────────────────────────────┘
        └───────────────┬───────────────┘
                         │ commit() persists via
                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │  providers/mockStore.ts (StoreData.lesGroepen: LesGroep[])  │
        │  providers/supabaseStore.ts (diffStores via lib/sync.ts,    │
        │  new SyncTable 'lesGroepen' → table 'lesson_groups')        │
        └───────────────┬────────────────────────────────────────────┘
                         ▼
        ┌────────────────────────────────────────────────────────────┐
        │  supabase-schema.sql: lesson_groups table + admin-only RLS  │
        │  (is_admin() on USING and WITH CHECK, no ownership check)   │
        └────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
lib/
├── lesgroepen.ts          # NEW — group invariants, roster propagation, key derivation
├── lesgroepen.test.ts     # NEW — full unit coverage
├── types.ts               # ADD: LesGroep interface; ADD group_id?, and (if D-05 lands here)
│                             lesson_duration_minutes? on Settings
├── sync.ts                # ADD: 'lesGroepen' to SyncTable, StoreChange handling
providers/
├── mockStore.ts            # ADD: lesGroepen: LesGroep[] to StoreData, seed/default handling
├── supabaseStore.ts        # ADD: 'lesGroepen': 'lesson_groups' to TABLES, select in loadFromSupabase
├── SimpleDataProvider.tsx  # ADD: addLesGroep, updateLesGroep, archiveLesGroep,
│                             updateLesGroepRoster actions
app/admin/
├── index.tsx                # ADD one tile under "Club" (or a new "Lesgroepen" tile), admin-only
├── lesgroepen/
│   ├── index.tsx             # NEW — list of groups
│   └── [id].tsx               # NEW — detail: roster, upcoming/given lesson counts, archive action
components/
├── ParticipantPicker.tsx     # REUSE as-is for roster editing (accepts any onChange(ids))
supabase-schema.sql
└── (bottom, alter-table block) lesson_groups table + RLS policies
```

### Pattern 1: "Forward from today" as a generalization of `seriesFrom`

**What:** D-06 requires the exact same temporal rule `seriesFrom` already implements for
recurring series, applied to a different join key (`group_id` on `bookings` instead of
`series_id`).

**When to use:** Any time a group edit (roster, hour, trainer) must decide which existing
`bookings` rows to update.

**Recommended signature** (in `lib/lesgroepen.ts`, or extracted into a small shared helper if
both call sites want it — see Code Examples below):

```typescript
// Source: modeled directly on lib/series.ts::seriesFrom (same file's own pattern)
export type GroupBooking = Pick<Booking, 'id' | 'group_id' | 'start_time' | 'status'>;

/**
 * Alle nog niet-gegeven lessen van een groep, op tijd oplopend: vandaag en later.
 * Zelfde regel als `seriesFrom` in lib/series — "wat geweest is, blijft staan" geldt
 * hier voor de groep net zoals daar voor de reeks. `now` is een parameter (niet
 * `new Date()` intern) om dit met een vaste tijd te kunnen testen, zoals `magLesVerwijderen`
 * dat ook al doet.
 */
export function groupBookingsFrom<B extends GroupBooking>(
  bookings: B[],
  groupId: string,
  now: Date,
): B[] {
  return bookings
    .filter((b) => b.group_id === groupId && new Date(b.start_time).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}
```

**Anti-Patterns to Avoid**
- **Reimplementing the `>=`-boundary / sort logic a third time:** `seriesFrom` already has this
  exact shape; `lib/recurrence.ts`'s own header comment warns explicitly against a second,
  slightly different implementation of a shared temporal rule diverging silently. Keep the two
  functions textually parallel (same comparison operator, same sort direction) even though they
  key off different fields, and cross-reference each other in comments per this codebase's
  convention (`lib/rechten.ts` ↔ `supabase-schema.sql` already does this).
- **Filtering on `status !== 'cancelled'` implicitly:** `seriesFrom` does NOT exclude cancelled
  bookings from "this and later" — a cancelled lesson in the middle of a series still gets
  touched by a series-wide action if the caller wants that. Decide explicitly whether a group
  roster change should also touch a cancelled-but-not-yet-passed booking, and document the
  choice rather than defaulting silently.

### Pattern 2: Roster as "the plan for the next lesson", never edited on old bookings

**What:** The group's `roster` field (jsonb array of player ids) is read only at the moment a
new booking is generated or an existing future booking is explicitly re-synced; it is never
read directly by any screen answering "who is in lesson X" (D-08).

**Example — the invariant to enforce, expressed as the shape of the write path:**

```typescript
// Source: pattern derived from lib/beurtenkaart.ts's plan*() functions (existing convention)
export interface RosterChangePlan {
  /** De groep zoals hij na de wijziging zou zijn. */
  group: LesGroep;
  /** Welke toekomstige boekingen hun participant_ids moeten krijgen bijgewerkt, en naar wat. */
  bookingPatches: Array<{ id: string; participant_ids: string[] }>;
}

export function planRosterChange(
  group: LesGroep,
  newRoster: string[],
  bookings: GroupBooking[],
  now: Date,
): RosterChangePlan {
  const affected = groupBookingsFrom(bookings, group.id, now);
  // De betaler van elke boeking blijft ongemoeid: participant_ids bevat nooit de betaler,
  // zie lib/groups.ts::participantIdsOf. Hier dus alleen de nieuwe extra-spelerslijst
  // doorschrijven naar elke toekomstige les — nooit naar een les die al is geweest.
  return {
    group: { ...group, roster: newRoster },
    bookingPatches: affected.map((b) => ({ id: b.id, participant_ids: newRoster })),
  };
}
```

**Anti-Patterns to Avoid**
- **A screen reading `lesGroep.roster` to answer "who's in this lesson":** `PITFALLS.md`
  Pitfall 1 names this exactly — the answer to "who's in lesson X" is always
  `booking.participant_ids` via `lib/groups.ts`, never the group's own roster field. Extend
  `ARCHITECTURE.md`'s existing anti-pattern entry (currently written for `lib/groups.ts` /
  `lib/series.ts`) to cover `lesGroep.roster` as well.

### Anti-Patterns to Avoid (general)
- **Group replacing `series_id`:** Do not remove or repurpose `bookings.series_id` when adding
  `group_id`. They answer different questions and can coexist on the same row (see Research
  Question 3 below) — a group's generated lessons may still want a `series_id` if they were
  created via `planSeries`-style batch generation later (Phase 5), while `group_id` is what
  makes them "this group's lessons" for roster/level/trainer purposes.
- **A second admin-tile page bypassing `isCoach`/`isAdmin` gating:** `app/admin/index.tsx`
  gates the *entire page* on `isCoach`, then gates individual tiles on `isAdmin` (see the
  `leden` tile). TOEG-01 requires the whole tennisschool module — including the lesgroepen
  list/detail screens themselves, not just the tile — to check `isAdmin`, not `isCoach`. A
  non-admin coach must not be able to deep-link to `/admin/lesgroepen` directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "This and all later X" temporal filtering | A new from-scratch date-comparison function | `seriesFrom`'s exact pattern, generalized into `groupBookingsFrom` (Pattern 1 above) | D-06 explicitly requires reuse; two independently-maintained versions of "this and later" is exactly the divergence risk `lib/recurrence.ts`'s own comments warn about |
| Multi-select player picker UI | A new combobox/pill component for the group roster | `components/ParticipantPicker.tsx` (unchanged, called with the group's roster as `value`) | CONTEXT.md names this explicitly as a reusable asset |
| Group size / "who's really in this lesson" math | A parallel roster-counting function on the group entity | `lib/groups.ts` (unchanged) — the group only ever supplies the *next* booking's `participant_ids`, it never itself answers "how many people are in this lesson" | `lib/groups.ts`'s own header comment: "de verleiding is groot" to recompute this inline; that comment now also applies to the new group entity |
| Admin-only RLS from an ownership check | Any `created_by`/`user_id` clause on `lesson_groups` policies | The `coach_rates` `rates_write` pattern: `for all using (is_admin()) with check (is_admin())` | Zero ownership semantics means zero exposure to the upsert-vs-insert trap; this is the single safest, simplest policy shape available and it's already proven in this schema |
| A new "settings" mechanism for lesson duration | A new table or a new top-level column | `club_settings.value` jsonb, extending the existing `Settings` interface | `booking_end_time` and `vakanties` already live exactly there; D-05 explicitly calls this "a club setting," which in this codebase's vocabulary means `club_settings`, not a new table |

**Key insight:** Every piece of this phase has a structurally identical precedent already in
the codebase (`seriesFrom` for temporal propagation, `ParticipantPicker` for roster UI,
`coach_rates`'s RLS for admin-only tables, `club_settings` for settings). The work is
disciplined reuse, not new design — the highest risk is *not* technical difficulty, it's
accidentally introducing a third, slightly-different version of a pattern that already exists
twice.

## Research Question Answers

### 1. Data model: `jsonb` roster or join table?

**Recommendation: `jsonb` array on the group row**, e.g. `lesson_groups.roster jsonb` (an array
of player id strings), matching `bookings.participant_ids`, `bookings.attendance`,
`users.working_days`/`working_hours`, `courts.group_rates`. `supabase-schema.sql`'s own design
note #3 states the rule this codebase already follows: "lists that only have meaning as a
whole... are jsonb, not a separate table... because they are never queried or changed in
isolation — always together with their lesson or card." A group's roster fits this exactly: it
is only ever read as "all of this group's current players" (for display, for the next
booking's `participant_ids`), never as "give me all groups a given player belongs to" via an
indexed query — with a handful of groups per club, a full scan is trivial. `[CITED:
supabase-schema.sql design note #3]`

This also directly serves Phase 5's import: the import derives a roster per `(Groep, weekdag,
beginuur)` key from flat spreadsheet rows and needs to write "the current set of player ids for
this group" in one shot — a single jsonb write, not N join-table inserts/deletes reconciled
against the previous state. `[ASSUMED: Phase 5's exact write pattern, since Phase 5 is not yet
planned]`

### 2. The link from booking to group

**Recommendation:** `bookings.group_id text references lesson_groups(id) on delete set null`.

Unlike `series_id` (a plain string with **no FK**), `group_id` should be a real foreign key.
The reason `series_id` has no FK is structural: a series is *nothing but* the shared string —
there is no separate "series" row to reference (`ARCHITECTURE.md`: "there is no separate
'series' table/entity"). A group, by contrast, is D-01's whole point: "a group exists as its
own thing... independent of any single lesson." Since `lesson_groups` is a real table with
real rows, referencing it with a proper FK is both possible and safer (Postgres enforces that
`group_id` never points at a deleted/nonexistent group).

**On delete/archive:** `on delete set null` is the correct FK action — but note D-04 already
specifies archiving, not deleting, as the retirement path ("archiveerbaar... zonder de gegeven
lessen of hun geschiedenis te raken"), so `on delete set null` is a safety net for an edge case
(a bad manual `delete` in the SQL editor), not the normal path. The normal path never deletes a
`lesson_groups` row at all. `[VERIFIED: supabase-schema.sql, direct read of existing FK
patterns e.g. `player_id text not null references users(id) on delete cascade`]`

### 3. Group vs series — the highest-risk design question

**Recommendation: the group sits beside `series_id`, owning a different concern; it does not
replace it.**

- `series_id` answers: "which other bookings were created together as one batch, for
  reschedule/cancel-together purposes." It is a pure generation artifact with zero semantic
  content beyond "same batch."
- `group_id` answers: "which persistent group — with a name, level, season, and roster — does
  this lesson belong to, for as long as that group exists, independent of how or when the
  lesson itself was created."

A single booking can plausibly have **both**: a lesson generated as part of a group's weekly
schedule (Phase 5, out of this phase's scope) would naturally get a `series_id` for "all the
lessons created in this one import batch" AND a `group_id` for "which group this recurring slot
belongs to, across multiple import runs and even across a group's edits." Collapsing them into
one field would mean: (a) a group that gets re-imported next season either has to reuse the old
`series_id` (semantically wrong — it's a new batch) or the "group" identity gets lost every
re-import, defeating IMP-06/IMP-07's requirement that re-import recognize the same group;
(b) `seriesFrom`'s existing "this and later" behavior for plain (non-group) recurring series
must keep working completely unchanged for any booking that has a `series_id` but no
`group_id` — mixing the two fields' semantics risks breaking that existing, tested code path.

**Confidence: HIGH** for "keep them separate," **MEDIUM** for the exact interaction in Phase 5
(scheduling), since that phase is not yet planned and the precise `series_id`-assignment
convention for group-generated lessons is a Phase 5 design decision, not this phase's.

### 4. The "forward from today" rule (D-06) — location and reuse

**Location:** `lib/lesgroepen.ts` (new file, per this codebase's "one rule module per concern"
convention — group logic doesn't belong bolted onto `lib/series.ts`, since a group is a
distinct entity, not a series).

**Can it genuinely reuse `seriesFrom`?** Not by direct function call — `seriesFrom` is typed
specifically around `series_id` (`SeriesBooking = Pick<Booking, 'id' | 'series_id' |
'start_time'>`) and its "no `series_id` → returns only itself" fallback is series-specific
semantics that don't apply to a group query. The correct reuse is **structural, not literal**:
write `groupBookingsFrom` (see Pattern 1 above) as a near-identical sibling — same `>=`
comparison, same sort, same "now is a parameter" testing discipline — rather than importing
`seriesFrom` and trying to repurpose it. This matches the codebase's own convention of
duplicating a *pattern* deliberately when the *type* differs (see `lib/beurtenkaart.ts`'s
several independent `plan*()` functions, each its own function despite a shared shape).

**What its test file must cover** (`lib/lesgroepen.test.ts`):
- A booking exactly at `now` is included (`>=`, matching `seriesFrom`'s own boundary choice and
  comment: "een les niet ontsnapt doordat hij toevallig op precies hetzelfde moment begint").
- A booking before `now` is excluded and unaffected by any patch derived from the result.
- A group with zero future bookings returns an empty list (not an error).
- A cancelled-but-future booking's inclusion/exclusion is asserted explicitly, matching
  whatever this phase's plan decides (see Anti-Pattern warning above) — do not leave this
  implicit.
- Sort order is strictly ascending by `start_time` even when input order is scrambled.

### 5. Point-in-time roster (D-07/D-08) — the invariant test

**How it propagates:** Exactly as shown in Pattern 2 above — `planRosterChange` computes
`groupBookingsFrom(bookings, groupId, now)` and produces a patch **only** for that subset. The
provider (`SimpleDataProvider.tsx`) applies `bookingPatches` to `store.bookings` via `.map()`
(matching every other provider action's "compute next snapshot, `commit()` once" shape) and
writes the updated `group.roster` in the same `commit()` — this is one atomic snapshot swap,
consistent with the "Snapshot-atomicity constraint" already documented in `ARCHITECTURE.md`.

**The invariant test that proves a past lesson is unchanged**
(`lib/lesgroepen.test.ts`, the single most important test in this phase):

```typescript
// Pattern: construct a group with bookings both before and after `now`, apply a roster
// change, assert the past booking object is untouched (reference-or-value equality) while
// the future one reflects the new roster.
test('een groepswijziging raakt nooit een les die al geweest is', () => {
  const gisteren = les('b-1', '2026-09-01T10:00', { group_id: 'g-1', participant_ids: ['oud'] });
  const morgen   = les('b-2', '2026-09-10T10:00', { group_id: 'g-1', participant_ids: ['oud'] });
  const plan = planRosterChange(groep('g-1'), ['nieuw'], [gisteren, morgen], new Date('2026-09-05'));
  expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-2']); // niet 'b-1'
});
```

A second test must assert the *price*-relevant consequence: since `groupSize()` (from
`lib/groups.ts`) is computed from `participant_ids`, a past booking's unchanged
`participant_ids` guarantees its price and attendance are unchanged too, without needing a
`lib/lesgroepen.test.ts` test to re-derive pricing logic — it only needs to prove
`participant_ids` itself didn't change, and `lib/payments.ts`'s existing, already-tested price
functions take it from there.

### 6. RLS — the admin-only policy and the upsert trap

**Recommended SQL** (to append to `supabase-schema.sql`'s existing `alter table ... if not
exists` block, following D-11):

```sql
-- Lesgroepen: een blijvend gegeven los van de losse les. Zie D-01/D-02 in
-- .planning/phases/01-lesgroepen/01-CONTEXT.md. Alleen de beheerder ziet en beheert dit —
-- dezelfde grens als coach_rates, en om dezelfde reden hieronder geen "created_by"-check:
-- lees eerst het commentaar boven bookings_insert voordat je hieraan iets verandert.
create table if not exists lesson_groups (
  id text primary key,
  name text not null,
  level text not null,
  weekday int not null check (weekday between 0 and 6),
  start_hour int not null check (start_hour between 0 and 23),
  start_minute int not null default 0 check (start_minute between 0 and 59),
  coach_id text references users(id) on delete set null,
  court_id text references courts(id) on delete set null,
  season_start date not null,
  season_end date not null,
  roster jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table bookings add column if not exists group_id text references lesson_groups(id) on delete set null;
create index if not exists bookings_group_idx on bookings (group_id);

alter table lesson_groups enable row level security;

-- Admin-only, zoals rates_write op coach_rates: `is_admin()` op zowel USING als WITH CHECK,
-- geen "created_by"-conditie. Precies dát ontbreken maakt deze policy immuun voor de
-- upsert-val die bookings_insert twee keer heeft geraakt (zie het commentaar daarboven) —
-- er is hier niets dat verandert al naargelang wie de rij ooit aanmaakte.
drop policy if exists lesson_groups_select on lesson_groups;
create policy lesson_groups_select on lesson_groups for select
  to authenticated using (is_admin());
drop policy if exists lesson_groups_write on lesson_groups;
create policy lesson_groups_write on lesson_groups for all
  to authenticated using (is_admin()) with check (is_admin());
```

**The upsert-vs-insert trap, concretely, for this table:** `providers/supabaseStore.ts` writes
every table via `insert ... on conflict do update` (`lib/sync.ts`'s whole-store diff, then
`.upsert(rows)`). Postgres evaluates the table's **INSERT** policy's `WITH CHECK` clause even
when the conflict path (an update to an existing row) is taken. Because the recommended policy
above checks only `is_admin()` — a fact about *who is asking right now*, never about *who
created the row* — this evaluation is stable under upsert: the same predicate holds whether the
row is being created or updated, by the same or a different admin. This is exactly the pattern
`coach_rates`'s `rates_write` already uses safely. The trap that hit `bookings_insert` twice
occurred only because that policy's `WITH CHECK` included `created_by = app_user_id()` — a
per-row-history fact that a later upsert cannot satisfy for anyone but the original creator.

**Manual verification steps required before this ships** (cannot be caught by `tsc`/Jest,
per D-10/TOEG-02 and `CONCERNS.md`'s explicit call for this):
1. Log in as admin A (or use a scripted `service_role`-free client authenticated as admin A).
   Create a `lesson_groups` row via the app's normal save path (not raw SQL).
2. Log in as a **different** admin B (or the same admin, different session). Edit the same
   group (roster, name, or archive flag) via the app's normal save path.
3. Confirm the edit persists — reload the app, verify the change is visible. If the edit
   silently does nothing (no error, no visible change after reload), the policy has the trap.
4. Log in as a non-admin coach. Confirm both read (group screens show nothing / redirect) and
   write (any attempt to hit the table, e.g. via a stray API call) are rejected.
5. Repeat step 2 with a genuinely new admin account created *after* the group already existed,
   to specifically exercise "not the creator, still an admin" — the exact scenario that broke
   `bookings_insert`.

This must be run against a real Supabase project. Per `CONCERNS.md`, there is no separate
dev/staging project today, so this verification either runs against production data (acceptable
only for structural checks — creating/deleting a clearly-labeled test group, never real club
data) or the user stands up a second free-tier project first, consistent with the project's
own standing recommendation.

### 7. Storage layer — exactly what must change

**`lib/types.ts`:**
- Add `LesGroep` interface (id, name, level, weekday, start hour/minute, coach_id, court_id,
  season start/end, `roster: string[]`, `archived: boolean`).
- Add `group_id?: string` to `Booking`.
- If D-05's lesson duration setting lands in `Settings` (recommended, see Question 9): add
  `lesson_duration_minutes?: number` to `Settings`.

**`lib/sync.ts`:**
- Add `'lesGroepen'` to the `SyncTable` union.
- Add `lesGroepen: LesGroep[]` to `SyncableStore`.
- Add `changeFor('lesGroepen', before.lesGroepen, next.lesGroepen)` to the `tables` array in
  `diffStores`.
- Update the `before` fallback object (the `previous ?? {...}` literal) to include
  `lesGroepen: []`.

**`providers/mockStore.ts`:**
- Add `lesGroepen: LesGroep[]` to `StoreData`.
- Add `lesGroepen: []` to `freshSeed()`.
- Add `lesGroepen: data.lesGroepen ?? []` to `withDefaults()` (critical — an existing club's
  locally-persisted store predates this field and would otherwise hand screens `undefined`).

**`providers/supabaseStore.ts`:**
- Add `lesGroepen: 'lesson_groups'` to the `TABLES: Record<SyncTable, string>` map.
- Add `selectAllOptioneel<LesGroep>('lesson_groups')` to the parallel `Promise.all` in
  `loadFromSupabase` (use `selectAllOptioneel`, not `selectAll`, matching the pattern already
  used for `ouder_kind`/`coach_rates` — tables added after initial schema must not break a club
  that hasn't run the migration yet, per D-11: "geen enkele taak mag aannemen dat de migratie
  al toegepast is").
- Include `lesGroepen` in the returned `StoreData` object.

**`providers/SimpleDataProvider.tsx`:**
- New actions: `addLesGroep`, `updateLesGroep`, `updateLesGroepRoster` (calls
  `planRosterChange`, patches both `lesGroepen` and `bookings` in one `commit()`),
  `archiveLesGroep`. Each follows the existing shape: read `storeRef.current`, call the `lib/`
  function, spread into a new snapshot, `commit()` once.
- Export the new actions from the context value and its dependency array (`useMemo`).

**What breaks if only one storage side is done:**
- **Only `supabaseStore` updated, `mockStore` not:** the app is unusable in local/demo mode
  (`.env` absent) — `StoreData` would lack `lesGroepen`, and any screen calling
  `useSimpleData().lesGroepen` would crash on `undefined.map(...)` the moment it renders. This
  is also the mode `PITFALLS.md` recommends for safe local testing (Pitfall 7) — breaking it
  removes the only safe way to develop this phase without touching production.
- **Only `mockStore` updated, `supabaseStore` not:** the real club's data never gets the new
  table read or written; groups created while running against Supabase would either error (if
  `selectAll` is used and the table doesn't exist yet pre-migration) or — worse — silently not
  persist if the write path is missing, giving a false impression of success in the UI while
  nothing is saved.
- **`lib/sync.ts` not updated (either backend touched, but not the diff):** the most insidious
  failure — the app *looks* like it works locally (mockStore doesn't use `diffStores` at all,
  it persists the whole blob), so a developer testing only in mock mode would see no problem,
  but against Supabase every group create/edit would silently never leave the browser, because
  `diffStores` wouldn't know to include `lesGroepen` in `StoreChange.tables`.

### 8. Archiving (GROEP-07)

**Recommendation: a boolean flag (`archived boolean not null default false`)**, not a status
enum and not a date. Rationale:
- D-04 requires archiving to be reversible-in-spirit ("archiveerbaar... zonder de gegeven
  lessen... te raken") and the only distinction ever needed is "does this show in the active
  list or not" — a boolean answers exactly that.
- A `status` enum (`'active' | 'archived'`) would be justified only if a third state existed
  (e.g. "draft," "pending deletion") — none is in scope, and this codebase's own convention
  favors the simplest type that answers the actual question (compare `Vakantie`'s plain
  `van`/`tot` strings rather than a richer date-range type).
- A `archived_at timestamptz` (nullable) is a reasonable **addition**, not a replacement, if the
  UI wants to show "archived on 25 June 2027" — but the *query* ("is this group active") should
  still be `archived = false`, not `archived_at is null`, for readability; recommend `archived
  boolean` alone for this phase and let a later phase add `archived_at` if the UX asks for it.

**What must NOT change when a group is archived:**
- `lesson_groups.roster` — archiving is not the same as clearing the roster; a coach reviewing
  an old group's history should still see who was in it.
- Any `bookings.group_id` reference — archived groups keep their historical lessons linked;
  GROEP-07 explicitly requires "without touching the given lessons or their history."
- `bookings.participant_ids` on any existing booking — unaffected by definition, since
  archiving never touches `bookings` at all in this design.
- The group's `name`/`level`/`coach_id`/etc. — archiving toggles exactly one field; nothing else
  in the row changes as a side effect.

**Read-side consequence:** `lib/lesgroepen.ts` should expose a small `actieveGroepen(groepen)`
/ `gearchiveerdeGroepen(groepen)` filter pair (mirroring the naming convention of
`openAanvragen` in `lib/ouderkind.ts`), used by the list screen — archiving is purely a display
filter, never a deletion or a data-shape change.

### 9. Lesson duration as a club setting (D-05)

Club settings live in `club_settings` (single row, fixed `id = 'club'`, a `value jsonb` blob)
and are typed by `lib/types.ts::Settings` — see `booking_end_time` and `vakanties?: Vakantie[]`
as existing precedent. They are read via `useSimpleData().settings` (with a hardcoded
in-provider fallback object at `providers/SimpleDataProvider.tsx:1113`,
`store?.settings ?? { booking_end_time: '21:00', theme: 'light', language: 'nl' }`) and written
in one shot via `saveSettings(s: Settings)` (`providers/SimpleDataProvider.tsx:1080`,
`commit({ ...store, settings: s })`).

**Recommended, minimal addition:**
```typescript
// lib/types.ts, in Settings:
/** Hoeveel minuten een groepsles duurt, tenzij een groep zelf iets anders zegt (die
 *  uitzondering bestaat niet in dit systeem — dit is de enige duur). Wijzigen geldt voor
 *  nieuw ingeplande lessen en nooit met terugwerkende kracht op wat al vaststaat. */
lesson_duration_minutes?: number;
```
- Default value `60`, applied both in `lib/seed.ts::defaultSettings` (mock/fresh-seed path) and
  in the provider's hardcoded fallback object (so a pre-migration club without this key in its
  `club_settings.value` blob still gets 60, per D-05: "60 minuten... beginwaarde").
  `[VERIFIED: providers/SimpleDataProvider.tsx:1113, providers/mockStore.ts::freshSeed via
  lib/seed.ts]`
- No schema migration needed beyond this — `club_settings.value` is already `jsonb`, so a new
  key inside it requires no `alter table`. This is the one piece of this phase's data model
  that ships without touching `supabase-schema.sql`'s alter-table block at all.
- "Never retroactive" (D-05's own wording) means: when generating a *new* booking from a group
  (out of this phase's scope, but the field must exist for Phase 5 to read), the duration is
  read once at generation time and baked into that booking's `end_time` — never recomputed from
  the current setting for an existing booking.

### 10. Scope call — should lesson scheduling land in this phase?

**Recommendation: defer scheduling (bulk-generating a group's `bookings` rows for a season) to
Phase 5.** This phase should support only:
- Creating/editing a group's identity fields (GROEP-01, GROEP-02) — no bookings generated as a
  side effect.
- Manually linking an existing or newly-created single booking to a group (satisfies GROEP-04:
  "a lesson from a group... is an ordinary booking"), via a `group_id` field addable through the
  existing booking-creation/edit flow — one lesson at a time, using the app's current
  single-booking or `addBookingSeries` flow, just with `group_id` set.
- GROEP-03 ("which lessons are planned, how many are coming") is then answered by **querying**
  `bookings` for `group_id = X` and counting/future-filtering — a read, not a generation step.

**Rationale:**
- `PROJECT.md`'s own Key Decision table and the roadmap explicitly sequence this: "import
  bepaalt zelf het sjabloon" and Phase 5's description is "de import plant de lessen van elke
  groep in over de opgegeven periode" — bulk scheduling is Phase 5's stated job, using
  `planSeries`/`lib/recurrence.ts`'s existing collision/vakantie-aware generation. Building a
  second, phase-1-only bulk scheduler would either (a) get thrown away when Phase 5 lands, or
  (b) become the thing Phase 5 has to awkwardly extend, coupling two phases that the roadmap
  deliberately kept separate.
- CONTEXT.md's own "Claude's Discretion" section lists this exact question ("of het inplannen
  van de lessen van een groep in deze fase al meekomt of pas bij de import") as open — this
  research resolves it toward **not this phase**, primarily because Phase 1 has no Excel/season
  data yet to schedule *from*; a from-scratch "pick a date range, generate N weekly lessons for
  this group" UI in Phase 1 would duplicate `lib/recurrence.ts::planSeries`'s existing
  vakantie/collision-aware logic for a UI surface Phase 5 needs to build anyway (with an import
  file driving it instead of a form).
- GROEP-03 is fully satisfiable without a scheduler: it only requires *counting and listing*
  bookings already linked to a group, regardless of how they got created (manually today,
  imported in Phase 5).

**Confidence: HIGH** given the roadmap's explicit phase boundaries; the main residual risk is
UX-only — an admin creating a group in Phase 1 with literally zero lessons attached until
either they manually book one or Phase 5 ships. Recommend the group detail screen state this
plainly ("Nog geen lessen ingepland — dat komt met de import" or similar), not leave it
ambiguous.

## Common Pitfalls

(Full detail and evidence already compiled in `.planning/research/PITFALLS.md`, read in full
for this research. The subset directly actionable in Phase 1's own plan:)

### Pitfall 1: Group roster becomes a second source of truth for "who's in this lesson"
**What goes wrong:** A screen or export reads `lesGroep.roster` to answer "who's in lesson X"
instead of `booking.participant_ids`.
**Why it happens:** The group needs its own roster field to exist even before any lesson is
generated from it; it's tempting to trust it for lesson-level questions too since it's "the
same list."
**How to avoid:** Enforce Pattern 2 above — `lesGroep.roster` is read only when generating or
explicitly re-syncing a *future* booking's `participant_ids`. Add the anti-pattern explicitly to
`ARCHITECTURE.md`'s existing entry for this class of bug.
**Warning signs:** Any `import`/reference to `lesGroep.roster` inside a component that also
renders `booking.*` fields for a specific lesson.

### Pitfall 6 (renumbered from PITFALLS.md): RLS upsert trap on the new table
**What goes wrong:** A creator/ownership-based policy silently blocks a legitimate later edit
by a different admin.
**How to avoid:** Use the `is_admin()`-only policy shape from Research Question 6 — no
ownership check at all.
**Warning signs:** Any `WITH CHECK` clause on `lesson_groups` referencing `created_by` or a
per-row-history field.

### New pitfall specific to this phase: `weekday`/`start_hour` used as the *sole* uniqueness
check, silently merging distinct groups
**What goes wrong:** GROEP-01 lets an admin type a group name freely; if the UI (or a future
import) treats `(name, weekday, start_hour)` as a hard uniqueness constraint rather than just a
*matching key for import*, two genuinely different groups that happen to share all three (a
data-entry coincidence, not the "Groep 8 reused three times" scenario `IMPORT-SJABLOON.md`
describes) could get silently merged.
**Why it happens:** D-03's key is designed for *import matching*, not for *database uniqueness*
in this phase's manual-creation UI — conflating the two would block a legitimate admin action
("I want a second group at the exact same slot temporarily, e.g. during a coach handover") with
no real justification in this phase's scope.
**How to avoid:** Do NOT add a database `unique (name, weekday, start_hour)` constraint in this
phase. Let the admin create groups freely; D-03's key becomes load-bearing only in Phase 5's
import matching logic, which is out of this phase's scope. If duplicate-looking groups are
confusing in the list UI, surface it as a soft warning, not a hard constraint.
**Warning signs:** A migration or `lib/lesgroepen.ts` validation function that rejects group
creation based on this tuple.

## Code Examples

### Deriving the day/hour key (matches `.planning/IMPORT-SJABLOON.md`'s stated key)
```typescript
// Source: derived from .planning/IMPORT-SJABLOON.md's "Sleutel: Groep + weekdag + beginuur"
// Not used for uniqueness enforcement in THIS phase (see Pitfall above) — only exposed so
// Phase 5's import can compute the same key against groups this phase creates.
export function groepSleutel(g: Pick<LesGroep, 'name' | 'weekday' | 'start_hour'>): string {
  return `${g.name.trim().toLowerCase()}|${g.weekday}|${g.start_hour}`;
}
```

### Admin-only tile gating (matches `app/admin/index.tsx`'s existing `leden` tile pattern)
```typescript
// Source: app/admin/index.tsx, existing pattern for the 'leden' tile
...(isAdmin(currentUser)
  ? [{ key: 'lesgroepen', title: t('Lesgroepen'), subtitle: t('Naam, niveau, rooster'),
       icon: Users, onPress: () => router.push('/admin/lesgroepen') } as Tile]
  : []),
```

### Screen-level admin gate (needed IN ADDITION to the tile — TOEG-01 requires this on the
screen itself, not just hiding the tile)
```typescript
// Source: pattern already used at the top of app/admin/index.tsx for isCoach; apply the
// same shape with isAdmin at the top of every new lesgroepen screen.
if (!isAdmin(currentUser)) {
  return (
    <Screen scroll={false}>
      <Text style={styles.muted}>{t('Lesgroepen zijn alleen voor de beheerder.')}</Text>
    </Screen>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — this is a new entity in an unchanged architecture | N/A | N/A | No prior art in this codebase to deprecate; this phase is additive only |

**Deprecated/outdated:** None — no existing code path is replaced by this phase. `series_id`
and `participant_ids` continue exactly as before.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 5's exact write pattern for the roster during import (single jsonb overwrite vs. incremental) | Research Question 1 | Low — this phase's `jsonb` choice is justified independently by the existing schema-design convention; Phase 5 can still read/write the same jsonb column regardless of its own internal diffing strategy |
| A2 | A `unique (name, weekday, start_hour)` constraint should NOT be added in this phase | Common Pitfalls (new pitfall) | Medium — if the planner or a future phase decides D-03's key IS meant as a hard constraint even in manual creation, this recommendation would need reversal; worth confirming with the user during planning if there's any doubt, since CONTEXT.md doesn't explicitly rule on database-level uniqueness, only on import-matching |
| A3 | Cancelled-but-future bookings should (or shouldn't) be included in `groupBookingsFrom`'s propagation set | Research Question 4 | Medium — affects whether a roster change silently "revives" a cancelled lesson's participant list; must be an explicit decision in the plan, not left to whatever the code happens to do |
| A4 | Recommendation to defer lesson generation entirely to Phase 5, including for a single manually-created group | Research Question 10 | Low-Medium — if the user actually wants to book a group's first lesson through a dedicated "generate lessons" flow in Phase 1 rather than the existing single-booking screen, this changes scope meaningfully; CONTEXT.md flags this exact question as open discretion |

## Open Questions

1. **Does a booking created "from a group" also get a `series_id`, or only `group_id`, in this
   phase's manual-linking flow?**
   - What we know: `group_id` is the persistent link; `series_id` is a batch-generation
     artifact. This phase doesn't generate batches.
   - What's unclear: If an admin manually creates several bookings for the same group one at a
     time (not via a batch), should they share a `series_id` at all, or is `series_id` simply
     absent until Phase 5's real batch generation?
   - Recommendation: Leave `series_id` absent/null for lessons linked to a group manually in
     this phase; `group_id` alone is sufficient to satisfy GROEP-03/GROEP-04's requirements.
     Phase 5 can decide its own `series_id` convention for batch-generated lessons.

2. **Should the group's `coach_id`/`court_id` be required at creation, or optional
   (matching `IMPORT-SJABLOON.md`'s note that `koen.xlsx` needs "trainer and courts still
   linked")?**
   - What we know: GROEP-01 lists trainer and court as fields to set when creating a group;
     `IMPORT-SJABLOON.md` explicitly anticipates that an imported season may arrive with courts
     unlinked ("de melding dat trainer en banen nog gekoppeld moeten worden" — IMP-10).
   - What's unclear: Whether this phase's own manual-creation UI should allow saving a group
     with no coach/court set (matching the import's tolerance) or require them (since a human
     is filling the form directly, with no spreadsheet ambiguity).
   - Recommendation: Make `coach_id` required (a group without an assigned trainer doesn't make
     sense for a manually-created group, unlike an import row that just hasn't been resolved
     yet) but `court_id` optional (mirrors `bookings.court_id` already being nullable — "a
     lesson without a court" is an existing, accepted state per `court_id text references
     courts(id) on delete set null`).

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependency. It uses the existing
Expo/React Native/Supabase stack already running in this repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 via `jest-expo` ~53.0.0 (existing, no change) |
| Config file | `package.json` `"jest"` block (existing) |
| Quick run command | `npx jest lib/lesgroepen` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GROEP-01 | Create a group with name/level/day/hour/coach/court/season | unit | `npx jest lib/lesgroepen -t "validateLesGroep"` | ❌ Wave 0 (`lib/lesgroepen.test.ts` new) |
| GROEP-02 | Add/remove a player from a group's roster | unit | `npx jest lib/lesgroepen -t "roster"` | ❌ Wave 0 |
| GROEP-03 | Count/list a group's planned and remaining lessons | unit | `npx jest lib/lesgroepen -t "groupBookingsFrom"` | ❌ Wave 0 |
| GROEP-04 | A group-linked booking remains a normal booking (reschedulable/cancellable/checkable) | unit (regression) | `npx jest lib/groups lib/series` (assert unchanged behavior with `group_id` present) | ✅ existing files, extend with `group_id`-present fixtures |
| GROEP-05 | A group edit propagates to today/future bookings only | unit | `npx jest lib/lesgroepen -t "vanaf vandaag"` | ❌ Wave 0 |
| GROEP-06 | A past booking's `participant_ids`/price/attendance survive a group edit | unit (invariant) | `npx jest lib/lesgroepen -t "geweest is blijft staan"` | ❌ Wave 0 |
| GROEP-07 | Archiving a group leaves lessons/history untouched | unit | `npx jest lib/lesgroepen -t "archiveren"` | ❌ Wave 0 |
| TOEG-01 | Module (screens + data) is admin-only | unit (rechten) + manual (screen) | `npx jest lib/rechten` + manual login as non-admin coach | ✅ `lib/rechten.test.ts` exists, extend if a new `mag*` function is added; manual step required for screen-level gate (no screen tests exist in this codebase, per `CONCERNS.md`) |
| TOEG-02 | RLS restricts writes to admins, including via upsert | manual only | See Research Question 6 verification steps | ❌ no automated RLS coverage exists anywhere in this codebase (`CONCERNS.md`) |
| TOEG-03 | Schema changes ship as `alter table if not exists` blocks, user-applied | manual (review) | N/A — verified by reading the diff to `supabase-schema.sql`, not by a test | N/A |

### Sampling Rate
- **Per task commit:** `npx jest lib/lesgroepen` (and `npx tsc --noEmit`)
- **Per wave merge:** `npm test` (full suite, all 44+ suites)
- **Phase gate:** Full suite green, `npx tsc --noEmit` clean, `npx expo export --platform web`
  succeeds, PLUS the manual RLS upsert verification (Research Question 6) completed and
  recorded — this phase cannot be considered done on green Jest alone, per D-10/TOEG-02.

### Wave 0 Gaps
- [ ] `lib/lesgroepen.ts` + `lib/lesgroepen.test.ts` — new module and its full test suite,
      covers GROEP-01, 02, 03, 05, 06, 07.
- [ ] Extend `lib/groups.test.ts`/`lib/series.test.ts` with fixtures that include `group_id` on
      a `Booking`, asserting existing group/series behavior is unaffected by the new field
      (regression coverage for GROEP-04).
- [ ] `lib/rechten.test.ts` — extend if any new `mag*`-style function is introduced for this
      module (e.g. if `magInElkeAgenda` isn't reused verbatim but a `magLesGroepenBeheren` is
      added instead — CONTEXT.md D-09 suggests reuse is preferred, so this may be a non-gap).
- [ ] Manual RLS test script/checklist (not automatable) — write the 5-step verification from
      Research Question 6 into the phase's own acceptance checklist so it isn't skipped.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — this phase adds no new auth surface, reuses existing Supabase Auth / `app_user_id()` |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | `is_admin()`-only RLS policy (Research Question 6) + client-side `isAdmin` gate on every new screen (dual-guard pattern, per `ARCHITECTURE.md`) |
| V5 Input Validation | Yes | `lib/lesgroepen.ts::validateLesGroep` — reject empty name, invalid weekday/hour ranges, `season_end < season_start`; Postgres `check` constraints as the backstop (`weekday between 0 and 6` etc., matching the existing `bookings.status`/`payment_method` `check` convention) |
| V6 Cryptography | No | Not applicable — no secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| RLS upsert-vs-insert-policy silent write failure (this codebase's own documented, twice-occurred bug class) | Tampering (indirectly — a legitimate write silently fails, which is an integrity/availability issue more than confidentiality) | `is_admin()`-only policy with no ownership check (Research Question 6); manual insert-as-A/update-as-B verification before ship |
| Elevation via a non-admin coach reaching an admin-only screen/table by direct navigation or API call | Elevation of Privilege | Dual guard: client-side `isAdmin` check on every new screen AND RLS `is_admin()` on the table itself — the RLS is the real backstop per `lib/rechten.ts`'s own stated philosophy ("de app is niet de bewaker") |
| A future field on `lesson_groups` accidentally readable/writable by a non-admin via an overly broad `select using (true)` "temporarily to unblock development" | Information Disclosure | Never write a permissive policy "temporarily" — start with the restrictive admin-only policy from day one, per D-10's own wording ("van meet af aan zo geschreven") |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `lib/series.ts` — `seriesFrom` implementation and its documented boundary/comparison rules
- `lib/groups.ts` — `participantIdsOf`, `groupSize`, `isGroupLesson`, `playsIn` and the explicit
  anti-duplication warning in its header comment
- `lib/recurrence.ts` — `planSeries`, `shiftDays`, local-time date-stepping convention, and its
  own comment warning against a second divergent overlap-detection implementation
- `lib/rechten.ts` — `isAdmin`, `isCoach`, `magInElkeAgenda`, `magLesVerwijderen`, and the
  file's stated philosophy ("de app is niet de bewaker")
- `lib/types.ts` — `Booking`, `Court`, `Vakantie`, `Boekingsperiode`, `Settings` interfaces
- `lib/sync.ts` — `SyncTable`, `SyncableStore`, `diffStores`, `changeFor`, `sameRow`
- `providers/mockStore.ts` — `StoreData`, `freshSeed`, `withDefaults`
- `providers/supabaseStore.ts` — `TABLES`, `loadFromSupabase`, `bewaarTarieven` (the
  `coach_rates` side-channel pattern), `saveToSupabase`
- `providers/SimpleDataProvider.tsx` — action shape (`addBooking`, `addBookingSeries`,
  `saveSettings`), `newId` prefix conventions, snapshot-atomicity constraint
- `lib/import-leden.ts` — the plan/execute (`planImport`/`pasImportToe`) dry-run pattern
- `app/admin/index.tsx` — tile gating (`isCoach` page-level, `isAdmin` tile-level for `leden`)
- `components/ParticipantPicker.tsx` — reusable roster-picker UI
- `supabase-schema.sql` (lines 1-886, read in full) — table DDL, `app_user_id()`/`is_admin()`/
  `is_coach()` helper functions, `bookings_insert`/`bookings_update`/`bookings_delete` policies
  and their upsert-trap comment, `coach_rates`'s `rates_write` admin-only policy, `club_settings`
  table and its select/write policies, the three numbered design notes at the top of the file
- `.planning/phases/01-lesgroepen/01-CONTEXT.md` — all locked decisions (D-01 through D-11) and
  discretion areas
- `.planning/REQUIREMENTS.md` — GROEP-01..07, TOEG-01..03 exact wording
- `.planning/PROJECT.md` — Core Value, Key Decisions table, constraints
- `.planning/IMPORT-SJABLOON.md` — the `Groep`+weekday+beginuur key and its justification from
  `koen.xlsx`'s real data (three "Groep 8" instances with zero roster overlap)
- `.planning/codebase/ARCHITECTURE.md` — system diagram, layering rules, dual-guard permission
  pattern, anti-pattern entries
- `.planning/codebase/CONVENTIONS.md` — Dutch naming, `lib/*.test.ts` pairing, no `jest.mock`,
  module-per-concern rule
- `.planning/codebase/CONCERNS.md` — the RLS upsert bug class (documented twice), zero RLS test
  coverage, dev-server-touches-production risk
- `.planning/research/PITFALLS.md` — read in full; Pitfalls 1, 6, 7 directly inform this phase

### Secondary (MEDIUM confidence)
- None used beyond the direct codebase reads above — this phase required no external
  library/API research, since it introduces no new dependency.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency; every pattern cited is a direct, verified read of
  this repository's own code.
- Architecture: HIGH — the group/series/booking relationship and the storage-layer change list
  are derived directly from reading `lib/`, `providers/`, and `supabase-schema.sql` in full,
  not inferred.
- Pitfalls: HIGH for codebase-specific pitfalls (grounded in `CONCERNS.md`'s documented, twice-
  occurred RLS bug and this phase's own read of the exact policies involved); MEDIUM for the two
  Open Questions, which are genuinely undecided by CONTEXT.md and flagged as such rather than
  guessed.

**Research date:** 2026-09-05
**Valid until:** 30 days (stable, no external dependency; codebase itself could shift if other
phases land first, but the roadmap sequences Phase 1 first)
