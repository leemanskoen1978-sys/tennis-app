# Phase 2: Wie gaf de les écht - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 2 new (`lib/lesgever.ts` + test) + 7 modified
**Analogs found:** 9 / 9

## Language convention (read before writing anything)

Identifiers, comments and UI strings are **Dutch**. Comments explain **WHY**, often naming the
exact incident/bug they prevent, not what the code does. This phase repeats, verbatim in spirit,
the `planMethodChange` header's own framing: "dat gat dat daarmee gedicht werd, liet een speler
twee keer betalen" — the new `lib/lesgever.ts` header must name its own equivalent gap (vaste
trainer uitbetaald voor een les die hij niet gaf, of de vervanger niets). There is **no
`jest.mock`/`jest.fn` anywhere in this codebase** — logic is pure, `now`/data passed as
parameters. Do not introduce mocking in `lib/lesgever.test.ts`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/lesgever.ts` (new) | pure rule module (single-source query) | CRUD (derived read) | `lib/beurtenkaart.ts::planMethodChange` (guarded-path discipline) + `lib/groups.ts` (narrow `Pick<>`, tiny exports) | exact (structural sibling of the D-05 discipline) |
| `lib/lesgever.test.ts` (new) | test | — | `lib/payments.test.ts` (fixture shape, no mocking) | exact |
| `lib/types.ts` (add `Booking.taught_by_id`) | model | — | `Booking.group_id`/`series_id` field + comment | exact |
| `lib/payments.ts` (`totalCoachPayout` call site change) | service (pure calc) | CRUD (aggregate) | itself, `coachPayout`/`bookingPrice` neighbourhood — no analog needed elsewhere, this file is both the site and its own best precedent | exact |
| `lib/reports.ts` (`payoutsByCoach`, `coachPayoutThisMonth` call site changes) | service (pure calc) | CRUD (grouping/filter) | itself — same reasoning as above | exact |
| `providers/SimpleDataProvider.tsx` (`setTaughtBy` new action + `updateBooking` exclusion) | provider action (guarded write) | request-response (single commit) | `setPaymentMethod` (guarded write via a `plan*` function) — though `setTaughtBy` needs no `plan*` function since there is no side effect to reconcile | exact for the write shape, partial for the "no plan needed" simplification |
| `supabase-schema.sql` (`bookings.taught_by_id` column + `bewaak_betaalvelden` trigger amendment) | schema/migration | — | the trigger's own existing early-return structure + the `lesson_groups`/`group_id` `alter table` block (freshest in-house example of the append-only convention) | exact |
| `components/BookingDetailSheet.tsx` (show vervanger name) | component | request-response (render) | itself, `coachName`/`Trainer:` line (lines 139, 307) | exact (in-file extension, no external analog needed) |
| `components/LessonCards.tsx` (short-card marker) | component | request-response (render) | itself, `other` label computation (line 64-66) | exact (in-file extension) |

No file has zero analog.

## Pattern Assignments

### `lib/lesgever.ts` (new) — the one guarded path (D-05)

**Analog:** `lib/beurtenkaart.ts::planMethodChange` — this is the exact discipline CONTEXT.md's
D-05 names by name: "Dit is bewust dezelfde discipline als `planMethodChange` voor betalingen:
het gat dat daarmee gedicht werd, liet een speler twee keer betalen." Quote the full function so
the new header can match its tone and its "guarded path" shape (`lib/beurtenkaart.ts` lines 65-142
read in full):

```typescript
/** De boekinggegevens die een betaalwijzewissel nodig heeft. */
export type MethodChangeBooking = Pick<
  Booking,
  | 'id' | 'player_id' | 'participant_ids' | 'court_id' | 'start_time' | 'end_time'
  | 'status' | 'payment_method' | 'beurtenkaart_id' | 'payment_split'
>;

export interface MethodChangePlan {
  cards: Beurtenkaart[];
  cardId: string | undefined;
  /** Gezet als de wissel niet doorgaat; `cards` en `cardId` blijven dan zoals ze waren. */
  error: string | null;
}

/**
 * De hele beslissing achter een betaalwijzewissel op één plek, zonder store of state:
 * zo is elke overgang te testen in plaats van met de hand na te spelen in de app.
 * De aanroeper commit het resultaat alleen als `error` leeg is.
 */
