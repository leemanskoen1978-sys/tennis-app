<!-- refreshed: 2026-09-05 -->
# Architecture

**Analysis Date:** 2026-09-05

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      Screens (Expo Router)                          │
│  `app/**/*.tsx`  — file-based routes, one Stack in `app/_layout.tsx`│
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Shared UI        │  Feature widgets  │  Cross-cutting providers     │
│ `components/ui/`  │ `components/*.tsx`│ `providers/kindkeuze.tsx`,   │
│                    │ `components/court`│ `providers/agendaScope.ts`, │
│                    │ `components/lesdag`│ `lib/i18n.ts`               │
└─────────┬──────────┴─────────┬─────────┴──────────────┬─────────────┘
          │                    │                          │
          ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SimpleDataProvider (`providers/SimpleDataProvider.tsx`) │
│  Single React context. Holds one in-memory snapshot (`StoreData`),  │
│  exposes ~50 verb-named actions (addBooking, setAanwezigheid, ...). │
│  Every action: read `storeRef`, compute next snapshot via a `lib/`  │
│  rule function, call `commit()` once.                                │
└───────────────────────────────┬───────────────────────────────────┘
                                  │ delegates pure decisions to
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│         `lib/` — pure rule modules (no React, no store, no I/O)     │
│  `lib/rechten.ts` (permissions), `lib/groups.ts` (group lessons),   │
│  `lib/series.ts` + `lib/recurrence.ts` (recurring series),          │
│  `lib/beurtenkaart.ts` (session cards), `lib/aanwezigheid.ts`,      │
│  `lib/sync.ts` (diff for Supabase), `lib/types.ts` (shared model)   │
│  Each has a matching `*.test.ts` next to it (unit-tested, no mocks) │
└───────────────────────────────┬───────────────────────────────────┘
                                  │ commit() persists via
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│           `providers/backend.ts` — picks one Backend at boot         │
├───────────────────────────────┬───────────────────────────────────┤
│ `providers/mockStore.ts`       │ `providers/supabaseStore.ts`        │
│ AsyncStorage/localStorage,     │ Supabase Postgres, real auth,       │
│ profile-picker login, no RLS   │ RLS-enforced, `lib/sync.ts` diff-   │
│ (demo / offline mode)          │ based writes                        │
└───────────────────────────────┴──────────────┬────────────────────┘
                                                  ▼
                                  ┌───────────────────────────────────┐
                                  │  `supabase-schema.sql`             │
                                  │  Tables + RLS policies + triggers  │
                                  │  (second, independent enforcement) │
                                  └───────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Single `Stack`, auth/redirect guards, per-screen header titles, tab/menu chrome | `app/_layout.tsx` |
| SimpleDataProvider | App-wide state container; owns the `StoreData` snapshot and every mutation | `providers/SimpleDataProvider.tsx` |
| backend | Chooses local-mock vs. Supabase backend based on env config; both implement the same `Backend` interface | `providers/backend.ts` |
| mockStore | Local persistence (AsyncStorage/localStorage), seed data, profile-based login | `providers/mockStore.ts` |
| supabaseStore | Supabase auth + CRUD, row cleanup, diff-based save | `providers/supabaseStore.ts` |
| kindkeuze | "Who am I viewing as" — self or a linked child — layered above every screen | `providers/kindkeuze.tsx` |
| agendaScope | Which coach's agenda is currently shown/filterable | `providers/agendaScope.ts` |
| rechten | Every permission question (`isAdmin`, `magLesVerwijderen`, `magKaartenSchrijven`, ...) | `lib/rechten.ts` |
| groups | Group-lesson semantics: participants, payer, group size | `lib/groups.ts` |
| series / recurrence | Recurring lesson series: membership (`seriesFrom`) and generation (`planSeries`) | `lib/series.ts`, `lib/recurrence.ts` |
| beurtenkaart | Session-card (10-pack) accounting: use, release, plan changes | `lib/beurtenkaart.ts` |
| sync | Snapshot diffing for Supabase writes | `lib/sync.ts` |
| supabase-schema.sql | Table DDL, RLS policies, triggers — second independent enforcement layer | `supabase-schema.sql` |

## Pattern Overview

**Overall:** Single-context, snapshot-based state management (a "Redux-without-Redux" shape) on top of a swappable storage backend, with all business rules extracted into pure, unit-tested `lib/` modules. Not a classic layered MVC/service architecture — there is no separate "service layer" beyond `providers/SimpleDataProvider.tsx` itself, which acts as both the state store and the orchestration layer.

