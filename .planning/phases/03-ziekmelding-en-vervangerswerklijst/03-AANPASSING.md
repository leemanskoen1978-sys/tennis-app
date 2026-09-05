# Aanpassing op plan 03-01

**Vastgelegd:** 2026-09-06, door de orkestrator, vóór de uitvoering van fase 3.

## Wat er veranderd is sinds plan 03-01 geschreven werd

Plan 03-01 stelt voor om `lib/overlap.ts` aan te maken met een functie `botsen`, en
`lib/recurrence.ts` en `providers/SimpleDataProvider.tsx` daarnaar te laten wijzen.

Dat plan is geschreven vóór fase 2.1 landde. **Fase 2.1 heeft de helft daarvan al gedaan, en
anders:** plan 02.1-01 heeft de private `collides` uit `lib/recurrence.ts` gehaald en
vervangen door een geëxporteerde `botstMet(slot, existing, vraag)`, die de botsende boeking
teruggeeft in plaats van een boolean en ook de baan meeneemt. `planSeries` loopt daar al
doorheen.

## Wat plan 03-01 dus wél moet doen

- **Maak geen `lib/overlap.ts` aan.** Er zou dan een derde variant naast `botstMet` en
  `overlaps` staan — precies wat het plan wilde voorkomen.
- **Gebruik `botstMet` uit `lib/recurrence.ts`.** Dat is nu de ene regel.
- **De echte overgebleven dubbeling is `overlaps` in `providers/SimpleDataProvider.tsx`.**
  Haal die weg en laat de aanroepers `botstMet` gebruiken. Dat is wat er van 03-01 overblijft,
  en het is nog steeds de moeite waard.
- Het invariant-criterium blijft gelden: na afloop staat er in de hele codebase nog precies
  één plek die twee tijdvakken vergelijkt.

Alle andere plannen van fase 3 die `botsen` of `lib/overlap.ts` noemen, lezen dat als
`botstMet` uit `lib/recurrence.ts`.
