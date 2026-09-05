# Tennis app — Tennisschool-module

## What This Is

Een Expo/React-Native-app (web + telefoon) op Supabase waarmee een tennisclub zijn lessen,
spelers, banen en geld beheert. Wat er nu bij komt is de **tennisschool-module**: één plek
waar de beheerder de lessen van *alle* trainers samen ziet en beheert, in plaats van per
trainer één agenda. Ziekte opvangen, een seizoen aan trainingen in één keer inladen, en er
op elk moment een Excel uit halen die klopt.

## Core Value

Als een trainer ziek is, moet de beheerder binnen een minuut zien welke lessen dat raakt en
er een vervanger aan hangen die dat uur écht kan — zonder in vijf agenda's te gaan zoeken.

## Requirements

### Validated

<!-- Wat de app vandaag al doet en waar de club op draait. Afgeleid uit .planning/codebase/. -->

- ✓ Lessen boeken, wijzigen, afzeggen en afvinken per trainer — bestaand (`bookings`, `app/agenda/`)
- ✓ Groepslessen als één boeking met medespelers (`Booking.participant_ids`, `lib/groups.ts`) — bestaand
- ✓ Herhalende lessen als losse boekingen met gedeeld `series_id` (`lib/recurrence.ts`, `lib/series.ts`) — bestaand
- ✓ Beschikbaarheid per trainer: eigen uren en afwijkende periodes (`users.booking_periods`, `lib/boekingstijd.ts`) — bestaand
- ✓ Clubbrede vakantiekalender (`club_settings.vakanties`, `lib/vakanties.ts`) — bestaand
- ✓ Aanwezigheid per les (`bookings.attendance`, `lib/aanwezigheid.ts`) — bestaand
- ✓ Betalingen, omzet en trainersloon met vaste regels (`lib/payments.ts`, `lib/reports.ts`, `coach_rates`) — bestaand
- ✓ Ledenlijst importeren uit Excel met droogloop vooraf (`lib/import-leden.ts`, `app/admin/leden-import.tsx`) — bestaand
- ✓ Eigen xlsx-schrijver zonder pakket (`lib/xlsx.ts`) — bestaand
- ✓ Beheerder als vinkje, niet als rol (`users.is_admin`, `lib/rechten.ts`, RLS in `supabase-schema.sql`) — bestaand

### Active

<!-- De zes punten van deze module. Hypothesen tot ze opgeleverd en bevestigd zijn. -->

- [ ] **Lesgroepen** als blijvend gegeven naast de losse boekingen: naam, niveau, dag/uur,
      vaste trainer, seizoen, de spelers erin. Een wijziging werkt door in alle lessen
      vanaf vandaag; wat geweest is blijft staan.
- [ ] **Wie de les écht gaf** wordt vastgelegd naast de vaste trainer, zodat de loonstaat
      klopt na een vervanging.
- [ ] **Ziekmelding** van een trainer over een periode zet alle geraakte lessen in één
      werklijst, met per les de keuze: vervanger koppelen, laten staan, of afzeggen.
- [ ] **Vervangersvoorstel** toont alleen collega's die dat uur werkelijk kunnen: geen eigen
      boeking, binnen hun boekingstijden, niet in een afwijkende periode of vakantie.
- [ ] **Trainingen importeren uit Excel** volgens een sjabloon van de app: groepen aanmaken,
      onbekende spelers aanmaken, de reeks lessen inplannen met de vakanties eruit, en bij
      herimport bijwerken in plaats van verdubbelen. Droogloop vóór er iets wegschrijft.
- [ ] **Excel-export van een periode** met vier bladen: lessenlijst, uren per trainer,
      aanwezigheidslijst per groep, en groepsoverzicht.

### Out of Scope

- Clubbreed weekraster over alle trainers — waardevol, maar een eigen brok werk; eerst deze zes.
- Automatisch verwittigen van spelers en ouders bij een wijziging — de app maakt geen mail
  of bericht; `lib/contact.ts` opent hooguit de mail-app. Later.
- Inhaallessen, wachtlijsten en inschrijvingen — nieuw domein, niet nodig om ziekte op te vangen.
- Controlelijst vóór het seizoen (dubbele banen, lessen in vakantie) — komt er logisch bij,
  maar pas als groepen en import staan.
- Toegang voor gewone trainers tot deze module — de module is voor de beheerder. Een trainer
  houdt zijn eigen agenda. Beperkt de rechtenvragen tot wat `magInElkeAgenda` al regelt.
- Een apart Supabase-testproject opzetten — de gebruiker draait de migraties zelf, met de hand.