export function planMethodChange(
  cards: Beurtenkaart[],
  booking: MethodChangeBooking,
  method: PaymentMethod,
  sponsor?: SponsorContext,
): MethodChangePlan {
  const unchanged = { cards, cardId: booking.beurtenkaart_id };

  // Een geannuleerde les mag geen beurt opeten en hoort geen betaalwijze te krijgen.
  if (booking.status === 'cancelled') {
    return { ...unchanged, error: t('Een geannuleerde les krijgt geen betaalwijze.') };
  }
  ...
  return { cards: next, cardId, error: null };
}
```

The RESEARCH.md-drafted `lib/lesgever.ts` is a *simpler* member of the same family — no plan
object, just the single-answer function, because there is nothing to reconcile (no card, no
split). Use its exact drafted text as the starting point (RESEARCH.md "Pattern 1", reproduced
here verbatim since it is the literal target, not a paraphrase):

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

**Narrow `Pick<>` convention it must match** — `lib/series.ts` line 12 and `lib/groups.ts`
line 15 both declare the minimal slice of `Booking` they need rather than importing the whole
type; `LesgeverBoeking` above already follows this. Keep exports small and named (per
CONVENTIONS.md "Module Design": only export what other modules actually import).

---

### `lib/lesgever.test.ts` (new)

**Analog:** `lib/payments.test.ts` (full fixture style, no `jest.mock`, read lines 1-15):

```typescript
import type { Booking, Court, User } from './types';
import { ... } from './payments';

