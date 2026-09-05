# Phase 2: Wie gaf de les écht - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Source:** Beslissingen uit het openingsgesprek en het projectonderzoek. De gebruiker heeft de
loonvraag expliciet beantwoord; de rest volgt uit vastgelegde projectbeslissingen.

<domain>
## Phase Boundary

Bij elke les is vast te leggen wie hem werkelijk gaf, apart van de trainer aan wie de les is
toegewezen, en elke plek die met loon of uren rekent gebruikt die ene waarheid.

Wat er NIET in zit: de ziekmelding en de werklijst (fase 3), het vervangersvoorstel (fase 3),
de export (fase 4). Deze fase levert alleen het veld, de ene rekenplek, en de zichtbaarheid.

</domain>

<decisions>
## Implementation Decisions

### Het veld

- **D-01:** De vervanger komt in een apart veld naast `bookings.coach_id`, dat nooit
  overschreven wordt. Overschrijven verliest wie er oorspronkelijk stond, en dan klopt noch het
  rooster noch de loonstaat. Dit is de kern van deze fase.
- **D-02:** Leeg betekent "de toegewezen trainer gaf de les zelf". Er hoeft dus niets ingevuld
  te worden voor de 99% van de lessen waar niets bijzonders aan is.
- **D-03:** De vervanger is een bestaande trainer. Geen vrije tekst — anders is er niets mee
  te rekenen.

### Het loon

- **D-04:** Het loon gaat naar wie de les werkelijk gaf, tegen **diens eigen uurtarief** uit
  `coach_rates`. De vaste trainer krijgt niets voor een les die hij niet gaf. Dit is expliciet
  door de gebruiker gekozen: het loon hoort bij wie het werk deed, en `coach_rates` staat al
  per persoon, dus er is geen tweede tariefbegrip nodig.
- **D-05:** Er komt **één plek** in de code die de vraag "wie gaf deze les" beantwoordt — één
  functie in `lib/`, met een test eromheen. Elke plek die loon, uren of een trainersrapport
  uitrekent gaat daardoorheen. Dit is bewust dezelfde discipline als `planMethodChange` voor
  betalingen: het gat dat daarmee gedicht werd, liet een speler twee keer betalen. Twee plekken
  die allebei "de trainer van deze les" bepalen, lopen vroeg of laat uit elkaar.
- **D-06:** Omzet verandert niet. Omzet loopt op het uurtarief van de **baan** (wat de speler
  betaalt); loon loopt op het uurtarief van de **trainer**. Die twee mogen nooit in elkaar
  geschoven worden — zie `lib/reports.ts` en `OPENSTAAND.md`. Een vervanging raakt alleen de
  loonkant.

### Zichtbaarheid

- **D-07:** Waar een les getoond wordt, is te zien dát er een vervanger stond en wie de vaste
  trainer was. Beide namen, niet één die de andere vervangt — anders is achteraf niet meer na
  te gaan wat er gebeurd is.

### Toegang

- **D-08:** Alleen een beheerder kan invullen wie de les werkelijk gaf. Een trainer die
  zichzelf als vervanger opgeeft, is v2 (zie REQUIREMENTS.md).
- **D-09:** Het veld raakt geld en hoort dus bij de bewaakte velden. `bewaak_betaalvelden` in
  `supabase-schema.sql` bewaakt vandaag al welke velden een niet-beheerder mag aanraken; het
  nieuwe veld hoort in diezelfde bewaking, niet in een nieuwe ernaast.
- **D-10:** De schemawijziging komt als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. **De gebruiker draait hem zelf.** Niets in deze fase mag SQL draaien
  of de productiedatabank aanraken.

### Claude's Discretion

- De naam van het veld en van de functie.
- Waar in de schermen de vervanger getoond en ingevuld wordt.
- Of `lib/payments.ts` de functie zelf aanroept of hem aangereikt krijgt.

</decisions>

<specifics>
## Specific Ideas

- Fase 3 bouwt de werklijst hierbovenop en fase 4 exporteert "uren per trainer" ermee. Het veld
  en de functie moeten dus bruikbaar zijn zonder scherm: puur, in `lib/`, met een test.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Beslissingen en eisen
- `.planning/PROJECT.md` — Key Decisions, met "vervanger krijgt zijn eigen uurtarief" en "vervanging als apart veld".
- `.planning/REQUIREMENTS.md` — VERV-01, VERV-02, VERV-03.
- `OPENSTAAND.md` — de geldregels die vastliggen. Omzet en trainersloon zijn twee bedragen en mogen nooit in elkaar schuiven.

### De bestaande code
- `lib/payments.ts` — `coachPayout`, `totalCoachPayout`, `bookingPrice`, `countsAsRevenue`.
- `lib/reports.ts` — waar loon en omzet uit elkaar gehouden worden.
- `lib/beurtenkaart.ts` (`planMethodChange`) — het voorbeeld van "één bewaakte weg", dat hier herhaald wordt voor de trainerattributie.
- `supabase-schema.sql` — `coach_rates`, `bewaak_betaalvelden`, en de `alter table ... if not exists`-blokken onderaan.
- `.planning/codebase/CONVENTIONS.md` en `.planning/codebase/CONCERNS.md`.
- `.planning/research/PITFALLS.md` — de sectie over attributie en loon.
- `.planning/phases/01-lesgroepen/` — wat fase 1 aan `bookings` en aan de stores heeft toegevoegd; deze fase bouwt daarop voort.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/payments.ts` — alle loonberekening loopt hier al langs; de nieuwe functie hoort hier of ernaast, en `lib/payments.test.ts` bestaat.
- `lib/reports.ts` — het trainersrapport; moet mee.
- `components/BookingDetailSheet.tsx`, `components/LessonCards.tsx` — waar een les getoond wordt.

### Constraints from Existing Code
- `lib/` importeert nooit uit `providers/`, `components/` of `app/`.
- Geen `jest.mock`. Logica puur en parameter-gestuurd.
- Oplevering: `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

</code_context>

<deferred>
## Deferred Ideas

- Een trainer die zichzelf ziek meldt of zichzelf als vervanger opgeeft — v2.
- De werklijst en het vervangersvoorstel — fase 3.

</deferred>

---

*Phase: 02-wie-gaf-de-les-echt*
*Context gathered: 2026-09-05*
