# Coding Conventions

**Analysis Date:** 2026-09-05

## Language of the Codebase (read this first)

This is a Dutch-language product. The conventions here are unusually strict and consistent —
future code MUST match them, not just "be clean":

- **Identifiers are Dutch** for anything domain-specific: functions, variables, types tied to
  the business (`lessenNu`, `zetAanwezigheid`, `planMethodChange`, `aanvraagVoor`,
  `kinderenVan`, `magInElkeAgenda`, `zonderLid`, `sessieSleutel`, `wisBewaardeSessie`).
  Generic/technical vocabulary stays English (`Booking`, `User`, `StoreData`, `useCallback`).
- **Comments are Dutch prose that explain WHY**, frequently citing the exact bug or user
  complaint the code prevents, not what the code does. Example, `lib/afvinken.ts`:

  ```ts
  /**
   * En hoe lang erna. Een les die net gedaan is blijft nog een halfuur staan: vergat de
   * trainer af te vinken, dan vindt hij ze terug zonder ergens een datum te moeten kiezen.
   * Langer niet — dan zou de les van deze ochtend nog boven de les van straks staan.
   */
  export const NA_MS = 30 * 60_000;
  ```

  Every file in `lib/` opens with a multi-line comment block explaining the *purpose and
  reasoning* of the module, not a one-line label. Do not write comments that restate the code
  (`// loop over bookings`) — write comments that justify a boundary, a magic number, or an
  ordering decision.
- **User-visible strings are Dutch literals**, translated via `t()` from `lib/i18n.ts` — see
  the Internationalization section below. Never hardcode English UI text; never invent a
  translation key string separate from the Dutch sentence.
- **English is used for**: this document, code review discussion, generic type/utility names,
  and library/package identifiers.

## Naming Patterns

**Files (`lib/`):**
- One noun or short Dutch/English word per rule module, lowercase, no separators:
  `afvinken.ts`, `beurtenkaart.ts`, `boekingstijd.ts`, `ouderkind.ts`, `rechten.ts`,
  `weggeklikt.ts`, `verversen.ts`. Each such module MUST have a matching `*.test.ts` file
  beside it (see Testing section / TESTING.md).
- Cross-cutting/infrastructure modules use English: `supabase.ts`, `supabase-config.ts`,
  `types.ts`, `theme-mode.ts`, `status.ts`.

**Files (`components/`, `app/`):**
- PascalCase for components: `BookingModal.tsx`, `ActionTile.tsx`, `LessonDetailSheet.tsx`,
  `UserManagement.tsx`.
- `useX.ts` for hooks colocated with components: `components/useOpname.ts`.
- Subdirectories group a feature's screens/pieces: `components/court/`, `components/lesdag/`,
  `components/progress/`, `components/ui/` (shared primitives: `Card`, `Badge`, `Screen`).

**Functions:**
- camelCase. Dutch verbs/nouns for domain logic: `lessenNu`, `planMethodChange`,
  `zetAanwezigheid`, `magAanwezigheidZetten`, `aanvraagVoor`, `kinderenVan`, `zonderLid`,
  `sessieSleutel`, `countsAsRevenue` (English here because it's a general financial-domain
  term already used in `payments.ts` alongside Dutch neighbours — mixing is acceptable when
  the concept itself reads naturally in English, e.g. money/revenue vocabulary).
- Boolean-returning functions read as a question or a permission check, often prefixed `mag`
  (Dutch "may/is allowed to"): `magInElkeAgenda`, `magKaartenSchrijven`, `magStilVerversen`,
  `magAanwezigheidZetten`.
- Planning/mutation-preview functions are prefixed `plan`: `planMethodChange`, `planCancel`,
  `planCardDeletion`, `planParticipantsChange`, `planSplitChange`, `planSeries`. This is a
  deliberate pattern: these functions compute *what should change* and return a plan/result
  object; the actual write happens one layer up (in `providers/SimpleDataProvider.tsx`).

**Variables:**
- camelCase; Dutch nouns for domain values held locally (`lessen`, `laat`, `speler`), English
  for generic loop/utility variables (`start`, `end`, `value`, `cleaned`).
- Constants that encode a business rule are `SCREAMING_SNAKE_CASE` with a Dutch or mixed name
  and a comment justifying the exact number: `VOOR_MS`, `NA_MS`, `SESSIONS_PER_CARD`,
  `GROEPSLES_METHOD`, `U9_CATALOGUE_ID`.

**Types:**
- PascalCase, defined centrally in `lib/types.ts` and re-exported/imported with `import type`.
  Domain types are English nouns (`Booking`, `User`, `Court`, `Lesson`, `Memo`,
  `PlayerGoal`, `Beurtenkaart` — note: even a type name can be Dutch when there is no natural
  English equivalent the team uses, e.g. `Beurtenkaart`, `OuderKind`).
