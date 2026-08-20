# Agenda: betaalwijze, beurtenkaart en maandexport — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De agenda krijgt één betaalveld met zes waarden, 10-beurtenkaarten die automatisch afboeken, en een maandoverzicht dat als CSV te downloaden of te delen is.

**Architecture:** Alle regels leven in pure modules onder `lib/` (met jest-tests ernaast); `providers/SimpleDataProvider.tsx` is de enige plek die de store muteert en houdt boeking en beurtenkaart in de pas; de schermen onder `app/` zijn dun. Het bestaande veld `Booking.payment_status` wordt vervangen door `Booking.payment_method`, met een migratie zodat bestaande stores blijven werken.

**Tech Stack:** React Native 0.79 + Expo 53, expo-router, TypeScript strict, jest (`jest-expo`), AsyncStorage via `providers/mockStore.ts`. Geen nieuwe dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-agenda-betaalwijze-beurtenkaart-export-design.md`

**Commando's die je vaak nodig hebt:**
- Tests: `npm test` of één bestand: `npx jest lib/payments.test.ts`
- Typecheck: `npx tsc --noEmit`

---

## Bestandsoverzicht

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `lib/types.ts` (wijzig) | `PaymentMethod`, `Beurtenkaart`, velden op `Booking` en `User` |
| `lib/payments.ts` (wijzig) | Labels, kleuren, werklijst, omzet, standaard betaalwijze |
| `lib/status.ts` (nieuw) | Nederlandse labels voor `BookingStatus`, gedeeld door agenda en CSV |
| `lib/migrate.ts` (nieuw) | Oude `payment_status` omzetten naar `payment_method` |
| `lib/beurtenkaart.ts` (nieuw) | Beurten tellen, afboeken, teruggeven |
| `lib/csv.ts` (nieuw) | Maandrijen samenstellen en naar CSV-tekst schrijven |
| `lib/share.ts` (nieuw) | Downloaden (web) of delen (telefoon) — enige platform-afhankelijke stukje |
| `providers/mockStore.ts` (wijzig) | `beurtenkaarten` in de store + migratie bij laden |
| `providers/SimpleDataProvider.tsx` (wijzig) | `setPaymentMethod` en de beurtenkaart-acties |
| `components/PaymentMethodSheet.tsx` (nieuw) | Keuzeblad met de zes betaalwijzen |
| `app/agenda/index.tsx` (wijzig) | Aantikbare betaal-badge + knoppen naar de twee nieuwe schermen |
| `app/agenda/beurtenkaarten.tsx` (nieuw) | Kaartenbeheer |
| `app/agenda/export.tsx` (nieuw) | Maandoverzicht + export |
| `app/admin/payments.tsx` (wijzig) | Zes knoppen in plaats van drie |
| `app/admin/reports.tsx` (wijzig) | Uitsplitsing per betaalwijze |
| `app/players/[id].tsx` (wijzig) | Standaard betaalwijze van de speler |
| `components/BookingModal.tsx` (wijzig) | Nieuwe boeking krijgt de standaard betaalwijze |
| `app/index.tsx`, `app/_layout.tsx` (wijzig) | Hub-teller en routetitels |

---

### Task 1: `PaymentMethod` en de betaalregels

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/payments.ts`
- Test: `lib/payments.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Vervang de volledige inhoud van `lib/payments.test.ts` door:

```ts
import type { Booking, Court, User } from './types';
import {
  needsPayment, filterPendingPayment, pendingPaymentsFor, totalRevenue,
  defaultMethodFor, paymentMeta, PAYMENT_METHODS, PAYMENT_LABELS,
} from './payments';

const base: Booking = {
  id: '1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

const courts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

describe('PAYMENT_METHODS', () => {
  it('are the six agreed values, with open first', () => {
    expect(PAYMENT_METHODS).toEqual(['open', 'cash', 'invoice', 'qr', 'beurtenkaart', 'sponsor']);
  });

  it('all have a Dutch label', () => {
    for (const m of PAYMENT_METHODS) {
      expect(PAYMENT_LABELS[m].length).toBeGreaterThan(0);
    }
  });

  it('gives every method a badge colour', () => {
    for (const m of PAYMENT_METHODS) {
      expect(paymentMeta(m).color).toMatch(/^#/);
    }
  });
});

describe('needsPayment', () => {
  it('is true for a realized booking still on open', () => {
    expect(needsPayment(base)).toBe(true);
    expect(needsPayment({ ...base, status: 'completed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'synchronized' })).toBe(true);
  });

  it('is false once any method is chosen', () => {
    expect(needsPayment({ ...base, payment_method: 'cash' })).toBe(false);
    expect(needsPayment({ ...base, payment_method: 'sponsor' })).toBe(false);
    expect(needsPayment({ ...base, payment_method: 'beurtenkaart' })).toBe(false);
  });

  it('is false for pending or cancelled bookings', () => {
    expect(needsPayment({ ...base, status: 'pending' })).toBe(false);
    expect(needsPayment({ ...base, status: 'cancelled' })).toBe(false);
  });
});

describe('filterPendingPayment', () => {
  it('returns only bookings that need payment', () => {
    const list: Booking[] = [base, { ...base, id: '2', payment_method: 'cash' }];
    expect(filterPendingPayment(list).map((b) => b.id)).toEqual(['1']);
  });
});

describe('pendingPaymentsFor', () => {
  const coach: User = { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach' };
  const player: User = { id: 'p1', name: 'Mathis', email: 'm@x.be', role: 'player' };

  it('gives a coach only their own bookings', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(pendingPaymentsFor(coach, list).map((b) => b.id)).toEqual(['1']);
  });

  it('gives a player only their own bookings', () => {
    const list: Booking[] = [base, { ...base, id: '2', player_id: 'p2' }];
    expect(pendingPaymentsFor(player, list).map((b) => b.id)).toEqual(['1']);
  });

  it('returns nothing without a user', () => {
    expect(pendingPaymentsFor(null, [base])).toEqual([]);
  });
});

describe('totalRevenue', () => {
  it('counts cash, invoice, qr and beurtenkaart', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_method: 'cash' },
      { ...base, id: '2', payment_method: 'invoice' },
      { ...base, id: '3', payment_method: 'qr' },
      { ...base, id: '4', payment_method: 'beurtenkaart' },
    ];
    expect(totalRevenue(list, courts)).toBe(120);
  });

  it('skips open and sponsor', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_method: 'open' },
      { ...base, id: '2', payment_method: 'sponsor' },
    ];
    expect(totalRevenue(list, courts)).toBe(0);
  });

  it('skips cancelled bookings', () => {
    const list: Booking[] = [{ ...base, payment_method: 'cash', status: 'cancelled' }];
    expect(totalRevenue(list, courts)).toBe(0);
  });
});