const base: Booking = {
  id: '1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};
```

Extend this exact fixture shape with `taught_by_id` via `Partial<Booking>` patches, per
CONTEXT.md's own drafted acceptance fixture (RESEARCH.md "Test Strategy" section, quoted
verbatim, use directly):

```typescript
const trainerVast: User = { id: 'u-vast', name: 'Vaste Trainer', role: 'coach', hourly_rate: 20, email: 'v@x.be' };
const trainerVervanger: User = { id: 'u-vervanger', name: 'Vervanger', role: 'coach', hourly_rate: 30, email: 'w@x.be' };
const les = (patch: Partial<Booking> = {}): Booking => ({
  id: 'b-1', player_id: 'p-1', coach_id: trainerVast.id, court_id: 'c-1',
  start_time: '2026-09-10T10:00:00.000Z', end_time: '2026-09-10T11:00:00.000Z',
  status: 'confirmed', payment_method: 'cash', ...patch,
});

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
    expect(vast).toBeUndefined();
    expect(vervanger?.amount).toBe(30);
  });
});
```

This is the literal proof for D-04 and VERV-02. Also add a D-06 regression test explicitly:
revenue (`bookingPrice`/`totalRevenue`) must be byte-identical whether or not `taught_by_id` is
set — D-06 is "easy to violate silently" per RESEARCH.md.

**Where these tests live:** new `lib/lesgever.test.ts` for `lesgeverId` itself (mirrors
`lib/series.test.ts`'s size/style); additions to the *existing* `lib/reports.test.ts` and
`lib/payments.test.ts` for the four call-site changes — not new files, per CONVENTIONS.md
"Module Design" (a new file is only for a genuinely new concern).

---

### `lib/types.ts` — `Booking.taught_by_id`, next to `coach_id`, `series_id`, `group_id`

**Full context, read verbatim** (`lib/types.ts` lines 155-203) — this is the exact interface
and comment-density convention `taught_by_id` must match, immediately visible next to the two
most recent precedents (`series_id`, `group_id`):

```typescript
export interface Booking {
  id: string;
  /** De speler die betaalt. Ook bij een groepsles: één les, één rekening. */
  player_id: string;
  participant_ids?: string[];
  coach_id: string;
  court_id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  status: BookingStatus;
  payment_method: PaymentMethod;
  beurtenkaart_id?: string;
  payment_split?: PaymentSplit;
  /**
   * Alle lessen uit dezelfde herhaalreeks delen dit nummer. Leeg bij een losse les.
   *
   * Meer is een reeks niet: elke les blijft een gewone boeking die je los kunt verzetten of
   * schrappen zonder de rest te raken. Zie `seriesFrom` in lib/series — de enige plek die
   * uitrekent welke lessen "vanaf deze les" bij elkaar horen.
   */
  series_id?: string;
  /**
   * De lesgroep waar deze les bij hoort. Leeg bij een les die los van een groep bestaat.
   *
   * Dit veld staat náást `series_id` en vervangt het niet: een reeks is de batch waarin een
   * hoop lessen ooit in één keer zijn aangemaakt, een groep is een blijvende identiteit die
   * het verzetten of schrappen van één les overleeft. Een les kan dus allebei dragen, of
   * maar één van de twee. Zie `groupBookingsFrom` in lib/lesgroepen — de enige plek die
   * uitrekent welke lessen van een groep "vanaf vandaag" zijn, en dus welke een wijziging
   * aan die groep nog mogen voelen.
   */
  group_id?: string;
  notes?: string;
  ...
```

Add `taught_by_id?: string;` directly after `coach_id: string;` (per RESEARCH.md's Storage
Wiring section — the natural neighbour, not at the tail with the newer optional fields), with a
Dutch doc comment following the exact `series_id`/`group_id` template: what empty means, why it
is a separate field, and a pointer to the one function that answers the question:

```typescript
  coach_id: string;
  /**
   * Wie deze les werkelijk gaf, als dat niet de vaste trainer (`coach_id`) was. Leeg
   * betekent "de vaste trainer gaf hem zelf" (D-02) — er hoeft dus niets ingevuld te worden
   * voor de gewone les. `coach_id` verandert hierdoor NOOIT: dat blijft van wie de les is,
   * zijn agenda en zijn dubbele-boekingscontrole. Loon, uren en het trainersrapport lezen
   * hier, en nergens anders, wie er echt op de baan stond — zie `lesgeverId` in lib/lesgever.
   */
  taught_by_id?: string;
```

---

### `lib/payments.ts` — `coachPayout`, `totalCoachPayout`, `bookingPrice` (D-06's line)

**Full text, read verbatim** (`lib/payments.ts` lines 369-428) — quoted in full so the planner
sees exactly where the coach's rate enters (`coachPayout`/`totalCoachPayout`) versus where the
court's rate enters (`bookingPrice`). This is D-06's line and it must not blur:

```typescript
/**
 * Wat de BETALER betaalt — één iemand, ook bij een groepsles. Wat de TRAINER eraan
 * overhoudt is een ander bedrag met een ander tarief; zie `coachPayout` hieronder.
 */
export function bookingPrice(b: PricedBooking, court: PricedCourt | undefined): number {
  const minutes = bookingMinutes(b);
  if (minutes === 0) return 0;
  return proRata(rateForGroup(court, groupSize(b)), minutes);
}

/**
 * Wat de TRAINER voor één les krijgt: zijn eigen uurtarief (`User.hourly_rate`) naar rato
 * van de duur. Bewust dezelfde rekenregel als `bookingPrice` — zelfde afronding op de cent,
 * en een kapotte of omgekeerde eindtijd geeft ook hier 0 — zodat de twee bedragen naast
 * elkaar op één scherm nooit een andere duur blijken te gebruiken.
 *
 * De groepsgrootte doet hier NIET mee: de trainer geeft één uur les, of daar nu één of vier
 * spelers op de baan staan. Alleen wat de club vraagt loopt op met de groep, niet wat de
 * trainer krijgt.
 *
 * Geen tarief ingevuld telt als 0. Dat is met opzet zichtbaar nul en niet "onbekend": de
 * schermen tonen er een waarschuwing bij, zodat een vergeten tarief opvalt in plaats van
 * stilletjes uit de som te verdwijnen.
 */
export function coachPayout(b: TimedBooking, hourlyRate: number | undefined): number {
  return proRata(hourlyRate, bookingMinutes(b));
}

/** Gerealiseerde omzet: de prijs per bevestigde les met een betalende betaalwijze. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const sum = bookings
    .filter((b) => PAYABLE_STATUSES.includes(b.status))
    .reduce((total, b) => total + lessonShares(b, courtById.get(b.court_id))
      .filter((s) => countsAsRevenue(s.method))
      .reduce((sub, s) => sub + s.amount, 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Wat er aan trainers uitbetaald wordt over deze lessen: per les het uurtarief van de
 * trainer die hem gaf, naar rato van de duur.
 * ...
 */
export function totalCoachPayout(bookings: Booking[], users: User[]): number {
  const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
  const sum = bookings
    .filter((b) => PAYABLE_STATUSES.includes(b.status))
    .reduce((total, b) => total + coachPayout(b, rateById.get(b.coach_id)), 0);
  return Math.round(sum * 100) / 100;
}
```

**The one-line change:** in `totalCoachPayout`, `rateById.get(b.coach_id)` becomes
`rateById.get(lesgeverId(b))`. `coachPayout`'s own signature (a rate in, not a booking+users)
needs **no** change — only its callers switch which id they look the rate up by. `bookingPrice`
and `totalRevenue` are **not touched** — they never read `coach_id` or `taught_by_id` at all,
which is the concrete proof D-06 asks for.

---

### `lib/reports.ts` — `payoutsByCoach`, `coachPayoutThisMonth`

**Full text, read verbatim** (`lib/reports.ts` lines 158-183, 276-284):

```typescript
/**
 * Let op het verschil met de omzet: die loopt op het uurtarief van de BAAN en is wat de
 * speler betaalt. Dit loopt op het uurtarief van de TRAINER. Het verschil tussen beide is
 * wat de club overhoudt (`clubMargin` in lib/payments).
 *
 * Een trainer die niet meer bestaat blijft staan als "Onbekend": zijn lessen zijn gegeven.
 * Hij heeft dan ook geen tarief meer, dus hij krijgt dezelfde melding als een trainer die
 * er nooit een invulde.
 */
export function payoutsByCoach(bookings: Booking[], users: User[]): CoachTotal[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const totals = new Map<string, CoachTotal>();

  for (const b of countedBookings(bookings)) {
    const coach = byId.get(b.coach_id);
    const row = totals.get(b.coach_id) ?? {
      coachId: b.coach_id,
      name: coach?.name ?? t('Onbekend'),
      lessons: 0,
      amount: 0,
      missingRate: coach?.hourly_rate === undefined,
    };
    row.lessons += 1;
    if (PAYABLE_STATUSES.includes(b.status)) {
      row.amount += coachPayout(b, coach?.hourly_rate);
    }
    totals.set(b.coach_id, row);
  }

  return [...totals.values()]
    .map((r) => ({ ...r, amount: euro(r.amount) }))
    .sort((a, b) => (b.amount - a.amount) || a.name.localeCompare(b.name, 'nl'));
}
```

```typescript
/**
 * Let op het verschil met de omzet: die loopt op het uurtarief van de BAAN en is wat de
 * spelers betalen. Dit loopt op het uurtarief van de TRAINER. Zonder ingevuld tarief is de
 * uitkomst 0 — het scherm hoort daar zelf iets bij te zeggen, want een stille nul leest als
 * "niets verdiend" in plaats van "niets ingevuld".
 */
export function coachPayoutThisMonth(
  coach: User | null | undefined,
  bookings: Booking[],
  now: Date = new Date(),
): number {
  if (!coach) return 0;
  const mine = bookings.filter((b) => b.coach_id === coach.id);
  return totalCoachPayout(bookingsInPeriod(mine, currentPeriod(now)), [coach]);
}
```

**The change, per RESEARCH.md's pitfall analysis (Pitfall 2 — the grouping KEY, not just the
rate lookup, must move):**
- `payoutsByCoach`: both `byId.get(b.coach_id)` → `byId.get(lesgeverId(b))` AND
  `totals.get(b.coach_id)`/`totals.set(b.coach_id, ...)` → `totals.get(lesgeverId(b))`/
  `totals.set(lesgeverId(b), ...)`, and `coachId: b.coach_id` in the fresh-row literal →
  `coachId: lesgeverId(b)`.
- `coachPayoutThisMonth`: `bookings.filter((b) => b.coach_id === coach.id)` →
  `bookings.filter((b) => lesgeverId(b) === coach.id)`.
- `app/coaches/[id].tsx:81` (`earnedThisMonth = coachPayoutThisMonth(coach, bookings)`) needs
  **no** change — fixing the `lib/` function fixes this caller for free, the exact proof that
  the "one place" discipline (D-05) works.
- `app/coaches/[id].tsx:60-67` (`coachBookings`, `upcoming`, `past` — the on-screen agenda list)
  **stays on `coach_id`, unchanged** — a substituted-away lesson still belongs to the assigned
  coach's calendar (Pitfall 3). Do not touch this block.

---

### `providers/SimpleDataProvider.tsx` — `updateBooking` exclusion + `setTaughtBy`

**The interface comment, full verbatim** (line 81-88) — note the drift RESEARCH.md found: the
comment names FIVE excluded fields, the implementation only excludes FOUR:

```typescript
  /** `payment_method`, `beurtenkaart_id`, `participant_ids`, `payment_split` en
   *  `attendance` blijven erbuiten: die lopen uitsluitend via `setPaymentMethod`,
   *  `setParticipants`, `setPaymentSplit` en `setAanwezigheid` — de plekken die de
   *  beurtenkaart, de factuurregel en de afvinklijst in de pas houden. */
  updateBooking: (
    id: string,
    patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split' | 'attendance'>>,
  ) => Promise<void>;
```

**The implementation, full verbatim** (lines 702-720) — its inline exclusion type only lists
FOUR fields, missing `attendance`:

```typescript
  const updateBooking = useCallback(async (
    id: string,
    patch: Partial<Omit<Booking, 'payment_method' | 'beurtenkaart_id' | 'participant_ids' | 'payment_split'>>,
  ) => {
    const store = storeRef.current;
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    const plan = booking && patch.status === 'cancelled'
      ? planCancel(store.beurtenkaarten, booking)
      : null;
    await commit({
      ...store,
      beurtenkaarten: plan ? plan.cards : store.beurtenkaarten,
      bookings: store.bookings.map((b) =>
        b.id === id ? { ...b, ...patch, ...(plan?.patch ?? {}) } : b,
      ),
    });
  }, [commit]);
```

**Instruction for the executor:** fix this pre-existing drift in the same edit that adds
`taught_by_id` — both the comment and the implementation's `Omit<...>` union must list all six
excluded fields afterward (`payment_method`, `beurtenkaart_id`, `participant_ids`,
`payment_split`, `attendance`, `taught_by_id`), so the two stay in agreement going forward.

**The guarded-write analog for `setTaughtBy`** — `setPaymentMethod`, full verbatim (lines
817-845), the shape to imitate (read `storeRef.current`, bail on missing booking, decide, one
`commit()`):

```typescript
  const setPaymentMethod = useCallback(async (bookingId: string, method: PaymentMethod): Promise<boolean> => {
    const store = storeRef.current;
    if (!store) return false;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return false;

    const plan = planMethodChange(store.beurtenkaarten, booking, method, {
      player: store.users.find((u) => u.id === booking.player_id),
      bookings: store.bookings,
      courts: store.courts,
    });
    if (plan.error) {
      setError(plan.error);
      return false;
    }

    setError(null);
    await commit({
      ...store,
      beurtenkaarten: plan.cards,
      bookings: store.bookings.map((b) =>
        b.id === bookingId ? { ...b, payment_method: method, beurtenkaart_id: plan.cardId } : b,
      ),
    });
    return true;
  }, [commit]);
```

`setTaughtBy` is simpler — no `plan*()` call needed (RESEARCH.md is explicit: "unlike
`planMethodChange`, there is no side-effect to reconcile — no card to release, no split to
recompute"). Shape:

```typescript
  /** Wie een les werkelijk gaf. Alleen de beheerder mag dit zetten (D-08); `updateBooking`
   *  sluit `taught_by_id` daarom expliciet uit van zijn type, net als `payment_method`. De
   *  echte bewaking staat in `bewaak_betaalvelden` — dit is de weg ernaartoe, niet de grens
   *  zelf (zie lib/rechten.ts: "de app is niet de bewaker"). */
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

**Wiring checklist (mirrors Phase 1's own written warning, `01-PATTERNS.md`):** register
`setTaughtBy` in the context type (near `setPaymentMethod`, line ~120), in the context value
object (~line 1139), and in the `useMemo` dependency array (~line 1172). "Een vergeten regel
daar is de meest voorkomende manier waarop een nieuwe actie stilzwijgend nooit op een scherm
aankomt."

---

### `supabase-schema.sql` — `bewaak_betaalvelden` (the crux) + the append-only tail blocks

**The trigger, full verbatim, current state** (lines 411-468) — this is the function whose
early-return the new check must sit *before*:

```sql
-- `bookings_update` laat hieronder ook de betaler toe (en de ouder van een minderjarige
-- betaler), want wie de rekening krijgt hoort te kiezen of hij cash betaalt of op factuur.
-- Sinds de aanwezigheid staat ook wie meespeelt in die policy: een speler vinkt zichzelf af.
-- Maar RLS kent alleen hele rijen: wie een rij mag wijzigen, mag élke kolom wijzigen. Zonder
-- deze trigger kon een speler met dezelfde toestemming zijn les een uur verzetten, aan een
-- andere trainer hangen of zichzelf goedkeuren.
--
-- Vandaar de vergelijking op de hele rij: alles behalve de drie velden hieronder moet gelijk
-- blijven. Zo hoeft deze functie niet te weten welke kolommen er in de toekomst bij komen —
-- een nieuwe kolom valt vanzelf onder "mag niet".
--
-- En daarna per veld wie het mag: de betaalwijze is van de betaler, de aanwezigheid van wie
-- er zelf staat (of van zijn ouder) en alleen voor een les die nog moet komen. Dezelfde twee
-- regels staan in de app — `magAanwezigheidZetten` in lib/aanwezigheid en de betaalregel in
-- het detailblad — daar zodat het scherm geen knop toont die hier geweigerd wordt, hier
-- omdat dit de bewaking is.
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
  -- Buiten een sessie om (een script, de SQL-editor) geldt deze grens niet.
  if auth.uid() is null then return new; end if;
  -- De trainer van deze les en de beheerder mogen alles; voor hen is er niets te bewaken.
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

drop trigger if exists bookings_betaalvelden_bewaakt on bookings;
create trigger bookings_betaalvelden_bewaakt
  before update on bookings
  for each row execute function bewaak_betaalvelden();
```

**The crux, spelled out:** line `if is_admin() or old.coach_id = app_user_id() then return new; end if;`
lets the assigned coach change *any* column on his own row today, including — if left
untouched — a future `taught_by_id`. D-08 requires admin-only, *even for the coach of the
lesson*. The new check must therefore run **before** this line, not be folded into the
exclusion-list comparison that only fires for non-coach/non-admin actors. This is the one
non-obvious wrinkle RESEARCH.md's Pitfall 1 names explicitly — do not copy the `lesson_groups`/
`group_id` precedent's reasoning ("de beheerder en de trainer van de les mogen sowieso al
alles") by analogy; that reasoning does not transfer here because D-08 draws a *stricter* line
specifically for this payroll field.

**Shape of the new check** (RESEARCH.md's drafted text, to be pasted inside a
`create or replace function bewaak_betaalvelden()` — same function, appended at the bottom of
the file per D-10, replacing the existing definition in place, not a second trigger):

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

**The append-only convention for the tail of the file** — the `lesson_groups`/`group_id` block
Phase 1 just added is the freshest in-house example of exactly this pattern (schema change +
Dutch comment explaining why the trigger does or doesn't need touching), read in full
(`supabase-schema.sql` lines 895-940):

```sql
-- als jsonb en niet als koppeltabel, om dezelfde reden als ontwerpkeuze 3 bovenaan dit
-- bestand: die lijst wordt nooit los van zijn groep opgevraagd of gewijzigd, altijd samen
-- met de groep erbij — een eigen tabel zou dus alleen een join per scherm opleveren.
--
-- Alleen de beheerder ziet en beheert deze tabel — dezelfde grens als `coach_rates`
-- hierboven, en om dezelfde reden geen "created_by"-kolom of -conditie: géén van beide
-- policies hieronder verwijst naar wie een rij ooit gemaakt heeft. Dat is met opzet. Lees
-- eerst het commentaar boven `bookings_insert` voordat je hier een eigenaarscontrole aan
-- toevoegt: de app schrijft met een upsert, Postgres toetst de `with check` ook bij een
-- latere wijziging, en alles wat hier over de máker van de rij geëist wordt, geldt dus ook
-- voor iedere volgende beheerder die de rij aanpast. Precies die val brak `bookings_insert`
-- ooit stilzwijgend, en dit project is er al twee keer stilzwijgend door geraakt — vandaar
-- de vorm van `rates_write`, niet van `rates_select`.
--
-- `bewaak_betaalvelden` hoeft niet aangepast te worden voor de nieuwe kolom `group_id` op
-- `bookings`. Die trigger vergelijkt de hele rij minus `payment_method`, `beurtenkaart_id`
-- en `attendance`, dus `group_id` valt vanzelf onder "mag een speler niet wijzigen" — en de
-- beheerder en de trainer van de les mogen sowieso al alles, want die twee staan bovenaan de
-- functie al langs. Wie de groep van een les verzet, is per definitie een van die twee.
create table if not exists lesson_groups (
  id text primary key,
  ...
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

Note this block's own comment is the exact "wrong by analogy" case Pitfall 1 warns against:
`group_id` needed NO trigger change precisely because "de beheerder en de trainer van de les
mogen sowieso al alles" was fine for that field. `taught_by_id` needs the OPPOSITE conclusion
because D-08 restricts even the coach of the lesson — the new block's own comment must say so
explicitly, cross-referencing this one, exactly the way this block cross-references
`bookings_insert`'s comment.

**The nullable-FK-with-`on delete set null` pattern to copy** for the new column
(`supabase-schema.sql` line 71, the existing `court_id` column, verbatim):

```sql
court_id text references courts(id) on delete set null,
```

**Full recommended append block** (RESEARCH.md's drafted SQL, ready to place after the
`lesson_groups` block, text only — D-10 forbids running it in this phase):

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

**Critical placement note:** this is a `create or replace function` of the *existing*
`bewaak_betaalvelden` — it must **replace** the current definition in place (same function
name, same trigger already attached via `bookings_betaalvelden_bewaakt`), not be a second,
conflicting definition. No RLS policy on `bookings` needs any change — `bookings_update`'s
`using`/`with check` already permit the admin and the row's own coach to update the row; the
trigger, not RLS, is where column-level restriction happens in this schema.

---

### `components/BookingDetailSheet.tsx` — show both names (D-07/VERV-03)

**Analog:** itself, the existing `Trainer:` line, full context read verbatim (lines 301-309):

```tsx
        <Pressable
          onPress={() => goTo(`/coaches/${booking.coach_id}`)}
          accessibilityRole="button"
          accessibilityLabel={t('Open dossier van trainer {naam}', { naam: coachName })}
          style={[styles.partyLine, webCursor]}
        >
          <Text style={styles.partyLink}>{t('Trainer')}: {coachName}</Text>
          <ChevronRight size={16} color={tennisColors.textMuted} />
        </Pressable>
```

`coachName` itself comes from `nameOf` (line 136): `const nameOf = (id: string): string =>
users.find((u) => u.id === id)?.name ?? t('Onbekend');`, and `coachName` is set at line 139:
`const coachName = nameOf(booking.coach_id);`.

**The change:** add a `taughtByName` derived value the same way, and render a *second* line
only when set — never replace the `Trainer:` line, so the assigned coach's identity is always
still visible (D-07's "beide namen, niet één die de andere vervangt"):

```tsx
const coachName = nameOf(booking.coach_id);
const taughtByName = booking.taught_by_id ? nameOf(booking.taught_by_id) : null;
// ...
<Text style={styles.partyLink}>{t('Trainer')}: {coachName}</Text>
{taughtByName ? (
  <Text style={styles.partyLink}>{t('Vervanger')}: {taughtByName}</Text>
) : null}
```

Follow the existing `Pressable`-wraps-`Text`-plus-`ChevronRight` shape for the new line too, if
the vervanger should also link through to `/coaches/${booking.taught_by_id}` (matching the
"beide namen klikken door" comment at line 266 — this codebase's stated reason the coach/player
name lines are pressable at all).

---

### `components/LessonCards.tsx` — compact-card marker (D-07/VERV-03)

**Analog:** itself, the existing `other` label computation, full context read verbatim
(lines 42, 64-66):

```tsx
const nameOf = (id?: string): string => users.find((u) => u.id === id)?.name ?? t('Onbekend');
...
const other = isCoach(currentUser)
  ? shortGroupLabel(nameOf(booking.player_id), groupSize(booking))
  : nameOf(booking.coach_id);
```

**The change (smallest per RESEARCH.md's Assumption A4, Claude's Discretion territory):** when
`booking.taught_by_id` is set, append a short marker to the existing coach-name label rather
than building a second full-name line — a compact card has no room for two names, and D-07's
hard constraint is that the substitution must never be *hidden*, only that both names be
reachable:

```tsx
const other = isCoach(currentUser)
  ? shortGroupLabel(nameOf(booking.player_id), groupSize(booking))
  : booking.taught_by_id
    ? `${nameOf(booking.coach_id)} (${t('vervangen')})`
    : nameOf(booking.coach_id);
```

The detail sheet (opened by tapping the card, `setOpenBooking(booking)` at line 72) is where
both full names are always shown per the pattern above — the card is a summary, one tap away
from the source of truth. Do not choose a design that shows *only* the substitute's name
anywhere; that is D-07's one hard constraint.

## Shared Patterns

### One guarded path for a money-relevant question (D-05)
**Source:** `lib/beurtenkaart.ts::planMethodChange` (the named precedent).
**Apply to:** `lib/lesgever.ts::lesgeverId` — every payroll/report call site imports this
function; nothing re-derives `taught_by_id ?? coach_id` inline anywhere else.

### Admin-only, DB-enforced field guard (D-08/D-09)
**Source:** `bewaak_betaalvelden`'s existing exclusion-list mechanism, extended with a new
*early* check (not a new trigger, not a new exclusion-list entry).
**Apply to:** `taught_by_id` writes, both the trigger amendment and `setTaughtBy`'s own doc
comment noting the trigger is the real boundary, per `lib/rechten.ts`'s stated philosophy ("de
app is niet de bewaker").

### `updateBooking`'s excluded-field type as compile-time guard
**Source:** `providers/SimpleDataProvider.tsx`'s `Omit<Booking, 'payment_method' | ...>` pattern.
**Apply to:** add `'taught_by_id'` to the same union (both the type and the implementation —
fix the pre-existing `attendance` drift in the same edit).

### `t()` for every user-facing string
**Source:** `lib/i18n.ts`; call sites throughout `components/BookingDetailSheet.tsx` and
`components/LessonCards.tsx` (`t('Trainer')`, `t('Onbekend')`, etc.).
**Apply to:** `t('Vervanger')`, `t('vervangen')`, and the trigger's Dutch exception message
(SQL strings are not run through `t()`, but must still read as natural Dutch prose matching
the existing exception messages' tone).

### Revenue vs. payout separation (D-06)
**Source:** `lib/payments.ts::bookingPrice` (court's rate) vs. `coachPayout`/`totalCoachPayout`
(coach's rate); `lib/reports.ts`'s own file-header three-rule comment.
**Apply to:** every task in this phase — `bookingPrice`/`totalRevenue` must never be touched or
imported alongside `lesgeverId`; a regression test asserting revenue is identical with and
without `taught_by_id` set is worth adding explicitly (D-06 is easy to violate silently).

## No Analog Found

None — every file in this phase's scope has a direct, concrete analog in the existing
codebase, either an external precedent (`planMethodChange`, `bewaak_betaalvelden`,
`lesson_groups`) or itself (small in-file extensions to `lib/payments.ts`, `lib/reports.ts`,
`components/BookingDetailSheet.tsx`, `components/LessonCards.tsx`).

## Metadata

**Analog search scope:** `lib/`, `providers/`, `components/`, `app/coaches/`, `supabase-schema.sql`
**Files scanned (full or targeted read):** `lib/beurtenkaart.ts` (`planMethodChange`
neighbourhood, lines 60-144), `lib/payments.ts` (lines 360-429), `lib/payments.test.ts`
(lines 1-40), `lib/reports.ts` (lines 150-284 targeted), `lib/types.ts` (`Booking` lines
155-203), `providers/SimpleDataProvider.tsx` (lines 75-195, 700-860 targeted),
`supabase-schema.sql` (lines 63-97, 395-469, 895-940 targeted), `components/
BookingDetailSheet.tsx` (lines 255-310 targeted), `components/LessonCards.tsx` (lines 1-75),
`app/coaches/[id].tsx` (grep for `coach_id === coach.id`/`coachBookings`/`earnedThisMonth`).
**Pattern extraction date:** 2026-09-05
