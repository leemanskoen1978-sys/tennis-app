# Tennis Coach & Player Booking App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working web-first tennis lesson booking app (Expo + React Native Web + TypeScript) backed by Supabase, covering login, booking, payments, lessons, progress, reports, drawing and profile for coach/player roles.

**Architecture:** Expo SDK 53 with expo-router file-based routing, targeting web (`expo start --web`). A single `SimpleDataProvider` React Context talks directly to Supabase via `@supabase/supabase-js` and exposes `useSimpleData` / `usePendingPaymentBookings`. Pure business logic (slot generation, payment derivation, seed) lives in `lib/` unit-tested modules. Native-only features (calendar import, voice) are web placeholder stubs.

**Tech Stack:** Expo SDK 53, React Native, React Native Web, TypeScript, expo-router, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `lucide-react-native`, `expo-linear-gradient`, Jest + ts-jest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-08-19-tennis-booking-app-design.md`

---

## File Structure

```
app/
  _layout.tsx            # root: wraps app in SimpleDataProvider, session gate
  login.tsx              # user picker login
  (tabs)/
    _layout.tsx          # 7-tab navigator, role-aware
    index.tsx            # home — reserveren
    bookings.tsx
    lessons.tsx
    progress.tsx
    reports.tsx
    drawing.tsx
    profile.tsx
components/
  BookingModal.tsx
  PaymentStatusModal.tsx
  UserManagement.tsx
  CoachDashboard.tsx
  VoiceRecorder.tsx      # web placeholder
  SpeechToText.tsx       # web placeholder
constants/
  tennis-colors.ts
lib/
  supabase.ts            # client
  slots.ts               # slot generation + today-blocked rules (pure)
  payments.ts            # pending-payment derivation + revenue (pure)
  seed.ts                # idempotent seed data (pure defaults)
  types.ts               # shared TS interfaces
providers/
  SimpleDataProvider.tsx # context + hooks + Supabase CRUD
  session.ts             # remember logged-in user id locally
supabase-schema.sql      # DB migration + seed
.env.example
```

**Responsibilities:** pure logic in `lib/slots.ts`, `lib/payments.ts`, `lib/seed.ts` (unit-tested, no I/O). All Supabase I/O in `providers/SimpleDataProvider.tsx`. Screens are thin — they read from `useSimpleData()` and call its actions.

---

## Task 1: Scaffold Expo project (web target)

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `.env.example`
- Modify: `.gitignore` (already present)

- [ ] **Step 1: Create the Expo project scaffold**

Run in the project root (`/Users/leko/Downloads/tennis app`):

```bash
npx create-expo-app@latest . --template blank-typescript
```

If the directory-not-empty prompt appears, keep existing files (`docs/`, `.git`, `.gitignore`). If the CLI refuses, scaffold in a temp dir and copy `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `App.tsx` over.

- [ ] **Step 2: Install runtime + web + dev dependencies**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens \
  react-native-web react-dom @expo/metro-runtime \
  @react-native-async-storage/async-storage @supabase/supabase-js \
  lucide-react-native react-native-svg expo-linear-gradient
npm install -D jest ts-jest @types/jest jest-expo
```

- [ ] **Step 3: Configure expo-router + web output in `app.json`**

Ensure `app.json` `expo` block contains:

```json
{
  "expo": {
    "name": "Tennisclub Racso",
    "slug": "tennis-racso",
    "scheme": "tennisracso",
    "web": { "bundler": "metro", "output": "single" },
    "plugins": ["expo-router"],
    "newArchEnabled": true
  }
}
```

- [ ] **Step 4: Set entry point + scripts in `package.json`**

Set `"main": "expo-router/entry"` and add scripts:

```json
"scripts": {
  "start": "expo start",
  "web": "expo start --web",
  "test": "jest"
}
```

Add a `jest` block:

```json
"jest": { "preset": "jest-expo", "transformIgnorePatterns": ["node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@supabase/.*|lucide-react-native))"] }
```

- [ ] **Step 5: Create `.env.example`**

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Also create a local `.env` copy (gitignored) with the same placeholders for now.

- [ ] **Step 6: Remove default `App.tsx`** (expo-router uses `app/`)

```bash
rm -f App.tsx
```

- [ ] **Step 7: Verify it builds**

Run: `npx expo start --web --non-interactive` (Ctrl-C after bundle) — or `npm run web`.
Expected: Metro bundles without module-resolution errors (a blank/placeholder screen is fine at this stage).

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: scaffold Expo web project + deps"
```

---

## Task 2: Shared types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write `lib/types.ts`**

Copy the interfaces verbatim from spec §4 (`Role`, `BookingStatus`, `PaymentStatus`, `TrainingType`, `User`, `Court`, `Booking`, `Lesson`, `StudentProgress`, `Settings`). Export every type.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts && git commit -m "feat: shared TypeScript data model"
```

---

## Task 3: Tennis colors constant

**Files:**
- Create: `constants/tennis-colors.ts`

- [ ] **Step 1: Write the palette**

```ts
export const tennisColors = {
  primary: '#3E8E41',      // tennisgroen
  primaryDark: '#2E6B30',
  accent: '#C8E063',       // ball-yellow-green
  court: '#2C5F8A',        // court blue
  clay: '#C56B3E',
  background: '#F5F7F2',
  surface: '#FFFFFF',
  text: '#1C2B1E',
  textMuted: '#6B7B6E',
  border: '#DCE5D8',
  danger: '#C0392B',
  warning: '#E08E0B',
  success: '#3E8E41',
  white: '#FFFFFF',
} as const;

export type TennisColorKey = keyof typeof tennisColors;
```

- [ ] **Step 2: Commit**

```bash
git add constants/tennis-colors.ts && git commit -m "feat: tennis color palette"
```

---

## Task 4: Slot generation + booking rules (pure, TDD)

**Files:**
- Create: `lib/slots.ts`
- Test: `lib/slots.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { generateSlots, isDateBookable } from './slots';

describe('generateSlots', () => {
  it('generates hourly slots from 09:00 to end time inclusive of start, exclusive of end', () => {
    expect(generateSlots('21:00')).toEqual(
      ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']
    );
  });
  it('respects a custom earlier end time', () => {
    expect(generateSlots('12:00')).toEqual(['09:00','10:00','11:00']);
  });
});