**Key Characteristics:**
- One `StoreData` object (defined in `providers/mockStore.ts`) represents the entire app's data at any moment; every mutation computes a brand-new `StoreData` and calls `commit()` exactly once (atomic snapshot swap, never partial multi-step writes).
- Decisions ("is this allowed", "what does this state transition imply") live in `lib/*.ts` pure functions that take plain data in and return plain data/patches out — they never import React, the provider, or Supabase.
- The provider (`SimpleDataProvider.tsx`) is intentionally "dumb glue": it reads `storeRef.current`, calls one `lib/` function to get a patch, spreads it into a new snapshot, and commits. Business logic bugs are fixed in `lib/`, not in the provider.
- Screens never talk to Supabase or AsyncStorage directly — always through `useSimpleData()`.
- Every client-side rule in `lib/rechten.ts` has a mirrored enforcement in `supabase-schema.sql` (RLS policy or trigger); the client check exists only to avoid offering a control that the database would reject, never as the sole guard.

## Layers

**Screens (`app/`):**
- Purpose: routes and page-level composition (Expo Router file-based routing)
- Location: `app/**/*.tsx`
- Contains: layout/composition code, form wiring, navigation calls
- Depends on: `providers/SimpleDataProvider.tsx` (via `useSimpleData()`), `components/`, `lib/` (formatting/labels only)
- Used by: end users, via Expo Router's file-based route table

**Components (`components/`):**
- Purpose: reusable/feature-specific UI widgets (modals, sheets, cards, charts)
- Location: `components/*.tsx`, `components/ui/`, `components/court/`, `components/progress/`, `components/lesdag/`
- Contains: presentational + light-interactive React Native components
- Depends on: `providers/SimpleDataProvider.tsx`, `lib/` for formatting/rules, `constants/`
- Used by: `app/` screens

**Providers (`providers/`):**
- Purpose: state container, auth, backend selection, cross-cutting "who am I" context
- Location: `providers/*.ts(x)`
- Contains: React context/providers holding mutable app state and orchestrating persistence
- Depends on: `lib/` (all business rules), `@supabase/supabase-js`, AsyncStorage
- Used by: every screen and most components (via `useSimpleData()`, `useKindkeuze()`, `useAgendaScope()`)

**Rule modules (`lib/`):**
- Purpose: pure, testable business logic and shared types — the actual "domain layer"
- Location: `lib/*.ts` (paired with `lib/*.test.ts`)
- Contains: permission checks, pricing/session-card math, recurrence math, i18n, formatting, CSV/XLSX import/export, sync diffing
- Depends on: nothing outside `lib/` (no React, no store, no network) — see Architectural Constraints
- Used by: `providers/SimpleDataProvider.tsx` (primary consumer), screens/components (formatting/labels), `lib/*.test.ts` (unit tests)

**Database (`supabase-schema.sql`):**
- Purpose: durable storage + second, independent authorization layer (RLS + triggers)
- Location: `supabase-schema.sql` (applied manually/via Supabase SQL editor — no migration framework in repo)
- Contains: table DDL, RLS policies per table/operation, triggers (e.g. `bewaak_betaalvelden`, `bewaak_is_admin`, `geef_beurt_terug`)
- Depends on: nothing in the app
- Used by: `providers/supabaseStore.ts` exclusively (mock backend never touches it)

## Data Flow

### Primary Request Path (booking a lesson)

1. Screen calls `addBooking(...)` or `addBookingSeries(...)` from `useSimpleData()` (`app/agenda/new.tsx` → `providers/SimpleDataProvider.tsx:558`)
2. Provider reads `storeRef.current`, checks for coach double-booking via local `overlaps()` (`providers/SimpleDataProvider.tsx:205`)
3. For a series, `planSeries()` in `lib/recurrence.ts` computes usable/skipped slots against existing bookings and club holidays
4. Group-lesson payment method is forced via `isGroupLesson()` (`lib/groups.ts`) before the booking is created
5. `commit(next)` persists the new snapshot: `backend.save(previous, next)` then `setStore(next)` (`providers/SimpleDataProvider.tsx:283`)
6. Local backend (`providers/mockStore.ts`) writes the whole blob to AsyncStorage; Supabase backend (`providers/supabaseStore.ts`) calls `diffStores()` (`lib/sync.ts`) to compute per-table upserts/deletes and sends them to Postgres, which re-validates every write against RLS policies in `supabase-schema.sql`
7. On success, all screens subscribed via `useSimpleData()` re-render with the new snapshot; on failure, `storeRef.current` is rolled back and the error surfaces via `error`/`clearError`

### Authentication / Session Flow

1. `providers/backend.ts` picks `supabaseBackend` or `localBackend` at import time, based on `supabaseConfigured` (`lib/supabase.ts`, env-driven)
2. `SimpleDataProvider` calls `backend.currentUserId()` (Supabase) or `loadCurrentUserId()` (`providers/session.ts`, local) on mount
3. `backend.onAuthChange()` (Supabase only) fires `'herstel'` (password-recovery link opened) or `'weg'` (signed out) events that the provider reacts to directly
4. `app/_layout.tsx` reads `loading`, `currentUser`, `herstelBezig` from `useSimpleData()` and redirects to `/login` or `/nieuw-wachtwoord` accordingly — the guard lives in the root layout, not in a route group, so every screen stays individually linkable

