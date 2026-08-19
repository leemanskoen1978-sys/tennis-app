# Tennis Coach & Player Booking App — Ontwerp (spec)

**Datum:** 2026-08-19
**Project:** Tennisclub Racso — les-boekings- en beheerapp
**Status:** goedgekeurd ontwerp, klaar voor implementatieplan

## 1. Doel

Een app waarin tennislessen worden geboekt en beheerd, met twee hoofdrollen:

- **Coaches** beheren hun agenda, betalingen en de voortgang van spelers.
- **Spelers** boeken lessen bij een coach naar keuze.

De app wordt gebouwd als **website** en eerst **lokaal getest** (`expo start --web`). De
codebasis blijft React Native zodat later ook naar iOS/Android gebouwd kan worden.

## 2. Scope van deze bouw

**In scope (deze iteratie):**

- Volledige app: 7 tabs + login.
- Online databank via **Supabase (Postgres)**, direct benaderd met `@supabase/supabase-js`
  (geen eigen backend).
- Alle bedrijfsregels uit §7.

**Bewust overgeslagen (latere iteratie):**

- `expo-calendar` — agenda-import van de telefoon (werkt niet in browser). De knop toont
  op web een placeholder "binnenkort / alleen mobiel".
- `expo-av` — spraakopname (`VoiceRecorder`) en `SpeechToText`. Op web als placeholder-stub.
- `expo-haptics` — geen effect op web; geen-op op web, actief op native.
- **Supabase Auth + strikte RLS** — voor de lokale test staat RLS permissief; echte auth is
  een latere hardening-stap.

## 3. Techniek

| Laag | Keuze |
|------|-------|
| Framework | Expo SDK 53 + React Native + TypeScript |
| Routing | expo-router (file-based) |
| Web-target | React Native Web (`expo start --web`) |
| Databank | Supabase (Postgres) via `@supabase/supabase-js` |
| State | `SimpleDataProvider` (React Context) + hooks `useSimpleData`, `usePendingPaymentBookings` |
| Icons | `lucide-react-native` |
| Kleuren | `constants/tennis-colors.ts` (tennisgroen als primary) |
| UI-extra | `expo-linear-gradient` |
| Config | `.env` met `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (+ `.env.example`) |

### Datalaag

`SimpleDataProvider` praat rechtstreeks met Supabase:

- **Laden:** bij mount worden users, courts, bookings, lessons, student_progress en settings
  opgehaald en in context gezet.
- **Schrijven:** create/update/delete gaan direct naar Supabase; na succes wordt de lokale
  context bijgewerkt (optimistic of refetch).
- **Hooks:**
  - `useSimpleData()` — geeft alle data + actie-functies.
  - `usePendingPaymentBookings()` — afgeleide lijst: bookings met
    `status ∈ {confirmed, completed, synchronized}` én `payment_status == null`.
- **Ingelogde gebruiker:** de gekozen gebruiker-id wordt lokaal onthouden
  (AsyncStorage/localStorage) zodat de sessie na refresh behouden blijft. Dit is de enige
  lokale opslag; alle domeindata leeft in Supabase.

## 4. Datamodel (TypeScript-interfaces)

```ts
type Role = 'player' | 'coach' | 'parent';
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'synchronized';
type PaymentStatus = 'paid' | 'unpaid' | 'invoice' | null;
type TrainingType = 'techniek' | 'tactiek' | 'fysiek' | 'mentaal' | 'match';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  bio?: string;
  preferred_court_id?: string;
  working_hours?: { start: string; end: string };   // bv. { start: '09:00', end: '21:00' }
  working_days?: number[];                            // 0-6
  notification_settings?: Record<string, boolean>;
}

interface Court {
  id: string;
  name: string;
  number: number;
  indoor: boolean;
  hourly_rate: number;
}

interface Booking {
  id: string;
  player_id: string;
  coach_id: string;
  court_id: string;
  start_time: string;        // ISO
  end_time: string;          // ISO
  status: BookingStatus;
  payment_status: PaymentStatus;
  notes?: string;
  actual_start_time?: string; // voor niet-ronde uren uit agenda-import
  actual_end_time?: string;
}

interface Lesson {
  id: string;
  title: string;
  url?: string;
  description?: string;
  uploaded_by: string;
  student_id?: string;
  coach_id?: string;
}

interface StudentProgress {
  id: string;
  student_id: string;
  coach_id: string;
  training_type: TrainingType;
  notes?: string;
  rating?: number;              // 1-5
  skills?: Record<string, number>;
  homework?: string;
  voice_memo_uri?: string;      // placeholder op web
}