- Discriminated/union domain concepts stay close to the DB: `PaymentMethod` is a string union
  of six literal values (`'open' | 'cash' | 'invoice' | 'qr' | 'beurtenkaart' | 'sponsor'`),
  mirroring the single `payment_method` column described in `OPENSTAAND.md`.

## Code Style

**Formatting:**
- No `.prettierrc`, `.eslintrc*`, or `eslint.config.*` found in the repository root — there is
  no automated formatter/linter configured. Style consistency is maintained by convention and
  by matching neighbouring code exactly (2-space indent, single quotes, semicolons,
  trailing commas in multi-line literals/params).
- `tsconfig.json` extends `expo/tsconfig.base` with `"strict": true`. This is the only
  automated code-quality gate besides tests — `npx tsc --noEmit` must pass with zero errors.

**TypeScript strictness:**
- `strict: true` is enforced. Avoid `any`; prefer precise union types and `import type` for
  type-only imports (used consistently throughout `lib/` and `providers/`).
- Functions have explicit return type annotations for anything non-trivial, especially in
  `lib/`: `export function lessenNu(bookings: Booking[], coachId: string, now: Date): Booking[]`.

## Import Organization

**Order observed (not enforced by tooling, but consistently followed):**
1. React / React Native / third-party framework imports (`react`, `react-native`,
   `@supabase/supabase-js`).
2. Relative imports to sibling `lib/` modules or `../lib/*` from providers/components.
3. `import type { ... }` grouped separately or alongside, using the `type` keyword inline
   (`import { isHerstelHash, type AanmeldUitkomst } from '../lib/wachtwoord';`).

**Path aliases:**
- None configured (`baseUrl: "."` in `tsconfig.json` only). All imports are relative
  (`./types`, `../lib/rechten`, `../../constants/tennis-colors`).

**Layering rule enforced by import direction (critical, verified by grep):**
- `lib/*.ts` modules import only from other `lib/*.ts` modules and from `constants/*`
  (design tokens like `tennisColors`, `spacing`, `typography`). They **never** import from
  `providers/`, `components/`, or `app/`.
- `providers/*.tsx` import from `lib/*` (never the other way around) and hold the actual
  read/write side effects (Supabase calls, AsyncStorage, `useState`).
- `components/*.tsx` and `app/*` import from both `lib/` and `providers/` to render state and
  call actions.
- This means: **if logic needs a test, it belongs in `lib/`, not in a screen or provider.**
  See `OPENSTAAND.md`: "Rekenwerk in `lib/` met tests ernaast, schermen blijven dun. Zit er
  logica in een scherm die je niet kunt testen, dan hoort ze in `lib/`."

## Internationalization (i18n)

- `lib/i18n.ts` defines `t(nl: string, vars?: Record<string, string | number>): string`.
- **The Dutch sentence itself is the translation key** — not a symbolic key like
  `settings.booking.end`. Call sites look like `t('Eindtijd reserveringen')`.
- English translations live in `lib/i18n-en.ts` as a lookup keyed by the exact Dutch string.
  A missing English entry falls back to the Dutch sentence, never to a raw key.
- Placeholders use `{naam}` syntax, filled via the `vars` argument — keeps interpolated
  sentences as one translatable unit rather than concatenated fragments.
- The active language is stored twice on purpose: in a React context (`LanguageCtx` /
  `LanguageProvider`, for re-render) and in a module-level `let current: Language` (for
  non-React `lib/` code such as date formatting). `LanguageProvider` sets the module variable
  **during render, not in a `useEffect`** — a `useEffect` fires after paint, so labels would
  read stale on the very render that switched language.
- New user-facing strings: always wrap in `t('Nederlandse zin')`; add an English counterpart
  to `lib/i18n-en.ts` only if/when full translation coverage is needed (see `OPENSTAAND.md`
  for known gaps — "Drie samengestelde foutmeldingen staan nog niet in het Engels").

## Error Handling

**Patterns:**
- Domain rule violations are expressed as **typed results/plans, not thrown exceptions**.
  Functions like `planMethodChange`, `planCancel`, `sponsorRefusal` (`lib/sponsor.ts`) return
  a description of what would happen (including a refusal reason) rather than throwing —
  callers in `providers/SimpleDataProvider.tsx` decide what to do with the result.
- `throw new Error(...)` is used sparingly, only for truly exceptional/platform-impossible
  situations, with a Dutch message: `lib/share.ts:78` —
  `throw new Error('Een Excel-bestand delen kan alleen op het web.')`.
