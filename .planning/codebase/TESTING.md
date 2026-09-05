# Testing Patterns

**Analysis Date:** 2026-09-05

## Test Framework

**Runner:**
- Jest `^29.7.0` with the `jest-expo` (`~53.0.0`) preset, configured inline in `package.json`
  (no separate `jest.config.js`):
  ```json
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|expo-modules-core|@supabase/.*|lucide-react-native|react-native-svg))"
    ]
  }
  ```
- `@types/jest ^30.0.0` for typings.

**Assertion Library:**
- Built-in Jest `expect` only. No `@testing-library/*`, no snapshot testing, no custom matchers.

**Run Commands:**
```bash
npm test                # runs `jest` — all suites, currently 44 suites / 985 tests, ~1.4s
npx jest lib/money.test.ts   # run a single suite
```
There is no separate watch-mode or coverage script defined in `package.json`; use `npx jest
--watch` / `npx jest --coverage` directly if needed.

## Test File Organization

**Location:**
- **Co-located, 1:1 pairing.** Every `lib/<naam>.ts` rule module has a sibling
  `lib/<naam>.test.ts` in the same directory. As of this analysis there are 54 non-test files
  in `lib/` and 44 test files — the untested ones are either pure type/constant modules
  (`types.ts`, `keymoments.ts`, `trainings-u9.ts`, `status.ts`, `share.ts` partially, `bestand.ts`)
  or thin platform-integration wrappers.
- **No tests outside `lib/`.** Zero test files exist for `components/`, `providers/`, or
  `app/`. This is a known, explicit gap — see `OPENSTAAND.md` item 9: "Tests op de schermen —
  alle 676 tests zitten in lib/, geen enkele op een scherm. Twee echte fouten van vandaag
  zaten daar" (an `onEndEditing` handler that never fires on `react-native-web`, and an
  unimported stylesheet — both bugs that unit tests in `lib/` could not have caught).
  **Convention for new code:** if a piece of logic can be tested, move it into a `lib/*.ts`
  module and test it there rather than trying to test a screen directly.

**Naming:**
- `<module>.test.ts`, exact same base name as the module under test.

**Structure:**
```
lib/
  afvinken.ts
  afvinken.test.ts
  beurtenkaart.ts
  beurtenkaart.test.ts
  money.ts
  money.test.ts
  ...
```

## Test Structure

**Suite organization** — `describe` blocks per exported function, `it` blocks written as full
English sentences describing behavior (not "should X", just a direct present-tense
description). Example from `lib/afvinken.test.ts`:

```typescript
import { lessenNu, VOOR_MS, NA_MS } from './afvinken';
import type { Booking } from './types';

const les = (id: string, startISO: string, patch: Partial<Booking> = {}): Booking => ({
  id,
  player_id: 'p1',
  coach_id: 'koen',
  court_id: 'court-1',
  start_time: startISO,
  end_time: new Date(new Date(startISO).getTime() + 3_600_000).toISOString(),
  status: 'confirmed',
  payment_method: 'open',
  ...patch,
});

const start = '2026-09-02T14:00:00.000Z';
const op = (offsetMs: number): Date => new Date(new Date(start).getTime() + offsetMs);

describe('lessenNu', () => {
  it('finds the lesson that is running right now', () => {
    expect(lessenNu([les('b1', start)], 'koen', op(20 * 60_000)).map((b) => b.id)).toEqual(['b1']);
  });

  it('already shows it shortly before the hour, but not long before', () => {
    expect(lessenNu([les('b1', start)], 'koen', op(-VOOR_MS)).map((b) => b.id)).toEqual(['b1']);
    expect(lessenNu([les('b1', start)], 'koen', op(-VOOR_MS - 60_000))).toEqual([]);
  });
  // ...
});
```

**Patterns:**
- **No `beforeEach`/`afterEach` setup/teardown observed** in the sampled suites — each `it`
  builds its own minimal fixtures inline via small local factory functions.
