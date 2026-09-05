# Phase 3: Ziekmelding en vervangerswerklijst - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 10 new + 8 modified (wiring)
**Analogs found:** 18 / 18 — every file has a landed, verbatim-readable analog. Phase 1 and
Phase 2 have both shipped, so unlike 01-PATTERNS.md this map quotes real, current source, not
proposed research sketches.

## Language convention (read before writing anything)

Identifiers, comments and UI strings are Dutch. Comments explain WHY, frequently naming the
exact incident or user complaint the code prevents — not what the code does. Two verbatim
examples to match tone against, both load-bearing for this phase:

`lib/lesgever.ts` (the one-place-answers-one-question discipline this phase's `zoektVervanger`
must copy exactly):
```typescript
// "Wie gaf deze les écht" is precies één vraag met precies één antwoord, en dat antwoord
// hoort maar op één plek te staan. `coach_id` blijft altijd "van wie is deze les" — zijn
// agenda, zijn rooster, zijn dubbele-boekingscontrole. `taught_by_id` is de vervanger, leeg
// betekent "de vaste trainer gaf hem zelf". Loon, uren en het trainersrapport lezen hier, en
// nergens anders, wie er werkelijk op de baan stond.
//
// Dezelfde discipline als `planMethodChange` in lib/beurtenkaart: het gat dat daar gedicht
// werd, liet een speler twee keer betalen; hier zou het gat de vaste trainer laten uitbetalen
// voor een les die hij niet gaf, of de vervanger niets. Wie hier een tweede antwoord naast
// zet — een `b.taught_by_id ?? b.coach_id` in een scherm of een rapport — krijgt dat gat
// terug op de plek die hij vergat mee te wijzigen.
```

`lib/lesgroepen.ts` (the freshest "plan, don't mutate" module — structural sibling for
`lib/ziekmelding.ts`):
```typescript
// Wat is een lesgroep, en welke lessen voelt een wijziging eraan? Puur rekenwerk — geen
// store, geen scherm — zodat de regels van een groep één keer vastliggen en te testen zijn.
//
// De grens die dit bestand bewaakt: een groep is "het rooster van nu", een boeking is "wie er
// die dag bij stond". Wie wil weten wie er in les X zat leest `Booking.participant_ids` via
// lib/groups, en nooit `LesGroep.roster`. Zonder die grens veranderen de groepsprijs en de
// aanwezigheid van een les van vorige maand zodra iemand vandaag een speler aan de groep
// toevoegt — de club zou haar eigen geschiedenis zien opschuiven.
```

No `jest.mock`/`jest.fn` anywhere in this codebase. Tests use plain arrays and a fixed
`now: Date` parameter — do not introduce mocking in `lib/ziekmelding.test.ts` or
`lib/vervanger.test.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/ziekmelding.ts` (new) | pure rule module | CRUD (validation) + derived-fact query | `lib/lesgroepen.ts` (plan-shape) + `lib/vakanties.ts` (period-on-entity shape) + `lib/lesgever.ts` (derived-fact discipline) | exact |
| `lib/ziekmelding.test.ts` (new) | test | — | `lib/series.test.ts` | exact |
| `lib/vervanger.ts` (new) | pure rule module | composition/reason-enum | `lib/boekingstijd.ts` (three-layer compose) | exact (structural) |
| `lib/vervanger.test.ts` (new) | test | — | `lib/series.test.ts` | exact |
| `lib/types.ts` (add `SickLeave`, no `Booking` change needed) | model | — | `Boekingsperiode` interface (period-on-entity) | exact |
| `lib/sync.ts` (add `'sickLeaves'`) | sync/diff wiring | event-diff (batch) | the already-landed `'lesGroepen'` entry (freshest table added) | exact |
| `providers/mockStore.ts` (add `sickLeaves: SickLeave[]`) | storage (mock/local) | CRUD (whole-blob persist) | the already-landed `lesGroepen: LesGroep[]` field | exact |
| `providers/supabaseStore.ts` (add `sickLeaves: 'sick_leaves'`, `selectAllOptioneel`) | storage (remote) | CRUD (upsert/select) | the already-landed `lesGroepen: 'lesson_groups'` wiring | exact |
| `providers/SimpleDataProvider.tsx` (`meldZiek`, `trekZiekmeldingIn`; reuse `setTaughtBy`) | provider actions | CRUD (compute snapshot, commit once) | `setTaughtBy` (single-field guarded patch) + `addLesGroep`/`archiveLesGroep` (add/soft-close shape) | exact |
| `app/admin/ziekmelding/index.tsx` (new) | screen (form + list) | request-response (render + create) | `app/admin/lesgroepen/index.tsx` (isAdmin gate, form → list, Chip pickers, dd/mm/jjjj dates) | exact |
| `app/admin/ziekmelding/[id].tsx` (new) | screen (worklist) | request-response (render + per-row mutate) | `components/BookingDetailSheet.tsx`'s `taught_by_id` chip-picker block | role-match |
| `app/admin/index.tsx` (add one tile) | screen (tile registry) | — | the already-landed `lesgroepen` tile entry | exact |
| `supabase-schema.sql` (append `sick_leaves` table + admin-only RLS) | schema/migration | — | the already-landed `lesson_groups` block (admin-only, no `created_by`) | exact |
| `components/BookingDetailSheet.tsx` (no structural change expected; `zoektVervanger` may add a visible marker) | component | — | its own existing `vervangerNaam`/chip-picker block | exact (reuse, minor addition) |

## Pattern Assignments

### `lib/ziekmelding.ts` (new, pure rule module)

**Analogs:** `lib/lesgroepen.ts` (header style, `Pick<>` narrow input types, `plan`-prefixed
compute-only functions) + `lib/vakanties.ts` (period-on-entity validation shape, `dagSleutel`
day-key discipline) + `lib/lesgever.ts` (the derived-fact, one-function-answers-one-question
discipline that `zoektVervanger` must follow exactly).