- `try { ... } catch` blocks appear where I/O can fail unpredictably: `lib/import-leden.ts`
  (parsing an uploaded file), `lib/theme-mode.ts` (reading a stored preference), and
  extensively in `providers/SimpleDataProvider.tsx` around Supabase/AsyncStorage calls. In the
  provider, errors are captured into `error: string | null` state (see `DataShape.error` /
  `clearError`) and surfaced in the UI — not swallowed silently, and not thrown further up.
- Financial rules never fail silently: e.g. a coach with no hourly rate configured shows
  "€0,00 mét zichtbare waarschuwing, nooit stil weglaten" (`OPENSTAAND.md`) — the convention is
  that a missing/invalid business value must be *visibly* flagged, never defaulted quietly.

## Comments

**When to comment:**
- Every non-trivial exported function/constant in `lib/` gets a doc comment explaining the
  *reasoning*, often anchored to a real incident ("dat gat dat daarmee gedicht werd, liet een
  speler twee keer betalen" — the gap that closed once let a player pay twice,
  `OPENSTAAND.md`). When touching such code, preserve or extend the rationale comment; do not
  strip it for brevity.
- File-header comments (2–6 lines) describe the module's reason for existing and its
  boundaries, not an API list.
- Comments explain *why*, not *what* — this is explicit house style (`OPENSTAAND.md`:
  "commentaar legt het *waarom* uit, niet het *wat*").

**JSDoc/TSDoc:**
- `/** ... */` blocks are used for exported functions/constants/props, in Dutch, and often
  include a one-sentence caveat about edge cases (e.g. `ActionTile`'s `selected` and `badge`
  prop docs explain the exact visual/behavioural edge case they solve).

## Function Design

**Size:** Small, single-purpose. `lib/` functions typically stay under ~30 lines; complex
rules are decomposed into several named helpers (e.g. `groups.ts` exposes `groupSize`,
`groupSizeLabel`, `isGroupLesson`, `lessonPlayerIds`, `playsIn` as separate exports rather
than one large function).

**Parameters:** Explicit, typed, ordered from "subject" to "context" to "now"
(`lessenNu(bookings, coachId, now)`). Optional configuration is passed as a `Partial<T>`
"patch" object in test helpers (`les(id, startISO, patch: Partial<Booking> = {})`).

**Return Values:** Pure functions return new arrays/objects; nothing in `lib/` mutates its
input arguments. Filtering/sorting pipelines are expressed as chained `.filter()`/`.sort()`
rather than imperative loops (see `lessenNu`).

## Module Design

**Exports:** Only what other modules actually import is exported. The August 22 cleanup
(documented in `OPENSTAAND.md`) explicitly removed 19 exports that were only used within their
own file — the convention is: **if nothing outside the file imports it, don't export it.**
Building blocks used only by that file's own tests (e.g. `sameRow`, `splitEvenly`, `crc32`,
`leesKopregel`) are a deliberate, accepted exception — they stay unexported and untested from
outside, "de prijs waard" (worth the price) rather than being exported just to satisfy a
generic testability rule.

**Barrel Files:** None. No `index.ts` re-export barrels found in `lib/`, `components/`, or
`providers/` — every import path points directly at the defining file.

**One rule module per concern:** Do not add a second responsibility to an existing `lib/`
file. When a new business rule emerges, create a new `lib/<naam>.ts` + `lib/<naam>.test.ts`
pair rather than growing an existing module (e.g. payment-method changes, cancellation,
splitting, and card-deletion planning are each separate functions in `lib/beurtenkaart.ts`,
but a genuinely new domain — like reminders, per `OPENSTAAND.md` item 4 — should get its own
file).

## Reusable UI Primitives — Do Not Reinvent

Per `OPENSTAAND.md`, always reuse existing building blocks instead of introducing new visual
patterns or ad hoc colors/sizes:
- `components/ui/ActionTile.tsx` — choice tiles
- `components/ui/StatCard.tsx` — number displays
- `components/ui/Screen.tsx` + `useIsWide()` — responsive width handling
- `constants/theme.ts` and `constants/tennis-colors.ts` — spacing/typography/color tokens

## Delivery Checklist (from OPENSTAAND.md and README.md)

Every change, before considering it done, is verified with:
```bash
npx tsc --noEmit                                     # typecheck, must be zero errors
npm test                                             # runs jest (jest-expo preset), all suites in lib/
npx expo export --platform web --output-dir .webbuild-check && rm -rf .webbuild-check
```
Additional house rules:
- **One agent/person per file at a time** — concurrent edits to the same file overwrite each
  other's work.
- The dev server (`npx expo start --web`, port 8081) hot-reloads on every save — never leave a
  half-written file that references something not yet created.
- **The dev server talks to the real Supabase project.** Testing locally can alter production
  club data — be deliberate about writes performed while the dev server is running.
- "Commit alles" (commit everything) from the user also means push — do not ask separately
  whether to push.

---

*Convention analysis: 2026-09-05*
