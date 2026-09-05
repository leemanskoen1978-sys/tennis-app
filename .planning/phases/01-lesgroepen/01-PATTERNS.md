# Phase 1: Lesgroepen - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 12 (new) + 6 (modified, wiring)
**Analogs found:** 11 / 12

## Language convention (read before writing anything)

Identifiers, comments and UI strings are **Dutch**. Comments explain **WHY**, not what, and
frequently cite the exact bug/complaint they prevent. Generic/technical vocabulary
(`Booking`, `StoreData`, `useCallback`) stays English. Example header style to match, verbatim
(`lib/series.ts`):

```typescript
// Welke lessen horen bij een herhaalreeks? Puur rekenwerk — geen store, geen scherm — zodat
// "vanaf deze les" één keer vastligt en te testen is, in plaats van op elk scherm opnieuw
// bedacht te worden.
//
// De reeks is niets meer dan een gedeeld `series_id` op gewone boekingen. Dat is met opzet:
// een les uit de reeks verzetten of schrappen raakt de rest niet, want er is geen aparte
// reeks-administratie die daarna zou moeten worden bijgewerkt.
```

There is **no `jest.mock`/`jest.fn` anywhere in this codebase**. Logic is made pure (plain
functions over plain arrays, `now: Date` passed as a parameter) so tests need no mocking at
all — see `lib/series.test.ts` below. Do not introduce mocking in `lib/lesgroepen.test.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/lesgroepen.ts` (new) | pure rule module | CRUD + temporal-propagation | `lib/series.ts` (+ `lib/groups.ts` for roster shape) | exact (structural sibling) |
| `lib/lesgroepen.test.ts` (new) | test | — | `lib/series.test.ts` | exact |
| `lib/types.ts` (add `LesGroep`, `Booking.group_id`, `Settings.lesson_duration_minutes`) | model | — | `OuderKind` interface + `Booking.series_id` field comment | exact |
| `lib/sync.ts` (add `'lesGroepen'` to `SyncTable`) | sync/diff wiring | event-diff (batch) | existing `'relaties'` entry (most recently added table) | exact |
| `providers/mockStore.ts` (add `lesGroepen: LesGroep[]`) | storage (mock/local) | CRUD (whole-blob persist) | existing `relaties: OuderKind[]` field | exact |
| `providers/supabaseStore.ts` (add `lesGroepen: 'lesson_groups'` to `TABLES`, load) | storage (remote) | CRUD (upsert/select) | existing `ouder_kind`/`relaties` via `selectAllOptioneel` | exact |
| `providers/SimpleDataProvider.tsx` (add `addLesGroep`, `updateLesGroep`, `updateLesGroepRoster`, `archiveLesGroep`) | provider actions | CRUD (compute snapshot, commit once) | `vraagKindAan`/`beslisOverKind`/`wisRelatie` (relaties actions) + `addBooking` | exact |
| `app/admin/lesgroepen/index.tsx` (new) | screen (list) | request-response (render) | `app/admin/index.tsx`'s isCoach gate + any admin list screen shape | role-match |
| `app/admin/lesgroepen/[id].tsx` (new) | screen (detail) | request-response (render + mutate) | same, combined with `ParticipantPicker` usage pattern | role-match |
| `app/admin/index.tsx` (add one tile) | screen (tile registry) | — | existing `leden` tile (admin-only, under "Club") | exact |
| `supabase-schema.sql` (append `lesson_groups` table + `bookings.group_id` column + RLS) | schema/migration | — | `coach_rates` table + `rates_select`/`rates_write` policies | exact |
| `components/ParticipantPicker.tsx` (reused, unmodified) | component | — | itself (no change needed) | exact (reuse as-is) |

No file has zero analog — see "No Analog Found" section below for the one partial case.

## Pattern Assignments

### `lib/lesgroepen.ts` (pure rule module, new)

**Analogs:** `lib/series.ts` (temporal propagation shape) + `lib/groups.ts` (header-comment
style, narrow `Pick<>` types, small named exports) + `lib/beurtenkaart.ts`'s `plan*()` family
(plan-then-apply shape, cited directly by RESEARCH.md Pattern 2).

**File header pattern** — every `lib/` file opens with a multi-line Dutch comment explaining
*why the module exists and its boundary*, not an API list. Full verbatim example to imitate
(`lib/series.ts` lines 1-7):

```typescript
// Welke lessen horen bij een herhaalreeks? Puur rekenwerk — geen store, geen scherm — zodat
// "vanaf deze les" één keer vastligt en te testen is, in plaats van op elk scherm opnieuw
// bedacht te worden.
//
// De reeks is niets meer dan een gedeeld `series_id` op gewone boekingen. Dat is met opzet:
// een les uit de reeks verzetten of schrappen raakt de rest niet, want er is geen aparte
// reeks-administratie die daarna zou moeten worden bijgewerkt.
```