### Viewer-scoping Flow ("who am I looking at")

1. `providers/kindkeuze.tsx` wraps `Root` inside `SimpleDataProvider`, letting a parent pick themselves or one of their approved children (`lib/ouderkind.ts`) as the active viewer
2. Screens read the active person from `useKindkeuze()` and pass that id into `lib/` queries (e.g. `playsIn`, `pendingPaymentsFor`) instead of always using `currentUser.id`
3. `providers/agendaScope.ts` layers a second, independent scoping concept for coaches: which coach's agenda is currently displayed/filterable

**State Management:**
- All server-shaped data lives in one `StoreData` object inside `SimpleDataProvider`; there is no separate cache layer, no React Query/SWR, no Redux store. Re-renders are driven by `setStore()` calls and a single `useMemo`-built context value.
- Ephemeral UI-only state (form fields, sheet open/closed) stays local to each screen/component with `useState`.

## Key Abstractions

**Booking (`lib/types.ts`):**
- Purpose: the single row representing one lesson slot — private or group, one-off or part of a series
- Group lessons: `player_id` is always the payer; extra participants live in `participant_ids` (never including the payer — see `lib/groups.ts:participantIdsOf`). `groupSize()` = 1 + participants. `payment_split` ('together'/'separate') only matters when `groupSize() > 1`.
- Recurring series: a shared `series_id` string links otherwise-independent `Booking` rows; there is no separate "series" table/entity. `lib/series.ts:seriesFrom()` finds "this booking and every later one in the same series" purely by filtering + sorting on `start_time`. `lib/recurrence.ts:planSeries()` generates the slots for a new series, skipping collisions and holidays.
- Examples: `lib/types.ts:145-220`, `lib/groups.ts`, `lib/series.ts`, `lib/recurrence.ts`
- Pattern: flat, self-describing rows; no normalized "series" or "group" join tables — every group/series concept is computed on demand from `bookings`

**Rule module (`lib/*.ts` + `lib/*.test.ts` pairs):**
- Purpose: isolate a single business concern as pure functions operating on plain data (never `StoreData`, never React)
- Examples: `lib/beurtenkaart.ts` (session-card math: `useSession`, `releaseSession`, `planMethodChange`, `planCancel`, `planParticipantsChange`, `planSplitChange`, `planCardDeletion`), `lib/aanwezigheid.ts` (attendance), `lib/rechten.ts` (permissions)
- Pattern: `plan*()` functions return `{ patch, cards, error? }`-shaped results describing *what should change*, which `SimpleDataProvider` then applies via a single `commit()` — the module never mutates or persists anything itself

