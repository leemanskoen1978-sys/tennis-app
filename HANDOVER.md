# Tennis App — Overzicht & Handover

Alles wat je moet weten om verder te werken aan deze app. Laatst bijgewerkt: 2026-08-19.

---

## 1. Wat is dit?

Een web-app (later ook mobiel) waarin **tennislessen geboekt en beheerd** worden.
Twee rollen:

- **Coach** — beheert agenda, betalingen, spelers, lessen en voortgang.
- **Speler** — boekt lessen, ziet eigen afspraken, lessen en voortgang.

De app draait op **twee mogelijke opslagen** en kiest zelf: staan de Supabase-sleutels in
`.env`, dan gaat alles naar de databank en log je in met e-mailadres en wachtwoord; staan ze
er niet, dan draait alles lokaal (AsyncStorage → localStorage op web) en kies je een profiel
uit een lijst. Die keuze valt op één plek: `providers/backend.ts`.

De webversie staat online op <https://leemanskoen1978-sys.github.io/tennis-app/>; elke push
naar `main` bouwt hem opnieuw (`.github/workflows/deploy.yml`).

---

## 2. Snel starten

```bash
cd "/Users/leko/Downloads/tennis app"
npm install          # eerste keer
npm run web          # start op http://localhost:8081 (of poort die Expo toont)
```

Inloggen = een profiel aantikken (geen wachtwoord):
- **Koen** = coach
- **Mathis** / **Test** = speler

Data blijft bewaard in je browser (localStorage). Reset alles via **Profiel → Noodopruiming**.

### Testen / kwaliteit
```bash
npm test                 # unit tests (slots, payments, seed) — 14 tests
npx tsc --noEmit         # typecheck (moet 0 errors geven)
```

---

## 3. Techniek & architectuur

| Laag | Keuze |
|------|-------|
| Framework | Expo SDK 53 + React Native + TypeScript |
| Routing | expo-router (file-based, map `app/`) |
| Web | React Native Web (`expo start --web`) |
| Opslag | **Supabase** met sleutels in `.env`, anders lokaal (`providers/mockStore.ts` → AsyncStorage). Keuze in `providers/backend.ts` |
| Inloggen | Supabase Auth (e-mail + wachtwoord), of profielkeuze zonder sleutels |
| Website | GitHub Pages, gebouwd door GitHub Actions bij elke push naar `main` |
| State | `SimpleDataProvider` (React Context) + hooks `useSimpleData`, `usePendingPaymentBookings` |
| Icons | `lucide-react-native` |
| Design | `constants/tennis-colors.ts` + `constants/theme.ts` (tokens) + gedeelde UI in `components/ui/` |

**Belangrijk:** schermen praten NOOIT rechtstreeks met de opslag. Ze gebruiken enkel
`useSimpleData()`. Precies daardoor kon de databank erbij komen zonder één scherm te
herschrijven.

---

## 4. Projectstructuur

```
app/
  _layout.tsx            # root: SimpleDataProvider + Stack (registreert player/[id], players)
  index.tsx              # redirect → hub of login
  login.tsx              # profielkeuze (geen echte auth)
  players.tsx            # spelerslijst (Beheer → Spelers) → dossier
  player/[id].tsx        # SPELER-DOSSIER (kop, lesdagen, lesplan, voortgang)
  (tabs)/
    _layout.tsx          # rol-afhankelijke tabbar
    index.tsx            # HUB "Wat wil je doen?" (+ Beheer-menu voor coach)
    home.tsx             # Reserveren (speler)
    bookings.tsx         # Afspraken (coach: tik speler → dossier)
    lessons.tsx          # Lessen (bibliotheek + toevoegen)
    progress.tsx         # Voortgang (form + recente activiteit + rapport per speler)
    reports.tsx          # Rapport (coach dashboard / speler-samenvatting)
    drawing.tsx          # Tekenen (tennisveld + objecten)
    profile.tsx          # Profiel + instellingen + noodopruiming
components/
  ui/                    # Screen, Button, Chip, Card, Badge, StudentCombobox (herbruikbaar)
  court/                 # TennisCourt (SVG-veld) + CourtIcons (kegel/speler/racket)
  progress/              # ProgressViews (gedeelde voortgang-weergaven: Stars, EntryCard, ReportSummary)
  BookingModal, PaymentStatusModal, UserManagement, CoachDashboard,
  LessonDetailModal, LessonAttachments, VoiceRecorder, SpeechToText
constants/               # tennis-colors, theme (spacing/radius/shadow/typography), app-config
lib/                     # types, slots, payments, seed (+ tests), supabase (klaar voor later)
providers/               # SimpleDataProvider (context), mockStore (opslag), session (ingelogde user)
docs/                    # deze handover-info + specs/plans + voice-memo-native.md + lesson-attachments.md
```

