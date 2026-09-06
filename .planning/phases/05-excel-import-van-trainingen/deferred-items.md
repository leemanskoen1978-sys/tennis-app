# Uitgestelde vondsten uit fase 5

Wat hier staat is buiten de reikwijdte van de plannen van deze fase gevonden en met opzet niet
aangeraakt: het raakt code die deze fase niet verandert.

## `newGoalId` deelt af en toe twee keer hetzelfde id uit

- **Gevonden bij:** plan 05-06, tijdens een volledige `npm test`-run.
- **Wat:** `lib/goals.test.ts` → "does not hand out the same id twice" viel één keer om en slaagde
  daarna weer. `newGoalId` in `lib/goals.ts` is `goal-${Date.now().toString(36)}-${vier tekens
  toeval}`; vijftig trekkingen binnen dezelfde milliseconde botsen soms.
- **Waarom niet hier gefixt:** raakt lib/goals, dat in deze fase niet meedoet. Een botsing betekent
  in de app dat één doel een ander overschrijft — de moeite waard, maar in een eigen plan.

## Een groep die in de export hernoemd is, wordt herkend maar niet hernoemd

- **Gevonden bij:** plan 05-07, taak 2 (de heen-en-terugtest met de export van fase 4).
- **Wat:** `groepWijzigingen` in `lib/import-trainingen.ts` vergelijkt `name`, `weekday` en
  `start_hour` bewust niet: "die drie vormen de sleutel waarmee de groep herkend werd, dus ze zijn
  per definitie gelijk". Dat klopt bij een match op de sleutel, maar níét bij een match op
  `Groep-ID` (D-03) — juist het geval waarin de naam mág verschillen. Een beheerder die een groep
  in het geëxporteerde bestand hernoemt en het terugstuurt, ziet "ongewijzigd" en de groep houdt
  haar oude naam. De herkenning zelf werkt: de groep komt niet als nieuwe groep binnen, er wordt
  dus niets verdubbeld.
- **Waarom niet hier gefixt:** plan 05-07 verbiedt uitdrukkelijk productiecode; de fix hoort in
  `groepWijzigingen`, dat in plan 05-06 geschreven is. Nodig: `name`, `weekday` en `start_hour`
  meenemen wanneer `groep.bestaand` via `Groep-ID` gevonden werd, plus een test dat een gewone
  sleutelmatch daardoor geen ruis krijgt (IMP-07).