**Dual-guard permissions:**
- Purpose: every access rule is expressed twice, independently: once in `lib/rechten.ts` (so the UI doesn't offer a control that would be rejected) and once in `supabase-schema.sql` as an RLS policy or trigger (the actual enforcement)
- Examples: `magLesVerwijderen` (`lib/rechten.ts:68`) mirrors `bookings_delete` policy (`supabase-schema.sql:795`); `magKaartenSchrijven` mirrors `kaarten_write`; `magLoonZien` mirrors `rates_select`
- Pattern: comments in both files explicitly cross-reference each other by name — when changing a permission rule, both sides must be updated

**Backend abstraction:**
- Purpose: let screens and the provider be agnostic to "local demo storage" vs. "real multi-device Supabase backend"
- Examples: `providers/backend.ts` (interface + selection), `providers/mockStore.ts`, `providers/supabaseStore.ts`
- Pattern: both implementations satisfy the same `Backend` interface (`load`, `save`, `reset`, `currentUserId`, `signIn`, `signUp`, `signOut`, `onAuthChange`, `stuurHerstelmail`, `zetNieuwWachtwoord`); selection happens once at module load via `supabaseConfigured` (env-driven), not per-call

## Entry Points

**App root:**
- Location: `app/_layout.tsx`
- Triggers: Expo Router boot
- Responsibilities: wraps the tree in `SimpleDataProvider` → `LanguageFromSettings` → `KindkeuzeProvider` → `Root`; `Root` owns the single `Stack`, auth redirects, and per-screen header/tab-bar visibility rules

**File-based routes:**
- Location: `app/**/*.tsx` (e.g. `app/agenda/new.tsx`, `app/players/[id].tsx`, `app/admin/leden.tsx`)
- Triggers: navigation (tab bar, deep link, programmatic `router.push`)
- Responsibilities: page composition; each screen pulls exactly the slice of `useSimpleData()` it needs

**Provider mount:**
- Location: `providers/SimpleDataProvider.tsx:263` (`SimpleDataProvider`)
- Triggers: once, at `app/_layout.tsx` root
- Responsibilities: loads the initial snapshot (`loadFor`), sets up `AppState`/`focus` listeners for silent refresh, exposes the entire action API

## Architectural Constraints

- **Threading:** Single JS thread (standard React Native/Expo); no workers. Async work is Promise-based (`backend.save`, Supabase calls).
- **Global state:** One React context (`SimpleDataProvider`'s `Ctx`) is the only app-wide store. `providers/backend.ts` exports a module-level singleton `backend` chosen once at import time — this cannot be changed at runtime without reloading the app. `lib/i18n.ts` keeps a module-level `current: Language` variable so non-React `lib/` code can read the active language without prop drilling.
- **No circular imports observed:** `lib/` modules import only from other `lib/` modules and never from `providers/` or `app/`; `providers/` imports from `lib/`; `app/`/`components/` import from both. This one-directional dependency rule is intentional and load-bearing for `lib/`'s unit-testability — do not add `lib/` → `providers/` imports.
- **No migration framework:** `supabase-schema.sql` is one large, idempotent (`create table if not exists`, `drop policy if exists`) script applied manually; there is no versioned migrations directory.
- **Snapshot-atomicity constraint:** every provider action must call `commit()` exactly once with a fully-computed next state; splitting a logical operation (e.g. "release a session card" + "mark booking cancelled") into two `commit()` calls would allow the app to observe (or persist) a half-finished state.

## Anti-Patterns

### Duplicating a group/series/permission computation inline on a screen

**What happens:** A screen counts `booking.participant_ids?.length` directly, or re-derives "is this a group lesson" without calling `lib/groups.ts`.
**Why it's wrong:** The codebase's own comments call this out explicitly (`lib/groups.ts:4-6`): one screen counts a duplicate id, another doesn't, and the price shown on the booking card silently diverges from the price in the report.
**Do this instead:** Always go through `lib/groups.ts` (`participantIdsOf`, `groupSize`, `isGroupLesson`, `playsIn`, `lessonPlayerIds`) and `lib/series.ts` (`seriesFrom`) rather than reading `participant_ids`/`series_id` directly.

### Adding a permission check only in the UI

**What happens:** A new "may this user do X" rule gets written only as a client-side `if` in a screen or only added to `lib/rechten.ts`, without a matching RLS policy/trigger in `supabase-schema.sql`.
**Why it's wrong:** `lib/rechten.ts` states plainly it is not the enforcer ("De app is niet de bewaker"). A client-only check can be bypassed by any direct API call; on the mock/local backend there is no RLS at all, so skipping the server-side half also breaks parity between demo and production behavior.
**Do this instead:** Add or update the rule in `lib/rechten.ts` (so the UI stays honest) AND add/update the matching policy or trigger in `supabase-schema.sql`, cross-referencing each other by name in comments, following the existing pattern.

## Error Handling

**Strategy:** One global `error: string | null` on the `SimpleDataProvider` context, set by whichever action fails; screens read it, show it, and call `clearError()`. `useSchoneLei()` (`providers/SimpleDataProvider.tsx:1198`) is a small hook screens call on mount to clear a stale error left by a previous screen.

**Patterns:**
- User-facing errors are Dutch, human-readable strings computed close to the failure (e.g. `refusedSeriesNotice`, `'Dit tijdslot is al geboekt bij deze coach.'`), not error codes.
- `commit()` rolls back `storeRef.current` to the previous snapshot on a failed `backend.save()` and rethrows, so the specific action's `catch` (if any) and the global `error` both reflect the failure consistently.
- Background/non-user-initiated work (`stilVerversen`, catalogue installation on load) fails silently (`console.warn`) rather than surfacing an error the user didn't ask to see.

## Cross-Cutting Concerns

**Logging:** `console.warn` for recoverable/background failures only (e.g. failed silent refresh, failed catalogue install, failed sign-out during logout). No structured logging framework or remote error tracking in the repo.

**Validation:** Enforced twice — informally in `lib/` rule functions before a `commit()` (e.g. `overlaps()` double-booking check, `planSeries()` collision/holiday check), and formally in `supabase-schema.sql` via `check` constraints, RLS policies, and triggers (e.g. `bewaak_betaalvelden`, `bewaak_gebruikersvelden`, `bewaak_is_admin`).

**Authentication:** Two modes behind one `Backend` interface — `'profiel'` (pick-a-name, no password, local storage only) and `'wachtwoord'` (real email/password via Supabase Auth). `app/login.tsx` and `app/nieuw-wachtwoord.tsx` are the only screens that special-case `authMode`.

---

*Architecture analysis: 2026-09-05*
