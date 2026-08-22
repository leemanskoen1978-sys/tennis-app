// Bladeren door een rij dingen die je één voor één afhandelt.
//
// Het bijzondere geval is dat de rij korter wordt terwijl je erin staat: je handelt een
// betaling af en die verdwijnt eruit. Dan wijst je plek ineens naar het ding dat erna kwam,
// en op de laatste plek naar niets meer. Eén functie die dat opvangt, zodat geen enkel
// scherm zijn eigen randgeval hoeft te bedenken.

import { t } from './i18n';

/** Een plek die zeker binnen de rij ligt. Een lege rij levert altijd 0. */
export function beperkIndex(index: number, lengte: number): number {
  if (!Number.isFinite(index) || lengte <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), lengte - 1);
}

/**
 * Waar je bent in de rij: "2 van 5". Bij één ding staat er niets — dan is er niets om
 * tussen te bladeren en is een teller alleen maar ruis.
 */
export function bladerLabel(index: number, lengte: number): string {
  if (lengte <= 1) return '';
  return t('{n} van {totaal}', { n: beperkIndex(index, lengte) + 1, totaal: lengte });
}