interface Settings {
  booking_end_time: string;     // instelbare eindtijd voor slots, default '21:00'
  theme?: 'light' | 'dark';
  language?: 'nl' | 'en';
  notifications?: Record<string, boolean>;
  blocked_popups_until?: string | null;
}
```

## 5. Supabase-schema (SQL-migratie)

Levering: `supabase-schema.sql`, uit te voeren in de Supabase SQL-editor.

Tabellen (snake_case, UUID-PK's, FK's naar `users`/`courts`):

- **`users`** — id, email (unique), name, role, phone, bio, preferred_court_id,
  working_hours (jsonb), working_days (jsonb), notification_settings (jsonb), created_at.
- **`courts`** — id, name, number, indoor (bool), hourly_rate (numeric).
- **`bookings`** — id, player_id→users, coach_id→users, court_id→courts, start_time (timestamptz),
  end_time, status (check-constraint), payment_status (nullable, check), notes,
  actual_start_time, actual_end_time, created_at.
- **`lessons`** — id, title, url, description, uploaded_by→users, student_id→users,
  coach_id→users, created_at.
- **`student_progress`** — id, student_id→users, coach_id→users, training_type (check),
  notes, rating (int), skills (jsonb), homework, voice_memo_uri, created_at.
- **`settings`** — één rij per gebruiker (`user_id→users` unique) met een `value` (jsonb),
  of een globale rij; wordt via de app gelezen/geschreven.

**Seed-blok:** voegt alleen in als de tabellen leeg zijn (idempotent):
- Users: **Koen** (coach), **Mathis** (player), **Test** (player).
- Courts: minstens 1 baan met uurloon.
- Default settings (`booking_end_time = '21:00'`).

**RLS:** aangezet met een permissieve policy voor de lokale test (later te verstrengen).

## 6. Schermen (7 tabs + login)

Bestandsstructuur:

```
app/
  login.tsx
  (tabs)/
    _layout.tsx
    index.tsx        // home — reserveren
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
  VoiceRecorder.tsx      // web-placeholder
  SpeechToText.tsx       // web-placeholder
  CoachDashboard.tsx
constants/
  tennis-colors.ts
lib/
  supabase.ts            // client
providers/
  SimpleDataProvider.tsx
```

1. **login** — lokale gebruikerslijst uit `users`; tik om in te loggen (geen echte auth).
2. **home (reserveren)** — coach-filter ("Alle coaches" of één coach); tijdsloten
   9:00 → `booking_end_time`; **vandaag geblokkeerd**; `BookingModal` om te bevestigen.
   Refresh-knop herlaadt de agenda van de gekozen coach.
3. **bookings** — lijst met status + betaalstatus; annuleren.
4. **lessons** — lesmateriaal (titel/url/beschrijving), koppelbaar aan speler.
5. **progress** — `StudentProgress`: trainingstype, rating, skills, huiswerk, notities;
   voice-memo als placeholder.
6. **reports** — inkomstenoverzicht en overzichten voor de coach.
7. **drawing** — courtsituaties tekenen op een canvas (werkt op web).
8. **profile** — profiel + settings (werkuren, eindtijd boeken, thema, taal).

**Rolgedrag:**
- **coach** → ziet `CoachDashboard` (titel boven actieknoppen, inkomstenoverzicht, pending
  betalingen), `PaymentStatusModal`, en `UserManagement` (spelers toevoegen).
- **speler** → boekt lessen en ziet eigen afspraken.

## 7. Bedrijfsregels

- **Persistente gebruikers:** seed (Koen, Mathis, Test) alleen bij eerste, lege databank.
  Later toegevoegde gebruikers blijven altijd bewaard. Coaches voegen spelers toe via
  `UserManagement`.
- **Boekingsregels:** niet boeken op de dag zelf (vandaag geblokkeerd); slots van 9:00 tot de
  instelbare `booking_end_time`.
- **Coach-filter:** een speler kiest "Alle coaches" of één coach; de planning toont de agenda
  van die coach (niet die van de speler zelf), met refresh-knop.
- **Agenda-import (later):** leest events van begin huidige maand tot 2 weken vooruit;
  niet-ronde uren worden aparte afspraken met status `synchronized`. **Nu placeholder.**
- **Betalingen:** `PaymentStatusModal` verschijnt automatisch als er afspraken met status
  confirmed/completed/synchronized zijn zonder `payment_status`. Per afspraak te verwerken als
  **cash / factuur / onbetaald / verwijderen** — één voor één, **geen bulk**.
- **Geen automatische data-opruiming:** corrupte data wordt nooit automatisch verwijderd; er is
  alleen een handmatige **"emergency cleanup"**-knop die expliciet om bevestiging vraagt.
- **Coach dashboard:** titel boven de actieknoppen, inkomstenoverzicht en pending betalingen.

## 8. Foutafhandeling

- Supabase-fouten (netwerk/permissie) worden opgevangen en tonen een nette melding; de app
  crasht niet. Schrijfacties die falen rollen de optimistic update terug.
- Ontbrekende/lege data → lege staten met duidelijke boodschap, nooit een crash.
- Geen automatische opruiming bij parse-/leesfouten (zie §7).

## 9. Testen (lokaal)

- `expo start --web` draait de app in de browser.
- Handmatige verificatie van de kernflows: inloggen, boeken (vandaag geblokkeerd, slots),
  betaalmodal, coach-dashboard, gebruikers toevoegen, tekenen, rapportage.
- Supabase-project met het schema uit §5; keys in `.env`.

## 10. Later (niet in deze bouw)

- Agenda-import (`expo-calendar`), spraakopname (`expo-av`), haptics.
- Supabase Auth + strikte RLS-policies.
- Native builds (iOS/Android).
