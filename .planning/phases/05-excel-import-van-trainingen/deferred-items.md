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
