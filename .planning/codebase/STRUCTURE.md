# Codebase Structure

**Analysis Date:** 2026-09-05

## Directory Layout

```
tennis app/
├── app/                    # Expo Router file-based routes (screens only)
│   ├── _layout.tsx         # Root Stack, auth guard, tab/menu chrome
│   ├── index.tsx           # Hub / landing screen
│   ├── login.tsx           # Sign-in (password mode) / profile picker (local mode)
│   ├── nieuw-wachtwoord.tsx# Password-recovery flow target
│   ├── kinderen.tsx        # "My children" (ouder-kind) screen
│   ├── memos.tsx           # Voice memo inbox
│   ├── profile.tsx         # Own profile
│   ├── agenda/             # Booking calendar: index, new, week, historiek, komend, overzicht, afvinken
│   ├── players/            # Player list, [id] dossier, progress
│   ├── coaches/             # Coach list, [id] dossier, lesson material, drawing board, keymoments
│   └── admin/               # Club management: leden, ouders, payments, courts, boekingstijden, settings, reports, vakanties, handleiding
├── components/             # Reusable and feature-specific React components
│   ├── ui/                 # Generic building blocks (Button, Card, Chip, MenuBar, TabBar, Screen, ...)
│   ├── court/               # Tennis-court visualisation widgets
│   ├── progress/             # Player progress form + views
│   ├── lesdag/               # "Lesson day" widgets (Lesdag, MemoKnop)
│   └── *.tsx                 # Modals/sheets used by one or a few screens (BookingModal, AssignLessonModal, ...)
├── providers/               # React context + backend/state layer (see ARCHITECTURE.md)
│   ├── SimpleDataProvider.tsx  # Single app-wide context: StoreData + all mutations
│   ├── backend.ts              # Picks mockStore vs supabaseStore
│   ├── mockStore.ts             # Local (AsyncStorage) backend + seed data loader
│   ├── supabaseStore.ts         # Supabase backend: auth, load/save, row cleanup
│   ├── kindkeuze.tsx            # "Viewing as self or child" context
│   ├── agendaScope.ts            # "Which coach's agenda is shown" scoping
│   ├── session.ts                 # Local-mode current-user-id persistence
│   └── weggeklikt.ts               # Dismissed-notice persistence
├── lib/                     # Pure business-rule modules, one concern per file, unit-tested
│   ├── *.ts                 # ~50 rule/util modules (rechten, groups, series, recurrence,
│   │                         #   beurtenkaart, aanwezigheid, sync, types, i18n, csv, xlsx, ...)
│   └── *.test.ts             # One test file per rule module (44 test files), jest-expo
├── constants/                # Design tokens and static config
│   ├── app-config.ts
│   ├── tennis-colors.ts
│   └── theme.ts
├── assets/                    # Images (coach-mark, keymoments/*)
├── docs/                       # Project docs (lesson-attachments.md, voice-memo-native.md, docs/superpowers/)
├── scripts/                    # One-off Node/Python scripts (extract-u9-trainings.py, gids-html.js)
├── supabase-schema.sql          # Full DDL + RLS policies + triggers (applied manually to Supabase)
├── app.json, babel.config.js, tsconfig.json  # Expo/TS/Babel config
├── global.d.ts                   # Ambient type declarations
├── .env / .env.example             # Supabase URL/anon key (never read/committed with real values)
└── .planning/codebase/               # Codebase map output (this file and siblings)
```

## Directory Purposes

**`app/`:**
- Purpose: every navigable screen; Expo Router turns the file tree into routes automatically
- Contains: `.tsx` screen components, one per route; `[id].tsx` / `[slag].tsx` for dynamic segments
- Key files: `app/_layout.tsx` (root layout — the only place route guards and header titles are declared)

**`components/`:**
- Purpose: everything a screen composes but that isn't itself a route
- Contains: generic UI primitives (`components/ui/`), domain-specific widgets grouped by feature (`components/court/`, `components/progress/`, `components/lesdag/`), and standalone modals/sheets used by one or two screens directly under `components/`
- Key files: `components/BookingModal.tsx`, `components/AssignLessonModal.tsx`, `components/LidBewerken.tsx` (the shared member-edit form), `components/ui/MenuBar.tsx`, `components/ui/TabBar.tsx`

**`providers/`:**
- Purpose: all mutable app state, backend selection, and cross-cutting "who/what is active" context — the only layer allowed to talk to `AsyncStorage` or `@supabase/supabase-js` directly (aside from `lib/supabase.ts`, which just builds the client)
- Contains: React Context providers and the local/Supabase backend implementations
- Key files: `providers/SimpleDataProvider.tsx`, `providers/backend.ts`, `providers/mockStore.ts`, `providers/supabaseStore.ts`

**`lib/`:**
- Purpose: pure, framework-free business logic and shared types — no React, no store references, no direct I/O. This is the layer to change first for any rule/behavior fix, and the layer with test coverage.
- Contains: one module per concern, each with a co-located `*.test.ts`
- Key files: `lib/types.ts` (all shared interfaces), `lib/rechten.ts` (permissions), `lib/groups.ts` (group lessons), `lib/series.ts` + `lib/recurrence.ts` (recurring series), `lib/beurtenkaart.ts` (session cards), `lib/sync.ts` (Supabase diffing), `lib/i18n.ts` + `lib/i18n-en.ts` (translation)