A second header style worth matching for `lib/lesgroepen.ts` specifically, since the group
touches pricing/attendance indirectly (`lib/groups.ts` lines 1-9 — note the explicit warning
against a tempting shortcut, the exact shape of warning this new file needs for `roster`):

```typescript
// Groepslessen: één les, meerdere spelers, één betaler.
//
// Alles wat "wie doet er mee aan deze les" beantwoordt staat hier, en nergens anders. De
// verleiding is groot om op een scherm even `b.participant_ids?.length` te tellen, maar dan
// telt het ene scherm een dubbele naam wel mee en het andere niet — en gaat de prijs op de
// boekingskaart afwijken van de prijs in het rapport.
//
// De betaler (`Booking.player_id`) telt altijd mee als speler. Hij staat niet in
// `participant_ids`: daar staan de anderen. Zie de toelichting bij `Booking` in lib/types.
```

**Narrow `Pick<>` input type pattern** (`lib/series.ts` line 12, `lib/groups.ts` line 15) —
lib files declare the minimal slice of `Booking` they need, not the whole type:

```typescript
/** De velden die een vraag over de reeks nodig heeft; meer weet dit bestand niet van een les. */
export type SeriesBooking = Pick<Booking, 'id' | 'series_id' | 'start_time'>;
```

Use this exact shape for `GroupBooking` in `lib/lesgroepen.ts`:
```typescript
export type GroupBooking = Pick<Booking, 'id' | 'group_id' | 'start_time' | 'status' | 'participant_ids'>;
```

**Core "forward from today" pattern** — full function to structurally imitate (NOT literally
reuse — `seriesFrom` is typed around `series_id` and has series-specific fallback semantics
that don't apply here; RESEARCH.md Research Question 4 is explicit that reuse must be
*structural*, same `>=` comparison, same sort direction), `lib/series.ts` lines 16-35:

```typescript
const at = (b: SeriesBooking): number => new Date(b.start_time).getTime();

/**
 * De gegeven les plus alle latere uit dezelfde reeks, op tijd gesorteerd.
 *
 * Nooit de eerdere: een les die al gegeven is, is geschiedenis en hoort niet mee te
 * veranderen omdat iemand de reeks vanaf volgende week stopzet. Even laat beginnende lessen
 * tellen wél mee (`>=`), zodat een les niet ontsnapt doordat hij toevallig op precies
 * hetzelfde moment begint.
 *
 * Een losse les (geen `series_id`) levert alleen zichzelf op — dan gedraagt "vanaf deze les"
 * zich als de gewone actie op één les. Een onbekend id levert niets op.
 */
export function seriesFrom<B extends SeriesBooking>(bookings: B[], bookingId: string): B[] {
  const target = bookings.find((b) => b.id === bookingId);
  if (!target) return [];
  if (!target.series_id) return [target];
  const from = at(target);
  return bookings
    .filter((b) => b.series_id === target.series_id && at(b) >= from)
    .sort((a, b) => at(a) - at(b));
}
```

RESEARCH.md's recommended signature for the new sibling (copy this shape, adjust the Dutch
comment to justify `group_id` instead of `series_id`, and resolve Open Question/Anti-Pattern
about cancelled bookings explicitly rather than silently):

```typescript
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

**Plan-then-apply pattern** (function name prefix `plan`, per CONVENTIONS.md: "Planning/
mutation-preview functions are prefixed `plan`... compute *what should change* and return a
plan/result object; the actual write happens one layer up"). Use this exact shape for
`planRosterChange` (RESEARCH.md Pattern 2, full text):

```typescript
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

**Boolean/`mag`-prefixed guard pattern**, if any permission check is needed beyond reused
`isAdmin` (`lib/rechten.ts` line 43-45, full function — reuse verbatim per D-09, do not write
a parallel `magLesGroepenBeheren` unless the plan genuinely needs a new question):

```typescript
/**
 * Mag deze gebruiker in de agenda van een andere trainer werken — boeken, wijzigen,
 * schrappen? Alleen een beheerder. Een gewone trainer blijft bij zijn eigen agenda, want
 * anders kan een collega jouw lessen schrappen zonder dat je het merkt.
 */
export function magInElkeAgenda(user: User | null | undefined): boolean {
  return isAdmin(user);
}
```