**File header pattern** — every `lib/` file opens with a multi-line Dutch comment stating the
module's boundary, not an API list. Write one in this shape (do not literally copy the words,
but match the density and the "what this file does NOT do" clause), modeled on
`lib/lesgroepen.ts` lines 1-8 quoted above and `lib/vakanties.ts` lines 1-11:
```typescript
// Wanneer de club dicht is. De clubkalender van het seizoen, als regel in plaats van als
// papier aan de muur.
//
// Zonder dit rekent de app door alsof er elke week les is: ...
//
// Een vakantie is een dag op de kalender en geen moment op de klok. Daarom staan de grenzen
// als `jjjj-mm-dd`: die vorm is tijdzoneloos, sorteert vanzelf goed en laat zich met een
// gewone tekstvergelijking aftoetsen. Zie `Vakantie` in lib/types.
```
A ziekmelding is structurally the closest to `Vakantie`/`Boekingsperiode` (period with
`van`/`tot` as `jjjj-mm-dd` strings) — the header must state the D-03 boundary explicitly
(ziekmelding ≠ `booking_periods`) since that is this phase's single easiest-to-blur line.

**Narrow `Pick<>` input type pattern**, exact precedent (`lib/lesgroepen.ts` line 20):
```typescript
/** De velden die een vraag over de groep nodig heeft; meer weet dit bestand niet van een les. */
export type GroepBoeking = Pick<Booking, 'id' | 'group_id' | 'start_time' | 'status' | 'participant_ids'>;
```
Use the same shape for the booking-affects question:
```typescript
export type ZiekmeldingBoeking = Pick<Booking, 'id' | 'coach_id' | 'taught_by_id' | 'start_time' | 'status' | 'group_id' | 'series_id' | 'court_id' | 'player_id' | 'participant_ids'>;
```

**Validation function pattern** — exact precedent, `lib/vakanties.ts::vakantieFout` (lines
81-87, full, verbatim) — the shape `ziekmeldingFout` must copy field-for-field:
```typescript
/**
 * Waarom deze vakantie niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand
 * nog aan het typen is, dus een half ingevulde datum is geen fout maar "nog niet af".
 */
export function vakantieFout(naam: string, van: string, tot: string): string | null {
  if (naam.trim().length === 0) return t('Geef de vakantie een naam.');
  if (parseDag(van) === null || parseDag(tot) === null) {
    return t('Vul beide dagen in als dd/mm/jjjj.');
  }
  return null;
}
```
`ziekmeldingFout(coachId, van, tot)` should read: reject missing `coachId`, reject unparseable
`van`/`tot` via `parseDag` (imported from `lib/vakanties`, do not reimplement date parsing),
same "nog niet af" tolerance. Import `parseDag`/`dagSleutel` from `./vakanties` — do not write
a second date parser.

