# Tennisclub Racso — Booking App

Expo (SDK 53) + React Native Web + TypeScript. Coaches beheren agenda, betalingen
en voortgang; spelers boeken lessen. Draait nu volledig op een **in-memory mock**
(localStorage) — geen databank nodig. Supabase is voorbereid voor later.

## Lokaal draaien (web)

```bash
npm install
npm run web
```

Open de URL die Expo toont (bv. http://localhost:8081). Kies een profiel:
- **Koen** = coach (dashboard, betalingen, spelers toevoegen, voortgang)
- **Mathis / Test** = spelers (lessen boeken)

## Testen

```bash
npm test              # unit tests (slots, betalingen, seed)
npx tsc --noEmit      # typecheck
```

## Wat werkt

- Login (profielkeuze), 7 tabs: Reserveren, Afspraken, Lessen, Voortgang, Rapport, Tekenen, Profiel
- Boeken: coach-filter, tijdsloten 9:00–instelbare eindtijd, vandaag geblokkeerd
- Betalingen: auto-popup voor coach (cash/factuur/onbetaald/verwijderen, één voor één)
- Coach-dashboard: titel boven acties, inkomsten, openstaande betalingen
- Tekenen: courtsituaties op canvas
- Profiel/instellingen + noodopruiming (met bevestiging)

## Nog te doen (bewust overgeslagen)

- Echte databank: Supabase aankoppelen (`lib/supabase.ts`, `supabase-schema.sql` staan klaar)
- Agenda-import (`expo-calendar`) en spraakopname (`expo-av`) — nu placeholders op web
- Supabase Auth + strikte RLS