describe('defaultMethodFor', () => {
  it('takes the player default when set', () => {
    const p: User = { id: 'p1', name: 'M', email: 'm@x.be', role: 'player', default_payment_method: 'qr' };
    expect(defaultMethodFor(p)).toBe('qr');
  });

  it('falls back to open', () => {
    const p: User = { id: 'p1', name: 'M', email: 'm@x.be', role: 'player' };
    expect(defaultMethodFor(p)).toBe('open');
    expect(defaultMethodFor(null)).toBe('open');
  });
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/payments.test.ts`
Verwacht: FAIL — `payment_method` bestaat niet op `Booking`, `PAYMENT_METHODS` niet geëxporteerd.

- [ ] **Step 3: Pas `lib/types.ts` aan**

Vervang in `lib/types.ts` de regel

```ts
export type PaymentStatus = 'paid' | 'unpaid' | 'invoice' | null;
```

door

```ts
/**
 * Hoe een les betaald wordt. Eén veld, geen aparte status: 'open' betekent dat er nog
 * niets is afgesproken en houdt de les in de werklijst van Beheer → Betalingen.
 */
export type PaymentMethod =
  | 'open'
  | 'cash'
  | 'invoice'
  | 'qr'
  | 'beurtenkaart'
  | 'sponsor';
```

Vervang in `interface Booking` de regel `payment_status: PaymentStatus;` door:

```ts
  payment_method: PaymentMethod;
  /** De kaart die de beurt voor deze les droeg — alleen gezet bij 'beurtenkaart'. */
  beurtenkaart_id?: string;
```

Voeg in `interface User`, onder `hourly_rate`, toe:

```ts
  /** Speler: de betaalwijze die een nieuwe les standaard krijgt. */
  default_payment_method?: PaymentMethod;
```

Voeg onderaan `lib/types.ts` toe:

```ts
/** Eén gebruikte beurt van een kaart. `booking_id` is leeg bij een handmatige beurt. */
export interface BeurtenkaartUse {
  booking_id: string;
  date: string; // ISO
}

/**
 * Een kaart van tien beurten. De beurten staan als lijst en niet als teller, zodat de
 * geschiedenis zichtbaar blijft en een beurt bij annulering terug kan.
 */
export interface Beurtenkaart {
  id: string;
  player_id: string;
  total_sessions: number;
  remarks?: string;
  created_at: string; // ISO
  uses: BeurtenkaartUse[];
}
```

- [ ] **Step 4: Schrijf `lib/payments.ts`**

Vervang de volledige inhoud van `lib/payments.ts` door:

```ts
import { tennisColors } from '../constants/tennis-colors';
import type { Booking, Court, PaymentMethod, User } from './types';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'open', 'cash', 'invoice', 'qr', 'beurtenkaart', 'sponsor',
] as const;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  open: 'Open',
  cash: 'Cash',
  invoice: 'Factuur',
  qr: 'QR-code',
  beurtenkaart: '10-beurtenkaart',
  sponsor: 'Sponsor',
};

export interface PaymentMeta {
  color: string;
  label: string;
  subtle: boolean;
}

/** Kleur en label voor de badge. 'open' is bewust ingetogen: het is nog geen keuze. */
export function paymentMeta(method: PaymentMethod): PaymentMeta {
  const label = PAYMENT_LABELS[method];
  switch (method) {
    case 'cash':
      return { color: tennisColors.success, label, subtle: false };
    case 'invoice':
      return { color: tennisColors.court, label, subtle: false };
    case 'qr':
      return { color: tennisColors.primaryDark, label, subtle: false };
    case 'beurtenkaart':
      return { color: tennisColors.clay, label, subtle: false };
    case 'sponsor':
      return { color: tennisColors.warning, label, subtle: false };
    case 'open':
    default:
      return { color: tennisColors.textMuted, label, subtle: true };
  }
}

const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'completed', 'synchronized'];

/** Een les vraagt nog om afhandeling zolang de betaalwijze op 'open' staat. */
export function needsPayment(b: Booking): boolean {
  return PAYABLE_STATUSES.includes(b.status) && b.payment_method === 'open';
}

export function filterPendingPayment(bookings: Booking[]): Booking[] {
  return bookings.filter(needsPayment);
}

/**
 * De betalingen die een gebruiker mag afhandelen. Geld blijft per trainer: een trainer
 * handelt zijn eigen lessen af, een speler ziet alleen die van hemzelf.
 */
export function pendingPaymentsFor(user: User | null, bookings: Booking[]): Booking[] {
  if (!user) return [];
  const mine = bookings.filter((b) =>
    user.role === 'coach' ? b.coach_id === user.id : b.player_id === user.id,
  );
  return filterPendingPayment(mine);
}

const REVENUE_METHODS: PaymentMethod[] = ['cash', 'invoice', 'qr', 'beurtenkaart'];

/** Sponsor levert geen geld op en 'open' is nog niets — die tellen niet mee. */
export function countsAsRevenue(method: PaymentMethod): boolean {
  return REVENUE_METHODS.includes(method);
}

/** Gerealiseerde omzet: het uurtarief van de baan per afgehandelde, niet-geannuleerde les. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const rateById = new Map(courts.map((c) => [c.id, c.hourly_rate]));
  return bookings
    .filter((b) => countsAsRevenue(b.payment_method) && b.status !== 'cancelled')
    .reduce((sum, b) => sum + (rateById.get(b.court_id) ?? 0), 0);
}

/** De betaalwijze die een nieuwe les van deze speler krijgt. */
export function defaultMethodFor(player: User | null | undefined): PaymentMethod {
  return player?.default_payment_method ?? 'open';
}
```

- [ ] **Step 5: Draai de test opnieuw**

Run: `npx jest lib/payments.test.ts`
Verwacht: PASS (alle tests groen). `npx tsc --noEmit` faalt nu nog op de schermen — dat is Task 3.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/payments.ts lib/payments.test.ts
git commit -m "feat(betalingen): betaalwijze als enig betaalveld op een boeking"
```

---

### Task 2: Migratie van bestaande stores

**Files:**
- Create: `lib/migrate.ts`
- Test: `lib/migrate.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Maak `lib/migrate.test.ts`:

```ts
import { migrateBooking, migrateBookings } from './migrate';

const legacy = {
  id: '1', player_id: 'p1', coach_id: 'c1', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed' as const,
};

describe('migrateBooking', () => {
  it('maps paid to cash', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'paid' }).payment_method).toBe('cash');
  });

  it('maps invoice to invoice', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'invoice' }).payment_method).toBe('invoice');
  });

  it('maps unpaid and null to open', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'unpaid' }).payment_method).toBe('open');
    expect(migrateBooking({ ...legacy, payment_status: null }).payment_method).toBe('open');
  });

  it('treats a missing field as open', () => {
    expect(migrateBooking({ ...legacy }).payment_method).toBe('open');
  });

  it('leaves an already migrated booking alone', () => {
    expect(migrateBooking({ ...legacy, payment_method: 'sponsor' }).payment_method).toBe('sponsor');
  });

  it('drops the old field', () => {
    const out = migrateBooking({ ...legacy, payment_status: 'paid' });
    expect('payment_status' in out).toBe(false);
  });

  it('keeps the other fields untouched', () => {
    const out = migrateBooking({ ...legacy, payment_status: 'paid', notes: 'Techniek' });
    expect(out.id).toBe('1');
    expect(out.notes).toBe('Techniek');
  });
});