**Small named exports, not one big function** — `lib/groups.ts` exposes `participantIdsOf`,
`groupSize`, `isGroupLesson`, `lessonPlayerIds`, `playsIn`, `shortGroupLabel`,
`groupSizeLabel` as separate ~5-10 line exports rather than one large function. `lib/
lesgroepen.ts` should follow the same decomposition: `validateLesGroep`, `groupBookingsFrom`,
`planRosterChange`, `groepSleutel`, `actieveGroepen`/`gearchiveerdeGroepen` as separate exports.

---

### `lib/lesgroepen.test.ts` (new)

**Analog:** `lib/series.test.ts`, read in full (69 lines) — copy its exact structure: a `base`
fixture `Booking`, a small factory function (`week`/`les`) that layers `Partial<Booking>`
patches onto the base, then one `describe` block with short, behaviorally-named `it(...)`
cases. **No `jest.mock` anywhere** — this file uses only plain arrays and a fixed `now: Date`.

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
  // ... etc
});
```

RESEARCH.md already specifies the single most important test for this new file, in this
exact style (its own "Research Question Answers" §5, quoted verbatim — use as the literal
starting point for the invariant test):

```typescript
test('een groepswijziging raakt nooit een les die al geweest is', () => {
  const gisteren = les('b-1', '2026-09-01T10:00', { group_id: 'g-1', participant_ids: ['oud'] });
  const morgen   = les('b-2', '2026-09-10T10:00', { group_id: 'g-1', participant_ids: ['oud'] });
  const plan = planRosterChange(groep('g-1'), ['nieuw'], [gisteren, morgen], new Date('2026-09-05'));
  expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-2']); // niet 'b-1'
});
```

Also extend (regression, not new files) `lib/groups.test.ts` and `lib/series.test.ts` with
fixtures that include `group_id` on a `Booking`, asserting unchanged behavior (GROEP-04).

---

### `lib/types.ts` (add `LesGroep`, extend `Booking`/`Settings`)

**Analog for the new interface's shape and comment density:** `OuderKind` (lines 442-460, full
verbatim) — a small persistent entity with an id, a few FK-style string fields, a status/flag,
and a Dutch doc comment explaining *why the entity exists*, not what its fields are:

```typescript
/**
 * Welke ouder bij welk kind hoort.
 *
 * Wie een kind wil volgen vraagt het aan, een trainer beslist — dezelfde vorm als een
 * lesaanvraag, en om dezelfde reden: zonder die stap kon iedereen het dossier van elk kind
 * van de club openen door de naam te kiezen.
 *
 * Een geweigerde aanvraag blijft staan in plaats van te verdwijnen, zodat de ouder te horen
 * krijgt wat er met zijn vraag gebeurd is.
 */
export interface OuderKind {
  id: string;
  parent_id: string;
  child_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  decided_at?: string;
  /** De trainer die besliste. Leeg zolang er niets beslist is. */
  decided_by?: string;
}
```

**Analog for how a new field is added to `Booking` with a cross-reference comment to its
owning `lib/` module** — `series_id` (types.ts lines 184-191, verbatim, the exact pattern
`group_id` must follow):

```typescript
  /**
   * Alle lessen uit dezelfde herhaalreeks delen dit nummer. Leeg bij een losse les.
   *
   * Meer is een reeks niet: elke les blijft een gewone boeking die je los kunt verzetten of
   * schrappen zonder de rest te raken. Zie `seriesFrom` in lib/series — de enige plek die
   * uitrekent welke lessen "vanaf deze les" bij elkaar horen.
   */
  series_id?: string;
```

Write `group_id?: string` immediately after it with the parallel comment ("Zie
`groupBookingsFrom` in lib/lesgroepen"), and per Research Question 3, an explicit note that it
coexists with `series_id` and does not replace it.

**Analog for adding a setting to `Settings`** — `Settings.vakanties` (types.ts lines 407-420):
```typescript
export interface Settings {
  booking_end_time: string;
  /**
   * De dagen waarop de club geen les geeft. Leeg of afwezig betekent: het hele jaar door
   * les — precies zoals de app zich gedroeg voordat dit bestond.
   */
  vakanties?: Vakantie[];
  ...
}
```
Add `lesson_duration_minutes?: number` the same way, using the Dutch comment text RESEARCH.md
already drafted (Research Question 9).

---

### `lib/sync.ts` (wire `lesGroepen` into `SyncTable`/`diffStores`)

**Analog:** the existing `'relaties'` entry — the most recently added table, added the exact
same way a new `lesGroepen` collection must be. Four places to touch, shown end-to-end
(verbatim, lines 22-24, 51-64, 118-134):

1. The union type:
```typescript
export type SyncTable =
  | 'users' | 'courts' | 'bookings' | 'lessons' | 'progress' | 'goals' | 'beurtenkaarten'
  | 'memos' | 'relaties';
