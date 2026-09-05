# Codebase Concerns

**Analysis Date:** 2026-09-05

This document reflects a codebase that is unusually well self-documented (`OPENSTAAND.md`,
`HANDOVER.md`, in-line Dutch comments explaining *why*) and has a large, passing test suite
(985 tests / 44 suites, all under `lib/`, `npx tsc --noEmit` clean at time of writing). Most
"concerns" here are therefore not sloppy code but deliberate trade-offs the project owner has
already named, plus a handful of structural risks worth watching as the app grows.

## Tech Debt

**`bookings` table does quadruple duty:**
- Issue: A single `bookings` row simultaneously represents (1) a scheduled lesson, (2) a
  pending lesson *request* (`status: 'pending'` / `rejected_at`), (3) a payment record
  (`payment_method`, `beurtenkaart_id`, `payment_split`), and (4) an attendance register
  (`attendance` jsonb, added "sinds de aanwezigheid" per `supabase-schema.sql`). A group
  lesson additionally folds multiple participants into one row via `participant_ids`.
- Files: `lib/types.ts` (`Booking` type, ~line 140-215), `supabase-schema.sql`
  (`bewaak_betaalvelden` trigger, lines 391-468; `bookings_select/insert/update/delete`
  policies, lines 704-800), `lib/beurtenkaart.ts` (`planMethodChange`), `lib/groups.ts`.
- Impact: Every new feature that touches bookings (payments, attendance, group lessons,
  approvals) has had to be defended with an increasingly complex Postgres trigger
  (`bewaak_betaalvelden`) that diffs the *entire row* minus a few allowed columns, because
  RLS `UPDATE` policies cannot restrict individual columns. This is fragile: a new column
  added to `bookings` is safe only if the trigger's exclusion list is remembered, and the
  trigger's `to_jsonb(new) - 'x' - 'y'` pattern grows more brittle with each new
  field. `OPENSTAAND.md` itself documents that this already broke twice silently (coach
  couldn't approve a request, player couldn't update own profile) before being fixed.
- Fix approach: If more per-lesson concerns are added (e.g. cancellation fees, rescheduling
  history — both already planned in `OPENSTAAND.md` §3.5/3.6), consider splitting attendance
  and payment history into their own tables with their own RLS policies rather than continuing
  to extend the single `bookings` row + one giant trigger.

**Single guarded path for payment changes is easy to accidentally bypass:**
- Issue: All payment-method changes must go through `planMethodChange` in
  `lib/beurtenkaart.ts`, invoked only via `setPaymentMethod` in
  `providers/SimpleDataProvider.tsx`. `updateBooking`'s TypeScript type deliberately excludes
  `payment_method` and `beurtenkaart_id` to force this. This is a good pattern, but it is
  enforced by a type omission, not a runtime guard — any new provider method or direct
  Supabase call that constructs a `Partial<Booking>` object without going through the
  provided type helpers could reintroduce a double-payment bug (the exact bug this pattern
  was created to fix, per `OPENSTAAND.md`).
- Files: `lib/beurtenkaart.ts` (`planMethodChange`), `providers/SimpleDataProvider.tsx`
  (`setPaymentMethod`, `updateBooking`), `supabase-schema.sql` (`bewaak_betaalvelden`).
- Impact: A regression here reintroduces a real money bug (player charged twice), not just a
  UI glitch.
- Fix approach: Keep this path as the only writer; when reviewing any PR that touches
  `payment_method` or `beurtenkaart_id`, verify it routes through `planMethodChange`. The DB
  trigger is the real backstop — do not weaken it.

**Duplicated permission checks (app + database) must be kept in sync by hand:**
- Issue: By design (documented in `lib/rechten.ts` header), every rule in the client
  (`lib/rechten.ts`: `magInElkeAgenda`, `magLesVerwijderen`, `magKaartenSchrijven`,
  `magLoonZien`, `magClubcijfersZien`) has a matching RLS policy or trigger in
  `supabase-schema.sql` that is the actual enforcement. The client-side checks exist only so
  the UI doesn't offer actions the database will reject.
- Files: `lib/rechten.ts`, `supabase-schema.sql` (policies `bookings_delete`, `kaarten_write`,
  `rates_select`, trigger `bewaak_is_admin`).