describe('migrateBookings', () => {
  it('migrates every booking in the list', () => {
    const out = migrateBookings([
      { ...legacy, id: '1', payment_status: 'paid' },
      { ...legacy, id: '2', payment_status: null },
    ]);
    expect(out.map((b) => b.payment_method)).toEqual(['cash', 'open']);
  });

  it('survives a missing list', () => {
    expect(migrateBookings(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/migrate.test.ts`
Verwacht: FAIL — `Cannot find module './migrate'`.

- [ ] **Step 3: Schrijf `lib/migrate.ts`**

```ts
// Een store die met een oudere versie is weggeschreven kent nog `payment_status`. Die
// omzetten bij het laden is goedkoper dan de gebruiker zijn boekingen laten wissen.

import type { Booking, PaymentMethod } from './types';

type LegacyPaymentStatus = 'paid' | 'unpaid' | 'invoice' | null;

export type LegacyBooking = Omit<Booking, 'payment_method'> & {
  payment_method?: PaymentMethod;
  payment_status?: LegacyPaymentStatus;
};

const LEGACY_MAP: Record<string, PaymentMethod> = {
  paid: 'cash',
  invoice: 'invoice',
  unpaid: 'open',
};

export function migrateBooking(b: LegacyBooking): Booking {
  const { payment_status: legacy, payment_method: current, ...rest } = b;
  const method: PaymentMethod =
    current ?? (legacy ? LEGACY_MAP[legacy] ?? 'open' : 'open');
  return { ...rest, payment_method: method };
}

export function migrateBookings(list: LegacyBooking[] | undefined): Booking[] {
  return (list ?? []).map(migrateBooking);
}
```

- [ ] **Step 4: Draai de test opnieuw**

Run: `npx jest lib/migrate.test.ts`
Verwacht: PASS.

- [ ] **Step 5: Haak de migratie in de store**

In `providers/mockStore.ts`: voeg bovenaan bij de imports toe

```ts
import { migrateBookings } from '../lib/migrate';
```

Voeg aan `interface StoreData` toe, onder `bookings`:

```ts
  beurtenkaarten: Beurtenkaart[];
```

en breid de type-import uit met `Beurtenkaart`:

```ts
import type { Beurtenkaart, Booking, Court, Lesson, PlayerGoal, StudentProgress, User, Settings } from '../lib/types';
```

Voeg in `freshSeed()` toe, onder `bookings: [...seedBookings],`:

```ts
    beurtenkaarten: [],
```

Vervang in `withDefaults()` de regel `bookings: data.bookings ?? [],` door:

```ts
    bookings: migrateBookings(data.bookings),
    beurtenkaarten: data.beurtenkaarten ?? [],
```

- [ ] **Step 6: Zet de seed om**

In `lib/seed.ts`: vervang in `seedBookings` elke `payment_status: null,` door `payment_method: 'open',` en elke `payment_status: 'paid',` door `payment_method: 'cash',`. Er zijn er vijf: `b-1` en `b-3` en `b-4` krijgen `'open'`, `b-2` en `b-5` krijgen `'cash'`.

- [ ] **Step 7: Draai alle tests**

Run: `npx jest lib/migrate.test.ts lib/payments.test.ts`
Verwacht: PASS. (`lib/seed.test.ts`, `lib/hub.test.ts` en `lib/relations.test.ts` falen nog — Task 3.)

- [ ] **Step 8: Commit**

```bash
git add lib/migrate.ts lib/migrate.test.ts lib/seed.ts providers/mockStore.ts
git commit -m "feat(betalingen): bestaande boekingen migreren naar de nieuwe betaalwijze"
```

---

### Task 3: Alle bestaande gebruikers van `payment_status` omzetten

Doel van deze taak: `npx tsc --noEmit` en `npm test` weer helemaal groen, zonder nieuwe functionaliteit.

**Files:**
- Modify: `lib/hub.test.ts:6`, `lib/relations.test.ts:12`, `lib/seed.test.ts`
- Modify: `app/index.tsx:42`
- Modify: `app/agenda/index.tsx`
- Modify: `app/admin/payments.tsx`
- Modify: `app/admin/reports.tsx`
- Modify: `components/BookingModal.tsx:86`

- [ ] **Step 1: Zoek alle plekken op**

Run: `grep -rn "payment_status\|PaymentStatus" app lib providers components --include="*.ts" --include="*.tsx"`
Verwacht: treffers in de bestanden hierboven. Werk ze allemaal af in de volgende stappen.

- [ ] **Step 2: Testbestanden**

In `lib/hub.test.ts` en `lib/relations.test.ts`: vervang `payment_status: null,` door `payment_method: 'open',`.
In `lib/seed.test.ts`: als er `payment_status` in staat, idem.

- [ ] **Step 3: `app/index.tsx`**

Vervang

```ts
  const myOpen = myBookings.filter(
    (b) => b.payment_status === null || b.payment_status === 'unpaid',
  ).length;
```

door

```ts
  const myOpen = myBookings.filter((b) => b.payment_method === 'open').length;
```

- [ ] **Step 4: `components/BookingModal.tsx`**

Vervang `payment_status: null,` (regel ~86) door `payment_method: 'open',`. (De echte standaard per speler komt in Task 10.)

- [ ] **Step 5: `app/agenda/index.tsx`**

Verwijder de lokale functie `paymentMeta` en het type-import `PaymentStatus`. De import wordt:

```ts
import type { Booking, BookingStatus } from '../../lib/types';
import { paymentMeta } from '../../lib/payments';
```

En de regel in de kaart wordt:

```ts
          const payment = paymentMeta(booking.payment_method);
```

Laat `BadgeMeta` staan voor `STATUS_META`, maar hernoem het type-gebruik zo dat `paymentMeta` uit `lib/payments` past: `const payment: PaymentMeta = paymentMeta(booking.payment_method);` met `import { paymentMeta, type PaymentMeta } from '../../lib/payments';`.

- [ ] **Step 6: `app/admin/payments.tsx`**

Vervang het type-import en de knoppen:

```ts
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import type { PaymentMethod } from '../../lib/types';
```

Vervang `type SettablePaymentStatus = Exclude<PaymentStatus, null>;` en `setStatus` door:

```ts
  const setMethod = (method: PaymentMethod) =>
    run(() => updateBooking(b.id, { payment_method: method }));
```

Vervang het `<View style={styles.actions}>`-blok door:

```tsx
      <View style={styles.actions}>
        {PAYMENT_METHODS.filter((m) => m !== 'open').map((method) => (
          <Button
            key={method}
            label={PAYMENT_LABELS[method]}
            variant={method === 'cash' ? 'primary' : 'secondary'}
            disabled={busy}
            onPress={() => setMethod(method)}
          />
        ))}
        <Button label="Verwijderen" variant="danger" disabled={busy} onPress={() => run(() => deleteBooking(b.id))} />
      </View>
```

(`open` staat er niet bij: dat is de toestand waarin de les hier al staat.)

- [ ] **Step 7: `app/admin/reports.tsx`**

Vervang `interface PaymentBreakdown` en `buildBreakdown` door een telling per betaalwijze:

```ts
import { PAYMENT_METHODS, PAYMENT_LABELS, totalRevenue } from '../../lib/payments';
import type { Booking, PaymentMethod } from '../../lib/types';

type PaymentBreakdown = Record<PaymentMethod, number>;

function emptyBreakdown(): PaymentBreakdown {
  return { open: 0, cash: 0, invoice: 0, qr: 0, beurtenkaart: 0, sponsor: 0 };
}

function buildBreakdown(bookings: Booking[]): PaymentBreakdown {
  return bookings.reduce<PaymentBreakdown>((acc, b) => {
    acc[b.payment_method] += 1;
    return acc;
  }, emptyBreakdown());
}
```

Waar het scherm de vier oude tellers toont (`coachBreakdown.paid` enzovoort), toon nu de zes:

```tsx
        {PAYMENT_METHODS.map((method) => (
          <View key={method} style={styles.row}>
            <Text style={styles.rowLabel}>{PAYMENT_LABELS[method]}</Text>
            <Text style={styles.rowValue}>{coachBreakdown[method]}</Text>
          </View>
        ))}
```

Gebruik de stijlnamen die er al zijn voor label/waarde-rijen; als die anders heten, houd de bestaande namen aan.

- [ ] **Step 8: Typecheck en tests**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

Run: `npm test`
Verwacht: alle suites groen.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(betalingen): alle schermen en tests op de nieuwe betaalwijze"
```

---

### Task 4: Beurtenkaart-rekenwerk

**Files:**
- Create: `lib/beurtenkaart.ts`
- Test: `lib/beurtenkaart.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Maak `lib/beurtenkaart.test.ts`:

```ts
import type { Beurtenkaart } from './types';
import {
  SESSIONS_PER_CARD, remaining, cardsFor, usableCardFor,
  useSession, releaseSession, removeManualSession,
} from './beurtenkaart';

function card(over: Partial<Beurtenkaart> = {}): Beurtenkaart {
  return {
    id: 'k1', player_id: 'p1', total_sessions: SESSIONS_PER_CARD,
    created_at: '2026-08-01T09:00:00.000Z', uses: [], ...over,
  };
}

const iso = '2026-08-20T10:00:00.000Z';

describe('remaining', () => {
  it('is the card size minus the used sessions', () => {
    expect(remaining(card())).toBe(10);
    expect(remaining(card({ uses: [{ booking_id: 'b1', date: iso }] }))).toBe(9);
  });

  it('never goes below zero', () => {
    const uses = Array.from({ length: 12 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(remaining(card({ uses }))).toBe(0);
  });
});

describe('cardsFor', () => {
  it('returns only the cards of that player, newest first', () => {
    const a = card({ id: 'k1', created_at: '2026-01-01T00:00:00.000Z' });
    const b = card({ id: 'k2', created_at: '2026-06-01T00:00:00.000Z' });
    const other = card({ id: 'k3', player_id: 'p2' });
    expect(cardsFor([a, b, other], 'p1').map((c) => c.id)).toEqual(['k2', 'k1']);
  });
});

describe('usableCardFor', () => {
  it('picks the card with the fewest sessions left', () => {
    const fuller = card({ id: 'k1', uses: [] });
    const emptier = card({ id: 'k2', uses: [{ booking_id: 'b1', date: iso }] });
    expect(usableCardFor([fuller, emptier], 'p1')?.id).toBe('k2');
  });

  it('skips full cards', () => {
    const uses = Array.from({ length: 10 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(usableCardFor([card({ uses })], 'p1')).toBeNull();
  });

  it('skips cards of another player', () => {
    expect(usableCardFor([card({ player_id: 'p2' })], 'p1')).toBeNull();
  });
});

describe('useSession', () => {
  it('adds a use for the booking', () => {
    const out = useSession(card(), 'b1', iso);
    expect(out.uses).toEqual([{ booking_id: 'b1', date: iso }]);
  });

  it('never books the same booking twice', () => {
    const once = useSession(card(), 'b1', iso);
    expect(useSession(once, 'b1', iso).uses).toHaveLength(1);
  });

  it('does nothing on a full card', () => {
    const uses = Array.from({ length: 10 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(useSession(card({ uses }), 'b99', iso).uses).toHaveLength(10);
  });

  it('allows several manual sessions with an empty booking id', () => {
    const out = useSession(useSession(card(), '', iso), '', iso);
    expect(out.uses).toHaveLength(2);
  });
});

describe('releaseSession', () => {
  it('gives the session of that booking back', () => {
    const used = useSession(card(), 'b1', iso);
    expect(releaseSession(used, 'b1').uses).toEqual([]);
  });

  it('leaves other bookings alone', () => {
    const used = useSession(useSession(card(), 'b1', iso), 'b2', iso);
    expect(releaseSession(used, 'b1').uses.map((u) => u.booking_id)).toEqual(['b2']);
  });

  it('ignores an empty booking id, so manual sessions stay put', () => {
    const manual = useSession(card(), '', iso);
    expect(releaseSession(manual, '').uses).toHaveLength(1);
  });
});

describe('removeManualSession', () => {
  it('removes the last manual session', () => {
    const out = removeManualSession(useSession(card(), '', iso));
    expect(out.uses).toEqual([]);
  });

  it('never removes a session that belongs to a lesson', () => {
    const booked = useSession(card(), 'b1', iso);
    expect(removeManualSession(booked).uses).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/beurtenkaart.test.ts`
Verwacht: FAIL — `Cannot find module './beurtenkaart'`.

- [ ] **Step 3: Schrijf `lib/beurtenkaart.ts`**

```ts
// Rekenwerk rond de 10-beurtenkaart. Puur: elke functie geeft een nieuwe kaart terug.

import type { Beurtenkaart } from './types';

export const SESSIONS_PER_CARD = 10;

export function remaining(card: Beurtenkaart): number {
  return Math.max(0, card.total_sessions - card.uses.length);
}

/** De kaarten van één speler, nieuwste eerst. */
export function cardsFor(cards: Beurtenkaart[], playerId: string): Beurtenkaart[] {
  return cards
    .filter((c) => c.player_id === playerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * De kaart waarop een beurt geboekt wordt: die met de minste beurten over, zodat een
 * begonnen kaart eerst leeg raakt in plaats van dat er drie halfvolle blijven liggen.
 */
export function usableCardFor(cards: Beurtenkaart[], playerId: string): Beurtenkaart | null {
  const usable = cards.filter((c) => c.player_id === playerId && remaining(c) > 0);
  if (usable.length === 0) return null;
  return usable.reduce((best, c) => (remaining(c) < remaining(best) ? c : best));
}

/**
 * Boekt een beurt af. Een lege `bookingId` is een handmatige beurt van het kaartscherm;
 * die mag meermaals. Een beurt van dezelfde les wordt nooit dubbel geteld.
 */
export function useSession(card: Beurtenkaart, bookingId: string, date: string): Beurtenkaart {
  if (remaining(card) <= 0) return card;
  if (bookingId && card.uses.some((u) => u.booking_id === bookingId)) return card;
  return { ...card, uses: [...card.uses, { booking_id: bookingId, date }] };
}

/** Geeft de beurt van één les terug. Handmatige beurten blijven staan. */
export function releaseSession(card: Beurtenkaart, bookingId: string): Beurtenkaart {
  if (!bookingId) return card;
  return { ...card, uses: card.uses.filter((u) => u.booking_id !== bookingId) };
}

/** De min-knop op het kaartscherm: haalt alleen een handmatig gezette beurt weg. */
export function removeManualSession(card: Beurtenkaart): Beurtenkaart {
  const lastManual = [...card.uses].reverse().find((u) => u.booking_id === '');
  if (!lastManual) return card;
  const index = card.uses.lastIndexOf(lastManual);
  return { ...card, uses: [...card.uses.slice(0, index), ...card.uses.slice(index + 1)] };
}
```

- [ ] **Step 4: Draai de test opnieuw**

Run: `npx jest lib/beurtenkaart.test.ts`
Verwacht: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/beurtenkaart.ts lib/beurtenkaart.test.ts
git commit -m "feat(beurtenkaart): rekenwerk voor beurten afboeken en teruggeven"
```

---

### Task 5: Provider — betaalwijze zetten en kaarten beheren

**Files:**
- Modify: `providers/SimpleDataProvider.tsx`

- [ ] **Step 1: Breid de imports uit**

```ts
import { pendingPaymentsFor } from '../lib/payments';
import {
  SESSIONS_PER_CARD, usableCardFor, useSession, releaseSession, removeManualSession,
} from '../lib/beurtenkaart';
import type {
  User, Court, Booking, Lesson, StudentProgress, PlayerGoal, Settings,
  Beurtenkaart, PaymentMethod,
} from '../lib/types';
```

- [ ] **Step 2: Breid `DataShape` uit**

Voeg toe onder `goals: PlayerGoal[];`:

```ts
  beurtenkaarten: Beurtenkaart[];
```

en onder `deleteBooking`:

```ts
  /** Zet de betaalwijze en houdt de beurtenkaart in de pas. */
  setPaymentMethod: (bookingId: string, method: PaymentMethod) => Promise<void>;
  addBeurtenkaart: (playerId: string) => Promise<void>;
  updateBeurtenkaart: (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => Promise<void>;
  /** Handmatig een beurt af- of bijboeken op het kaartscherm. */
  addCardSession: (id: string) => Promise<void>;
  removeCardSession: (id: string) => Promise<void>;
  /** Verwijdert de kaart; lessen die eraan hingen vallen terug op 'open'. */
  deleteBeurtenkaart: (id: string) => Promise<void>;
```

- [ ] **Step 3: Schrijf de acties**

Voeg toe, direct onder `deleteBooking`:

```ts
  const setPaymentMethod = useCallback(async (bookingId: string, method: PaymentMethod) => {
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    let cards = store.beurtenkaarten;
    let cardId = booking.beurtenkaart_id;

    // Weg van de beurtenkaart: de beurt komt terug voor hij ergens anders heen kan.
    if (cardId && method !== 'beurtenkaart') {
      cards = cards.map((c) => (c.id === cardId ? releaseSession(c, bookingId) : c));
      cardId = undefined;
    }

    if (method === 'beurtenkaart' && !cardId) {
      const card = usableCardFor(cards, booking.player_id);
      if (!card) {
        setError('Geen beurtenkaart met beurten over voor deze speler.');
        return;
      }
      cards = cards.map((c) => (c.id === card.id ? useSession(c, bookingId, booking.start_time) : c));
      cardId = card.id;
    }

    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.map((b) =>
        b.id === bookingId ? { ...b, payment_method: method, beurtenkaart_id: cardId } : b,
      ),
    });
  }, [store, commit]);

  const addBeurtenkaart = useCallback(async (playerId: string) => {
    if (!store) return;
    const card: Beurtenkaart = {
      id: newId('k'),
      player_id: playerId,
      total_sessions: SESSIONS_PER_CARD,
      created_at: nowISO(),
      uses: [],
    };
    await commit({ ...store, beurtenkaarten: [...store.beurtenkaarten, card] });
  }, [store, commit]);

  const updateBeurtenkaart = useCallback(async (id: string, patch: Pick<Beurtenkaart, 'remarks'>) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }, [store, commit]);

  const addCardSession = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) =>
        c.id === id ? useSession(c, '', nowISO()) : c,
      ),
    });
  }, [store, commit]);

  const removeCardSession = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.map((c) => (c.id === id ? removeManualSession(c) : c)),
    });
  }, [store, commit]);

  const deleteBeurtenkaart = useCallback(async (id: string) => {
    if (!store) return;
    await commit({
      ...store,
      beurtenkaarten: store.beurtenkaarten.filter((c) => c.id !== id),
      // Lessen verliezen hun beurt, dus ze moeten opnieuw afgehandeld worden.
      bookings: store.bookings.map((b) =>
        b.beurtenkaart_id === id
          ? { ...b, payment_method: 'open' as PaymentMethod, beurtenkaart_id: undefined }
          : b,
      ),
    });
  }, [store, commit]);
```

- [ ] **Step 4: Laat annuleren en verwijderen de beurt teruggeven**

Vervang `updateBooking` en `deleteBooking` door:

```ts
  // Een geannuleerde of verwijderde les mag geen beurt blijven opeten.
  const releaseCardFor = (data: StoreData, booking: Booking | undefined): Beurtenkaart[] => {
    if (!booking?.beurtenkaart_id) return data.beurtenkaarten;
    return data.beurtenkaarten.map((c) =>
      c.id === booking.beurtenkaart_id ? releaseSession(c, booking.id) : c,
    );
  };

  const updateBooking = useCallback(async (id: string, patch: Partial<Booking>) => {
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    const cancelling = patch.status === 'cancelled' && booking?.status !== 'cancelled';
    const cards = cancelling ? releaseCardFor(store, booking) : store.beurtenkaarten;
    await commit({
      ...store,
      beurtenkaarten: cards,
      bookings: store.bookings.map((b) =>
        b.id === id
          ? { ...b, ...patch, ...(cancelling ? { payment_method: 'open' as PaymentMethod, beurtenkaart_id: undefined } : {}) }
          : b,
      ),
    });
  }, [store, commit]);

  const deleteBooking = useCallback(async (id: string) => {
    if (!store) return;
    const booking = store.bookings.find((b) => b.id === id);
    await commit({
      ...store,
      beurtenkaarten: releaseCardFor(store, booking),
      bookings: store.bookings.filter((b) => b.id !== id),
    });
  }, [store, commit]);
```

- [ ] **Step 5: Zet alles in de context-waarde**

Voeg in het `useMemo`-object toe:

```ts
    beurtenkaarten: store?.beurtenkaarten ?? [],
```

en bij de acties:

```ts
    setPaymentMethod,
    addBeurtenkaart,
    updateBeurtenkaart,
    addCardSession,
    removeCardSession,
    deleteBeurtenkaart,
```

en voeg dezelfde zes namen plus niets anders toe aan de dependency-array van dat `useMemo`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

- [ ] **Step 7: Commit**

```bash
git add providers/SimpleDataProvider.tsx
git commit -m "feat(beurtenkaart): kaarten in de store, betaalwijze boekt automatisch af"
```

---

### Task 6: Betaalwijze kiezen in de agenda

**Files:**
- Create: `components/PaymentMethodSheet.tsx`
- Modify: `app/agenda/index.tsx`

- [ ] **Step 1: Maak het keuzeblad**

Maak `components/PaymentMethodSheet.tsx`:

```tsx
import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow } from '../constants/theme';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../lib/payments';
import type { PaymentMethod } from '../lib/types';

interface Props {
  visible: boolean;
  current: PaymentMethod;
  /** Getoond bij '10-beurtenkaart', bijvoorbeeld "nog 4 beurten". */
  cardHint?: string;
  error?: string | null;
  onPick: (method: PaymentMethod) => void;
  onClose: () => void;
}

/** Eén blad met de zes betaalwijzen, gedeeld door elk scherm dat er een moet kiezen. */
export function PaymentMethodSheet({
  visible, current, cardHint, error, onPick, onClose,
}: Props): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Betaalwijze</Text>

          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method}
                label={PAYMENT_LABELS[method]}
                selected={method === current}
                onPress={() => onPick(method)}
              />
            ))}
          </View>

          {cardHint ? <Text style={styles.hint}>{cardHint}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Sluiten" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radius.sm,
    backgroundColor: tennisColors.border, marginBottom: spacing.sm,
  },
  title: { ...typography.h2, color: tennisColors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { ...typography.body, fontSize: 14, color: tennisColors.textMuted, fontStyle: 'italic' },
  error: { color: tennisColors.danger, fontSize: 14 },
});
```

- [ ] **Step 2: Maak de badge aantikbaar in `app/agenda/index.tsx`**

Voeg bij de imports toe:

```ts
import { PaymentMethodSheet } from '../../components/PaymentMethodSheet';
import { cardsFor, remaining } from '../../lib/beurtenkaart';
import type { PaymentMethod } from '../../lib/types';
```

Haal `beurtenkaarten`, `setPaymentMethod`, `error` en `clearError` uit de provider:

```ts
  const {
    currentUser, bookings, users, courts, updateBooking,
    beurtenkaarten, setPaymentMethod, error, clearError,
  } = useSimpleData();
```

Voeg state toe naast `onlyMine`:

```ts
  // Welke afspraak zijn betaalwijze laat kiezen; null = blad dicht.
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
```

Voeg boven de `return` toe:

```ts
  const cardHintFor = (booking: Booking | null): string | undefined => {
    if (!booking) return undefined;
    const cards = cardsFor(beurtenkaarten, booking.player_id);
    if (cards.length === 0) return 'Deze speler heeft nog geen beurtenkaart.';
    const left = cards.reduce((sum, c) => sum + remaining(c), 0);
    return left === 1 ? 'Nog 1 beurt over.' : `Nog ${left} beurten over.`;
  };

  const pickMethod = async (method: PaymentMethod): Promise<void> => {
    if (!payingBooking) return;
    clearError();
    await setPaymentMethod(payingBooking.id, method);
    setPayingBooking(null);
  };
```

Vervang in de kaart de betaal-badge door een aantikbare versie (alleen voor een trainer; een speler kijkt alleen):

```tsx
                {isCoach ? (
                  <Pressable
                    onPress={() => { clearError(); setPayingBooking(booking); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Betaalwijze wijzigen, nu ${payment.label}`}
                    style={webCursor}
                  >
                    <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                  </Pressable>
                ) : (
                  <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                )}
```

Zet vlak voor de sluitende `</Screen>`:

```tsx
      <PaymentMethodSheet
        visible={payingBooking !== null}
        current={payingBooking?.payment_method ?? 'open'}
        cardHint={cardHintFor(payingBooking)}
        error={error}
        onPick={(m) => { void pickMethod(m); }}
        onClose={() => { clearError(); setPayingBooking(null); }}
      />
```

Het blad sluit ook als `setPaymentMethod` een fout zet (geen kaart met beurten over): de
betaalwijze verandert dan niet, en de melding hoort op het agendascherm zelf te staan.
Toon hem daar bovenaan, direct onder de knoppenrij:

```tsx
      {error ? <Text style={styles.error}>{error}</Text> : null}
```

en voeg aan de stylesheet toe:

```ts
  error: { color: tennisColors.danger, fontSize: 14 },
```

- [ ] **Step 3: Voeg de twee knoppen toe**

In het `isCoach`-blok bovenaan, onder "Betalingen verwerken":

```tsx
          <Button
            label="Beurtenkaarten"
            variant="secondary"
            onPress={() => router.push('/agenda/beurtenkaarten')}
          />
          <Button
            label="Maandoverzicht"
            variant="secondary"
            onPress={() => router.push('/agenda/export')}
          />
```

(De twee schermen komen in Task 7 en 9; tot dan geeft de knop een lege route.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

- [ ] **Step 5: Commit**

```bash
git add components/PaymentMethodSheet.tsx app/agenda/index.tsx
git commit -m "feat(agenda): betaalwijze kiezen op de afspraak zelf"
```

---

### Task 7: Scherm voor de beurtenkaarten

**Files:**
- Create: `app/agenda/beurtenkaarten.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Registreer de route**

Voeg in `app/_layout.tsx` aan `SCREENS` toe, onder `{ name: 'agenda/new', title: 'Nieuwe afspraak' }`:

```ts
  { name: 'agenda/beurtenkaarten', title: 'Beurtenkaarten' },
```

- [ ] **Step 2: Schrijf het scherm**

Maak `app/agenda/beurtenkaarten.tsx`:

```tsx
// Kaartenbeheer: alle 10-beurtenkaarten op één plek, want een kaart wordt aangemaakt en
// nagekeken los van de les waarvoor hij toevallig geldt.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { remaining, SESSIONS_PER_CARD } from '../../lib/beurtenkaart';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography } from '../../constants/theme';
import type { Beurtenkaart, User } from '../../lib/types';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('nl-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function BeurtenkaartenScreen(): React.JSX.Element {
  const {
    currentUser, users, beurtenkaarten,
    addBeurtenkaart, updateBeurtenkaart, addCardSession, removeCardSession, deleteBeurtenkaart,
  } = useSimpleData();

  const [newPlayerId, setNewPlayerId] = useState<string | null>(null);
  // Welke kaart om bevestiging vraagt voor verwijderen; null = geen.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const players: User[] = useMemo(() => users.filter((u) => u.role !== 'coach'), [users]);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Alleen een trainer beheert de beurtenkaarten.</Text>
      </Screen>
    );
  }

  const sorted: Beurtenkaart[] = [...beurtenkaarten].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  const nameOf = (id: string): string => users.find((u) => u.id === id)?.name ?? 'Onbekende speler';

  return (
    <Screen>
      <Text style={styles.sectionLabel}>Nieuwe kaart</Text>
      <StudentCombobox
        students={players}
        value={newPlayerId}
        onChange={setNewPlayerId}
        placeholder="Typ de naam van de speler…"
      />
      <Button
        label={`Kaart van ${SESSIONS_PER_CARD} beurten aanmaken`}
        variant="primary"
        disabled={newPlayerId === null}
        onPress={() => {
          if (!newPlayerId) return;
          void addBeurtenkaart(newPlayerId);
          setNewPlayerId(null);
        }}
      />

      {sorted.length === 0 ? (
        <Text style={styles.muted}>Nog geen beurtenkaarten.</Text>
      ) : null}

      {sorted.map((card) => {
        const left = remaining(card);
        const used = card.uses.length;
        const pct = Math.min(100, Math.round((used / card.total_sessions) * 100));
        return (
          <Card key={card.id}>
            <Text style={styles.cardName}>{nameOf(card.player_id)}</Text>
            <Text style={styles.cardMeta}>
              {left} van {card.total_sessions} beurten over · aangemaakt {fmt(card.created_at)}
            </Text>

            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>

            <View style={styles.stepRow}>
              <Button
                label="Beurt af"
                variant="secondary"
                fullWidth={false}
                icon={<Plus size={16} color={tennisColors.text} />}
                onPress={() => { void addCardSession(card.id); }}
              />
              <Button
                label="Beurt terug"
                variant="secondary"
                fullWidth={false}
                icon={<Minus size={16} color={tennisColors.text} />}
                onPress={() => { void removeCardSession(card.id); }}
              />
            </View>
            <Text style={styles.hint}>
              Handmatig bijstellen raakt alleen beurten zonder les; een beurt van een les komt
              terug door die les op een andere betaalwijze te zetten.
            </Text>

            <Text style={styles.subLabel}>Opmerking</Text>
            <TextInput
              style={styles.input}
              defaultValue={card.remarks ?? ''}
              placeholder="Bijvoorbeeld: betaald op 3 september"
              placeholderTextColor={tennisColors.textMuted}
              onEndEditing={(e) => {
                void updateBeurtenkaart(card.id, { remarks: e.nativeEvent.text.trim() || undefined });
              }}
            />

            {card.uses.length > 0 ? (
              <>
                <Text style={styles.subLabel}>Gebruikte beurten</Text>
                {card.uses.map((use, i) => (
                  <Text key={`${use.booking_id}-${i}`} style={styles.useLine}>
                    {i + 1}. {fmt(use.date)}{use.booking_id ? '' : ' (handmatig)'}
                  </Text>
                ))}
              </>
            ) : null}

            {confirmingId === card.id ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmText}>
                  Kaart verwijderen? {card.uses.filter((u) => u.booking_id).length} les(sen)
                  verliezen hun beurt en komen terug op Open.
                </Text>
                <View style={styles.stepRow}>
                  <Button
                    label="Ja, verwijderen"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => { void deleteBeurtenkaart(card.id); setConfirmingId(null); }}
                  />
                  <Button
                    label="Nee"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => setConfirmingId(null)}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.stepRow}>
                <Button
                  label="Verwijderen"
                  variant="danger"
                  fullWidth={false}
                  onPress={() => setConfirmingId(card.id)}
                />
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    ...typography.label, color: tennisColors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subLabel: { ...typography.label, color: tennisColors.text, marginTop: spacing.md },
  muted: { ...typography.body, color: tennisColors.textMuted },
  cardName: { ...typography.h3, color: tennisColors.text },
  cardMeta: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  bar: {
    height: 10, borderRadius: radius.pill, backgroundColor: tennisColors.primaryTint,
    marginTop: spacing.sm, overflow: 'hidden',
  },
  barFill: { height: 10, backgroundColor: tennisColors.primary },
  stepRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  hint: { fontSize: 12, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.xs },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.background, marginTop: spacing.xs,
  },
  useLine: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  confirmBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: tennisColors.background, borderWidth: 1, borderColor: tennisColors.border,
  },
  confirmText: { fontSize: 14, color: tennisColors.text },
});
```

- [ ] **Step 3: Controleer de combobox-interface**

Run: `sed -n 1,40p components/ui/StudentCombobox.tsx`
Verwacht: props `students`, `value`, `onChange`, `placeholder` — zoals in `app/agenda/new.tsx` gebruikt. Wijken de namen af, volg dan wat daar staat.

- [ ] **Step 4: Typecheck en handmatige controle**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

Run: `npm run web`, log in als Koen, ga naar Agenda → Beurtenkaarten, maak een kaart voor Mathis, zet in de agenda een les van Mathis op "10-beurtenkaart" en controleer dat de kaart op 9 beurten staat.

- [ ] **Step 5: Commit**

```bash
git add app/agenda/beurtenkaarten.tsx app/_layout.tsx
git commit -m "feat(beurtenkaart): scherm om kaarten aan te maken en na te kijken"
```

---

### Task 8: CSV-rijen en -tekst

**Files:**
- Create: `lib/status.ts`
- Create: `lib/csv.ts`
- Test: `lib/csv.test.ts`

- [ ] **Step 1: Schrijf de falende test**

Maak `lib/csv.test.ts`:

```ts
import type { Booking, Court, User } from './types';
import { monthRows, toCsv, CSV_HEADER } from './csv';

const users: User[] = [
  { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach' },
  { id: 'p1', name: 'Mathis', email: 'm@x.be', role: 'player' },
];

const courts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: '2026-08-20T08:00:00.000Z', end_time: '2026-08-20T09:00:00.000Z',
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

describe('monthRows', () => {
  it('keeps only bookings in the chosen month', () => {
    const rows = monthRows(
      [booking(), booking({ id: 'b2', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].player).toBe('Mathis');
  });

  it('sorts by start time', () => {
    const rows = monthRows(
      [
        booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
        booking({ id: 'b1' }),
      ],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b2']);
  });

  it('fills coach, court, duration, price and labels', () => {
    const [row] = monthRows([booking()], users, courts, new Date(2026, 7, 1));
    expect(row.coach).toBe('Koen');
    expect(row.court).toBe('Baan 1');
    expect(row.minutes).toBe(60);
    expect(row.price).toBe(30);
    expect(row.status).toBe('Bevestigd');
    expect(row.payment).toBe('Cash');
  });

  it('prices a half hour at half the rate', () => {
    const [row] = monthRows(
      [booking({ end_time: '2026-08-20T08:30:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(row.minutes).toBe(30);
    expect(row.price).toBe(15);
  });

  it('names an unknown player and court instead of leaving them empty', () => {
    const [row] = monthRows(
      [booking({ player_id: 'weg', court_id: 'weg' })], users, courts, new Date(2026, 7, 1),
    );
    expect(row.player).toBe('Onbekend');
    expect(row.court).toBe('Onbekend terrein');
  });

  it('returns nothing for an empty month', () => {
    expect(monthRows([booking()], users, courts, new Date(2026, 0, 1))).toEqual([]);
  });
});

describe('toCsv', () => {
  it('starts with the header row', () => {
    expect(toCsv([]).split('\n')[0]).toBe(CSV_HEADER.join(';'));
  });

  it('writes one line per row, semicolon separated', () => {
    const rows = monthRows([booking()], users, courts, new Date(2026, 7, 1));
    const lines = toCsv(rows).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split(';')).toHaveLength(CSV_HEADER.length);
  });

  it('writes the price with a comma, as Excel here expects', () => {
    const rows = monthRows([booking({ end_time: '2026-08-20T08:30:00.000Z' })], users, courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('15,00');
  });

  it('quotes a field that contains the separator', () => {
    const rows = monthRows([booking()], [
      { id: 'koen', name: 'Koen; de trainer', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('"Koen; de trainer"');
  });
});
```

- [ ] **Step 2: Draai de test en zie hem falen**

Run: `npx jest lib/csv.test.ts`
Verwacht: FAIL — `Cannot find module './csv'`.

- [ ] **Step 3: Schrijf `lib/status.ts`**

```ts
// Nederlandse labels voor de status van een boeking, op één plek: het agendascherm en de
// maandexport moeten hetzelfde woord gebruiken.

import type { BookingStatus } from './types';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  cancelled: 'Geannuleerd',
  completed: 'Voltooid',
  synchronized: 'Gesynchroniseerd',
};
```

- [ ] **Step 4: Schrijf `lib/csv.ts`**

```ts
// Het maandoverzicht als gegevens (monthRows) en als tekst (toCsv), los van elkaar zodat
// het scherm dezelfde rijen kan tonen die het uitvoert.

import { PAYMENT_LABELS } from './payments';
import { BOOKING_STATUS_LABELS } from './status';
import type { Booking, Court, User } from './types';

export interface CsvRow {
  id: string;
  date: string;    // dd/mm/jjjj
  time: string;    // HH:MM
  coach: string;
  player: string;
  court: string;
  minutes: number;
  price: number;   // euro
  status: string;
  payment: string;
}

export const CSV_HEADER = [
  'Datum', 'Uur', 'Trainer', 'Speler', 'Terrein', 'Duur (min)', 'Prijs (EUR)', 'Status', 'Betaalwijze',
] as const;

function two(n: number): string {
  return String(n).padStart(2, '0');
}

function inMonth(iso: string, month: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

/** De lessen van één kalendermaand, op tijd gesorteerd, met de namen al opgezocht. */
export function monthRows(
  bookings: Booking[], users: User[], courts: Court[], month: Date,
): CsvRow[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const courtById = new Map(courts.map((c) => [c.id, c]));

  return bookings
    .filter((b) => inMonth(b.start_time, month))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b) => {
      const start = new Date(b.start_time);
      const minutes = Math.round((new Date(b.end_time).getTime() - start.getTime()) / 60000);
      const court = courtById.get(b.court_id);
      return {
        id: b.id,
        date: `${two(start.getDate())}/${two(start.getMonth() + 1)}/${start.getFullYear()}`,
        time: `${two(start.getHours())}:${two(start.getMinutes())}`,
        coach: nameById.get(b.coach_id) ?? 'Onbekend',
        player: nameById.get(b.player_id) ?? 'Onbekend',
        court: court?.name ?? 'Onbekend terrein',
        minutes,
        price: Math.round(((court?.hourly_rate ?? 0) * minutes) / 60 * 100) / 100,
        status: BOOKING_STATUS_LABELS[b.status],
        payment: PAYMENT_LABELS[b.payment_method],
      };
    });
}

/** Excel hier leest puntkomma's en een komma als decimaalteken. */
function cell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [CSV_HEADER.join(';')];
  for (const r of rows) {
    lines.push([
      r.date, r.time, r.coach, r.player, r.court,
      String(r.minutes), r.price.toFixed(2).replace('.', ','), r.status, r.payment,
    ].map(cell).join(';'));
  }
  return lines.join('\n');
}
```

- [ ] **Step 5: Draai de test opnieuw**

Run: `npx jest lib/csv.test.ts`
Verwacht: PASS.

- [ ] **Step 6: Laat het agendascherm hetzelfde labelbestand gebruiken**

In `app/agenda/index.tsx`: vervang de labels in `STATUS_META` door verwijzingen naar `BOOKING_STATUS_LABELS`, zodat er maar één lijst is:

```ts
import { BOOKING_STATUS_LABELS } from '../../lib/status';

const STATUS_META: Record<BookingStatus, BadgeMeta> = {
  pending: { color: tennisColors.warning, label: BOOKING_STATUS_LABELS.pending, subtle: false },
  confirmed: { color: tennisColors.primary, label: BOOKING_STATUS_LABELS.confirmed, subtle: false },
  cancelled: { color: tennisColors.textMuted, label: BOOKING_STATUS_LABELS.cancelled, subtle: false },
  completed: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.completed, subtle: false },
  synchronized: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.synchronized, subtle: false },
};
```

- [ ] **Step 7: Commit**

```bash
git add lib/status.ts lib/csv.ts lib/csv.test.ts app/agenda/index.tsx
git commit -m "feat(export): maandrijen en CSV-tekst voor het lesoverzicht"
```

---

### Task 9: Exportscherm en delen

**Files:**
- Create: `lib/share.ts`
- Create: `app/agenda/export.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Schrijf `lib/share.ts`**

```ts
// Het enige platform-afhankelijke stukje: op web wordt een CSV een download, op een
// telefoon gaat hij het deelmenu in. Geen extra pakketten nodig.

import { Platform, Share } from 'react-native';

export async function shareCsv(filename: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    // De BOM vooraan zorgt dat Excel de accenten goed leest.
    const blob = new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: text, title: filename });
}
```

- [ ] **Step 2: Registreer de route**

Voeg in `app/_layout.tsx` aan `SCREENS` toe, onder de regel van `agenda/beurtenkaarten`:

```ts
  { name: 'agenda/export', title: 'Maandoverzicht' },
```

- [ ] **Step 3: Schrijf het scherm**

Maak `app/agenda/export.tsx`:

```tsx
// Maandoverzicht: eerst zien wat je uitvoert, dan pas uitvoeren.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react-native';

import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { monthRows, toCsv, CSV_HEADER } from '../../lib/csv';
import { shareCsv } from '../../lib/share';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shift(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export default function ExportScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts } = useSimpleData();
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const isCoach = currentUser?.role === 'coach';

  // Een trainer voert zijn eigen lessen uit, een speler die van hemzelf: geld en dossiers
  // blijven per persoon, ook in een export.
  const mine = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter((b) =>
      isCoach ? b.coach_id === currentUser.id : b.player_id === currentUser.id,
    );
  }, [bookings, currentUser, isCoach]);

  const rows = useMemo(
    () => monthRows(mine, users, courts, month),
    [mine, users, courts, month],
  );

  const total = rows.reduce((sum, r) => sum + r.price, 0);
  const label = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;
  const filename = `lessen-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}.csv`;

  return (
    <Screen>
      <View style={styles.monthRow}>
        <Button
          label="Vorige"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronLeft size={16} color={tennisColors.text} />}
          onPress={() => setMonth((m) => shift(m, -1))}
        />
        <Text style={styles.month}>{label}</Text>
        <Button
          label="Volgende"
          variant="secondary"
          fullWidth={false}
          icon={<ChevronRight size={16} color={tennisColors.text} />}
          onPress={() => setMonth((m) => shift(m, 1))}
        />
      </View>

      <Card>
        <Text style={styles.summary}>
          {rows.length === 1 ? '1 les' : `${rows.length} lessen`} · € {total.toFixed(2).replace('.', ',')}
        </Text>
      </Card>

      {rows.length === 0 ? (
        <Text style={styles.muted}>Geen lessen in deze maand.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.tr, styles.thead]}>
              {CSV_HEADER.map((h) => (
                <Text key={h} style={[styles.td, styles.th]}>{h}</Text>
              ))}
            </View>
            {rows.map((r) => (
              <View key={r.id} style={styles.tr}>
                <Text style={styles.td}>{r.date}</Text>
                <Text style={styles.td}>{r.time}</Text>
                <Text style={styles.td}>{r.coach}</Text>
                <Text style={styles.td}>{r.player}</Text>
                <Text style={styles.td}>{r.court}</Text>
                <Text style={styles.td}>{r.minutes}</Text>
                <Text style={styles.td}>{r.price.toFixed(2).replace('.', ',')}</Text>
                <Text style={styles.td}>{r.status}</Text>
                <Text style={styles.td}>{r.payment}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Button
        label="Exporteren"
        variant="primary"
        disabled={rows.length === 0}
        icon={<Download size={16} color={tennisColors.white} />}
        onPress={() => { void shareCsv(filename, toCsv(rows)); }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  month: { ...typography.h3, color: tennisColors.text },
  summary: { ...typography.body, color: tennisColors.text, fontWeight: '600' },
  muted: { ...typography.body, color: tennisColors.textMuted },
  tr: { flexDirection: 'row' },
  thead: { borderBottomWidth: 1, borderBottomColor: tennisColors.border, marginBottom: spacing.xs },
  td: { width: 110, paddingVertical: spacing.xs, paddingRight: spacing.sm, fontSize: 13, color: tennisColors.text },
  th: { fontWeight: '700', color: tennisColors.textMuted },
});
```

- [ ] **Step 4: Typecheck en handmatige controle**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

Run: `npm run web`, Agenda → Maandoverzicht, blader naar de vorige maand, druk op Exporteren en controleer dat er een `lessen-JJJJ-MM.csv` gedownload wordt die in Excel netjes in kolommen staat.

- [ ] **Step 5: Commit**

```bash
git add lib/share.ts app/agenda/export.tsx app/_layout.tsx
git commit -m "feat(export): maandoverzicht bekijken en als CSV uitvoeren"
```

---

### Task 10: Standaard betaalwijze per speler

**Files:**
- Modify: `app/players/[id].tsx`
- Modify: `components/BookingModal.tsx`

- [ ] **Step 1: Zet de keuze in het spelersdossier**

Voeg in `app/players/[id].tsx` bij de imports toe:

```ts
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import type { PaymentMethod } from '../../lib/types';
```

Haal `updateUser` erbij uit `useSimpleData()`.

Voeg, alleen zichtbaar voor een trainer, een blok toe boven het voortgangsformulier:

```tsx
      {isCoach ? (
        <Card>
          <Text style={styles.sectionTitle}>Standaard betaalwijze</Text>
          <Text style={styles.muted}>
            Een nieuwe les van {player.name} krijgt deze betaalwijze meteen.
          </Text>
          <View style={styles.chipRow}>
            {PAYMENT_METHODS.map((method) => (
              <Chip
                key={method}
                label={PAYMENT_LABELS[method]}
                selected={(player.default_payment_method ?? 'open') === method}
                onPress={() => {
                  void updateUser(player.id, {
                    default_payment_method: method as PaymentMethod,
                  });
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}
```

Gebruik de stijlnamen die in dat bestand al bestaan voor `sectionTitle`, `muted` en `chipRow`; bestaan ze niet onder die naam, voeg ze dan toe:

```ts
  sectionTitle: { ...typography.h3, color: tennisColors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
```

- [ ] **Step 2: Laat een nieuwe boeking die wijze overnemen**

In `components/BookingModal.tsx`: voeg bij de imports toe

```ts
import { defaultMethodFor } from '../lib/payments';
```

en vervang in `handleConfirm` de regel `payment_method: 'open',` door:

```ts
        payment_method: defaultMethodFor(users.find((u) => u.id === (playerId ?? currentUser.id))),
```

Let op: een speler met standaard `beurtenkaart` boekt hiermee geen beurt af — dat gebeurt bewust pas als de trainer de les in de agenda bevestigt. Voeg daarom onder het invoerveld voor notities een regel toe die dat duidelijk maakt:

```tsx
            <Text style={styles.hint}>
              Betaalwijze: {PAYMENT_LABELS[defaultMethodFor(users.find((u) => u.id === (playerId ?? currentUser?.id)))]}
            </Text>
```

met `import { defaultMethodFor, PAYMENT_LABELS } from '../lib/payments';` en in de stylesheet:

```ts
  hint: { fontSize: 13, color: tennisColors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
```

- [ ] **Step 3: Typecheck en handmatige controle**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

Run: `npm run web`, zet bij Mathis de standaard op "Cash", boek een nieuwe les voor hem en controleer dat de badge in de agenda meteen "Cash" toont.

- [ ] **Step 4: Commit**

```bash
git add "app/players/[id].tsx" components/BookingModal.tsx
git commit -m "feat(betalingen): standaard betaalwijze per speler"
```

---

### Task 11: Alles nalopen

**Files:** geen nieuwe

- [ ] **Step 1: Volledige testronde**

Run: `npm test`
Verwacht: alle suites groen, inclusief `lib/payments.test.ts`, `lib/migrate.test.ts`, `lib/beurtenkaart.test.ts`, `lib/csv.test.ts`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Verwacht: geen fouten.

- [ ] **Step 3: Geen restanten van het oude veld**

Run: `grep -rn "payment_status\|PaymentStatus" app lib providers components --include="*.ts" --include="*.tsx"`
Verwacht: alleen treffers in `lib/migrate.ts` (het legacy-type) en `lib/migrate.test.ts`.

- [ ] **Step 4: Doorloop met de hand**

Run: `npm run web` en loop af als trainer Koen:
1. Agenda: badge aantikken, elke betaalwijze kiezen — de badge verandert mee.
2. Speler zonder kaart op "10-beurtenkaart" zetten: melding "Geen beurtenkaart met beurten over voor deze speler.", betaalwijze verandert niet.
3. Kaart aanmaken, les op beurtenkaart zetten: kaart staat op 9 over.
4. Diezelfde les annuleren: kaart staat weer op 10 over en de les staat op Open.
5. Beheer → Betalingen: de zes knoppen staan er, lijst loopt leeg als je ze afhandelt.
6. Beheer → Rapport: uitsplitsing per betaalwijze klopt met wat je zojuist zette.
7. Agenda → Maandoverzicht: exporteren geeft een bruikbaar CSV-bestand.

- [ ] **Step 5: Commit als er nog iets is bijgeschaafd**

```bash
git add -A
git commit -m "fix(agenda): laatste afwerking van betaalwijze, beurtenkaart en export"
```