```
→ append `| 'lesGroepen'`.

2. The store shape:
```typescript
export interface SyncableStore {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  lessons: Lesson[];
  progress: StudentProgress[];
  goals: PlayerGoal[];
  beurtenkaarten: Beurtenkaart[];
  memos: Memo[];
  /** De koppelingen ouder-kind, aangevraagd of beslist. */
  relaties: OuderKind[];
  settings: Settings;
  installed_catalogues?: string[];
}
```
→ add `lesGroepen: LesGroep[];` with its own one-line Dutch comment, and import `LesGroep`
from `./types` in the top import block.

3. The `before` fallback object inside `diffStores` (lines 118-122) — **must** include the
new key or a first-ever save silently loses the concept of an empty table:
```typescript
  const before: SyncableStore = previous ?? {
    users: [], courts: [], bookings: [], lessons: [], progress: [], goals: [],
    beurtenkaarten: [], memos: [], relaties: [], settings: next.settings,
    installed_catalogues: [],
  };
```
→ add `lesGroepen: [],`.

4. The `tables` array (lines 124-134):
```typescript
  const tables: TableChange[] = [
    changeFor('users', before.users, next.users),
    ...
    changeFor('relaties', before.relaties, next.relaties),
  ].filter((c) => c.upsert.length > 0 || c.remove.length > 0);
```
→ add `changeFor('lesGroepen', before.lesGroepen, next.lesGroepen),`.

---

### `providers/mockStore.ts` (add `lesGroepen: LesGroep[]` to `StoreData`)

**Analog:** the existing `relaties: OuderKind[]` field, wired through all three functions that
must agree (verbatim, lines 18-33, 35-49, 56-72):

```typescript
export interface StoreData {
  users: User[];
  courts: Court[];
  bookings: Booking[];
  beurtenkaarten: Beurtenkaart[];
  lessons: Lesson[];
  progress: StudentProgress[];
  memos: Memo[];
  goals: PlayerGoal[];
  /** De koppelingen ouder-kind, aangevraagd of beslist. Zie lib/types: OuderKind. */
  relaties: OuderKind[];
  settings: Settings;
  installed_catalogues?: string[];
}