- Impact: If a rule changes in one place and not the other, the failure mode is either a
  visible dead button (safe but confusing) or — worse — a button that appears to work but
  silently fails, which is exactly the class of bug `OPENSTAAND.md` records happening twice
  around the `upsert`-vs-`insert`-policy interaction (see "Known Bugs" below and the "Eén
  valkuil in de RLS-regels" section of `OPENSTAAND.md`).
- Fix approach: When adding a new permission rule, always update both files in the same
  commit and add a test in `lib/rechten.test.ts`; there is no automated check that the two
  stay in sync (RLS policies aren't exercised by the Jest suite, which runs against no
  database).

**Dead/unused revenue calculation (`clubMargin`):**
- Issue: `clubMargin` in `lib/payments.ts:435` is implemented and tested but not surfaced on
  any screen (confirmed via `OPENSTAAND.md` §2 and no call sites found in `app/` or
  `components/`).
- Files: `lib/payments.ts:421-436` (`totalCoachPayout`, `clubMargin`).
- Impact: None currently (dead code, not a bug), but it's a landmine for a future "why doesn't
  this number show up anywhere" investigation.
- Fix approach: Wire it into the admin reports screen (`app/admin/reports.tsx`) or remove it
  if margin reporting is no longer wanted.

**`totalCoachPayout` pays trainers for unpaid ("open") lessons:**
- Issue: A trainer's payout counts a lesson as soon as it's given, regardless of whether the
  club has actually collected payment from the player (`payment_method: 'open'`). This is a
  documented, deliberate choice ("het uur is gegeven"), not a bug.
- Files: `lib/payments.ts` (`totalCoachPayout`).
- Impact: If the club's policy changes to "pay trainer only after collection", this function
  needs a filter on payment status — currently it would silently keep the old behavior.
- Fix approach: Add the filter only if/when the club's payout policy changes; until then, no
  action needed, but any refactor of this function must preserve the current semantics
  intentionally rather than by accident.

**Delete-from-detail-sheet inconsistency:**
- Issue: The delete action in the lesson detail sheet only appears for a lesson that belongs
  to a recurring series; a standalone lesson has no delete affordance at all.
- Files: `components/BookingDetailSheet.tsx` (or `components/LessonDetailSheet.tsx` per
  `OPENSTAAND.md` — verify current filename, screens were refactored since that doc was
  written).
- Impact: Confusing/inconsistent UX; users may not find how to delete a one-off booking.
- Fix approach: Decide on one consistent delete affordance and add it for standalone bookings
  too.

**`BookingModal` has no max width on wide screens:**
- Files: `components/BookingModal.tsx` (725 lines — the largest single modal in the app).
  Other sheets appear to use a bounded-width pattern via `Screen.tsx` / `useIsWide()`
  (per `HANDOVER.md` design-system conventions); this modal does not.
- Impact: Cosmetic only — the modal stretches full-width on a wide monitor.
- Fix approach: Apply the same max-width treatment used elsewhere in the design system.

**Nested modal on unknown-player creation:**
- Issue: Creating an unknown player from inside the player-picker combobox opens a modal
  inside a modal.
- Files: Player picker / combobox flow feeding `components/UserManagement.tsx` and booking
  screens; exact nesting point not isolated during this pass — search for combobox
  "add player" entry points in `components/` (e.g. `StudentCombobox`).
- Impact: Works on web; explicitly **not yet verified on native/phone** per `OPENSTAAND.md`.
- Fix approach: Manually test on a physical device before relying on this flow for mobile
  users; consider flattening to a single sheet if nested modals misbehave on native.

**Memo/voice-note storage has no retention limit:**
- Issue: Coach voice memos (`memos` table / `voice_memo_uri`) accumulate indefinitely if a
  trainer never "works them out" into written progress notes. This is an intentional
  worklist-not-inbox design, but there's no size cap.
- Files: `lib/memo.ts`, `lib/types.ts` (`Memo`), `docs/superpowers/specs/` (22 augustus voice
  memo spec).
- Impact: A trainer who never processes memos accumulates increasing amounts of audio the
  client has to fetch/hold on every app start. Currently stored as base64 in local mock
  storage in the no-Supabase fallback mode (`lib/memo.test.ts` fixtures use
  `data:audio/webm;base64,...`); once on Supabase Storage this is less severe but still
  unbounded.
- Fix approach: `OPENSTAAND.md` already identifies Supabase Storage (rather than inline
  base64) as the answer once this becomes a real problem; no cap exists today.

**Speech-to-text does not exist:**
- Issue: A placeholder component (`components/SpeechToText.tsx`) was deliberately removed
  during an August 22 cleanup because it was unused and misleading ("a file that says 'coming
  soon' and is shown nowhere is not the start of a feature, it's noise" — paraphrased from
  `OPENSTAAND.md`). The feature itself remains unbuilt.
- Files: `docs/voice-memo-native.md` describes the intended native approach.
- Impact: None today (correctly removed dead code); flagged here only so a future
  implementer knows the design doc still exists even though the stub file doesn't.

## Known Bugs

**RLS upsert pitfall — insert policy re-checked on every update (recurring risk class):**
- Symptoms: An action that should succeed (a coach approving a pending lesson request, a
  player updating their own profile) silently does nothing — no error surfaces to the UI,
  because Postgres evaluates the `INSERT` policy's `WITH CHECK` clause on every `UPSERT`, even
  when the row already exists.
- Files: `supabase-schema.sql`, especially the comment block directly above `bookings_insert`
  (lines ~726-749) and the general write path `saveToSupabase` (see
  `providers/supabaseStore.ts`).
- Trigger: Any RLS policy on a table written via `insert ... on conflict do update` (the
  app's standard write pattern per `lib/sync.ts` — the whole store is diffed and pushed as
  upserts) that includes a condition about the row's *creator* (e.g. `created_by =
  app_user_id()`) will be silently re-evaluated against the *new* writer's identity, not the
  original creator's.
- Workaround: Already fixed for `bookings_insert` (creator check removed for the coach/admin
  branches) and for the two documented August-22 cases. This is recorded here as a **known
  bug class**, not a single fixed bug: any future policy added to a table that uses the
  upsert write pattern is at risk of the same silent failure. Read the comment above
  `bookings_insert` before touching any RLS policy.

**"Lessen hangen aan een traineraccount" — per user memory note:**
- Symptoms: Logging in as `trainer@trainer.be` shows the student list but not that trainer's
  own lessons.
- Files: Likely `app/coaches/[id].tsx` (filters `bookings` by `coach_id === coach.id`) and/or
  the RLS `bookings_select` policy (`coach_id = app_user_id()`) — suggests a mismatch between
  the logged-in `auth.users` id and the `users.id`/`coach_id` stored on existing bookings for
  this specific test account (possibly a leftover from before `link_auth_user` linked this
  email, or a coach whose historic bookings were seeded under a different id).
- Trigger: Log in specifically as `trainer@trainer.be`.
- Workaround: None recorded. Needs reproduction against the live data to confirm whether this
  is a stale-id issue (fixable with a one-off SQL update) or a genuine code path issue in
  `providers/supabaseStore.ts` / `lib/sync.ts`.

**Calendar automation ("agenda-automatisering") gets stuck:**
- Symptoms: Per user memory note, EventKit has no access and AppleScript hangs on the large
  "Family" calendar.
- Files: `scripts/` directory (`extract-u9-trainings.py`, `gids-html.js` are unrelated —
  the calendar-export feature referenced is the `.ics` generation, see `docs/` design notes
  from `184244f docs(agenda): ontwerp voor nieuwe lessen meteen in je agenda` and the commits
  around `1774687 feat(agenda): je geplande lessen als agendabestand voor Outlook`). No
  dedicated automation script for macOS Calendar/EventKit was found under `scripts/` in this
  pass — the "agenda-automatisering" referenced is most likely an external, ad hoc
  macOS-side script (outside this repo) that consumes the exported `.ics` files
  (`koen-lessen.ics`, `racso-lessen.ics` at repo root).
- Trigger: Running the external automation against macOS Calendar with the "Family" calendar
  selected.
- Workaround: None recorded; this concern is external to the app's own codebase but affects
  the same workflow the `.ics` export feature serves.

## Security Considerations

**Dev server talks to real production Supabase — no environment separation:**
- Risk: `.env` (present at repo root, correctly git-ignored) holds the anon key for the
  club's live Supabase project. There is no separate staging/dev project. Running
  `npx expo start --web` locally reads and writes real club data — real players, real
  bookings, real payments.
- Files: `.env`, `providers/backend.ts` (chooses Supabase vs local mock store based solely on
  whether `.env` keys are present — there is no third "local dev against a test Supabase
  project" mode).
- Current mitigation: RLS policies limit what any given logged-in identity can touch; the
  anon key alone grants nothing beyond what RLS allows. The user's own memory note flags this
  explicitly: "testen op localhost wijzigt productiedata van de club."
  Removing `.env` locally to fall back to local mock storage is the only way to test the
  no-DB code path without touching prod, but that skips exercising the actual Supabase
  integration.
- Recommendations: Stand up a second, free-tier Supabase project for development, load it
  with the same `supabase-schema.sql`, and add `.env.example`-style guidance in `README.md`
  pointing dev work at it. Until then, treat every local `npm run web` session with `.env`
  present as touching production.

**Confirm-email must be manually enabled before any bulk import:**
- Risk: Documented in `README.md` and `OPENSTAAND.md` §3.3 — if Supabase's "Confirm email"
  auth setting is off, anyone who knows a club member's email address can claim that
  member's pre-created account before the real member signs up, because imported
  members exist in `users` before they've ever logged in.
- Files: `app/admin/leden-import.tsx`, `lib/import-leden.ts`, `supabase-schema.sql`
  (`link_auth_user` trigger).
- Current mitigation: README instructs enabling "Confirm email" before importing; this is a
  manual, external Supabase dashboard setting not enforced by the code itself.
- Recommendations: There is no way for the app to verify this setting is on. Consider a
  pre-import checklist prompt in `app/admin/leden-import.tsx`, or accept the documentation-only
  mitigation as sufficient for a single-admin club.

**Service-role key correctly kept out of the app — verify this stays true:**
- Risk: `README.md` explicitly states the service-role key is never needed and "hoort nergens
  in deze app of repo." No occurrences of a service-role key were found in this pass.
- Files: N/A (absence confirmed).
- Recommendations: Any future Edge Function work (mentioned as a prerequisite for invite
  emails in `OPENSTAAND.md` §3.3) will need a service-role key — make sure that key lives only
  in Supabase's Edge Function environment, never in `.env` or client bundle.

## Performance Bottlenecks

**Whole-store diffing on every save (`lib/sync.ts`):**
- Problem: Every write recomputes a deep diff (`sameRow`, `changeFor`) between the entire
  previous in-memory snapshot and the entire next snapshot, across all tables (`users`,
  `courts`, `bookings`, `lessons`, `progress`, `goals`, `beurtenkaarten`, `memos`,
  `relaties`), then upserts whatever changed.
- Files: `lib/sync.ts` (`diffStores`, `changeFor`, `sameRow`), consumed by
  `providers/supabaseStore.ts`.
- Cause: This is a deliberate design for atomicity — "een beurt afboeken, de les op factuur
  zetten en de kaart bijwerken niet half kunnen slagen" (`lib/sync.ts` header comment) — the
  whole app state is always recomputed as a single new snapshot and diffed rather than each
  action issuing its own targeted mutation.
- Improvement path: Fine at current club scale (dozens of players, hundreds of bookings).
  If a club with thousands of historical bookings is onboarded, the linear scan + deep
  equality check across every table on every keystroke-adjacent save (e.g. every booking
  action) could become noticeable. Watch `bookings` and `lessons` array sizes; if this
  becomes slow, the fix is scoping diffs to only the tables an action could plausibly have
  touched rather than diffing all nine every time.

**Historical local-storage/base64 attachment limits (mock-store fallback path only):**
- Problem: In the no-Supabase local fallback mode, PDFs and voice memos are stored as
  base64 data URLs directly in `localStorage`/`AsyncStorage`, capped at ~5MB total with
  individual PDFs capped at 2MB (per `HANDOVER.md` §9).
- Files: `providers/mockStore.ts`, `lib/bestand.ts` (attachment handling).
- Cause: No real object storage in the local-only mode; this mode is intended for demos and
  screen-only development, not real usage per `HANDOVER.md`.
- Improvement path: Real club usage on Supabase does not hit this limit (files are meant to
  move to Supabase Storage/Drive per `HANDOVER.md` §9), but if any screen work is done while
  running in local-mock mode with real attachments, this ceiling can silently truncate data.

## Fragile Areas

**`bookings` table + `bewaak_betaalvelden` trigger:**
- Files: `supabase-schema.sql` lines 391-468, `lib/beurtenkaart.ts`, `lib/groups.ts`,
  `providers/SimpleDataProvider.tsx`.
- Why fragile: As described under Tech Debt above, this is a single row-level trigger doing
  column-level access control by diffing whole JSONB blobs with hand-maintained exclusion
  lists (`- 'payment_method' - 'beurtenkaart_id' - 'attendance'`). A new column added to
  `Booking` in `lib/types.ts` without updating this trigger's exclusion list will be treated
  as "anyone with update rights on this row can silently change it," which may be too
  permissive, or conversely the trigger may block a legitimate new use case with an opaque
  Postgres exception surfaced as a generic save failure in the UI.
- Safe modification: Any new field added to the `bookings` table must be explicitly
  considered against `bewaak_betaalvelden` (does this field belong to the coach, the payer,
  or a participant?) and the trigger updated in the same change. Add a corresponding case to
  `lib/beurtenkaart.test.ts` / `lib/rechten.test.ts` style tests where possible, but note RLS
  triggers themselves are **not exercised by the Jest suite** — they can only be verified by
  hand against a real Supabase project (or a local Postgres instance running the same SQL).
- Test coverage: None automated for the SQL/RLS layer itself; all 985 tests run against
  pure TypeScript in `lib/`, with zero database involved (confirmed via `npm test` output —
  44 suites, all under `lib/`).

**`providers/SimpleDataProvider.tsx` (1210 lines):**
- Files: `providers/SimpleDataProvider.tsx`.
- Why fragile: This is the single largest non-generated file in the app and the sole gateway
  screens use to reach data (`useSimpleData()`), per the architecture rule in
  `HANDOVER.md` ("schermen praten NOOIT rechtstreeks met de opslag"). Its size means most new
  features add another method here, increasing the chance of an unrelated change breaking a
  guarded path (like `setPaymentMethod`) elsewhere in the same file.
- Safe modification: Prefer extracting pure calculation logic to `lib/` (already the stated
  convention — "Rekenwerk in `lib/` met tests ernaast, schermen blijven dun," per
  `OPENSTAAND.md`) rather than growing this provider file further; keep this file to
  orchestration only.
- Test coverage: Not directly unit-tested (it's a React provider); its correctness rests on
  the `lib/` functions it calls being tested, which is a reasonable split, but the wiring
  itself (which action calls which `lib/` function, in which order) is only covered by manual
  QA per `OPENSTAAND.md` §9 ("alle 676 tests zitten in `lib/`, geen enkele op een scherm").

**No screen-level tests at all:**
- Files: Entire `app/` and `components/` trees.
- Why fragile: `OPENSTAAND.md` explicitly names two real production bugs caught only by
  manual testing that automated tests would have caught: a save button that never fired on
  web because `onEndEditing` doesn't exist in `react-native-web`, and a style object that was
  never imported. Both are exactly the class of bug that survives a green `lib/` test suite
  and a clean `tsc` run.
- Safe modification: Any change to a screen or component should be manually smoke-tested on
  web (`npm run web`) before considering it done; the project's own release checklist
  (`OPENSTAAND.md` "Werkwijze") already requires `tsc`, `jest`, and an `expo export
  --platform web` build step for this reason, but none of those catch runtime-only wiring
  bugs in components.
- Test coverage: 0% at the screen/component level by design so far; 985 tests cover `lib/`
  only.

## Scaling Limits

**Single Supabase project, single admin workflow:**
- Current capacity: Sized for one tennis club (per `README.md` — "een club met vijftig
  leden"), with manual role promotion (`update users set role = 'coach'`) and a manual
  admin-flag trigger (`bewaak_is_admin`) rather than any multi-tenant structure.
- Limit: The schema and RLS policies assume a single club's data lives in one Supabase
  project. There is no tenant/club_id partitioning anywhere in `supabase-schema.sql`.
- Scaling path: Not a concern unless this app is repurposed to serve multiple clubs from one
  database — currently out of scope and not hinted at anywhere in the docs.

**Supabase built-in email is rate-limited:**
- Current capacity: `README.md` explicitly warns the built-in Supabase mail sender is
  "streng gelimiteerd" and recommends a club of ~50 members configure custom SMTP
  (Project Settings → Authentication → SMTP).
- Limit: Without custom SMTP, "Confirm email" and "Wachtwoord vergeten" flows do nothing
  visible once the built-in quota is exhausted.
- Scaling path: Documented mitigation already exists (custom SMTP) — just needs to be applied
  before/at import of the full member list.

## Dependencies at Risk

**None identified as urgent.** `jest-expo` is intentionally pinned to `~53.0.0` to match Expo
SDK 53 (`HANDOVER.md` §9) — this is a deliberate pin, not staleness, and should move in lockstep
with any future Expo SDK upgrade. `global.d.ts` maps the `JSX` namespace to `React.JSX` for
React 19 compatibility and is called out as "niet weghalen" (do not remove) — a future
React/TypeScript-types upgrade should re-verify whether this shim is still needed before
deleting it.

## Missing Critical Features

(Carried over from `OPENSTAAND.md` §3, in the project owner's own priority order — included
here because each is a real, known gap rather than an oversight this analysis discovered.)

- **Reminders:** No reminders exist for players about upcoming lessons, nor for trainers about
  lessons stuck in "open" payment status too long.
- **Cancellation policy:** Cancelling late is currently free and clears the payment method —
  no late-cancellation fee logic exists.
- **Rescheduling:** No "move this booking" flow exists; the only option today is cancel +
  rebook, which loses history and is clunky for weather-driven rescheduling (outdoor → indoor
  court).
- **Invoicing:** `"invoice"` exists as a `payment_method` value but no actual invoice document
  is generated anywhere in the app.
- **Progress-over-time view:** `StudentProgress` ratings are recorded per entry, but there is
  no screen showing a player's rating trend over time — only point-in-time entries and a
  timeline list.
- Files for all of the above: `lib/types.ts` (`Booking`, `StudentProgress`), `lib/payments.ts`,
  `app/coaches/reports.tsx` / `app/admin/reports.tsx`.

## Test Coverage Gaps

**Zero UI/screen test coverage:**
- What's not tested: Every file under `app/` and `components/` (the entire rendering and
  event-handling layer). All 985 tests are in `lib/*.test.ts` and exercise pure functions only.
- Files: `app/**/*.tsx`, `components/**/*.tsx` (see `components/BookingModal.tsx` at 725
  lines and `components/BookingDetailSheet.tsx` at 675 lines as the highest-risk,
  highest-complexity untested surfaces).
- Risk: UI wiring bugs (event handlers never firing, missing style imports, platform-specific
  API gaps between web and native) ship undetected by the automated suite; two such bugs are
  already documented as having shipped and been caught only by hand (`OPENSTAAND.md` §9).
- Priority: Medium — the project's stated philosophy is that all testable logic already lives
  in `lib/` and screens stay "thin," which limits the blast radius of this gap, but the two
  documented incidents show thin screens still carry real risk (event binding, style
  application) that pure-function tests structurally cannot catch.

**RLS policies and triggers are untested by any automated suite:**
- What's not tested: `supabase-schema.sql` in its entirety — every `CREATE POLICY` and every
  `CREATE OR REPLACE FUNCTION ... TRIGGER` (`bewaak_is_admin`, `bewaak_betaalvelden`,
  `geef_beurt_terug`, `link_auth_user`, and others).
- Files: `supabase-schema.sql`.
- Risk: This is the actual security/business-rule enforcement layer (per `lib/rechten.ts`'s
  own header comment: "De app is niet de bewaker"), yet it has no automated test coverage at
  all — verification is manual, against either production or a hand-run local Postgres
  instance. The RLS upsert pitfall documented under "Known Bugs" above is a direct consequence
  of this gap: two real regressions shipped silently before being caught by hand.
- Priority: High — this is the layer the entire security model rests on, and the project's
  own postmortem notes ("Eén valkuil in de RLS-regels" in `OPENSTAAND.md`) show it has already
  produced two silent production bugs. Consider a lightweight pgTAP or Supabase CLI-based
  test harness that runs `supabase-schema.sql` against a local Postgres/Supabase instance and
  asserts policy behavior for each role, especially for the upsert-vs-insert-policy
  interaction.

---

*Concerns audit: 2026-09-05*