- Test *names* (in English, though the codebase's identifiers/comments are Dutch) describe the
  business rule being verified, e.g. "leaves out the lessons of another coach", "leaves out a
  cancelled lesson", "puts two lessons at the same time in order of start" — read together,
  a file's `it` blocks form a spec of the business rule, not just an execution trace.
- Boundary conditions are always tested in pairs: the value that should still pass and the
  value one increment past it that should not (`op(-VOOR_MS)` passes, `op(-VOOR_MS - 60_000)`
  does not).

## Mocking

**Framework:** None. Zero usages of `jest.mock`, `jest.fn`, `jest.spyOn` found anywhere in
`lib/*.test.ts` (grep confirms 0 files use `jest.mock`).

**Pattern used instead of mocking:** External dependencies (Supabase, AsyncStorage, env vars)
are wrapped by a small **pure function that takes its inputs as parameters**, and that pure
function — not the wrapper around the real client — is what gets tested. Example,
`lib/supabase-config.ts` / `lib/supabase-config.test.ts`:

```typescript
import { resolveSupabaseConfig, sessieSleutel } from './supabase-config';

it(/* ... */, () => {
  const config = resolveSupabaseConfig('https://abc.supabase.co', 'eyJhbGciOi');
  expect(config).toEqual({ url: 'https://abc.supabase.co', /* ... */ });
});

it('reports unconfigured for an empty key', () => {
  expect(resolveSupabaseConfig('https://abc.supabase.co', '').configured).toBe(false);
});
```

`lib/supabase.ts` itself (which actually calls `createClient(...)`) has no test — it is a thin
wire-up file. The configuration/URL-parsing *logic* that could go wrong is extracted into
`resolveSupabaseConfig`/`sessieSleutel` in a separate, pure, tested module.

**What to mock:** Nothing — the house style avoids mocking entirely by design.

**What NOT to mock:** Do not introduce `jest.mock` for Supabase, AsyncStorage, or React Native
APIs. Instead, extract the decision-making logic (parsing, validation, plan computation) into
a pure function in `lib/`, pass in the raw values it needs as arguments, and test that
function directly. Side-effecting wrappers (`providers/SimpleDataProvider.tsx`,
`providers/supabaseStore.ts`, `lib/supabase.ts`) remain untested by design and are kept as
thin as possible for exactly that reason.

## Fixtures and Factories

**Test data:** Small inline factory functions defined at the top of each test file, not a
shared fixtures directory. Pattern: a function named after the domain object (`les` for a
`Booking`) that takes required fields as positional args and a `Partial<T>` `patch` for
overrides:

```typescript
const les = (id: string, startISO: string, patch: Partial<Booking> = {}): Booking => ({
  id,
  player_id: 'p1',
  coach_id: 'koen',
  court_id: 'court-1',
  start_time: startISO,
  end_time: new Date(new Date(startISO).getTime() + 3_600_000).toISOString(),
  status: 'confirmed',
  payment_method: 'open',
  ...patch,
});
```

**Location:** Defined locally per test file — no shared `test/fixtures/` or `__mocks__/`
directory exists. If a fixture becomes genuinely shared across many `*.test.ts` files, extract
it into the corresponding `lib/*.ts` module (not a new test-only utility file) so it stays
next to the type it constructs.

## Coverage

**Requirements:** No coverage threshold configured (no `coverageThreshold` in `package.json`
jest config). No CI coverage gate found in `.github/`.

**View coverage:**
```bash
npx jest --coverage
```

**De facto coverage shape:** ~100% of `lib/` business-rule modules; 0% of `components/`,
`providers/`, and `app/`. This is a deliberate trade-off (business logic is where correctness
matters most and where it's cheap to test in isolation), not an oversight — but it is also an
acknowledged risk (see `OPENSTAAND.md` item 9 on the two bugs that slipped through because
they lived in screen code).

## Test Types

**Unit tests:** The only test type present. Each targets one exported function or a small
group of closely related exported functions from a single `lib/*.ts` module, with the full
range of realistic and edge-case inputs constructed by hand.

**Integration tests:** None. No test spins up multiple `lib/` modules together, a database, or
a running app instance.

**E2E Tests:** Not used. Manual QA against the real Supabase-backed dev server substitutes for
end-to-end coverage today (see `OPENSTAAND.md`'s "met de hand doorlopen" notes — features are
walked through by hand in the browser before being marked done).

## Common Patterns

**Time-based testing:**
```typescript
const start = '2026-09-02T14:00:00.000Z';
const op = (offsetMs: number): Date => new Date(new Date(start).getTime() + offsetMs);
// then: lessenNu(bookings, coachId, op(20 * 60_000))
```
`now` is always passed in as an explicit parameter to the function under test (never read via
`new Date()` inside the function under test) — this is what makes deterministic time-window
tests possible without faking timers.

**Numeric/money precision testing:**
```typescript
expect(parseEuro('45,50')).toBe(45.5);
expect(parseEuro('-10')).toBeUndefined();   // negative amounts are treated as invalid input
```

**Reading test intent as spec:** Because there is no separate design doc for most business
rules, the `it()` descriptions plus the rule module's doc comments together ARE the
specification. When modifying a `lib/*.ts` file, read its paired `*.test.ts` file first — the
test names enumerate every behavior that must keep working.

## Verification Commands (required at every delivery, not just tests)

From `OPENSTAAND.md` and `README.md`, the full delivery check is three commands, run in order:
```bash
npx tsc --noEmit                                                       # typecheck
npm test                                                               # jest, all lib/ suites
npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check   # web build sanity
```
All three currently pass cleanly (verified 2026-09-05: `tsc --noEmit` exits 0; `npm test`
reports 44 suites / 985 tests passed). Treat a failure in any of the three as blocking —
`npm test` alone is not considered sufficient sign-off.

---

*Testing analysis: 2026-09-05*