---

## 5. Datamodel (`lib/types.ts`)

- **User** — id, email, name, role (`player` | `coach` | `parent`), phone, bio, …
- **Court** — id, name, number, indoor, hourly_rate
- **Booking** — player_id, coach_id, court_id, start_time/end_time (ISO), status
  (`pending`/`confirmed`/`cancelled`/`completed`/`synchronized`), payment_status
  (`paid`/`unpaid`/`invoice`/`null`), notes, actual_start/end_time
- **Lesson** — title, url, description, uploaded_by, student_id, coach_id,
  **status** (`gepland`/`gegeven` — voor het lesplan), **attachments** (PDF's)
- **StudentProgress** — student_id, coach_id, training_type
  (techniek/tactiek/fysiek/mentaal/match), rating, notes, homework, voice_memo_uri,
  **lesson_id** (koppeling met een les), created_at
- **Settings** — booking_end_time, theme, language, notifications, blocked_popups_until
- **LessonAttachment** — id, name, mime, size, source (`local`/`drive`), uri, drive_file_id

---

## 6. Datalaag (lokaal of Supabase)

**`providers/SimpleDataProvider.tsx`** stelt beschikbaar via `useSimpleData()`:
- data: `users, courts, bookings, lessons, progress, settings, currentUser, loading, error`
- acties: `login, logout, refresh, addBooking, updateBooking, deleteBooking,
  addUser, addLesson, updateLesson, deleteLesson, addProgress, saveSettings,
  emergencyCleanup, clearError`
- `usePendingPaymentBookings()` → afgeleide lijst van te verwerken betalingen.

**`providers/mockStore.ts`** = de opslag: seedt bij eerste start, bewaart in localStorage,
verwijdert nooit automatisch corrupte data (alleen `resetStore` via noodopruiming).

**`providers/backend.ts`** kiest tussen die lokale opslag en Supabase, en is het enige
bestand dat het verschil kent. **`providers/supabaseStore.ts`** doet het werk aan de
databankkant: in één keer inlezen wat deze gebruiker mag zien, en bij het opslaan uitrekenen
wélke rijen er veranderd zijn. Dat rekenwerk staat in **`lib/sync.ts`** en is getest zonder
databank — elke actie blijft dus gewoon de hele nieuwe toestand doorgeven, en dat is de reden
dat een beurt afboeken en de les op factuur zetten niet half kunnen slagen.

**`supabase-schema.sql`** bevat de tabellen, de koppeling login ↔ gebruiker en de RLS-regels.
Die regels zijn strikt: ze staan in de databank en niet alleen in de schermen. Zie README
voor het aankoppelen stap voor stap.

---

## 7. Features per scherm

- **Hub (Start)** — begroeting + actiekaarten per rol. Coach heeft een **Beheer**-knop
  (menu: Openstaande betalingen · Spelers · Speler toevoegen · Les toevoegen).
- **Reserveren** (speler) — coach kiezen (verplicht vóór boeken), datumstrip (vandaag
  geblokkeerd), tijdsloten 9:00→instelbare eindtijd, bezette slots geblokkeerd.
- **Afspraken** — lijst met status/betaalstatus, annuleren. Coach: **tik op speler → dossier**.
- **Lessen** — bibliotheek; klik op een les opent **detail** (bekijken/bewerken/verwijderen,
  video openen, PDF-bijlagen). "Voor wie" is een **autocomplete-combobox**.
- **Voortgang** — form (combobox-speler, inline "speler toevoegen", type, rating,
  notities, huiswerk, **web-spraakmemo**), **"Waar je mee bezig bent"** (recente activiteit),
  **"Rapport per speler"** (samenvatting + tijdlijn, "Open dossier").
- **Rapport** — coach: dashboard (titel boven acties, inkomsten, openstaand) + uitsplitsing;
  speler: eigen samenvatting.
- **Tekenen** — echt clay-tennisveld (correcte lijnen), **verticaal/horizontaal** togglen,
  objecten **kegel/speler/racket** plaatsen (tik) en **verslepen**, vrij tekenen, ongedaan/wissen.
- **Profiel** — instellingen (eindtijd boeken, thema, taal), uitloggen, **noodopruiming**
  (met bevestiging; reset alles naar begintoestand).
- **Speler-dossier** (`player/[id]`) — kop, **Lesdagen** (aankomend/geweest), **Lesplan**
  (Doelen/Te doen ↔ Gegeven, met toggle + les toewijzen), **Voortgang** (form met
  les-koppeling + rapport). Bereikbaar via Afspraken, Voortgang-rapport, Beheer→Spelers.

---

## 8. Bedrijfsregels (bewaakt in de code)

- Gebruikers persistent: seed (Koen/Mathis/Test) alleen bij eerste, lege opslag.
- Boeken niet op de dag zelf; slots 9:00 → `booking_end_time`.
- Een speler moet een **specifieke coach** kiezen vóór het boeken (geen stille default meer).
- Dubbele boeking bij dezelfde coach/tijd wordt geweigerd (`addBooking`-guard).
- Betalingen: één voor één (cash/factuur/onbetaald/verwijderen), **geen bulk**.
  **Geen** automatische popup meer — betalingen via Beheer/Rapport.
- Geen automatische data-opruiming; enkel handmatige noodopruiming met bevestiging.
- Omzet telt alleen `paid` én niet-geannuleerde boekingen.

---

## 9. Bekende aandachtspunten / gotchas

- **Twee manieren van inloggen**: met sleutels is het Supabase Auth (e-mail + wachtwoord,
  strikte RLS); zonder sleutels blijft het profielkeuze zonder wachtwoord, en dan is er dus
  geen enkele grens — die opzet is voor demo's en voor het werken aan een scherm.
- **De eerste die zich aanmeldt is een speler.** De rol van trainer geef je bewust, met een
  `update users set role = 'coach'` in Supabase. Zie README.
- **localStorage-limieten**: spraakmemo's en PDF-bijlagen worden als base64 data-URL
  opgeslagen. Limiet ~5 MB totaal; PDF's zijn gecapt op **2 MB/bestand**. Voor echt
  gebruik → uploaden naar Supabase Storage / Google Drive en enkel de URL bewaren.
- **Native placeholders**: agenda-import (expo-calendar), spraakopname (expo-av),
  spraak-naar-tekst, en PDF-picker (expo-document-picker) werken **alleen op web** of zijn
  placeholders. Native aanpak staat in `docs/voice-memo-native.md` en `docs/lesson-attachments.md`.
- **`parent`-rol** bestaat in het type maar heeft nog geen koppeling kind↔ouder.
  Bedoeld voor later (eindrapport voor ouder).
- **Build-details**: `jest-expo` is gepind op `~53.0.0` (SDK 53). Er is een `global.d.ts`
  die de `JSX`-namespace naar `React.JSX` mapt (React 19). Niet weghalen.
- **Geen popup-blokkering actief**: `settings.blocked_popups_until` wordt nog niet geschreven.

---

## 10. Wat is af / wat nog niet

**Af (werkt in de webtest):**
- Volledige UI/flows voor coach & speler, hub, dossier, lesplan, voortgang-rapport
- Mock-databank met persistentie; lessen bewerken/verwijderen; PDF-bijlagen (web)
- Web-spraakmemo; tekenveld met objecten en oriëntatie
- Design-systeem + toegankelijkheid-basis; tsc schoon; 14 unit-tests groen

**Nog te doen (bewuste keuzes):**
1. **Agenda-import** (expo-calendar), **native spraakopname** (expo-av), **native PDF-picker**.
2. **Bestanden echt online** bewaren (Supabase Storage / Drive) i.p.v. base64 in de opslag.
3. **Ouder-toegang**: kind↔ouder koppelen, eindrapport voor ouder.
4. **Lesplan uitbreiden**: volgorde/doelen met streefdatum, voortgang per doel.

---

## 11. Werkwijze / historiek

- Ontwerp: `docs/superpowers/specs/2026-08-19-tennis-booking-app-design.md`
- Plan: `docs/superpowers/plans/2026-08-19-tennis-booking-app.md`
- Alles zit in git (deze map is een eigen repo). `git log --oneline` toont de opbouw:
  foundation → alle schermen → council-verbeteringen → tekenveld → hub/beheer →
  lessen/voortgang → speler-dossier.
- Verificatie gebeurt telkens met `tsc`, `jest` en een headless browser-smoketest
  (Playwright) — streef naar **0 console-errors**.

---

## 12. Handige commando's

```bash
npm run web                 # app starten (web)
npm test                    # unit tests
npx tsc --noEmit            # typecheck
git log --oneline | head    # historiek
grep -rn "TODO\|placeholder" app components   # openstaande punten zoeken
```