**Derived-fact pattern** — this is the highest-risk piece of the whole phase (per RESEARCH.md
Q5) and has a direct, already-shipped precedent to imitate exactly: `lib/lesgever.ts`'s
`lesgeverId` (full file, quoted above under "Language convention"). The discipline to copy:
one small pure function, a doc comment that says "dit is de ENIGE plek die deze vraag
beantwoordt", and a `Pick<>` input type so callers can't accidentally pass (or trust) a wider
shape. Sketch, matching that exact register:
```typescript
/** De velden die deze vraag nodig heeft; meer weet dit bestand niet van een ziekmelding. */
export type OpenZiekmelding = Pick<SickLeave, 'coach_id' | 'van' | 'tot' | 'retracted_at'>;

/**
 * Zoekt deze les nog een vervanger? Geen kolom, geen status op de boeking — een afgeleid
 * feit uit de ziekmelding zelf (D-06). Dit is de ENIGE plek die deze vraag beantwoordt, net
 * als `lesgeverId` in lib/lesgever: precies daarom hoeft intrekken (D-02/VERV-10) geen
 * enkele boeking aan te raken — zodra de ziekmelding hier niet meer "open" telt, is het
 * antwoord vanzelf nee, overal waar iemand dit opnieuw aanroept.
 */
export function zoektVervanger(
  booking: Pick<Booking, 'coach_id' | 'status' | 'taught_by_id' | 'start_time'>,
  openZiekmeldingen: OpenZiekmelding[],
): boolean {
  if (booking.status === 'cancelled') return false;
  if (booking.taught_by_id) return false;
  const dag = dagSleutel(new Date(booking.start_time));
  return openZiekmeldingen.some((z) =>
    !z.retracted_at && z.coach_id === booking.coach_id && z.van <= dag && dag <= z.tot);
}
```
Note: use `dagSleutel(new Date(booking.start_time))`, never `.slice(0, 10)` on an ISO string —
`toISOString()` renders in UTC and a late-evening local booking can shift to the next UTC day
(RESEARCH.md Q3's explicit warning). `dagSleutel` is already imported by `lib/boekingstijd.ts`
from `./vakanties` — reuse it the same way, do not re-derive a day-string.

**"Which lessons are affected" filter** — structurally the same shape as
`lib/lesgroepen.ts::lessenVanGroep`/`groupBookingsFrom` (filter + sort, no mutation, `Pick<>`
input), but keyed on a date-range period like `vakantieOpDag` rather than "from today forward":
```typescript
// lib/vakanties.ts::vakantieOpDag, the exact "does this day fall in this period" shape
// lessenVoorZiekmelding must reuse (inclusive both ends, swapped-order tolerant):
export function vakantieOpDag(vakanties: Vakantie[], dag: string): Vakantie | null {
  return vakanties.find((v) => {
    if (parseDag(v.van) === null || parseDag(v.tot) === null) return false;
    const [van, tot] = v.van <= v.tot ? [v.van, v.tot] : [v.tot, v.van];
    return dag >= van && dag <= tot;
  }) ?? null;
}
```
`lessenVoorZiekmelding(bookings, sickLeave, vakanties, now)` composes this same inclusive
day-range comparison against `dagSleutel(new Date(b.start_time))`, filters
`status !== 'cancelled'`, excludes any day inside a club vakantie
(`vakantieOpMoment(vakanties, b.start_time)`), and — per D-15/Q4 Assumption A3 (already locked
as D-15 in this phase's own CONTEXT.md) — matches on `coach_id === sickLeave.coach_id OR
taught_by_id === sickLeave.coach_id`.

**Small named exports, not one big function** — same decomposition discipline as
`lib/lesgroepen.ts` (`lesGroepFout`, `groupBookingsFrom`, `planRosterChange`, `groepSleutel`,
`actieveGroepen`/`gearchiveerdeGroepen` as separate ~5-15 line exports). `lib/ziekmelding.ts`
should expose `ziekmeldingFout`, `lessenVoorZiekmelding`, `zoektVervanger`,
`openZiekmeldingen` (filters out retracted rows — the one place that question is asked) as
separate exports, not one function that does everything.

---

### `lib/vervanger.ts` (new, pure rule module)

**Analog:** `lib/boekingstijd.ts` (the three-layer "compose existing answers into one" shape,
full header quoted below) + `lib/recurrence.ts::collides` (the overlap predicate to reuse or
extract, not reinvent a third time).

**Header pattern to match** (`lib/boekingstijd.ts` lines 1-22, full, verbatim — note how it
explicitly documents what it deliberately excludes, which is exactly the shape `lib/vervanger.ts`
needs since it must explicitly document why club vakanties ARE included here even though
`boekingstijd.ts` excludes them):
```typescript
// Tussen welke uren er bij een trainer geboekt kan worden — en wanneer daar iets anders
// geldt dan gewoonlijk.
//
// Drie lagen, van breed naar smal, en elke smallere wint:
//
//  1. De club. `settings.booking_end_time` zegt tot hoe laat er in het algemeen geboekt
//     wordt; de dag begint om 09:00. Dat is wat een trainer krijgt die niets invulde.
//  2. De trainer. Zijn `working_hours` zijn zijn eigen standaard, ...
//  3. De periode. Een zomerrooster, een maand waarin hij later begint, een week waarin hij
//     er niet is — zie `Boekingsperiode` in lib/types.
//
// ...
//
// De vakanties van de club staan hier bewust niet in. Die sluiten iedereen, gelden dus niet
// per trainer, en worden op de schermen apart getoond — met de naam van de vakantie erbij,
// wat hier niet zou passen.
```
`lib/vervanger.ts`'s own header must invert that last paragraph: "dit bestand controleert
vakanties WEL, want een collega die op vakantie is kan hier niet invallen" — naming why it adds
the one check `boekingstijd.ts` deliberately omits, per RESEARCH.md Pitfall 1.

**The three composed answers, read verbatim from their source** — do not reimplement any of
these, import and call them:

`urenOp`/`periodeOp` (`lib/boekingstijd.ts` lines 64-92, exact signatures):
```typescript
export function periodeOp(trainer: BoekingsTrainer, d: Date): Boekingsperiode | null { ... }
export function urenOp(trainer: BoekingsTrainer, dag: Date, clubEinde: string): Uren | null {
  const periode = periodeOp(trainer, dag);
  if (periode !== null) return periode.uren ?? null;
  return trainer.working_hours ?? { start: CLUB_START, end: clubEinde };
}
export type BoekingsTrainer = Pick<User, 'working_hours' | 'booking_periods'>;
```

`vakantieOpMoment` (`lib/vakanties.ts` lines 66-69, exact):
```typescript
export function vakantieOpMoment(vakanties: Vakantie[], iso: string): Vakantie | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return vakantieOp(vakanties, d);
}
```

**The overlap predicate — currently duplicated twice, do not write a third copy.** Both
existing copies are byte-for-byte identical logic (`aStart < bEnd && bStart < aEnd`, cancelled
excluded, same coach only):

`lib/recurrence.ts::collides` (lines 106-119, full, verbatim, with its own comment already
warning about the duplication):
```typescript
/**
 * Botst deze les met een bestaande boeking van dezelfde trainer? Woordelijk dezelfde
 * regel als `overlaps` in providers/SimpleDataProvider: dezelfde trainer, tijdvakken die
 * elkaar raken zonder de grenzen mee te tellen (een les van 10–11 botst niet met 11–12),
 * en een geannuleerde les houdt niets bezet. Wijkt deze versie ooit af, dan meldt het
 * scherm een reeks die de provider vervolgens weigert — daarom moeten de twee gelijk zijn.
 */
function collides(slot: SeriesSlot, coachId: string, existing: Booking[]): boolean {
  const aStart = new Date(slot.start_time).getTime();
  const aEnd = new Date(slot.end_time).getTime();
  return existing.some((b) => {
    if (b.status === 'cancelled' || b.coach_id !== coachId) return false;
    const bStart = new Date(b.start_time).getTime();
    const bEnd = new Date(b.end_time).getTime();
    return aStart < bEnd && bStart < aEnd;
  });
}
```
`providers/SimpleDataProvider.tsx::overlaps` (lines 251-259) is the identical logic under a
different name, also unexported. **Recommendation (per RESEARCH.md's own recommendation (b)):
extract a shared `lib/overlap.ts::botsen(a, b)` and have `recurrence.ts`, `SimpleDataProvider.tsx`,
and this new `vervanger.ts` all import it** — writing a third inline copy inside
`lib/vervanger.ts` is the exact anti-pattern this phase's own research names as the highest
individual mistake risk (Pitfall 1/Anti-Pattern 1). If the plan chooses not to extract, it must
copy this exact comparison verbatim, not "a similar one".

**Reason-enum, never-filter-silently pattern** — this is new logic (D-08/D-09 have no existing
codebase precedent for "return why not" instead of a boolean), but the shape (a `Pick<>` input
type, ordered checks, one `return` per reason, no early array-filter that could drop a
candidate) must follow the same small-function discipline as every other `lib/` file in this
map. Suggested signature, unchanged from RESEARCH.md Pattern 1 (already vetted against D-08
through D-10):
```typescript
export type VervangerReden =
  | 'kan' | 'eigen_les' | 'buiten_uren' | 'afwijkende_periode' | 'clubvakantie' | 'zelf_ziek';

export function kanVervangen(
  kandidaat: BoekingsTrainer & Pick<User, 'id' | 'name'>,
  slot: { start_time: string; end_time: string },
  bestaandeLessen: Booking[],
  vakanties: Vakantie[],
  openZiekmeldingen: OpenZiekmelding[],
  clubEinde: string,
): { coach: Pick<User, 'id' | 'name'>; reden: VervangerReden } { /* ... */ }
```
Order of checks per D-08 (fixed order, first "no" wins, per D-10's "geen rangschikking"): zelf
ziek → binnen boekingstijden/periode → clubvakantie → eigen les (`botsen`/`collides`). Every
candidate coach must be passed through this function — never pre-filtered out before calling it
(that is precisely what D-09 forbids).

---

### `lib/ziekmelding.test.ts` / `lib/vervanger.test.ts` (new)

**Analog:** `lib/series.test.ts`, read in full — exact structure to copy: a `base` fixture
`Booking`, a small factory (`les`/`week`) layering `Partial<Booking>` patches, a `describe`
block of short behaviorally-named `it(...)` cases, no mocking:
```typescript
import { seriesFrom } from './series';
import type { Booking } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

describe('seriesFrom', () => {
  it('returns nothing for an unknown booking', () => {
    expect(seriesFrom([week(1)], 'weg')).toEqual([]);
  });
  it('never touches earlier lessons — the past stays as it is', () => {
    const list = [week(1), week(2), week(3)];
    expect(seriesFrom(list, 'b3').map((b) => b.id)).toEqual(['b3']);
  });
});
```
Required test cases (per D-11 + RESEARCH.md's Wave-0 gap list): one test per D-08 reason for
`kanVervangen` (five red-then-green tests), `zoektVervanger` true/false around
`taught_by_id`/`cancelled`/`retracted_at`, and one DST-crossing fixture for
`lessenVoorZiekmelding` (RESEARCH.md Q3 gives the exact fixture: a sick leave
`2027-03-25`..`2027-04-01` must find a Tuesday 20:00 lesson on `2027-03-30`, post-spring-forward,
still reading 20:00).

---

### `lib/types.ts` (add `SickLeave`)

**Analog for shape and comment density** — `Boekingsperiode` (lines 413-428, full, verbatim —
this is the closest existing interface: a period with `van`/`tot` as `jjjj-mm-dd`, on an owning
entity, with an optional label):
```typescript
/**
 * Een periode waarin voor één trainer andere boekingstijden gelden — of helemaal geen.
 *
 * De dagen staan als `jjjj-mm-dd`, om dezelfde reden als bij `Vakantie`: dit is een stuk
 * kalender en geen moment op de klok, en zo blijft het tijdzoneloos te vergelijken.
 *
 * Het verschil met een vakantie: een vakantie sluit de hele club, dit geldt voor één
 * trainer. Vandaar dat het bij hem staat en niet bij de clubinstellingen.
 */
export interface Boekingsperiode {
  id: string;
  naam?: string;
  van: string;
  tot: string;
  uren?: { start: string; end: string };
}
```
Write `SickLeave` in the same register, explicitly stating the D-03 boundary against
`Boekingsperiode` (the two are easy to conflate and the interface comment is the first line of
defense against that):
```typescript
/**
 * Een ziekmelding: een periode waarin een trainer niet kon lesgeven. Anders dan een
 * `Boekingsperiode` (die zegt "hij geeft die weken geen les" en vooruit gepland is), is dit
 * een gebeurtenis met lessen die al gepland stonden en nu opgelost moeten worden — zie D-03
 * in .planning/phases/03-ziekmelding-en-vervangerswerklijst/03-CONTEXT.md.
 *
 * `retracted_at` in plaats van verwijderen: intrekken is iets dat gebeurd is en blijft
 * zichtbaar. Een rij met `retracted_at` gezet telt nergens meer mee als "open" — niet in de
 * werklijst, niet in het vervangersvoorstel (`zoekt Vervanger` in lib/ziekmelding) — maar
 * blijft bestaan.
 */
export interface SickLeave {
  id: string;
  coach_id: string;
  van: string;
  tot: string;
  reden?: string;
  created_at?: string;
  retracted_at?: string;
}
```
No changes needed to `Booking` or `Settings` — Phase 2's `taught_by_id` (types.ts lines
170-183) already carries the full weight this phase needs; do not add a `needs_substitute`
field (this is the exact rejected alternative in RESEARCH.md's Q5).

---

### `lib/sync.ts` (wire `sickLeaves`)

**Analog:** the already-landed `'lesGroepen'` entry — four exact spots, shown as they exist
today (verbatim, current source):

1. `SyncTable` union (line 22-24):
```typescript
export type SyncTable =
  | 'users' | 'courts' | 'bookings' | 'lessons' | 'progress' | 'goals' | 'beurtenkaarten'
  | 'memos' | 'relaties' | 'lesGroepen';
```
→ append `| 'sickLeaves'`.

2. `SyncableStore` (line 51-64) — add `sickLeaves: SickLeave[];` with a one-line Dutch comment,
and import `SickLeave` alongside `LesGroep` in the top import block.

3. The `before` fallback inside `diffStores` (line 120-127, current comment already documents
*why* this step matters — reuse the same reasoning for the new key):
```typescript
  const before: SyncableStore = previous ?? {
    users: [], courts: [], bookings: [], lessons: [], progress: [], goals: [],
    beurtenkaarten: [], memos: [], relaties: [],
    // Ook de nieuwe verzamelingen horen hier leeg te staan: zonder `lesGroepen: []` leest de
    // eerste bewaaractie `before.lesGroepen` als undefined in plaats van als een lege lijst,
    lesGroepen: [],
    settings: next.settings, installed_catalogues: [],
  };
```
→ add `sickLeaves: [],` right beside `lesGroepen: [],`, same comment reasoning extended.

4. The `tables` array (around line 140): add
`changeFor('sickLeaves', before.sickLeaves, next.sickLeaves),` next to the existing
`changeFor('lesGroepen', before.lesGroepen, next.lesGroepen),`.

---

### `providers/mockStore.ts` (add `sickLeaves: SickLeave[]`)

**Analog:** the already-landed `lesGroepen` field, wired through all three functions that must
agree (current source, lines 18-30, 37-49, 60-75):
```typescript
export interface StoreData {
  users: User[]; courts: Court[]; bookings: Booking[]; beurtenkaarten: Beurtenkaart[];
  lessons: Lesson[]; progress: StudentProgress[]; memos: Memo[]; goals: PlayerGoal[];
  relaties: OuderKind[];
  lesGroepen: LesGroep[];
  settings: Settings;
  installed_catalogues?: string[];
}

function freshSeed(): StoreData {
  return {
    users: [...seedUsers], courts: [...seedCourts], bookings: [...seedBookings],
    beurtenkaarten: [], lessons: [...seedLessons], progress: [...seedProgress],
    memos: [], goals: [], relaties: [...seedRelaties],
    lesGroepen: [],
    settings: { ...defaultSettings }, installed_catalogues: [],
  };
}

function withDefaults(data: StoreData): StoreData {
  return {
    ...data,
    users: data.users ?? [], courts: data.courts ?? [], bookings: migrateBookings(data.bookings),
    beurtenkaarten: data.beurtenkaarten ?? [], lessons: data.lessons ?? [], progress: data.progress ?? [],
    memos: data.memos ?? [], goals: data.goals ?? [], relaties: data.relaties ?? [],
    lesGroepen: data.lesGroepen ?? [],
    settings: { ...defaultSettings, ...data.settings },
  };
}
```
→ add `sickLeaves: SickLeave[]` to `StoreData`, `sickLeaves: []` to `freshSeed()` (no seed data
— genuinely new, empty-by-default), and `sickLeaves: data.sickLeaves ?? []` to `withDefaults()`
with a matching one-line comment ("Een opslag van vóór de ziekmeldingen heeft dit veld niet.").
Skipping this last one crashes any screen calling `.sickLeaves.map(...)` on a store that
predates this field — the exact gap Phase 1's own retro (`01-03-SUMMARY.md`) flagged.

---

### `providers/supabaseStore.ts` (wire `sickLeaves` → `sick_leaves`)

**Analog:** the already-landed `lesGroepen: 'lesson_groups'` wiring via `selectAllOptioneel`
(current source, lines 31-41 and around 133-178):
```typescript
const TABLES: Record<SyncTable, string> = {
  users: 'users', courts: 'courts', bookings: 'bookings', lessons: 'lessons',
  progress: 'student_progress', goals: 'player_goals', beurtenkaarten: 'beurtenkaarten',
  memos: 'memos', relaties: 'ouder_kind',
  lesGroepen: 'lesson_groups',
};
```
```typescript
  // `lesson_groups` is het verste in dat verhaal: de beheerder draait die migratie zelf
  selectAllOptioneel<OuderKind>('ouder_kind', ['auth_id']),
  selectAllOptioneel<RateRow>('coach_rates', ['auth_id', 'updated_at']),
  selectAllOptioneel<LesGroep>('lesson_groups'),
  ...
  return { ..., lesGroepen, ... };
```
→ add `sickLeaves: 'sick_leaves',` to `TABLES`; add
`selectAllOptioneel<SickLeave>('sick_leaves')` to the `Promise.all` array (same "kwam later dan
het schema, migratie is user-run" comment extended to cover it — D-14 requires this table load
to survive a club that has not yet run the SQL); destructure as `sickLeaves`; include it in the
returned object; import `SickLeave` in the top type-import block. **Must use
`selectAllOptioneel`, not `selectAll`** — this is not optional per D-14/RESEARCH.md. No change
needed to `saveToSupabase`'s generic `change.tables` loop — it already handles any `SyncTable`
entry uniformly via `TABLES[table]`.

---

### `providers/SimpleDataProvider.tsx` (new actions: `meldZiek`, `trekZiekmeldingIn`; reuse `setTaughtBy` for "vervanger koppelen"; reuse `updateBooking`'s cancel path for "afzeggen")

**Analog for `meldZiek`:** `addBooking`'s validate-then-commit shape (lines 604-618, current
source, verbatim):
```typescript
const addBooking = useCallback(async (b: Omit<Booking, 'id'>): Promise<Booking | null> => {
  const store = storeRef.current;
  if (!store) return null;
  if (overlaps(b, store.bookings)) {
    setError('Dit tijdslot is al geboekt bij deze coach.');
    return null;
  }
  const created: Booking = { ...b, id: newId('b') };
  await commit({ ...store, bookings: [...store.bookings, created] });
  return created;
}, [commit]);
```
`meldZiek(coachId, van, tot, reden)` should follow the same shape: read `storeRef.current`, bail
on `null`, build `{ id: newId('z'), coach_id, van, tot, reden, created_at: nowISO() }`, one
`commit({ ...store, sickLeaves: [...store.sickLeaves, created] })`. Validation
(`ziekmeldingFout`) belongs in the screen before calling this action, same as `lesGroepFout` is
called by `app/admin/lesgroepen/index.tsx` before `addLesGroep` — the provider action itself
does not re-validate business rules, only guards against a null store (matches this codebase's
existing division of labor).

**Analog for `trekZiekmeldingIn`:** the guarded single-field patch shape of `setTaughtBy` (lines
897-908, current source, full, verbatim — this is the exact discipline "no plan* function
needed, just read, guard, commit" that a soft-close action should copy):
```typescript
// Eén patch, één veld: `coach_id` blijft staan zoals hij stond. Er valt hier niets te
// verzoenen zoals bij `setPaymentMethod` — geen beurt terug te geven, geen splitsing te
// herrekenen — dus geen `plan*`-functie: alleen lezen, afbreken bij een onbekende
// boeking, en committen.
const setTaughtBy = useCallback(async (bookingId: string, coachId: string | null): Promise<void> => {
  const store = storeRef.current;
  if (!store) return;
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  await commit({
    ...store,
    bookings: store.bookings.map((b) =>
      b.id === bookingId ? { ...b, taught_by_id: coachId ?? undefined } : b,
    ),
  });
}, [commit]);
```
`trekZiekmeldingIn(id)` should do exactly this shape against `sickLeaves`, setting
`retracted_at: nowISO()` — **and touch nothing else**. Per D-17/Q6, this action must NOT map
over `store.bookings` at all: the derived `zoektVervanger()` fact makes any bookings-side write
here both unnecessary and wrong (it would violate D-02's "lessen waar al een vervanger op staat,
blijven zoals ze zijn").

**"Vervanger koppelen" reuses `setTaughtBy` verbatim — do not call `updateBooking` directly.**
`updateBooking`'s type signature already excludes `taught_by_id` by construction (line 750,
current source):
```typescript
const updateBooking = useCallback(async (
  id: string,
  patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split' | 'attendance' | 'taught_by_id'>>,
) => { ... }, [commit]);
```
This means `tsc` already catches an attempt to route a substitute assignment through
`updateBooking` — the worklist screen's "vervanger koppelen" button must call the existing
`setTaughtBy(bookingId, coachId)` from context, exactly like `BookingDetailSheet.tsx` already
does (see below). "Afzeggen" reuses the existing cancel path
(`updateBooking(id, { status: 'cancelled', ... })` or the existing `decideBooking`/cancel
action already used elsewhere) — no new cancel logic.

**Export discipline:** remember to add `meldZiek`, `trekZiekmeldingIn`, and `sickLeaves` itself
to the context value object and its `useMemo` dependency array (same section where `setTaughtBy`,
`addLesGroep`, `updateLesGroepRoster`, `archiveLesGroep` are currently listed, lines ~1276-1324)
— a forgotten export is the most common way a new action silently doesn't reach screens, per
Phase 1's own retro.

---

### `app/admin/ziekmelding/index.tsx` (new — form + list)

**Analog:** `app/admin/lesgroepen/index.tsx`, read in full (321 lines) — copy its exact shape:
top-of-file Dutch header comment stating the screen's boundary, the `isAdmin` early-return gate,
`Chip` rows for enumerable choices, `dd/mm/jjjj` date inputs via `parseDayInput`/`formatDayInput`
from `lib/period` and `dagSleutel` from `lib/vakanties`, a `Card`-wrapped form followed by a
plain list.

**Header comment shape** (lines 1-11, verbatim — match this density, not these exact words):
```typescript
// Beheer → Lesgroepen: de vaste groepen van de tennisschool, met wie ze geeft en wanneer.
//
// Een lesgroep is geen les. Het is het blijvende gegeven eronder: ...
//
// Wat dit scherm bewust nog niet doet: een heel seizoen aan lessen inplannen. ...
```

**The isAdmin gate — copy verbatim, only the message text changes** (lines 61-70, exact):
```typescript
// De grens staat hier, en niet alleen op de tegel in Beheer: een verborgen tegel is geen
// toegangscontrole, want een trainer kan de link gewoon intikken (TOEG-01). De databank
// weigert hem daarna ook — dit zorgt dat hij het scherm niet eens te zien krijgt.
if (!isAdmin(currentUser)) {
  return (
    <Screen scroll={false}>
      <Text style={styles.muted}>{t('Lesgroepen zijn alleen voor de beheerder.')}</Text>
    </Screen>
  );
}
```
→ swap the message to `t('Ziekmeldingen zijn alleen voor de beheerder.')`. Apply the identical
gate to `[id].tsx` as well — hiding the tile is not enough (same anti-pattern flagged in
01-PATTERNS.md).

**Trainer picker via `Chip` rows over an enumerable list** (lines 170-180, exact shape to reuse
for the sick-coach picker):
```typescript
<Text style={styles.label}>{t('Trainer')}</Text>
<View style={styles.chipRij}>
  {trainers.map((c) => (
    <Chip
      key={c.id}
      label={c.name}
      selected={trainerId === c.id}
      onPress={() => setTrainerId(c.id)}
    />
  ))}
</View>
```
`trainers` comes from `coachesOf(users)` (`lib/hub.ts`) — reuse that helper, do not re-filter
`users` inline.

**Date inputs, dd/mm/jjjj, exact shape** (lines 201-224, verbatim structure) — reuse
`parseDayInput`/`formatDayInput` from `lib/period` and `dagSleutel` from `lib/vakanties` for
"Van"/"Tot" fields, same `inputMode="numeric"` and placeholder pattern:
```typescript
<TextInput
  style={styles.input}
  value={van}
  onChangeText={setVan}
  placeholder={t('dd/mm/jjjj')}
  placeholderTextColor={tennisColors.textMuted}
  inputMode="numeric"
/>
```

**Validate-then-clear-then-navigate pattern** (lines 78-113, structural shape — build a
candidate object, call the `lib/` validator, set an error string on failure, clear the form and
call the provider action on success):
```typescript
const melding = lesGroepFout(kandidaat);
if (melding || !vanDag || !totDag) {
  setFout(melding ?? t('Vul beide dagen in als dd/mm/jjjj.'));
  return;
}
setFout(null);
void addLesGroep(kandidaat);
// ...clear all local state fields
```
→ `meldZiek`'s submit handler follows the same shape, calling `ziekmeldingFout` before
`meldZiek`, then (per RESEARCH.md Q9) navigating to `/admin/ziekmelding/${nieuweZiekmelding.id}`
— note `addLesGroep` doesn't return the created row's id today by this read; if `meldZiek` needs
the new id for navigation, either have it return the created `SickLeave` (mirroring
`addBooking`'s `Promise<Booking | null>` return shape) or generate the id in the screen before
calling the action — the executor should pick whichever keeps the provider the single source of
id generation (`newId(...)`), consistent with every other `add*` action in this file.

**List rendering, active vs. archived split** (lines 237-278, structural shape — reuse for
active vs. retracted sick leaves): a `Card` per row with a two-line text block, plus a visually
de-emphasized "archief" section below for retracted entries, using `opacity: 0.7` and an
uppercase section label exactly like the existing `archief`/`archiefKop` styles.

---

### `app/admin/ziekmelding/[id].tsx` (new — the worklist)

**Analog:** `components/BookingDetailSheet.tsx`'s existing "wie gaf deze les" block (lines
346-379, current source, full, verbatim) — this is the exact chip-picker pattern the worklist's
per-row "vervanger koppelen" control must reuse, including its admin-only gate comment and its
"no disabled button, just no button" discipline:
```typescript
{/* Invullen wie de les werkelijk gaf mag alleen de beheerder (D-08) — bewust niet
    `canManage`, want daar valt de trainer van de les zelf ook onder. ...

    Voor wie het niet mag staat er geen uitgeschakelde knop maar helemaal geen knop:
    er bestaat dan geen `onPress` die `setTaughtBy` kan bereiken. Dat is geen
    bewaking maar netheid — de bewaking staat in `bewaak_betaalvelden` in de databank,
    zodat het scherm geen knop toont die daarna geweigerd wordt (lib/rechten:
    "de app is niet de bewaker"). */}
{isAdmin(currentUser) ? (
  <>
    <Text style={styles.label}>{t('Wie gaf deze les?')}</Text>
    <View style={styles.chipRow}>
      <Chip
        label={t('Gaf hem zelf')}
        selected={!booking.taught_by_id}
        onPress={() => { void setTaughtBy(booking.id, null); }}
      />
      {users
        .filter((u) => isCoach(u) && u.id !== booking.coach_id)
        .map((u) => (
          <Chip
            key={u.id}
            label={u.name}
            selected={booking.taught_by_id === u.id}
            onPress={() => { void setTaughtBy(booking.id, u.id); }}
          />
        ))}
    </View>
  </>
) : null}
```
Extend this exact pattern per D-09: instead of a plain `Chip` per coach, annotate each
unavailable candidate with `kanVervangen`'s reason as a subtitle/greyed style rather than
omitting them — the underlying `onPress={() => setTaughtBy(...)}` wiring stays identical.

**Both-names-visible pattern** — apply the same discipline as `BookingDetailSheet.tsx` lines
331-344 (verbatim) to each worklist row that already has a substitute assigned:
```typescript
{/* Beide namen blijven staan. Wie hier alleen de vervanger zou tonen, maakt achteraf
    onnavolgbaar wat er gebeurd is: dan is niet meer te zien aan wie de les was
    toegewezen én wie hem uiteindelijk gaf (D-07). */}
```
A worklist row for a lesson that already has `taught_by_id` set must show both the vaste
trainer's name and the vervanger's name (per RESEARCH.md Q4's "already resolved" edge case row
shape) — never hide the original assignment.

**Per-row layout data (D-04):** datum, uur, baan, groep-of-speler, aantal spelers — reuse
`groepSleutel`/`lesGroepen.find(...)` lookups exactly as `BookingDetailSheet.tsx` line 173-174
already does (`booking.group_id ? lesGroepen.find((g) => g.id === booking.group_id) : null`) —
do not re-derive a group label a second way. Player count reuses `groupSize`/`lessonPlayerIds`
from `lib/groups.ts`, not a manual `participant_ids.length + 1`.

---

### `app/admin/index.tsx` (register the tile)

**Analog:** the already-landed `lesgroepen` tile entry (current source, line 86-88, exact):
```typescript
...(isAdmin(currentUser)
  ? [{ key: 'lesgroepen', title: t('Lesgroepen'), subtitle: t('Naam, niveau, rooster en spelers'), icon: GraduationCap, onPress: () => router.push('/admin/lesgroepen') } as Tile]
  : []),
```
→ add a parallel entry under the same `'club'`-style group, e.g.
```typescript
...(isAdmin(currentUser)
  ? [{ key: 'ziekmelding', title: t('Ziekmelding'), subtitle: t('Werklijst en vervangers'), icon: Thermometer, onPress: () => router.push('/admin/ziekmelding') } as Tile]
  : []),
```
(pick an unused `lucide-react-native` icon; `Thermometer` or `UserX` both read naturally in
Dutch UI — avoid reusing `GraduationCap`/`Users`/`UserCog`, already claimed by neighbouring
tiles).

---

### `supabase-schema.sql` (append `sick_leaves` table + admin-only RLS)

**Analog:** the already-landed `lesson_groups` block — this is the exact admin-only,
zero-ownership shape D-13 requires, quoted in full as it exists today:
```sql
-- ...
-- Alleen de beheerder ziet en beheert deze tabel — dezelfde grens als `coach_rates`
-- hierboven, en om dezelfde reden geen "created_by"-kolom of -conditie: géén van beide
-- policies hieronder verwijst naar wie een rij ooit gemaakt heeft. Dat is met opzet. Lees
-- eerst het commentaar boven `bookings_insert` voordat je hier een eigenaarscontrole aan
-- toevoegt: de app schrijft met een upsert, Postgres toetst de `with check` ook bij een
-- latere wijziging, en alles wat hier over de máker van de rij geëist wordt, geldt dus ook
-- voor iedere volgende beheerder die de rij aanpast. Precies die val brak `bookings_insert`
-- ooit stilzwijgend, en dit project is er al twee keer stilzwijgend door geraakt — vandaar
-- de vorm van `rates_write`, niet van `rates_select`.
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

drop policy if exists lesson_groups_select on lesson_groups;
create policy lesson_groups_select on lesson_groups for select
  to authenticated using (is_admin());
drop policy if exists lesson_groups_write on lesson_groups;
create policy lesson_groups_write on lesson_groups for all
  to authenticated using (is_admin()) with check (is_admin());
```
`sick_leaves` follows this shape exactly (per D-13: "in dezelfde vorm als `coach_rates`"), with
the D-03-boundary comment and the `retracted_at`-not-delete reasoning stated up front, mirroring
how the `taught_by_id` block (added by Phase 2, quoted next) explains its own `on delete set
null` choice:
```sql
-- ---------------------------------------------------------------------------
-- Ziekmeldingen
-- ---------------------------------------------------------------------------

-- Een ziekmelding is een periode op een trainer, los van zijn boekingstijden
-- (users.booking_periods) en los van de clubvakanties. Zie D-03 in
-- .planning/phases/03-ziekmelding-en-vervangerswerklijst/03-CONTEXT.md: een
-- boekingsperiode is vooruit gepland ("hij geeft die weken geen les"), een ziekmelding is
-- een gebeurtenis met lessen die al gepland stonden en nu opgelost moeten worden. Ze staan
-- daarom in een eigen tabel, niet als extra velden op `booking_periods`.
--
-- `retracted_at` in plaats van verwijderen: intrekken (D-02/VERV-10) is iets dat gebeurd
-- is en blijft zichtbaar. Een ziekmelding met `retracted_at` gezet telt nergens meer mee
-- als "open" — niet in de werklijst, niet in het vervangersvoorstel — maar de rij zelf
-- blijft bestaan.
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
Note `coach_id ... on delete cascade` here (not `set null` like `lesson_groups.coach_id`) — a
sick-leave row has no meaning once its trainer is deleted (unlike a lesson, which must survive
and fall back to "the regular coach taught it himself"). This intentionally differs from
`lesson_groups`'s `on delete set null`; state the reason in the comment if the plan keeps this
choice.

**Cross-reference the `taught_by_id` block** (Phase 2, already shipped, lines 944-981 —
confirms Assumption A1 fully: the field, function, and guard all exist exactly as researched):
```sql
-- Loongevoelig: alleen de beheerder mag invullen wie een les werkelijk gaf. Dit hoort bij
-- bewaak_betaalvelden (dezelfde bewaking als payment_method), niet bij een nieuwe trigger
-- ernaast (D-09). ...
create or replace function bewaak_betaalvelden()
...
  if new.taught_by_id is distinct from old.taught_by_id and not is_admin() then
    raise exception 'Alleen een beheerder kan invullen wie de les werkelijk gaf.';
  end if;
  if is_admin() or old.coach_id = app_user_id() then return new; end if;
  ...
```
No change to `bewaak_betaalvelden` is needed for `sick_leaves` — that trigger only guards
`bookings`, and this phase's "vervanger koppelen" write reuses the already-guarded `setTaughtBy`
path. No trigger is needed on `sick_leaves` itself: its RLS (`is_admin()` on both `using`/`with
check`) is the entire guard, identical to `coach_rates`/`lesson_groups`.

**D-14 constraint (do not skip):** this block only ships as text in this SQL file. The user
runs it themselves — no task in this phase may assume it has been applied, which is exactly why
`supabaseStore.ts` must use `selectAllOptioneel`, not `selectAll`, for `sick_leaves`.

**Manual RLS upsert verification (D-13, cannot be automated — CONCERNS.md: zero RLS test
coverage in Jest):**
1. Insert a sick-leave row as admin session A via the app's normal upsert write path.
2. Update the same row as admin session B (add `reden`, or set `retracted_at`) via the app's
   normal write path.
3. Confirm the update succeeds and is visible on reload (the case `rates_write`'s
   no-ownership shape is specifically designed to pass).
4. As a non-admin coach/player session, confirm both `select` and any write are rejected.
5. Record the outcome explicitly in the plan's verification checklist before `/gsd:verify-work`.

## Shared Patterns

### The derived-fact discipline ("one function answers one question")
**Source:** `lib/lesgever.ts::lesgeverId` (Phase 2, shipped) — the direct precedent for
`lib/ziekmelding.ts::zoektVervanger`.
**Apply to:** every screen/component that displays whether a lesson still needs a substitute
(worklist, `BookingDetailSheet.tsx`, any future agenda marker) — always call `zoektVervanger()`
fresh against the current `sickLeaves`/`bookings`, never cache the boolean across a screen
boundary or pass it down as a prop computed once upstream.

### Admin-only dual guard (client + RLS)
**Source:** `lib/rechten.ts::isAdmin` (client) + `supabase-schema.sql`'s `is_admin()` (DB, the
real backstop).
**Apply to:** every new screen under `app/admin/ziekmelding/`, `meldZiek`/`trekZiekmeldingIn`,
both new RLS policies on `sick_leaves`.

