# External Integrations

**Analysis Date:** 2026-09-05

## APIs & External Services

**Backend-as-a-Service:**
- Supabase - the only server-side integration in the app. Provides Postgres database, authentication, and Row Level Security.
  - SDK/Client: `@supabase/supabase-js` ^2.112.3, instantiated in `lib/supabase.ts`
  - Auth: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (env vars)
  - The anon key is intentionally shipped in the web bundle; all access control is enforced server-side via Postgres RLS policies in `supabase-schema.sql`

**Messaging (client-side link-outs only, no API/SDK):**
- WhatsApp - `wa.me` deep links, built by `whatsappLink()` in `lib/contact.ts`, opened via `Linking.openURL` (see `components/ui/ContactRegels.tsx`, `app/profile.tsx`). No WhatsApp Business API or webhook integration — this is purely a generated URL the OS/browser opens.
- Email - `mailto:` links, built by `mailtoLink()` in `lib/contact.ts`, opened the same way. No transactional email sending from the app itself (see "Email delivery" below — that part is handled entirely by Supabase Auth, not custom code).

**Document/video links (pass-through only):**
- `components/LessonAttachments.tsx` and `components/LessonDetailModal.tsx` open externally-hosted URLs (e.g. lesson video links, attachment `uri`) via `Linking.openURL`. Comments in `LessonAttachments.tsx` indicate a planned future integration with Google Drive (`source: 'drive'`, `drive_file_id`, `webViewLink`) that is **not yet implemented** — currently attachments are either a `data:` URL (base64, stored inline in the row) or a plain external URL opened as-is. See `docs/lesson-attachments.md` for the design note (referenced in code comments; not verified in this pass).

## Data Storage

**Databases:**
- Supabase-hosted PostgreSQL (Supabase Cloud) — schema fully defined in `supabase-schema.sql` (886 lines)
  - Connection: `EXPO_PUBLIC_SUPABASE_URL` env var (also used to derive the AsyncStorage session key, see `sessieSleutel()` in `lib/supabase-config.ts`)
  - Client: `@supabase/supabase-js` via `lib/supabase.ts`, all reads/writes go through `providers/supabaseStore.ts`
  - Tables (from `supabase-schema.sql`): `users`, `courts`, `bookings`, `lessons`, `student_progress`, `memos`, `player_goals`, `beurtenkaarten`, `coach_rates`, `ouder_kind`, `club_settings`, `installed_catalogues`
  - Row Level Security is enabled on all tables with policies keyed off `auth.uid()`, `is_admin()`, `is_coach()`, and a parent-child link table (`ouder_kind` / `is_mijn_kind()`) — see `lib/rechten.ts` for the client-side mirror of these rules (explicitly documented as non-authoritative; the DB policies are the real enforcement)
  - A Postgres trigger (`on_auth_user_created`, line ~548) links newly-created `auth.users` rows to application `users` rows on sign-up

**Fallback / offline storage:**
- When Supabase env vars are absent or empty, the app uses a local-only "mock store" (`providers/mockStore.ts`) backed by `@react-native-async-storage/async-storage` (and `localStorage` on web via the same abstraction). No network calls occur in this mode. The choice between the two backends is made in exactly one place: `providers/backend.ts`.

**File Storage:**
- No Supabase Storage buckets or third-party file storage detected (`supabase.storage`, `createSignedUrl`, `.upload(` were grepped for and not found in `lib/`, `providers/`, `app/`). Lesson attachments (PDFs) are currently stored as base64 `data:` URLs directly in the database/local store, not in object storage — see `components/LessonAttachments.tsx`.

**Caching:**
- None. No Redis, no query-cache layer, no `react-query`/`swr` dependency found in `package.json`.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (email + password), used only in the "connected" mode (`providers/supabaseStore.ts`: `signIn`, `signUp`, `signOut`, `onAuthChange`, `stuurHerstelmail` (password reset email), `zetNieuwWachtwoord` (set new password))
  - Session persistence: `AsyncStorage` on native, browser default (`localStorage`, via `storage: undefined`) on web (`lib/supabase.ts`)
  - `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl` enabled only on web (needed for email confirmation / password-reset redirect flows)
  - Password reset flow depends on Supabase project settings for **Site URL** and **Redirect URLs** including the deployed subpath (documented in `README.md`); misconfiguration breaks the reset-link flow silently
  - Local/offline mode uses a completely different, password-less "pick a profile from a list" auth (`authMode: 'profiel'` in `providers/backend.ts`) — there is no real identity or session in this mode

**Authorization model:**
- Three roles (`speler`/player, `coach`/trainer, `ouder`/parent — see `lib/types.ts` for the `Role` union) plus one independent `is_admin` boolean flag (not a 4th role) — documented in `lib/rechten.ts`
- Enforced authoritatively in Postgres via RLS policies (`supabase-schema.sql`); `lib/rechten.ts` duplicates the same logic client-side purely for UI gating (hiding actions the DB would reject anyway)

## Monitoring & Observability

**Error Tracking:**
- None detected. No Sentry, Bugsnag, or similar crash-reporting SDK in `package.json`.

**Logs:**
- No structured logging framework. Standard `console.*` usage only (not exhaustively audited).

## CI/CD & Deployment

**Hosting:**
- GitHub Pages, static web export only. The app is deployed from a subpath (`/tennis-app/`, configured via `app.json`: `experiments.baseUrl`), not domain root.
- No native app store distribution (no `eas.json`, no App Store/Play Store CI steps).

**CI Pipeline:**
- `.github/workflows/deploy.yml` ("Website"), triggered on push to `main` or manual dispatch:
  1. `npm ci`
  2. `npx tsc --noEmit` (typecheck gate)
  3. `npm test -- --ci` (Jest gate)
  4. Env-key sanity check — fails the build if exactly one of the two Supabase secrets is set (half-configured is treated as worse than none)
  5. `npx expo export -p web` with the two Supabase secrets injected as env vars
  6. Copies `dist/index.html` → `dist/404.html` (SPA fallback for GitHub Pages) and creates `dist/.nojekyll` (so the `_expo` directory, which starts with an underscore, isn't dropped by Jekyll)
  7. `actions/upload-pages-artifact` → `actions/deploy-pages`
- Single-flight concurrency group (`pages`) — a new push cancels an in-progress deploy.

## Environment Configuration

**Required env vars (both optional together; must be set as a pair or not at all):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Secrets location:**
- Local development: `.env` (gitignored, not committed; `.env.example` documents the shape with placeholder values)
- CI/production: GitHub Actions repository secrets, injected as build-time env vars during `expo export`
- The Supabase **service-role key is never used anywhere** in this app (explicitly called out in `README.md`) — only the public anon key, which is safe to ship client-side given RLS enforcement

## Webhooks & Callbacks

**Incoming:**
- None. This is a client-only app (no backend server / API routes) that talks directly to Supabase from the browser/native client. There is no custom server to receive webhooks.

**Outgoing:**
- None beyond the implicit Supabase Auth email flows (confirmation email, password-reset email), which are sent by Supabase itself, not by app code, once **Confirm email** is enabled in the Supabase project's Authentication settings (per `README.md` setup instructions).

---

*Integration audit: 2026-09-05*
