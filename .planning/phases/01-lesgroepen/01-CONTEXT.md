# Phase 1: Lesgroepen - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Source:** Beslissingen uit het openingsgesprek met de gebruiker (geen aparte discuss-phase gedraaid — alles hieronder is expliciet beantwoord).

<domain>
## Phase Boundary

De beheerder beheert lesgroepen als eigen, blijvend gegeven — los van individuele lessen —
bereikbaar vanuit Beheer en enkel zichtbaar voor de beheerder.

Wat er NIET in deze fase zit: vervanging en ziekmelding (fase 2 en 3), Excel-export (fase 4),
Excel-import (fase 5). De import leunt zwaar op wat hier gebouwd wordt, maar bouwt zelf geen
groepsmodel — dat komt hier vandaan.

</domain>

<decisions>
## Implementation Decisions

### Het groepsmodel

- **D-01:** Een lesgroep is een eigen tabel, geen veld op `bookings`. Een groep bestaat los van
  één les: hij heeft een naam, een niveau en een seizoen, en overleeft het verzetten of
  schrappen van een losse les.
- **D-02:** Een les blijft een rij in `bookings`, met een verwijzing naar zijn groep. De hele
  app rekent op `bookings` (agenda, betalingen, afvinken, omzet); een tweede soort les ernaast
  zou al die code splijten. Een les uit een groep moet te verzetten, af te zeggen en af te
  vinken zijn als elke andere les.
- **D-03:** Een groep heeft één vast moment: dag + beginuur. Een club die dezelfde mensen twee
  keer per week laat trainen, krijgt twee groepen. Dit volgt uit de sleutel die fase 5
  gebruikt (`Groep` + weekdag + beginuur) — zie `.planning/IMPORT-SJABLOON.md`, met het bewijs
  uit de echte seizoensplanning erbij.
- **D-04:** Een groep heeft een seizoensperiode (van–tot) en is archiveerbaar aan het einde
  daarvan, zonder de gegeven lessen of hun geschiedenis te raken.
- **D-05:** De lesduur is 60 minuten, als clubinstelling in `club_settings` — niet
  hardgecodeerd en niet per groep. Een wijziging geldt voor nieuw ingeplande lessen en nooit
  met terugwerkende kracht.

### Wijzigen en geschiedenis

- **D-06:** Een wijziging aan een groep (speler erbij of eraf, ander uur, andere trainer) werkt
  door in alle lessen van vandaag en later. Lessen die al geweest zijn blijven staan zoals ze
  waren. Dit is dezelfde regel als `seriesFrom` in `lib/series.ts` — één regel voor twee
  begrippen, en die regel hoort in `lib/` te staan met een test eromheen.
- **D-07:** Elke les houdt zijn eigen deelnemerslijst op het moment van de les
  (`Booking.participant_ids` blijft leidend voor die ene les). De groep is "het roster van nu";
  de boeking is "wie er die dag bij stond". Zonder dit verandert de groepsprijs en de
  aanwezigheid van een oude les zodra iemand vandaag de groep aanpast.
- **D-08:** De groep is nooit een tweede waarheid over een reeds ingeplande les. Bij elke
  vraag over een les die al bestaat, wint de boeking.

### Toegang

- **D-09:** De hele tennisschool-module is voor de beheerder alleen (`users.is_admin`). Een
  gewone trainer houdt zijn eigen agenda en ziet deze schermen niet. Dat houdt de rechtenvragen
  klein: `magInElkeAgenda` in `lib/rechten.ts` regelt dit al.
- **D-10:** Elke nieuwe tabel krijgt admin-only RLS-policies, van meet af aan zo geschreven —
  niet met eigenaarschapscontroles die later moeten worden bijgesteld. De upsert-weg wordt met
  de hand nagelopen: die val heeft dit project al twee keer geraakt en noch `tsc` noch de
  testsuite ziet hem.