### Snapshot-atomicity commit
**Source:** `providers/SimpleDataProvider.tsx` — every action reads `storeRef.current`, computes
one full next snapshot, calls `commit()` exactly once (see `setTaughtBy`, `updateLesGroepRoster`
touching two collections at once).
**Apply to:** `meldZiek`, `trekZiekmeldingIn` — neither should ever need to touch more than one
collection (`sickLeaves`), precisely because "zoekt vervanger" is derived, not stored (D-06,
Q5) and "vervanger koppelen"/"afzeggen" already go through their own existing single-commit
actions (`setTaughtBy`, `updateBooking`).

### `selectAllOptioneel` for any pre-migration-safe table
**Source:** `providers/supabaseStore.ts`, used for `memos`, `ouder_kind`, `coach_rates`,
`lesson_groups`.
**Apply to:** `sick_leaves`, mandatorily, per D-14.

### `t()` for every user-facing string
**Source:** `lib/i18n.ts`; call sites throughout `app/admin/lesgroepen/index.tsx` and
`components/BookingDetailSheet.tsx`.
**Apply to:** every new screen and every subtitle/label/error message in this phase. The Dutch
sentence IS the translation key — never invent a symbolic key.

### The overlap predicate — one place, not three
**Source:** `lib/recurrence.ts::collides` / `providers/SimpleDataProvider.tsx::overlaps`
(currently duplicated).
**Apply to:** `lib/vervanger.ts`'s "eigen les" check (D-08 reason 1) — extract a shared
`lib/overlap.ts::botsen(a, b)` rather than writing a third copy (see `lib/vervanger.ts` section
above for the full reasoning).

