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
3. Zet in **Authentication → Providers → Email** de optie **Confirm email** aan, en doe dat
   vóór je leden importeert. Een geïmporteerd lid bestaat al in de databank maar stelt zijn
   wachtwoord pas zelf in, op het loginscherm, met alleen zijn e-mailadres als sleutel. Staat
   de bevestiging uit, dan kan wie dat adres kent het account claimen vóór het lid er zelf is
   — bij "Account aanmaken" was dat al zo, maar na een import staan er in één keer vijftig
   adressen die te raden zijn. Staat de bevestiging aan, dan moet er eerst een mail aankomen
   op dat adres, en die krijgt alleen wie het echt bezit.
4. Haal in **Project Settings → API** de *Project URL* en de *anon public* key op.
   De service-role key heb je niet nodig en hoort nergens in deze app of repo.
5. Zet ze in `.env` (zie `.env.example`):

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

6. Start de app opnieuw. Je krijgt nu het inlogscherm met wachtwoord.
7. De eerste die zich aanmeldt, is nog een **speler** — dat is met opzet: een trainer geef
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

Zet ook **Site URL** en **Redirect URLs** goed (Authentication → URL Configuration). Het adres
van de website hoort in die lijst te staan, anders weigert Supabase de link uit een
herstelmail en komt je speler op een foutpagina. Dat is de meest gemaakte fout bij het
opzetten hiervan, en je merkt hem pas als iemand zijn wachtwoord kwijt is.

Reken bovendien niet op de ingebouwde mail van Supabase: die is streng gelimiteerd. Een club
met vijftig leden hoort onder Project Settings → Authentication → SMTP zijn eigen mailserver
in te stellen. Zonder werkende mail doen "Confirm email" en "Wachtwoord vergeten" allebei
niets zichtbaars.

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

## Thema en taal

Beheer → Instellingen heeft twee knoppen die de hele app raken. Ze gelden voor de club, niet
per gebruiker: ze staan in dezelfde `club_settings`-rij als de boekingseindtijd.

**Licht en donker.** Elk scherm schrijft `tennisColors.text`, en dat is op het web de tekst
`var(--tc-text)`. Wat die verwijzing betekent staat in `lib/theme-mode`, dat één attribuut op
`<html>` zet; de browser verft de rest. Er wordt dus niets opnieuw gerenderd om te wisselen, en
geen van de 600+ stijlregels in de app hoeft van thema's te weten. Een kleur bestaat in twee
rijen (`constants/tennis-colors`): één om mee te schríjven en één om mee te vúllen. Op donker
lopen die uiteen — tennisgroen is prima om mee te schrijven op wit en onleesbaar op bijna zwart,
terwijl het als vulling met witte tekst erop in beide thema's goed is.

**Nederlands en Engels.** De sleutel van een vertaling is de Nederlandse zin zelf, dus in de code
staat `t('Eindtijd reserveringen')`. Een vergeten vertaling valt daardoor terug op het Nederlands
in plaats van op een sleutel die niemand herkent. De Engelse kant staat in `lib/i18n-en`; een
scherm haalt `t` op met `useT()` uit `lib/i18n`, zodat React weet dat het opnieuw getekend moet
worden. Datums en maandnamen komen van de browser en volgen de taal mee.

Wat **niet** vertaald wordt, met opzet: alles wat de club zelf schrijft. Het lessenboekje, de
titels en beschrijvingen van lesmateriaal, notities, doelen, de namen van banen en spelers, en de
tags die uit die teksten gehaald worden.

## Nog te doen

- Herinneringen, annuleringsregels en facturen — zie `OPENSTAAND.md`
- Bestanden (PDF's, spraakmemo's) naar Supabase Storage in plaats van base64 in de opslag
- Tests op de schermen; alles wat er nu is, zit in `lib/`
- Donker thema op een telefoon-build: CSS-variabelen bestaan daar niet, dus daar
  staat het lichte palet vast (zie `constants/tennis-colors`)
