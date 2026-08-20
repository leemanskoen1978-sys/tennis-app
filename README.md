# Tennisclub Racso — Booking App

Expo (SDK 53) + React Native Web + TypeScript. Trainers beheren agenda, betalingen,
lesmateriaal en voortgang; spelers vragen lessen aan en volgen hun eigen dossier.

De app draait op twee mogelijke opslagen, en kiest zelf:

| | Zonder sleutels in `.env` | Met sleutels in `.env` |
|---|---|---|
| Waar staat het | opslag van dit toestel (AsyncStorage) | Supabase |
| Inloggen | profiel kiezen uit een lijst | e-mailadres + wachtwoord |
| Samen werken | nee, één toestel | ja |

Die keuze valt op één plek: `providers/backend.ts`. Geen enkel scherm weet welke van de
twee eronder zit.

## Lokaal draaien (web)

```bash
npm install
npm run web
```

Open de URL die Expo toont (bv. http://localhost:8081). Zonder `.env` kies je een profiel:
**Koen** is trainer, **Mathis** en **Test** zijn spelers.

## Testen

```bash
npm test              # unit tests (alles in lib/)
npx tsc --noEmit      # typecheck
```

## Supabase aankoppelen

1. Maak een project op [supabase.com](https://supabase.com) (gratis plan volstaat).
2. Open **SQL Editor → New query**, plak de volledige inhoud van `supabase-schema.sql`
   en klik **Run**. Het script mag je later opnieuw draaien; het is idempotent.
3. Haal in **Project Settings → API** de *Project URL* en de *anon public* key op.
   De service-role key heb je niet nodig en hoort nergens in deze app of repo.
4. Zet ze in `.env` (zie `.env.example`):

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

5. Start de app opnieuw. Je krijgt nu het inlogscherm met wachtwoord.
6. De eerste die zich aanmeldt, is nog een **speler** — dat is met opzet: een trainer geef
   je bewust die rol. Zet die ene rij in Supabase om:

   ```sql
   update users set role = 'coach' where email = 'jouw@adres.be';
   ```

   Log daarna opnieuw in. Die trainer brengt bij zijn eerste start het lessenboekje (de 51
   U9-trainingen) mee naar de databank.

Voegt een trainer een speler toe die nog nooit ingelogd heeft, dan bestaat die speler al
mét lessen en dossier. Meldt die speler zich later aan met hetzelfde e-mailadres, dan
koppelt de databank zijn account aan die bestaande rij.

De anon key staat in de webbundel en dat hoort zo: hij geeft alleen toegang tot wat Row
Level Security toelaat. Die regels staan in `supabase-schema.sql` — een trainer beheert
zijn eigen agenda, een speler ziet en doet alleen wat van hemzelf is.

## Online zetten

Elke push naar `main` bouwt de webversie en zet hem op GitHub Pages
(`.github/workflows/deploy.yml`). De workflow draait eerst `tsc` en de tests; is er iets
rood, dan blijft de vorige versie staan.

Eenmalig instellen op GitHub:

- **Settings → Pages → Source: GitHub Actions**
- **Settings → Secrets and variables → Actions → New repository secret**, twee keer:
  `EXPO_PUBLIC_SUPABASE_URL` en `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Zonder die twee bouwt de
  site wél, maar draait hij op de opslag van de browser in plaats van op de databank.

De site staat in een submap (`/tennis-app/`); dat is de `baseUrl` in `app.json`. Verandert
de naam van de repo, dan verandert die mee.

## Nog te doen

- Herinneringen, annuleringsregels en facturen — zie `OPENSTAAND.md`
- Bestanden (PDF's, spraakmemo's) naar Supabase Storage in plaats van base64 in de opslag
- Tests op de schermen; alles wat er nu is, zit in `lib/`