## No Analog Found

None. Every file in this phase's classification table has at least one landed, verbatim-readable
analog in the current codebase — Phase 1 and Phase 2 together already cover every structural
shape this phase needs (period-on-entity validation, derived-fact query, four-stop table wiring,
admin-only RLS, chip-based pickers, guarded single-field provider actions).

## Metadata

**Analog search scope:** `lib/`, `providers/`, `app/admin/`, `components/`, `supabase-schema.sql`
**Files scanned (full or targeted read):** `lib/lesgroepen.ts` (full), `lib/lesgever.ts` (full),
`lib/boekingstijd.ts` (full), `lib/vakanties.ts` (full), `lib/recurrence.ts` (targeted:
header, `shiftDays`, `collides`), `lib/rechten.ts` (targeted: header, `isAdmin`,
`magInElkeAgenda`), `lib/types.ts` (targeted: `User`, `Booking`, `Boekingsperiode`, `Settings`,
`LesGroep`), `lib/sync.ts` (targeted: `SyncTable`, `SyncableStore`, `diffStores`), `lib/series.test.ts`
(targeted, for test-shape precedent), `providers/mockStore.ts` (targeted), `providers/supabaseStore.ts`
(targeted), `providers/SimpleDataProvider.tsx` (targeted: `overlaps`, `addBooking`, `updateBooking`,
`setTaughtBy`, `updateLesGroepRoster`, action-export block), `app/admin/lesgroepen/index.tsx`
(full, 321 lines), `app/admin/index.tsx` (targeted: tile registry), `components/BookingDetailSheet.tsx`
(targeted: lines 140-380), `supabase-schema.sql` (targeted: `coach_rates`, `bewaak_betaalvelden`
both versions, `lesson_groups` block, `taught_by_id` block).
**Pattern extraction date:** 2026-09-06