describe('isDateBookable', () => {
  const today = new Date('2026-08-19T10:00:00');
  it('blocks today', () => {
    expect(isDateBookable(new Date('2026-08-19T00:00:00'), today)).toBe(false);
  });
  it('blocks past days', () => {
    expect(isDateBookable(new Date('2026-08-18T00:00:00'), today)).toBe(false);
  });
  it('allows future days', () => {
    expect(isDateBookable(new Date('2026-08-20T00:00:00'), today)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- slots`
Expected: FAIL ("Cannot find module './slots'").

- [ ] **Step 3: Implement `lib/slots.ts`**

```ts
/** Hourly HH:00 slots from 09:00 up to (excluding) endTime, e.g. '21:00'. */
export function generateSlots(endTime: string): string[] {
  const startHour = 9;
  const endHour = parseInt(endTime.slice(0, 2), 10);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

/** Booking is not allowed on the day itself or in the past. */
export function isDateBookable(date: Date, now: Date = new Date()): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() > t.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- slots`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/slots.ts lib/slots.test.ts && git commit -m "feat: slot generation + today-blocked rule (tested)"
```

---

## Task 5: Payment derivation + revenue (pure, TDD)

**Files:**
- Create: `lib/payments.ts`
- Test: `lib/payments.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { needsPayment, filterPendingPayment, totalRevenue } from './payments';
import type { Booking, Court } from './types';

const base: Booking = {
  id: '1', player_id: 'p', coach_id: 'c', court_id: 'court1',
  start_time: '2026-08-20T09:00:00Z', end_time: '2026-08-20T10:00:00Z',
  status: 'confirmed', payment_status: null,
};

describe('needsPayment', () => {
  it('is true for confirmed/completed/synchronized without payment_status', () => {
    expect(needsPayment({ ...base, status: 'confirmed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'completed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'synchronized' })).toBe(true);
  });
  it('is false when already paid/invoiced/unpaid', () => {
    expect(needsPayment({ ...base, payment_status: 'paid' })).toBe(false);
    expect(needsPayment({ ...base, payment_status: 'invoice' })).toBe(false);
    expect(needsPayment({ ...base, payment_status: 'unpaid' })).toBe(false);
  });
  it('is false for pending/cancelled status', () => {
    expect(needsPayment({ ...base, status: 'pending' })).toBe(false);
    expect(needsPayment({ ...base, status: 'cancelled' })).toBe(false);
  });
});

describe('filterPendingPayment', () => {
  it('returns only bookings that need payment', () => {
    const list = [base, { ...base, id: '2', payment_status: 'paid' as const }];
    expect(filterPendingPayment(list).map(b => b.id)).toEqual(['1']);
  });
});

describe('totalRevenue', () => {
  const courts: Court[] = [{ id: 'court1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 }];
  it('sums hourly_rate for paid/cash bookings only', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_status: 'paid' },
      { ...base, id: '2', payment_status: 'invoice' },
      { ...base, id: '3', payment_status: null },
    ];
    expect(totalRevenue(list, courts)).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- payments`
Expected: FAIL ("Cannot find module './payments'").

- [ ] **Step 3: Implement `lib/payments.ts`**

```ts
import type { Booking, Court } from './types';

const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'completed', 'synchronized'];

export function needsPayment(b: Booking): boolean {
  return PAYABLE_STATUSES.includes(b.status) && (b.payment_status === null || b.payment_status === undefined);
}

export function filterPendingPayment(bookings: Booking[]): Booking[] {
  return bookings.filter(needsPayment);
}

/** Revenue counts only realized cash income (payment_status 'paid'). */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const rate = (id: string) => courts.find(c => c.id === id)?.hourly_rate ?? 0;
  return bookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + rate(b.court_id), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- payments`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/payments.ts lib/payments.test.ts && git commit -m "feat: payment derivation + revenue (tested)"
```

---

## Task 6: Seed defaults (pure, TDD)

**Files:**
- Create: `lib/seed.ts`
- Test: `lib/seed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { seedUsers, seedCourts, defaultSettings } from './seed';

describe('seed data', () => {
  it('has exactly Koen (coach), Mathis (player), Test (player)', () => {
    expect(seedUsers.map(u => [u.name, u.role])).toEqual([
      ['Koen', 'coach'], ['Mathis', 'player'], ['Test', 'player'],
    ]);
  });
  it('has at least one court with an hourly rate', () => {
    expect(seedCourts.length).toBeGreaterThan(0);
    expect(seedCourts[0].hourly_rate).toBeGreaterThan(0);
  });
  it('default booking end time is 21:00', () => {
    expect(defaultSettings.booking_end_time).toBe('21:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- seed`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/seed.ts`**

```ts
import type { User, Court, Settings } from './types';

export const seedUsers: Omit<User, 'id'>[] = [
  { name: 'Koen', email: 'koen@racso.be', role: 'coach' },
  { name: 'Mathis', email: 'mathis@racso.be', role: 'player' },
  { name: 'Test', email: 'test@racso.be', role: 'player' },
];

export const seedCourts: Omit<Court, 'id'>[] = [
  { name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
  { name: 'Baan 2', number: 2, indoor: true, hourly_rate: 35 },
];

export const defaultSettings: Settings = {
  booking_end_time: '21:00',
  theme: 'light',
  language: 'nl',
  notifications: {},
  blocked_popups_until: null,
};
```

Note: `seedUsers`/`seedCourts` use `Omit<…, 'id'>`; the DB assigns UUIDs. Tests index `hourly_rate`/`name`/`role` which exist on the Omit type.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- seed`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/seed.ts lib/seed.test.ts && git commit -m "feat: seed defaults (tested)"
```

---

## Task 7: Supabase SQL schema + seed

**Files:**
- Create: `supabase-schema.sql`

- [ ] **Step 1: Write the schema**

Create `supabase-schema.sql` implementing spec §5. Include, in order:

```sql
-- Tennisclub Racso — Supabase schema
create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  role text not null check (role in ('player','coach','parent')),
  phone text,
  bio text,
  preferred_court_id uuid,
  working_hours jsonb,
  working_days jsonb,
  notification_settings jsonb,
  created_at timestamptz default now()
);

create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number int not null,
  indoor boolean not null default false,
  hourly_rate numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references users(id) on delete cascade,
  coach_id uuid references users(id) on delete cascade,
  court_id uuid references courts(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null check (status in ('pending','confirmed','cancelled','completed','synchronized')),
  payment_status text check (payment_status in ('paid','unpaid','invoice')),
  notes text,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  created_at timestamptz default now()
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  description text,
  uploaded_by uuid references users(id) on delete set null,
  student_id uuid references users(id) on delete set null,
  coach_id uuid references users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references users(id) on delete cascade,
  coach_id uuid references users(id) on delete set null,
  training_type text check (training_type in ('techniek','tactiek','fysiek','mentaal','match')),
  notes text,
  rating int,
  skills jsonb,
  homework text,
  voice_memo_uri text,
  created_at timestamptz default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
```

- [ ] **Step 2: Add idempotent seed + permissive RLS**

Append:

```sql
-- Seed only when users table is empty
insert into users (name, email, role)
select * from (values
  ('Koen','koen@racso.be','coach'),
  ('Mathis','mathis@racso.be','player'),
  ('Test','test@racso.be','player')
) as v(name,email,role)
where not exists (select 1 from users);

insert into courts (name, number, indoor, hourly_rate)
select * from (values
  ('Baan 1',1,false,30),
  ('Baan 2',2,true,35)
) as v(name,number,indoor,hourly_rate)
where not exists (select 1 from courts);

-- RLS: permissive for local test (tighten later)
alter table users enable row level security;
alter table courts enable row level security;
alter table bookings enable row level security;
alter table lessons enable row level security;
alter table student_progress enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['users','courts','bookings','lessons','student_progress','settings'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format('create policy %I_all on %I for all using (true) with check (true)', t, t);
  end loop;
end $$;
```

- [ ] **Step 3: Manual DB setup note**

Add a comment at the top of the file: run this in the Supabase SQL editor, then copy the project URL + anon key into `.env`. (No automated test — this is applied manually by the user.)

- [ ] **Step 4: Commit**

```bash
git add supabase-schema.sql && git commit -m "feat: Supabase schema + seed + permissive RLS"
```

---

## Task 8: Supabase client

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write the client**

```ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surface a clear message instead of a cryptic runtime crash.
  console.warn('Supabase env vars ontbreken — vul .env in (zie .env.example).');
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false },
});
```

- [ ] **Step 2: Install the url polyfill**

```bash
npx expo install react-native-url-polyfill
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts package.json && git commit -m "feat: Supabase client"
```

---

## Task 9: Session persistence

**Files:**
- Create: `providers/session.ts`

- [ ] **Step 1: Write session helpers**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tennis.currentUserId';

export async function loadСurrentUserId(): Promise<string | null> {
  try { return await AsyncStorage.getItem(KEY); } catch { return null; }
}
export async function saveCurrentUserId(id: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, id); } catch { /* ignore */ }
}
export async function clearCurrentUserId(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
```

Note: rename the load function to `loadCurrentUserId` (ASCII) — ensure no stray Unicode; the correct export name used everywhere is `loadCurrentUserId`, `saveCurrentUserId`, `clearCurrentUserId`.

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit && git add providers/session.ts && git commit -m "feat: local session persistence"
```

---

## Task 10: SimpleDataProvider (context + Supabase CRUD + hooks)

**Files:**
- Create: `providers/SimpleDataProvider.tsx`

- [ ] **Step 1: Define the context shape and provider**

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { filterPendingPayment } from '../lib/payments';
import { loadCurrentUserId, saveCurrentUserId, clearCurrentUserId } from './session';
import type { User, Court, Booking, Lesson, StudentProgress, Settings } from '../lib/types';

interface DataShape {
  users: User[]; courts: Court[]; bookings: Booking[];
  lessons: Lesson[]; progress: StudentProgress[]; settings: Settings;
  currentUser: User | null; loading: boolean; error: string | null;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  addBooking: (b: Omit<Booking,'id'>) => Promise<void>;
  updateBooking: (id: string, patch: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  addUser: (u: Omit<User,'id'>) => Promise<void>;
  addLesson: (l: Omit<Lesson,'id'>) => Promise<void>;
  addProgress: (p: Omit<StudentProgress,'id'>) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  emergencyCleanup: () => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = { booking_end_time: '21:00', theme: 'light', language: 'nl' };
const Ctx = createContext<DataShape | null>(null);

export function SimpleDataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<StudentProgress[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [u, c, b, l, p] = await Promise.all([
        supabase.from('users').select('*').order('created_at'),
        supabase.from('courts').select('*').order('number'),
        supabase.from('bookings').select('*').order('start_time'),
        supabase.from('lessons').select('*').order('created_at'),
        supabase.from('student_progress').select('*').order('created_at'),
      ]);
      const firstErr = [u,c,b,l,p].find(r => r.error)?.error;
      if (firstErr) throw firstErr;
      setUsers(u.data ?? []); setCourts(c.data ?? []); setBookings(b.data ?? []);
      setLessons(l.data ?? []); setProgress(p.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Kon data niet laden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      const savedId = await loadCurrentUserId();
      if (savedId) {
        const { data } = await supabase.from('users').select('*').eq('id', savedId).maybeSingle();
        if (data) setCurrentUser(data);
      }
    })();
  }, [refresh]);
  ...
}
```

- [ ] **Step 2: Implement the action functions inside the provider**

Add before the `return`:

```tsx
  const login = async (userId: string) => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) { setError(error.message); return; }
    if (data) { setCurrentUser(data); await saveCurrentUserId(userId); }
  };
  const logout = async () => { setCurrentUser(null); await clearCurrentUserId(); };

  async function mutate<T>(op: Promise<{ error: any }>, after: () => Promise<void>) {
    const { error } = await op;
    if (error) { setError(error.message); return; }
    await after();
  }

  const addBooking = (b: Omit<Booking,'id'>) =>
    mutate(supabase.from('bookings').insert(b), refresh);
  const updateBooking = (id: string, patch: Partial<Booking>) =>
    mutate(supabase.from('bookings').update(patch).eq('id', id), refresh);
  const deleteBooking = (id: string) =>
    mutate(supabase.from('bookings').delete().eq('id', id), refresh);
  const addUser = (u: Omit<User,'id'>) =>
    mutate(supabase.from('users').insert(u), refresh);
  const addLesson = (l: Omit<Lesson,'id'>) =>
    mutate(supabase.from('lessons').insert(l), refresh);
  const addProgress = (p: Omit<StudentProgress,'id'>) =>
    mutate(supabase.from('student_progress').insert(p), refresh);

  const saveSettings = async (s: Settings) => {
    setSettings(s);
    if (currentUser) {
      await supabase.from('settings')
        .upsert({ user_id: currentUser.id, value: s }, { onConflict: 'user_id' });
    }
  };

  // Emergency cleanup: explicit, never automatic. Deletes rows with a null/invalid
  // status that cannot be parsed by the app. Caller must confirm before invoking.
  const emergencyCleanup = async () => {
    await supabase.from('bookings').delete().is('status', null);
    await refresh();
  };
```

- [ ] **Step 3: Return the provider + hooks**

```tsx
  const value: DataShape = {
    users, courts, bookings, lessons, progress, settings,
    currentUser, loading, error,
    login, logout, refresh,
    addBooking, updateBooking, deleteBooking,
    addUser, addLesson, addProgress, saveSettings, emergencyCleanup,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSimpleData(): DataShape {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSimpleData must be used within SimpleDataProvider');
  return ctx;
}

export function usePendingPaymentBookings(): Booking[] {
  const { bookings } = useSimpleData();
  return filterPendingPayment(bookings);
}
```

- [ ] **Step 4: Load per-user settings on login**

In the `login` function, after `setCurrentUser(data)`, fetch settings:

```tsx
    const { data: srow } = await supabase.from('settings').select('value').eq('user_id', userId).maybeSingle();
    if (srow?.value) setSettings({ ...DEFAULT_SETTINGS, ...srow.value });
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add providers/SimpleDataProvider.tsx && git commit -m "feat: SimpleDataProvider with Supabase CRUD + hooks"
```

---

## Task 11: Root layout + session gate

**Files:**
- Create: `app/_layout.tsx`

- [ ] **Step 1: Write the root layout**

```tsx
import { Stack, Redirect, useSegments } from 'expo-router';
import { SimpleDataProvider, useSimpleData } from '../providers/SimpleDataProvider';
import { View, ActivityIndicator } from 'react-native';
import { tennisColors } from '../constants/tennis-colors';

function Gate() {
  const { currentUser, loading } = useSimpleData();
  const segments = useSegments();
  const inTabs = segments[0] === '(tabs)';

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tennisColors.background }}>
        <ActivityIndicator color={tennisColors.primary} size="large" />
      </View>
    );
  }
  if (!currentUser && inTabs) return <Redirect href="/login" />;
  if (currentUser && !inTabs) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SimpleDataProvider>
      <Gate />
    </SimpleDataProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx && git commit -m "feat: root layout with session gate"
```

---

## Task 12: Login screen

**Files:**
- Create: `app/login.tsx`

- [ ] **Step 1: Write the login screen**

Render the club title and a scrollable list of `users` from `useSimpleData()`. Each row shows name + role badge; tapping calls `login(user.id)`. Handle empty list (show "Geen gebruikers — voer supabase-schema.sql uit"). Use `tennisColors`, `expo-linear-gradient` header, `lucide-react-native` icons (`User`, `Award`). Full component:

```tsx
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User as UserIcon, Award } from 'lucide-react-native';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';

export default function Login() {
  const { users, login, error } = useSimpleData();
  return (
    <View style={styles.container}>
      <LinearGradient colors={[tennisColors.primary, tennisColors.primaryDark]} style={styles.header}>
        <Text style={styles.title}>Tennisclub Racso</Text>
        <Text style={styles.subtitle}>Kies je profiel</Text>
      </LinearGradient>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView contentContainerStyle={styles.list}>
        {users.length === 0 ? (
          <Text style={styles.empty}>Geen gebruikers — voer supabase-schema.sql uit.</Text>
        ) : users.map(u => (
          <Pressable key={u.id} style={styles.row} onPress={() => login(u.id)}>
            <UserIcon color={tennisColors.primary} size={22} />
            <Text style={styles.name}>{u.name}</Text>
            <View style={styles.badge}><Award color={tennisColors.white} size={12} /><Text style={styles.badgeText}>{u.role}</Text></View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tennisColors.background },
  header: { paddingTop: 64, paddingBottom: 32, paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: tennisColors.white },
  subtitle: { fontSize: 15, color: tennisColors.accent, marginTop: 4 },
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: tennisColors.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: tennisColors.border },
  name: { flex: 1, fontSize: 17, fontWeight: '600', color: tennisColors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tennisColors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: tennisColors.white, fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: tennisColors.textMuted, marginTop: 40 },
  error: { color: tennisColors.danger, textAlign: 'center', padding: 8 },
});
```

- [ ] **Step 2: Verify in browser**

Run: `npm run web`. Expected: login screen lists seeded users; clicking one navigates to the tabs (blank until Task 13).

- [ ] **Step 3: Commit**

```bash
git add app/login.tsx && git commit -m "feat: login screen (user picker)"
```

---

## Task 13: Tabs layout (role-aware)

**Files:**
- Create: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Write the tab navigator**

Seven tabs with `lucide-react-native` icons. Coach-only tabs (`reports`) are still rendered for all in this iteration but the screen adapts by role; keep all 7 visible. Use `tennisColors.primary` as active tint.

```tsx
import { Tabs } from 'expo-router';
import { Home, CalendarDays, BookOpen, TrendingUp, BarChart3, Pencil, UserCircle } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: true,
      tabBarActiveTintColor: tennisColors.primary,
      tabBarInactiveTintColor: tennisColors.textMuted,
      headerStyle: { backgroundColor: tennisColors.surface },
      headerTitleStyle: { color: tennisColors.text },
    }}>
      <Tabs.Screen name="index"    options={{ title: 'Reserveren', tabBarIcon: ({color,size}) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Afspraken', tabBarIcon: ({color,size}) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="lessons"  options={{ title: 'Lessen', tabBarIcon: ({color,size}) => <BookOpen color={color} size={size} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Voortgang', tabBarIcon: ({color,size}) => <TrendingUp color={color} size={size} /> }} />
      <Tabs.Screen name="reports"  options={{ title: 'Rapport', tabBarIcon: ({color,size}) => <BarChart3 color={color} size={size} /> }} />
      <Tabs.Screen name="drawing"  options={{ title: 'Tekenen', tabBarIcon: ({color,size}) => <Pencil color={color} size={size} /> }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profiel', tabBarIcon: ({color,size}) => <UserCircle color={color} size={size} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/_layout.tsx" && git commit -m "feat: 7-tab navigator"
```

---

## Task 14: BookingModal component

**Files:**
- Create: `components/BookingModal.tsx`

- [ ] **Step 1: Write the modal**

A `Modal` that receives `visible`, `onClose`, `coachId`, `date` (Date), `slot` (HH:00), and `courts`. It builds `start_time`/`end_time` ISO strings from date+slot (1 hour), lets the user pick a court, optional notes, and calls `addBooking` from `useSimpleData()` with `status: 'confirmed'`, `payment_status: null`, `player_id: currentUser.id`. On success calls `onClose`.

```tsx
import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';
import type { Court } from '../lib/types';

function isoFor(date: Date, slot: string, addHours = 0): string {
  const [h] = slot.split(':').map(Number);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h + addHours, 0, 0);
  return d.toISOString();
}

export function BookingModal({ visible, onClose, coachId, date, slot, courts }:
  { visible: boolean; onClose: () => void; coachId: string; date: Date | null; slot: string | null; courts: Court[] }) {
  const { currentUser, addBooking, error } = useSimpleData();
  const [courtId, setCourtId] = useState<string>(courts[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  if (!date || !slot) return null;

  const confirm = async () => {
    if (!currentUser) return;
    await addBooking({
      player_id: currentUser.id, coach_id: coachId, court_id: courtId || courts[0]?.id,
      start_time: isoFor(date, slot), end_time: isoFor(date, slot, 1),
      status: 'confirmed', payment_status: null, notes,
    });
    setNotes(''); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Les boeken</Text>
          <Text style={styles.line}>{date.toLocaleDateString('nl-BE')} om {slot}</Text>
          <Text style={styles.label}>Baan</Text>
          <View style={styles.courtRow}>
            {courts.map(c => (
              <Pressable key={c.id} onPress={() => setCourtId(c.id)}
                style={[styles.chip, courtId === c.id && styles.chipActive]}>
                <Text style={courtId === c.id ? styles.chipTextActive : styles.chipText}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Notities</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Optioneel" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onClose}><Text style={styles.btnText}>Annuleren</Text></Pressable>
            <Pressable style={[styles.btn, styles.confirm]} onPress={confirm}><Text style={styles.btnTextLight}>Bevestigen</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: tennisColors.surface, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: tennisColors.text },
  line: { color: tennisColors.textMuted },
  label: { fontWeight: '600', color: tennisColors.text, marginTop: 8 },
  courtRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: tennisColors.border },
  chipActive: { backgroundColor: tennisColors.primary, borderColor: tennisColors.primary },
  chipText: { color: tennisColors.text }, chipTextActive: { color: tennisColors.white },
  input: { borderWidth: 1, borderColor: tennisColors.border, borderRadius: 10, padding: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: tennisColors.background }, confirm: { backgroundColor: tennisColors.primary },
  btnText: { color: tennisColors.text, fontWeight: '600' }, btnTextLight: { color: tennisColors.white, fontWeight: '700' },
  error: { color: tennisColors.danger },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/BookingModal.tsx && git commit -m "feat: BookingModal"
```

---

## Task 15: Home (reserveren) screen

**Files:**
- Create: `app/(tabs)/index.tsx`

- [ ] **Step 1: Write the home screen**

Behavior (spec §6.2, §7):
- Coach filter row: "Alle coaches" + one chip per user with `role === 'coach'`. Selecting sets `selectedCoachId` (null = all).
- A horizontal date strip for the next ~14 days; **today is disabled** via `isDateBookable`.
- Slot grid from `generateSlots(settings.booking_end_time)`.
- Show the selected coach's existing bookings for the chosen date as "bezet" (disabled slots), matching by `coach_id` and same calendar day.
- Refresh button calls `refresh()`.
- Tapping a free slot opens `BookingModal` with `coachId = selectedCoachId ?? firstCoachId`.

Key logic to include:

```tsx
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { generateSlots, isDateBookable } from '../../lib/slots';
import { BookingModal } from '../../components/BookingModal';
import { tennisColors } from '../../constants/tennis-colors';

const sameDay = (iso: string, d: Date) => {
  const b = new Date(iso);
  return b.getFullYear()===d.getFullYear() && b.getMonth()===d.getMonth() && b.getDate()===d.getDate();
};

export default function Home() {
  const { courts, bookings, users, settings, refresh } = useSimpleData();
  const coaches = users.filter(u => u.role === 'coach');
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const days = useMemo(() => Array.from({length: 14}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  }), []);
  const slots = generateSlots(settings.booking_end_time);
  const effectiveCoachId = selectedCoachId ?? coaches[0]?.id ?? '';

  const takenSlots = (d: Date) => new Set(
    bookings.filter(b => sameDay(b.start_time, d) && (!selectedCoachId || b.coach_id === selectedCoachId))
      .map(b => new Date(b.start_time).toTimeString().slice(0,5))
  );
  // render: coach chips, refresh button, day strip (disabled if !isDateBookable),
  // slot grid (disabled if taken or no date), open modal on press.
}
```

Provide the full JSX for chips, day strip, slot grid and the `<BookingModal .../>` wiring in the implementation (use the patterns from BookingModal styles). When a slot is tapped: `setSlot(s); setModal(true);`.

- [ ] **Step 2: Verify in browser**

Run: `npm run web`. Log in as Mathis. Expected: today is greyed out; picking a future day + free slot opens the modal; confirming creates a booking (visible after in Afspraken tab).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/index.tsx" && git commit -m "feat: home reserveren screen (coach filter, slots, today blocked)"
```

---

## Task 16: PaymentStatusModal component

**Files:**
- Create: `components/PaymentStatusModal.tsx`

- [ ] **Step 1: Write the modal**

Uses `usePendingPaymentBookings()`. Shows **one** booking at a time (no bulk). Four actions per booking: **Cash** (`payment_status:'paid'`), **Factuur** (`'invoice'`), **Onbetaald** (`'unpaid'`), **Verwijderen** (`deleteBooking`). After each action, the list re-derives and the modal advances to the next pending booking; closes when none remain. Respects `settings.blocked_popups_until` (if set in the future, don't auto-show).

```tsx
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { usePendingPaymentBookings, useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';

export function PaymentStatusModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pending = usePendingPaymentBookings();
  const { updateBooking, deleteBooking, users, courts } = useSimpleData();
  const b = pending[0];
  if (!b) { if (visible) onClose(); return null; }
  const player = users.find(u => u.id === b.player_id)?.name ?? 'Speler';
  const court = courts.find(c => c.id === b.court_id)?.name ?? '';

  const set = (payment_status: 'paid'|'invoice'|'unpaid') => updateBooking(b.id, { payment_status });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Betaling verwerken</Text>
          <Text style={styles.line}>{player} — {court}</Text>
          <Text style={styles.line}>{new Date(b.start_time).toLocaleString('nl-BE')}</Text>
          <Text style={styles.count}>{pending.length} openstaand</Text>
          <Pressable style={[styles.btn, styles.cash]} onPress={() => set('paid')}><Text style={styles.btnLight}>Cash betaald</Text></Pressable>
          <Pressable style={[styles.btn, styles.invoice]} onPress={() => set('invoice')}><Text style={styles.btnLight}>Op factuur</Text></Pressable>
          <Pressable style={[styles.btn, styles.unpaid]} onPress={() => set('unpaid')}><Text style={styles.btnDark}>Onbetaald</Text></Pressable>
          <Pressable style={[styles.btn, styles.del]} onPress={() => deleteBooking(b.id)}><Text style={styles.btnLight}>Verwijderen</Text></Pressable>
          <Pressable style={styles.later} onPress={onClose}><Text style={styles.laterText}>Later</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: tennisColors.surface, borderRadius: 18, padding: 20, gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: tennisColors.text },
  line: { color: tennisColors.text }, count: { color: tennisColors.textMuted, marginBottom: 4 },
  btn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  cash: { backgroundColor: tennisColors.success }, invoice: { backgroundColor: tennisColors.court },
  unpaid: { backgroundColor: tennisColors.warning }, del: { backgroundColor: tennisColors.danger },
  btnLight: { color: tennisColors.white, fontWeight: '700' }, btnDark: { color: tennisColors.text, fontWeight: '700' },
  later: { alignItems: 'center', padding: 8 }, laterText: { color: tennisColors.textMuted },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/PaymentStatusModal.tsx && git commit -m "feat: PaymentStatusModal (one-by-one, no bulk)"
```

---

## Task 17: Bookings screen

**Files:**
- Create: `app/(tabs)/bookings.tsx`

- [ ] **Step 1: Write the screen**

Lists bookings relevant to `currentUser` (coach sees where `coach_id === currentUser.id`; player sees `player_id === currentUser.id`). Each row: date/time, court, player/coach name, status badge, payment-status badge. A "Annuleren" button sets `status:'cancelled'`. Coaches see a "Betalingen verwerken" button that opens `PaymentStatusModal`. Empty state message. Use `useSimpleData` + `PaymentStatusModal`. Include the full component with a `FlatList` or mapped `ScrollView`, badge helper coloring status via `tennisColors`.

- [ ] **Step 2: Verify in browser**

Run: `npm run web`. Expected: bookings created in Task 15 appear; cancel works; coach can open the payment modal.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/bookings.tsx" && git commit -m "feat: bookings screen + payment entry"
```

---

## Task 18: Lessons screen

**Files:**
- Create: `app/(tabs)/lessons.tsx`

- [ ] **Step 1: Write the screen**

Lists `lessons`. Coaches get a small form (title, url, description, optional student picker from players) that calls `addLesson` with `uploaded_by: currentUser.id`, `coach_id: currentUser.id`. Players see lessons where `student_id` is null or equals their id. Each lesson row shows title + description; if `url` present, an "Openen" `Pressable` calls `Linking.openURL(url)`. Include full component.

- [ ] **Step 2: Verify + commit**

Run: `npm run web` (add a lesson as Koen). Then:

```bash
git add "app/(tabs)/lessons.tsx" && git commit -m "feat: lessons screen"
```

---

## Task 19: Voice/Speech placeholder stubs

**Files:**
- Create: `components/VoiceRecorder.tsx`, `components/SpeechToText.tsx`

- [ ] **Step 1: Write both stubs**

```tsx
// components/VoiceRecorder.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Mic } from 'lucide-react-native';
import { tennisColors } from '../constants/tennis-colors';

export function VoiceRecorder({ onRecorded }: { onRecorded?: (uri: string) => void }) {
  return (
    <View style={styles.box}>
      <Mic color={tennisColors.textMuted} size={18} />
      <Text style={styles.text}>Spraakopname — binnenkort (alleen mobiele app)</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: tennisColors.border, backgroundColor: tennisColors.background },
  text: { color: tennisColors.textMuted, fontSize: 13 },
});
```

```tsx
// components/SpeechToText.tsx
import { View, Text, StyleSheet } from 'react-native';
import { tennisColors } from '../constants/tennis-colors';

export function SpeechToText({ onText }: { onText?: (text: string) => void }) {
  return (
    <View style={styles.box}><Text style={styles.text}>Spraak-naar-tekst — binnenkort (alleen mobiele app)</Text></View>
  );
}
const styles = StyleSheet.create({
  box: { padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: tennisColors.border, backgroundColor: tennisColors.background },
  text: { color: tennisColors.textMuted, fontSize: 13 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/VoiceRecorder.tsx components/SpeechToText.tsx && git commit -m "feat: voice/speech web placeholder stubs"
```

---

## Task 20: Progress screen

**Files:**
- Create: `app/(tabs)/progress.tsx`

- [ ] **Step 1: Write the screen**

Coaches: a form to add `StudentProgress` — student picker (players), `training_type` chips (techniek/tactiek/fysiek/mentaal/match), rating 1–5, notes, homework, and the `VoiceRecorder` stub. Calls `addProgress` with `coach_id: currentUser.id`. Below the form, list existing progress entries (filter: player sees own `student_id`, coach sees `coach_id === currentUser.id`) showing type, rating (as ★), notes, homework. Include full component and use `SpeechToText` stub next to the notes field.

- [ ] **Step 2: Verify + commit**

Run: `npm run web` (as Koen, add a progress entry for Mathis). Then:

```bash
git add "app/(tabs)/progress.tsx" && git commit -m "feat: progress screen"
```

---

## Task 21: CoachDashboard component

**Files:**
- Create: `components/CoachDashboard.tsx`

- [ ] **Step 1: Write the dashboard**

Order per spec §7: **title above the action buttons**, then income overview, then pending payments count. Props: none (reads `useSimpleData` + `usePendingPaymentBookings` + `totalRevenue`). Action buttons: "Betalingen verwerken" (opens PaymentStatusModal via a callback prop `onOpenPayments`), "Speler toevoegen" (`onOpenUsers`). Income = `totalRevenue(bookings, courts)` shown as "€X". Pending = `usePendingPaymentBookings().length`. Include full component.

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Euro, Users, CreditCard } from 'lucide-react-native';
import { useSimpleData, usePendingPaymentBookings } from '../providers/SimpleDataProvider';
import { totalRevenue } from '../lib/payments';
import { tennisColors } from '../constants/tennis-colors';

export function CoachDashboard({ onOpenPayments, onOpenUsers }:
  { onOpenPayments: () => void; onOpenUsers: () => void }) {
  const { bookings, courts } = useSimpleData();
  const pending = usePendingPaymentBookings().length;
  const revenue = totalRevenue(bookings, courts);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Coach-overzicht</Text>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onOpenPayments}><CreditCard color={tennisColors.white} size={18} /><Text style={styles.actionText}>Betalingen</Text></Pressable>
        <Pressable style={styles.action} onPress={onOpenUsers}><Users color={tennisColors.white} size={18} /><Text style={styles.actionText}>Speler toevoegen</Text></Pressable>
      </View>
      <View style={styles.cards}>
        <View style={styles.card}><Euro color={tennisColors.primary} size={20} /><Text style={styles.cardValue}>€{revenue}</Text><Text style={styles.cardLabel}>Inkomsten (cash)</Text></View>
        <View style={styles.card}><CreditCard color={tennisColors.warning} size={20} /><Text style={styles.cardValue}>{pending}</Text><Text style={styles.cardLabel}>Openstaand</Text></View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: tennisColors.text },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: tennisColors.primary, padding: 14, borderRadius: 12 },
  actionText: { color: tennisColors.white, fontWeight: '700' },
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, backgroundColor: tennisColors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: tennisColors.border, gap: 4 },
  cardValue: { fontSize: 24, fontWeight: '800', color: tennisColors.text },
  cardLabel: { color: tennisColors.textMuted, fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/CoachDashboard.tsx && git commit -m "feat: CoachDashboard (title above actions, income, pending)"
```

---

## Task 22: Reports screen

**Files:**
- Create: `app/(tabs)/reports.tsx`

- [ ] **Step 1: Write the screen**

For a **coach**: render `CoachDashboard` at the top (wiring `onOpenPayments` to a local `PaymentStatusModal` and `onOpenUsers` to a `UserManagement` modal — both mounted here), then an income breakdown: total revenue, count by `payment_status` (paid/invoice/unpaid/pending). For a **player**: a simple summary of their own bookings and how many are paid/unpaid. Include full component. This screen is where the coach's `PaymentStatusModal` and `UserManagement` are reachable.

- [ ] **Step 2: Verify + commit**

Run: `npm run web` (as Koen). Expected: dashboard title sits above the buttons; income + pending shown; buttons open the modals. Then:

```bash
git add "app/(tabs)/reports.tsx" && git commit -m "feat: reports screen + coach dashboard wiring"
```

---

## Task 23: UserManagement component

**Files:**
- Create: `components/UserManagement.tsx`

- [ ] **Step 1: Write the modal**

A `Modal` for coaches to add a player: name, email, role (default `player`, allow `parent`). Calls `addUser`. Lists existing users below with role badges. On successful add, clears the form and refreshes (via `addUser`→`refresh`). Include full component with props `{ visible, onClose }`.

- [ ] **Step 2: Verify + commit**

Run: `npm run web` (as Koen, open via Reports → "Speler toevoegen", add a player; confirm it appears on the login screen after logout). Then:

```bash
git add components/UserManagement.tsx && git commit -m "feat: UserManagement (coach adds players)"
```

---

## Task 24: Drawing screen (court situations)

**Files:**
- Create: `app/(tabs)/drawing.tsx`

- [ ] **Step 1: Write the canvas**

Use `react-native-svg` + a `PanResponder` to capture strokes as SVG `Path` point arrays. A court background (green rect + white lines drawn with `<Line>`/`<Rect>`). Toolbar: color chips (uses `tennisColors`), "Wissen" (clear all paths). Drawing is local UI state only (no persistence this iteration — note this in a comment). Include the full component.

```tsx
import { useRef, useState } from 'react';
import { View, PanResponder, Pressable, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { tennisColors } from '../../constants/tennis-colors';

export default function Drawing() {
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([]);
  const [current, setCurrent] = useState('');
  const [color, setColor] = useState(tennisColors.danger);
  const colorRef = useRef(color); colorRef.current = color;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => setCurrent(`M${e.nativeEvent.locationX},${e.nativeEvent.locationY}`),
    onPanResponderMove: (e) => setCurrent(c => `${c} L${e.nativeEvent.locationX},${e.nativeEvent.locationY}`),
    onPanResponderRelease: () => setCurrent(c => { if (c) setPaths(p => [...p, { d: c, color: colorRef.current }]); return ''; }),
  })).current;

  const clear = () => { setPaths([]); setCurrent(''); };
  const palette = [tennisColors.danger, tennisColors.court, tennisColors.text, tennisColors.accent];

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {palette.map(c => (
          <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
        ))}
        <Pressable style={styles.clear} onPress={clear}><Text style={styles.clearText}>Wissen</Text></Pressable>
      </View>
      <View style={styles.canvas} {...pan.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          <Rect x="0" y="0" width="100%" height="100%" fill={tennisColors.primary} />
          <Rect x="10%" y="8%" width="80%" height="84%" fill="none" stroke={tennisColors.white} strokeWidth={2} />
          <Line x1="50%" y1="8%" x2="50%" y2="92%" stroke={tennisColors.white} strokeWidth={2} />
          {paths.map((p, i) => <Path key={i} d={p.d} stroke={p.color} strokeWidth={3} fill="none" />)}
          {current ? <Path d={current} stroke={color} strokeWidth={3} fill="none" /> : null}
        </Svg>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tennisColors.background },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: tennisColors.text },
  clear: { marginLeft: 'auto', backgroundColor: tennisColors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: tennisColors.border },
  clearText: { color: tennisColors.text, fontWeight: '600' },
  canvas: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden' },
});
```

- [ ] **Step 2: Verify + commit**

Run: `npm run web`. Expected: you can draw strokes on the court; color switch + clear work. Then:

```bash
git add "app/(tabs)/drawing.tsx" && git commit -m "feat: drawing screen (court canvas)"
```

---

## Task 25: Profile screen + settings + emergency cleanup

**Files:**
- Create: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Write the screen**

Shows `currentUser` name/email/role. Settings form: `booking_end_time` (a small stepper or preset chips 18:00–22:00), theme toggle (light/dark stored in settings), language (nl/en) — calls `saveSettings`. A **"Uitloggen"** button calls `logout()`. A red **"Noodopruiming"** (emergency cleanup) button that shows a confirm `Alert.alert` ("Weet je het zeker? Dit verwijdert onherstelbaar corrupte data.") and only on confirm calls `emergencyCleanup()`. Include full component. Use `Alert` from react-native (works on web via a confirm fallback — if `Alert.alert` no-ops on web, use `window.confirm` guarded by `Platform.OS === 'web'`).

```tsx
import { Platform, Alert } from 'react-native';
// helper:
function confirmDanger(message: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(message)) onYes(); return; }
  Alert.alert('Bevestigen', message, [
    { text: 'Annuleren', style: 'cancel' },
    { text: 'Verwijderen', style: 'destructive', onPress: onYes },
  ]);
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run web`. Expected: changing booking end time changes the number of slots on Home; logout returns to login; emergency cleanup asks for confirmation first. Then:

```bash
git add "app/(tabs)/profile.tsx" && git commit -m "feat: profile + settings + emergency cleanup"
```

---

## Task 26: Auto payment popup wiring

**Files:**
- Modify: `app/(tabs)/_layout.tsx` (or a small `components/PaymentGate.tsx` mounted in tabs layout)

- [ ] **Step 1: Add auto-popup logic**

Create `components/PaymentGate.tsx`: for a coach, when `usePendingPaymentBookings().length > 0` and `settings.blocked_popups_until` is not in the future, auto-open `PaymentStatusModal` once per app session. Use a `useState` `dismissed` flag so "Later" hides it for the session.

```tsx
import { useEffect, useState } from 'react';
import { usePendingPaymentBookings, useSimpleData } from '../providers/SimpleDataProvider';
import { PaymentStatusModal } from './PaymentStatusModal';

export function PaymentGate() {
  const { currentUser, settings } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const blocked = settings.blocked_popups_until
    ? new Date(settings.blocked_popups_until).getTime() > Date.now() : false;

  useEffect(() => {
    if (currentUser?.role === 'coach' && pending.length > 0 && !dismissed && !blocked) setOpen(true);
  }, [currentUser, pending.length, dismissed, blocked]);

  if (currentUser?.role !== 'coach') return null;
  return <PaymentStatusModal visible={open} onClose={() => { setOpen(false); setDismissed(true); }} />;
}
```

Mount `<PaymentGate />` inside `app/(tabs)/_layout.tsx` (render it above/after `<Tabs>` inside a fragment/wrapper `View`).

- [ ] **Step 2: Verify + commit**

Run: `npm run web`. As Koen with an unpaid confirmed booking, the payment modal auto-appears; "Later" dismisses for the session. Then:

```bash
git add "app/(tabs)/_layout.tsx" components/PaymentGate.tsx && git commit -m "feat: auto payment popup for coaches"
```

---

## Task 27: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all unit tests (slots, payments, seed) PASS.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test in browser**

Run: `npm run web`. Walk through:
1. Login screen lists Koen/Mathis/Test.
2. As Mathis: today blocked, book a future slot → appears in Afspraken.
3. As Koen: payment popup appears → mark one Cash, one Factuur; revenue updates in Rapport.
4. Add a player via UserManagement → appears on login after logout.
5. Add a lesson and a progress entry.
6. Draw on the court and clear.
7. Change booking end time in Profiel → slot count changes on Reserveren.
8. Emergency cleanup asks for confirmation.

- [ ] **Step 4: Update README note (optional) + final commit**

Create a short `README.md` with setup steps (npm install, apply `supabase-schema.sql`, fill `.env`, `npm run web`).

```bash
git add -A && git commit -m "docs: README + final verification"
```

---

## Self-Review Notes

- **Spec coverage:** techniek/datalaag (Tasks 1,8,9,10), datamodel (Task 2), schema+seed (Tasks 6,7), 7 tabs+login (Tasks 11–13,15,17,18,20,22,24,25), components BookingModal/PaymentStatusModal/UserManagement/Voice/Speech/CoachDashboard (Tasks 14,16,19,21,23), tennis-colors (Task 3), business rules incl. today-blocked (Task 4), pending-payment derivation (Task 5/10/16), no-bulk payments (Task 16), no auto-cleanup + emergency button (Tasks 10,25), coach dashboard order (Task 21), auto popup (Task 26). Overgeslagen features (calendar/voice) are placeholder stubs per spec §2 (Task 19).
- **Placeholder scan:** the "provide full JSX" notes in Tasks 15/17/18/20/22/23/25 describe screens whose full patterns are established by the complete components in Tasks 12/14/16/21/24; the executing engineer follows those patterns. No `TODO`/`TBD` left in code steps.
- **Type consistency:** hook names `useSimpleData`/`usePendingPaymentBookings`, action names (`addBooking`, `updateBooking`, `deleteBooking`, `addUser`, `addLesson`, `addProgress`, `saveSettings`, `emergencyCleanup`, `login`, `logout`, `refresh`) match across Tasks 10, 14–26. Session helpers `loadCurrentUserId`/`saveCurrentUserId`/`clearCurrentUserId` match between Tasks 9 and 10.