## Context

**Waar dit op voortbouwt.** De volledige codebase-map staat in `.planning/codebase/`. Kort:

- `lib/` bevat pure regelmodules zonder store of scherm, elk met een testbestand ernaast
  (985 tests). `providers/` doet de opslag (`SimpleDataProvider` met `supabaseStore` of
  `mockStore`). `lib/` importeert nooit uit `providers/`, `components/` of `app/`.
- Een les is een rij in `bookings`. Die tabel doet veel tegelijk: les, lesaanvraag, betaling
  en aanwezigheid. Zie `.planning/codebase/CONCERNS.md` — de module hangt er nieuwe
  begrippen aan en moet dat niet erger maken.
- Elke rechtenregel in `lib/rechten.ts` heeft zijn tegenhanger in een RLS-policy of trigger
  in `supabase-schema.sql`. De app is niet de bewaker; de databank is dat.
- Commentaar en identifiers zijn Nederlands, en het commentaar legt uit *waarom* iets zo is —
  vaak met de fout erbij die het voorkomt. Nieuwe code hoort daarbij te passen.

**Wat er al aan bestanden ligt.** `koen.xlsx` en `KDT tennisplanning U9 eindversie.pdf` in de
projectmap zijn echte planningen van de club; bruikbaar als ijkpunt bij het ontwerpen van
het importsjabloon, ook al bepaalt de app het formaat.

**Bekende valkuilen.** De dev-server praat met de échte productiedatabank van de club: testen
op localhost wijzigt live gegevens. Er is geen testdekking op de schermlaag en geen op de
RLS-laag. De upsert-versus-insert-policy-val heeft al twee keer toegeslagen.

## Constraints

- **Tech stack**: Expo ~53 / React Native 0.79 / expo-router / Supabase. TypeScript `strict`.
  Geen nieuwe zware afhankelijkheden — de xlsx-schrijver is met opzet zelfgeschreven.
- **Taal**: Nederlands in code, commentaar en scherm; `t()` uit `lib/i18n.ts` voor teksten,
  met de Nederlandse zin als sleutel en `lib/i18n-en.ts` voor Engels.
- **Testen**: elke nieuwe regelmodule in `lib/` krijgt een `lib/*.test.ts` ernaast. Geen
  `jest.mock` — logica wordt puur en parameter-gestuurd gemaakt in plaats van gemockt.
- **Oplevering**: `npx tsc --noEmit`, `npm test` en `npx expo export --platform web` horen
  bij elke oplevering (zie `OPENSTAAND.md`).
- **Database**: schemawijzigingen komen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`, plus de bijhorende RLS-policies. De gebruiker draait ze zelf in de
  Supabase SQL-editor. Nooit ongevraagd op productie toepassen.
- **Geld**: de regels in `OPENSTAAND.md` over betaalwijze, prijs, loon en omzet liggen vast
  en mogen niet verschuiven. Elke wijziging van een betaalwijze blijft via `planMethodChange`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lesgroepen als eigen tabel, niet als veld op `bookings` | Een groep bestaat los van één les: hij heeft een naam, een niveau en een seizoen, en overleeft het verzetten of schrappen van een losse les. Zonder dit blijft import, export en vervangen rijenwerk. | — Pending |
| Een les blijft een rij in `bookings`, met een verwijzing naar zijn groep | De hele app rekent op `bookings` (agenda, betalingen, afvinken, omzet). Een tweede soort les ernaast zou al die code splijten. | — Pending |
| Groepswijziging werkt vanaf vandaag vooruit | Zelfde regel als `seriesFrom`: wat geweest is, is geschiedenis en verandert niet omdat de groep vandaag anders wordt. Eén regel voor twee begrippen. | — Pending |
| Vervanger krijgt zijn eigen uurtarief | Het loon hoort bij wie het werk deed. `coach_rates` staat al per persoon; er is geen tweede tariefbegrip nodig. | — Pending |
| Vervanging als apart veld, niet door `coach_id` te overschrijven | Overschrijven verliest wie er oorspronkelijk stond, en dan klopt noch het rooster noch de loonstaat. | — Pending |
| Import bepaalt zelf het sjabloon en toont een droogloop | Precies het patroon van `lib/import-leden.ts`, dat zich bewezen heeft: eerst het plan tonen, dan pas wegschrijven. | — Pending |
| De module is voor de beheerder alleen | `magInElkeAgenda` regelt dit al en het houdt de RLS-vragen klein. Een trainer die zich wil ziekmelden kan dat later krijgen. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-05 after initialization*