**`constants/`:**
- Purpose: design tokens and static, non-secret configuration
- Contains: color palette, theme, app-wide constants
- Key files: `constants/tennis-colors.ts`, `constants/theme.ts`, `constants/app-config.ts`

**`supabase-schema.sql`:**
- Purpose: the production database schema, RLS policies, and triggers — the authoritative enforcement layer that mirrors `lib/rechten.ts`
- Not applied via a migrations tool; it is idempotent (`if not exists`, `drop policy if exists ... create policy ...`) and re-run manually against the Supabase SQL editor when it changes

## Key File Locations

**Entry Points:**
- `app/_layout.tsx`: root layout, auth redirect guard, Stack/tab/menu composition
- `app/index.tsx`: post-login landing/hub screen

**Configuration:**
- `app.json`: Expo app config
- `tsconfig.json`: TypeScript config
- `babel.config.js`: Babel/Expo preset config
- `.env` / `.env.example`: Supabase URL + anon key (existence noted only; never read contents)
- `lib/supabase.ts` / `lib/supabase-config.ts`: builds the Supabase client, reads env, exposes `supabaseConfigured`

**Core Logic:**
- `providers/SimpleDataProvider.tsx`: the entire app-state API
- `lib/`: all business rules (see above)
- `supabase-schema.sql`: schema + authorization

**Testing:**
- `lib/*.test.ts`: 44 unit-test files, one per rule module, run via `jest` (`jest-expo` preset, configured in `package.json`)

## Naming Conventions

**Files:**
- Screens: lowercase, route-matching names (`agenda/new.tsx`, `players/[id].tsx`); dynamic segments use `[param].tsx`
- `lib/` modules: short, single-concern nouns/verbs in Dutch or English matching the domain term (`beurtenkaart.ts` = session card, `aanwezigheid.ts` = attendance, `rechten.ts` = permissions) — pick the term the rest of the codebase already uses for that concept, don't translate ad hoc
- Test files: `<module>.test.ts`, always co-located next to the module in `lib/`
- Components: PascalCase (`BookingModal.tsx`, `LidBewerken.tsx`)

**Directories:**
- Feature-grouped subfolders under `components/` and `app/` use lowercase (`court/`, `progress/`, `lesdag/`, `agenda/`, `players/`, `coaches/`, `admin/`)

## Where to Add New Code

**New business rule / domain logic:**
- Implementation: new module in `lib/` (pure function(s), no React/store imports)
- Tests: co-located `lib/<name>.test.ts` covering the pure function directly (no mocking needed — this is the point of the layer)
- If the rule gates an action, also add the corresponding action/wiring in `providers/SimpleDataProvider.tsx`, and if it affects Supabase-backed data, add/update the matching RLS policy or trigger in `supabase-schema.sql`

**New screen:**
- Add a `.tsx` file under the relevant `app/` subfolder (`agenda/`, `players/`, `coaches/`, `admin/`, or top-level for hub-level screens)
- Register its title (and whether it should show the header/tab bar) in `app/_layout.tsx`'s `screens()` array and `HEADLESS` set
- Pull data via `useSimpleData()`; do not call `providers/mockStore.ts` or `providers/supabaseStore.ts` directly

**New reusable UI element:**
- Generic/cross-feature: `components/ui/`
- Belongs to one feature area: the matching subfolder (`components/court/`, `components/progress/`, `components/lesdag/`) or, if it's a one-off modal/sheet used by one or two screens, directly under `components/`

**New provider-level state or cross-cutting scoping:**
- If it affects the whole data model (a new collection, a new mutation): extend `StoreData` in `providers/mockStore.ts`, add the field/action to `providers/SimpleDataProvider.tsx`, add the table + RLS to `supabase-schema.sql`, and add sync mapping in `lib/sync.ts`
- If it's UI-session scoping only (like "who am I viewing as"): a new small context under `providers/`, following the shape of `providers/kindkeuze.tsx` or `providers/agendaScope.ts`

**Utilities:**
- Shared, pure helpers: `lib/` (formatting, date/time math — see `lib/datetime.ts`, `lib/week.ts`, `lib/period.ts`)
- Not React-specific: keep out of `components/`/`app/`

## Special Directories

**`.expo/`:**
- Purpose: Expo tooling cache/device registry
- Generated: Yes
- Committed: No (local tool state)

**`.planning/`:**
- Purpose: GSD planning artifacts, including this codebase map
- Generated: Yes (by `/gsd:*` commands)
- Committed: Project-dependent — treat as documentation, not app code

**`docs/`:**
- Purpose: feature-specific written documentation (`lesson-attachments.md`, `voice-memo-native.md`) and `docs/superpowers/`
- Generated: No
- Committed: Yes

**`scripts/`:**
- Purpose: one-off data-prep scripts (`extract-u9-trainings.py` for lesson catalogue extraction, `gids-html.js` for the trainer's guide)
- Generated: No
- Committed: Yes; not part of the app bundle

---

*Structure analysis: 2026-09-05*