function freshSeed(): StoreData {
  return {
    users: [...seedUsers],
    courts: [...seedCourts],
    bookings: [...seedBookings],
    beurtenkaarten: [],
    lessons: [...seedLessons],
    progress: [...seedProgress],
    memos: [],
    goals: [],
    relaties: [...seedRelaties],
    settings: { ...defaultSettings },
    installed_catalogues: [],
  };
}
```

```typescript
function withDefaults(data: StoreData): StoreData {
  return {
    ...data,
    users: data.users ?? [],
    courts: data.courts ?? [],
    bookings: migrateBookings(data.bookings),
    beurtenkaarten: data.beurtenkaarten ?? [],
    lessons: data.lessons ?? [],
    progress: data.progress ?? [],
    memos: data.memos ?? [],
    goals: data.goals ?? [],
    // Een opslag van vóór de ouderkoppeling heeft dit veld niet.
    relaties: data.relaties ?? [],
    settings: { ...defaultSettings, ...data.settings },
  };
}
```

Add `lesGroepen: LesGroep[]` to `StoreData`, `lesGroepen: []` to `freshSeed()` (no seed data —
this is a genuinely new, empty-by-default entity, matching `relaties`/`goals`/`memos`), and
`lesGroepen: data.lesGroepen ?? []` to `withDefaults()` with the matching one-line Dutch
comment ("Een opslag van vóór de lesgroepen heeft dit veld niet.") — this last one is called
out by RESEARCH.md as *critical*, since skipping it crashes any screen calling
`.lesGroepen.map(...)` for every club whose local store predates this field.

---

### `providers/supabaseStore.ts` (wire `lesGroepen` → `lesson_groups`)

**Analog:** the `ouder_kind`/`relaties` wiring via `selectAllOptioneel`, not `selectAll` (used
because `memos`/`ouder_kind`/`coach_rates` all shipped after the initial schema — exactly
`lesson_groups`'s situation per D-11). Verbatim (lines 30-41, 133-177):

```typescript
const TABLES: Record<SyncTable, string> = {
  users: 'users',
  courts: 'courts',
  bookings: 'bookings',
  lessons: 'lessons',
  progress: 'student_progress',
  goals: 'player_goals',
  beurtenkaarten: 'beurtenkaarten',
  memos: 'memos',
  relaties: 'ouder_kind',
};
```
→ add `lesGroepen: 'lesson_groups',`.

```typescript
export async function loadFromSupabase(): Promise<StoreData> {
  const [
    users, courts, bookings, lessons, progress, goals, beurtenkaarten, memos, relaties, rates,
  ] = await Promise.all([
    selectAll<User>('users'),
    ...
    // Deze twee kwamen later dan de rest van het schema; een club die de nieuwe SQL nog
    // niet draaide kent ze niet, en dan mag de hele lading daar niet op stuklopen.
    selectAllOptioneel<OuderKind>('ouder_kind', ['auth_id']),
    selectAllOptioneel<RateRow>('coach_rates', ['auth_id', 'updated_at']),
  ]);
  ...
  return {
    users: metTarief(users, rates),
    courts, bookings, lessons, progress, goals, beurtenkaarten, memos, relaties,
    settings: { ...defaultSettings, ...stored },
    installed_catalogues: (catalogueRows.data ?? []).map((r) => (r as { id: string }).id),
  };
}
```
→ add `selectAllOptioneel<LesGroep>('lesson_groups')` to the `Promise.all` array (with the
same "kwam later dan het schema" comment extended to cover it), destructure it as
`lesGroepen`, and include `lesGroepen` in the returned object. Import `LesGroep` in the type
import block at the top of the file. No change needed to `saveToSupabase` — the generic
`change.tables` loop (lines 271-286) already handles any `SyncTable` entry uniformly via
`TABLES[table]`, exactly like every table except `users` (which has the `coach_rates`
side-channel) and `relaties` (which needs none).

---

### `providers/SimpleDataProvider.tsx` (new actions: `addLesGroep`, `updateLesGroep`, `updateLesGroepRoster`, `archiveLesGroep`)

**Analog:** the `relaties` action family — `vraagKindAan`, `beslisOverKind`, `wisRelatie`
(lines 952-988, full verbatim) — same shape as every provider action: read `storeRef.current`,
bail on `null`, build the new value(s), one `commit()` call.

```typescript
const vraagKindAan = useCallback(async (childId: string) => {
  const store = storeRef.current;
  if (!store || !currentUserId) return;
  if (aanvraagVoor(currentUserId, childId, store.relaties)) return;
  const nieuw: OuderKind = {
    id: newId('ok'),
    parent_id: currentUserId,
    child_id: childId,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  await commit({ ...store, relaties: [...store.relaties, nieuw] });
}, [commit, currentUserId]);

const beslisOverKind = useCallback(async (relatieId: string, goedgekeurd: boolean) => {
  const store = storeRef.current;
  if (!store) return;
  await commit({
    ...store,
    relaties: store.relaties.map((r) => (r.id === relatieId
      ? { ...r, status: goedgekeurd ? 'approved' as const : 'rejected' as const, ... }
      : r)),
  });
}, [commit, currentUserId]);

const wisRelatie = useCallback(async (relatieId: string) => {
  const store = storeRef.current;
  if (!store) return;
  await commit({ ...store, relaties: store.relaties.filter((r) => r.id !== relatieId) });
}, [commit]);
```

`addLesGroep` should also match `addBooking`'s id-prefix and validation-before-commit shape
(lines 558-575, verbatim):

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
Use `newId('lg')` (or similar short prefix, consistent with `newId('b')`/`newId('ok')`/
`newId('l')` conventions in `providers/mockStore.ts` line 84-86) for `addLesGroep`.

`updateLesGroepRoster` is the one action with real logic (calls `planRosterChange` from
`lib/lesgroepen.ts`) and must patch **two** collections in **one** `commit()` — this exact
two-collection-one-commit shape is already used elsewhere in this file (e.g. `beurtenkaarten`
+ `bookings` together at line 653 and line 894):

```typescript
await commit({ ...store, beurtenkaarten: cards, bookings });
...
await commit({ ...store, beurtenkaarten: plan.cards, bookings: plan.bookings });
```
→ `updateLesGroepRoster` should do the same: `await commit({ ...store, lesGroepen: [...updated group...], bookings: [...patched bookings...] });` in a single call, per the "snapshot-atomicity" constraint (ARCHITECTURE.md) and D-07/D-08.

Finally, remember to export each new action from the context value object (around line
1128-1169) and add each to the `useMemo` dependency array on the same lines — this file
already does this for `addBooking`, `addBookingSeries`, etc.; a forgotten export/dependency
entry is the most common way a new action silently doesn't reach screens.

---

### `app/admin/index.tsx` (register the tile)

**Analog:** the existing `leden` tile — admin-only within an already-coach-gated page (lines
1-136, relevant excerpt lines 35-41 and 80-90, verbatim):

Page-level gate (isCoach, not isAdmin — the *page* is for all coaches, individual admin tiles
gate further):
```typescript
if (!isCoach(currentUser)) {
  return (
    <Screen scroll={false}>
      <Text style={styles.muted}>{t('Beheer is alleen voor trainers.')}</Text>
    </Screen>
  );
}
```

Tile-level admin gate, under the `'club'` group (exactly what CONTEXT.md suggests — "'Club'
ligt voor de hand"):
```typescript
...(isAdmin(currentUser)
  ? [{ key: 'leden', title: t('Leden'), subtitle: t('Gegevens, type account en beheerders'), icon: UserCog, onPress: () => router.push('/admin/leden') } as Tile]
  : []),
```
→ add a parallel entry, e.g.:
```typescript
...(isAdmin(currentUser)
  ? [{ key: 'lesgroepen', title: t('Lesgroepen'), subtitle: t('Naam, niveau, rooster'), icon: Users, onPress: () => router.push('/admin/lesgroepen') } as Tile]
  : []),
```
(Import an unused-elsewhere icon from `lucide-react-native`; `Users` is already imported for
the `ouders` tile — pick a distinct one, e.g. `Layers` or `Users2`, to avoid two tiles sharing
an icon glyph, unless the plan decides a shared icon is fine.)

**Critical anti-pattern flagged by RESEARCH.md:** hiding the tile is not enough. Every new
screen under `app/admin/lesgroepen/` must ALSO gate itself on `isAdmin` at the top (TOEG-01 —
the whole module, not just the tile, per RESEARCH.md's "Anti-Patterns to Avoid" section):

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

Screen composition primitives to reuse, unmodified (`components/ui/`): `Screen` (responsive
scroll wrapper), `ActionTile` + `TileGrid` (choice tiles, used for any list-of-groups display
if tile-shaped, otherwise a plain list is fine per Claude's Discretion in CONTEXT.md).

---

### `components/ParticipantPicker.tsx` (reuse as-is for roster editing)

No modification needed — read in full (97 lines). Its header comment states exactly why it is
shared and must not be forked:

```typescript
// De extra spelers van een groepsles kiezen. Eén component, gedeeld door het boekscherm en
// het detailblad: wie er meedoet is dezelfde vraag, of je de les nu aanmaakt of achteraf
// bijstelt, en twee keer overgeschreven zou het twee keer anders gaan werken.
```

Its props signature is exactly what a group roster editor needs:
```typescript
export function ParticipantPicker({
  players,      // User[] — all pickable players
  payerId,      // string | undefined — excluded from the choosable list
  value,        // string[] — current roster/participant ids
  onChange,     // (ids: string[]) => void
  onRequestCreate, // optional: create-unknown-name flow
}: { ... }): React.JSX.Element
```
For a group (no single "payer"), pass `payerId={undefined}` — the component already handles
that (`players.filter((p) => p.id !== payerId && ...)` with `payerId` possibly `undefined`
simply excludes nothing extra beyond `value`).

---

### `lib/import-leden.ts` (the "compute a plan, show it, then write" pattern — reference only, not modified this phase)

Not touched in Phase 1, but its two-stage shape is exactly the plan/execute discipline the
`updateLesGroepRoster` flow must also honor at the UI layer (show `planRosterChange`'s result
before committing, if the plan calls for a confirmation step). Header comment (verbatim, lines
1-6):

```typescript
// Een ledenlijst uit Excel omzetten naar leden van de club.
//
// Wat hier staat is alle regelgeving van de import en niets anders: geen databank, geen
// scherm, geen bestand. Het scherm geeft rijen tekst en de huidige ledenlijst, en krijgt
// een plan terug van wat er zou gebeuren. Dat is waarom de trainer het resultaat kan zien
// vóór er iets weggeschreven wordt — en waarom die belofte hier te testen valt.
```

The plan/execute split itself (`planImport` returns an `ImportPlan`; `pasImportToe` takes that
plan plus a small `ImportActies` interface of just the provider functions it needs, and
applies it step by step, counting successes/failures without throwing):

```typescript
export interface ImportActies {
  addUser: (u: Omit<User, 'id'>) => Promise<User | null>;
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
}

export async function pasImportToe(
  plan: ImportPlan,
  acties: ImportActies,
  voortgang?: (klaar: number, totaal: number) => void,
): Promise<ImportUitslag> {
  ...
  for (const lid of plan.nieuw) {
    try {
      if (await acties.addUser(lid)) toegevoegd++; else mislukt++;
    } catch {
      mislukt++;
    }
    klaar++;
    voortgang?.(klaar, totaal);
  }
  ...
}
```

---

### `supabase-schema.sql` (append `lesson_groups` table, `bookings.group_id` column, admin-only RLS)

**Analog:** `coach_rates` table + its `rates_select`/`rates_write` policies — RESEARCH.md
names this explicitly as the exact admin-only shape to copy, because it has **zero ownership
semantics** and is therefore provably immune to the upsert trap.

**Design notes at the top of the file** (lines 1-23, full verbatim) — the three numbered
conventions every new table decision must be checked against:

```sql
-- Tennis App — Supabase-schema.
--
-- Voer dit uit in de SQL-editor van je Supabase-project (Database → SQL editor → New query,
-- alles plakken, Run). Zet daarna de project-URL en de anon key in .env; zie .env.example.
-- Het script is idempotent: je mag het opnieuw draaien na een wijziging.
--
-- Drie keuzes die de rest van dit bestand verklaren:
--
-- 1. Sleutels zijn `text`, niet `uuid`. De app maakt zijn eigen id's ("b-m1k2j3-x9y") en doet
--    dat al sinds de eerste versie; ze zijn uniek en leesbaar in een foutmelding. Zou de
--    databank ze uitdelen, dan moest elke schrijfactie eerst wachten op een antwoord voordat
--    het scherm iets kon tonen.
--
-- 2. Een gebruiker en zijn login zijn twee dingen. `users.auth_id` wijst naar `auth.users`,
--    maar mag leeg zijn: een trainer voegt een speler toe die nog nooit ingelogd heeft, en
--    die speler bestaat dan al met lessen en al. Logt hij later voor het eerst in, dan wordt
--    zijn account aan die bestaande rij gekoppeld op e-mailadres (zie `link_auth_user`).
--    Was de login zelf de sleutel geweest, dan had zo'n speler geen dossier kunnen hebben.
--
-- 3. Lijstjes die alleen als geheel betekenis hebben (de beurten van een kaart, de oefeningen
--    van een training, de deelnemers van een groepsles) staan als jsonb en niet in een eigen
--    tabel. Ze worden nooit los opgevraagd of los gewijzigd — altijd samen met hun les of
--    kaart — dus een aparte tabel zou alleen maar een join per scherm opleveren.
```
→ Design note #3 is the direct justification RESEARCH.md cites for making `lesson_groups.roster`
a `jsonb` array, not a join table.

**`coach_rates` table DDL** (lines 187-191, full verbatim — the shape to copy: no `created_by`,
no ownership column at all):
```sql
create table if not exists coach_rates (
  coach_id text primary key references users(id) on delete cascade,
  hourly_rate numeric not null,
  updated_at timestamptz not null default now()
);
```

**`coach_rates` policies** (lines 636-646, full verbatim — the exact admin-only shape named by
RESEARCH.md as this phase's template):
```sql
-- coach_rates: je eigen loon, of alles als je de club beheert. Dit is de hele reden dat het
-- uurloon een eigen tabel heeft — zie daar. Een collega valt buiten beide takken en krijgt
-- geen rij terug; niet een rij met een leeg bedrag, maar niets.
drop policy if exists rates_select on coach_rates;
create policy rates_select on coach_rates for select
  to authenticated using (coach_id = app_user_id() or is_admin());

-- Schrijven alleen de beheerder: dit is wat de club uitbetaalt.
drop policy if exists rates_write on coach_rates;
create policy rates_write on coach_rates for all
  to authenticated using (is_admin()) with check (is_admin());
```
`lesson_groups` is even simpler than `coach_rates` (no per-row "is this yours" split at all —
select and write are BOTH pure `is_admin()`), so both new policies should look like
`rates_write`, not `rates_select`:
```sql
create policy lesson_groups_select on lesson_groups for select
  to authenticated using (is_admin());
create policy lesson_groups_write on lesson_groups for all
  to authenticated using (is_admin()) with check (is_admin());
```

**The upsert-trap comment to cross-reference** (`bookings_insert`, lines 729-749, full
verbatim — this is the exact incident D-10/TOEG-02 require every new admin-only policy's
comment to point back to):
```sql
drop policy if exists bookings_insert on bookings;
-- LET OP bij het wijzigen: de app schrijft met een upsert (`insert ... on conflict do
-- update`, zie saveToSupabase). Postgres controleert daarbij ook déze policy, óók als de
-- rij allang bestaat en er alleen iets aan verandert. Alles wat hier over de *maker* van de
-- rij wordt geëist, geldt dus ook bij elke latere wijziging door iemand anders.
--
-- Daarom staat er bij de trainer geen `created_by = app_user_id()` meer. Dat stond er wel,
-- en het brak het goedkeuren: een speler vraagt een les aan (created_by = de speler), de
-- trainer keurt goed, de rij wordt ge-upsert — en dan klopte de trainerregel niet meer
-- omdat de maker iemand anders was. De knop deed niets en zei niets. Het beschermde ook
-- niets: een trainer mag elke les in zijn eigen agenda sowieso al wijzigen.
create policy bookings_insert on bookings for insert
  to authenticated with check (
    is_admin()
    or (is_coach() and coach_id = app_user_id())
    or (player_id = app_user_id() and status = 'pending' and created_by = app_user_id())
    or (is_mijn_kind(player_id) and status = 'pending' and created_by = app_user_id())
  );
```

**Existing `bookings` FK-column pattern to copy for `group_id`** (line 71, verbatim — the
exact nullable-FK-with-`on delete set null` shape RESEARCH.md's Research Question 2
recommends):
```sql
court_id text references courts(id) on delete set null,
```

**Full recommended SQL block** (already drafted in RESEARCH.md Research Question 6, ready to
append verbatim to the bottom `alter table ... if not exists` section per D-11 — the executor
should not need to re-derive this):
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

drop policy if exists lesson_groups_select on lesson_groups;
create policy lesson_groups_select on lesson_groups for select
  to authenticated using (is_admin());
drop policy if exists lesson_groups_write on lesson_groups;
create policy lesson_groups_write on lesson_groups for all
  to authenticated using (is_admin()) with check (is_admin());
```

D-11 constraint (do not skip): this block only ships as text in this SQL file. **The user
runs it themselves** in the Supabase SQL editor — no task in this phase may assume it has been
applied, which is exactly why `supabaseStore.ts` must use `selectAllOptioneel`, not
`selectAll`, for `lesson_groups` (see that section above).

## Shared Patterns

### Admin-only dual guard (client + RLS)
**Source:** `lib/rechten.ts::isAdmin` (client) + `supabase-schema.sql`'s `is_admin()` (DB, the
real backstop — see `lib/rechten.ts`'s own header: "De app is niet de bewaker").
**Apply to:** every new screen under `app/admin/lesgroepen/`, every provider action that
touches `lesGroepen`/`bookings.group_id`, and both new RLS policies.

### Snapshot-atomicity commit
**Source:** `providers/SimpleDataProvider.tsx` — every action shape: read `storeRef.current`,
compute the next full snapshot (possibly touching two collections, e.g. `beurtenkaarten` +
`bookings` at once), call `commit()` exactly once.
**Apply to:** `addLesGroep`, `updateLesGroep`, `updateLesGroepRoster` (patches `lesGroepen` AND
`bookings` together), `archiveLesGroep`.

### Plan-then-apply for anything with a preview-worthy consequence
**Source:** `lib/beurtenkaart.ts`'s `plan*()` family; `lib/import-leden.ts`'s
`planImport`/`pasImportToe` split.
**Apply to:** `lib/lesgroepen.ts::planRosterChange` — compute the patch in `lib/`, let the
provider apply it; do not compute the roster-propagation patch inline inside
`SimpleDataProvider.tsx`.

### `selectAllOptioneel` for any pre-migration-safe table
**Source:** `providers/supabaseStore.ts`, used for `memos`, `ouder_kind`, `coach_rates`.
**Apply to:** `lesson_groups`, mandatorily, per D-11.

### `t()` for every user-facing string
**Source:** `lib/i18n.ts`; call sites throughout `app/admin/index.tsx`
(`t('Lesgroepen')`, etc.).
**Apply to:** every new screen and every subtitle/label/error message in this phase. The
Dutch sentence IS the translation key — never invent a symbolic key.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/admin/lesgroepen/[id].tsx` (bulk lesson generation UI) | screen | batch | Explicitly out of scope this phase (D-14) — no analog needed; RESEARCH.md defers this to Phase 5's `lib/recurrence.ts::planSeries`. If Claude's Discretion decides to include a minimal "link one existing booking to this group" control instead, its closest analog is the existing single-booking edit flow's `group_id`-less form, not a new pattern. |

## Metadata

**Analog search scope:** `lib/`, `providers/`, `app/admin/`, `components/`, `supabase-schema.sql`
**Files scanned (full or targeted read):** `lib/series.ts`, `lib/series.test.ts`,
`lib/groups.ts`, `lib/rechten.ts`, `lib/types.ts`, `lib/sync.ts`, `lib/import-leden.ts`,
`providers/mockStore.ts`, `providers/supabaseStore.ts`, `providers/SimpleDataProvider.tsx`
(targeted sections), `app/admin/index.tsx`, `components/ParticipantPicker.tsx`,
`supabase-schema.sql` (targeted sections: header, `bookings`, `coach_rates`, `ouder_kind`,
all RLS policy blocks, `bookings_insert` upsert-trap comment)
**Pattern extraction date:** 2026-09-05
