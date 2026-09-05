# Technology Stack

**Analysis Date:** 2026-09-05

## Languages

**Primary:**
- TypeScript ~5.8.3 - all app code (`app/`, `components/`, `lib/`, `providers/`, `constants/`), strict mode enabled in `tsconfig.json`

**Secondary:**
- Dutch is the primary human language used throughout: identifiers, comments, and JSDoc-style docblocks in `lib/`, `providers/`, `app/`, `components/` are written in Dutch. UI copy is externalized through a small i18n layer (`lib/i18n.ts`, `lib/i18n-en.ts`) so English is a supported display language, but source code itself is Dutch-first.
- Python - one utility script, `scripts/extract-u9-trainings.py` (data extraction, not part of the app runtime)
- SQL (PostgreSQL / Supabase dialect) - `supabase-schema.sql` (886 lines): tables, RLS policies, triggers, functions
- HTML/JS - `trainersgids.html`, `scripts/gids-html.js` (a standalone trainer's guide document, generated/maintained outside the Expo app)

## Runtime

**Environment:**
- Expo SDK ~53.0.0 (managed workflow), targets iOS, Android, and Web from one codebase
- React 19.0.0 / React DOM 19.0.0
- React Native 0.79.6, New Architecture enabled (`app.json`: `"newArchEnabled": true`)
- Routing: `expo-router` ~5.1.11, file-based routing rooted at `app/` (`main` entry in `package.json` is `expo-router/entry`)
- Web bundling: Metro bundler, single-output web build (`app.json`: `"web": { "bundler": "metro", "output": "single" }`)
- No `.nvmrc` present; CI (`​.github/workflows/deploy.yml`) pins Node 20 via `actions/setup-node@v4`

**Package Manager:**
- npm (lockfile `package-lock.json` present, committed)
- No `.npmrc` present

## Frameworks

**Core:**
- Expo Router ~5.1.11 - file-based navigation/screens, entry point `app/_layout.tsx`
- React Native 0.79.6 - cross-platform UI runtime
- React Native Web ^0.20.0 - enables the same screens to render as the deployed website
- `@supabase/supabase-js` ^2.112.3 - backend client (auth, Postgres, realtime not used explicitly — see INTEGRATIONS.md)

**Testing:**
- Jest ^29.7.0 with `jest-expo` ~53.0.0 preset (configured inline in `package.json`, not a separate `jest.config.js`)
- No separate assertion/mocking library beyond Jest's built-ins
- Tests are co-located with source under `lib/` (e.g. `lib/contact.test.ts`, `lib/wachtwoord.test.ts`, `lib/supabase-config.test.ts`) — run via `npm test`

**Build/Dev:**
- Babel - `babel.config.js` (single line, uses `babel-preset-expo`)
- TypeScript compiler - type-checking only (`npx tsc --noEmit`), no separate bundler config beyond Metro (implicit via Expo)
- `expo export -p web` - produces the static website build (`dist/`) deployed to GitHub Pages

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.112.3 - the only remote data backend; without configured keys the app runs entirely offline (see below)
- `@react-native-async-storage/async-storage` 2.1.2 - persists the Supabase session on native platforms and backs the local-only "mock store" fallback
- `react-native-url-polyfill` ^4.0.0 - required by `@supabase/supabase-js` on React Native (imported first in `lib/supabase.ts`)
- `expo-router` ~5.1.11 - screen/navigation structure, drives the entire `app/` directory layout

**Infrastructure:**
- `expo-linear-gradient` ~14.1.5, `react-native-svg` 15.11.2, `lucide-react-native` ^1.33.0 - UI/visual primitives
- `react-native-gesture-handler` ~2.24.0, `react-native-screens` ~4.11.1, `react-native-safe-area-context` 5.4.0 - native navigation/gesture plumbing required by Expo Router
- `expo-linking` ~7.1.7 - deep links and `Linking.openURL` (used for `mailto:`, `wa.me`, and lesson attachment/video URLs)
- `expo-constants` ~17.1.8 - present in dependencies but not currently referenced anywhere in `lib/`, `providers/`, or `app/` (checked via grep — no usages found)
- `@expo/metro-runtime` ~5.0.5 - required for Expo web + Metro fast refresh

## Configuration

**Environment:**
- Two environment variables drive the entire backend choice, read via `process.env` in `lib/supabase.ts`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Both variables are optional. `lib/supabase-config.ts` (`resolveSupabaseConfig`) treats a missing OR empty-string value as "not configured" (important: `expo export` turns a missing env var into an empty string, not `undefined`). If either is empty, the whole app falls back to on-device storage.
- `.env` (present, gitignored) holds real developer values; `.env.example` documents the two required keys with placeholder values.
- In CI (`.github/workflows/deploy.yml`), the same two values come from GitHub Actions repository secrets (`secrets.EXPO_PUBLIC_SUPABASE_URL`, `secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY`); the workflow explicitly fails the build if only one of the two is set (to avoid a silently half-configured deploy).
- No `.env` contents were read as part of this analysis (existence noted only, per policy).

**Build:**
- `app.json` - Expo app manifest: app name "Tennis App", slug `tennis-app`, scheme `tennisapp`, portrait-only, light UI style, `expo-router` plugin, web export configured with `experiments.baseUrl: "/tennis-app"` (the site is served from a GitHub Pages subpath, not domain root)
- `tsconfig.json` - extends `expo/tsconfig.base`, `strict: true`, `baseUrl: "."`
- `babel.config.js` - Expo preset only
- No `eas.json` present — this project does not appear to use EAS Build/Submit; native builds are not configured, only the web export path is wired up in CI

## Platform Requirements

**Development:**
- Node 20 (as used in CI; no enforced local version file)
- `npm install` then `npm run web` (or `npx expo start` for native/dev-client) per `README.md`
- Without `.env`, the app runs fully offline against local `AsyncStorage`/mock data — useful for working on a screen without a Supabase project or network

**Production:**
- Deployed as a static website to GitHub Pages via `.github/workflows/deploy.yml`, triggered on push to `main` (and manually via `workflow_dispatch`)
- CI pipeline: `npx tsc --noEmit` → `npm test -- --ci` → env-key sanity check → `npx expo export -p web` → copy `dist/index.html` to `dist/404.html` (SPA fallback) → `touch dist/.nojekyll` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- No native (iOS/Android) production distribution pipeline is present in this repo (no `eas.json`, no App Store/Play Store config)

---

*Stack analysis: 2026-09-05*