- **D-11:** Schemawijzigingen komen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`, met de policies erbij. **De gebruiker draait ze zelf** in de Supabase
  SQL-editor. Geen enkele taak mag aannemen dat de migratie al toegepast is, en niets in deze
  fase mag ongevraagd de productiedatabank aanraken.

### Claude's Discretion

De gebruiker heeft expliciet gezegd dat ik het formaat en de vormgeving bepaal. Vrij in te
vullen bij het plannen:
- De precieze tabel- en kolomnamen, en of het roster een `jsonb`-lijst op de groep is of een
  koppeltabel.
- De schermindeling: lijst van groepen, detail per groep, hoe spelers toegevoegd worden.
  `components/ParticipantPicker.tsx` en `components/LidBewerken.tsx` bestaan al.
- Waar de tegel in `app/admin/index.tsx` komt te staan en onder welke groep ("Club" ligt voor
  de hand).
- Of het inplannen van de lessen van een groep in deze fase al meekomt of pas bij de import.

</decisions>

<specifics>
## Specific Ideas

- De club telt een handvol trainers en enkele tientallen groepen per seizoen. Schaal is geen
  probleem; overzichtelijkheid wel.
- Uit de echte seizoensplanning (`koen.xlsx`): groepsgroottes van 2 tot 6, lessen op hele uren
  tussen 14:00 en 20:00, niveaus als vrije tekst ("Kidstennis oranje", "Tienertennis geel",
  "Duoles", "Volwassenen - (her)starters", "Privéles"). Niveau is dus géén vaste lijst.
- Eén groepsnaam kan in de praktijk op meerdere momenten voorkomen met totaal verschillende
  spelers. De naam alleen is geen identiteit.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projectbeslissingen en scope
- `.planning/PROJECT.md` — Core Value, constraints, en de Key Decisions-tabel met de redenen erbij.
- `.planning/REQUIREMENTS.md` — GROEP-01 t/m GROEP-07 en TOEG-01 t/m TOEG-03 zijn de eisen van deze fase.
- `.planning/IMPORT-SJABLOON.md` — waarom een groep op `Groep` + dag + uur wordt gesleuteld, met het bewijs uit de echte planning. Fase 5 leunt hierop; het groepsmodel hier moet het aankunnen.

### De bestaande code
- `.planning/codebase/ARCHITECTURE.md` — de scheiding `lib/` (pure regels) vs `providers/` (opslag), en hoe groepen en reeksen vandaag werken.
- `.planning/codebase/CONVENTIONS.md` — Nederlandse namen, "waarom"-commentaar, `lib/*.ts` naast `lib/*.test.ts`, geen `jest.mock`, `t()` voor teksten.
- `.planning/codebase/CONCERNS.md` — de RLS-upsertval, `bookings` die viervoudig werk doet, en dat de dev-server de échte productiedatabank raakt.
- `.planning/research/PITFALLS.md` — vooral het punt over twee concurrerende waarheden tussen een groepsroster en `participant_ids`.
- `OPENSTAAND.md` — de geldregels die vastliggen en niet mogen verschuiven.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/groups.ts` — rekent vandaag de groepsgrootte uit een boeking. De nieuwe groep mag dit niet dupliceren.
- `lib/series.ts` (`seriesFrom`) — "deze en alle latere". D-06 is dezelfde regel; hergebruik of parallelle vorm, niet een derde variant.
- `lib/recurrence.ts` — welke datums een wekelijkse reeks oplevert, vakanties eruit, botsingen gemeld. Lokale tijd met dag/uur/minuut-velden, bewust géén "168 uur erbij" — dat moet zo blijven.
- `lib/vakanties.ts`, `lib/boekingstijd.ts`, `lib/period.ts` — clubvakanties, trainersuren, periodes.
- `lib/rechten.ts` — `isAdmin`, `isCoach`, `magInElkeAgenda`.
- `components/ParticipantPicker.tsx` — spelers kiezen; ligt voor de hand voor het roster.
- `components/ui/` — `Screen`, `ActionTile`, `TileGrid`; `app/admin/index.tsx` is de tegelpagina.
- `lib/students.ts` (`normalizeName`, `nameExists`) — namen matchen.

### Constraints from Existing Code
- `lib/` importeert nooit uit `providers/`, `components/` of `app/`. Alle regels van deze fase horen puur en testbaar in `lib/`.
- Opslag loopt via `providers/SimpleDataProvider.tsx`, met `supabaseStore` en `mockStore` erachter — beide moeten meegaan, anders werkt de app niet zonder Supabase.
- TypeScript staat op `strict`. Geen `jest.mock`: logica wordt puur gemaakt in plaats van gemockt.
- Oplevering: `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

</code_context>

<deferred>
## Deferred Ideas

- Wachtlijsten en inschrijven op een groep — v2.
- Clubbreed weekraster — v2.
- Trainers die hun eigen groepen beheren — bewust buiten scope, zie D-09.

</deferred>

---

*Phase: 01-lesgroepen*
*Context gathered: 2026-09-05 uit het openingsgesprek*
