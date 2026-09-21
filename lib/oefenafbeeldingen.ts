// Waar de afbeeldingen bij de oefeningen per kleur staan, en hoe ze heten.
//
// Ze staan in één Storage-bucket ("oefeningen"), één map per kleur en week, en de naam van het
// bestand zegt bij welk onderdeel het hoort:
//
//     blauw-week1/leskern-1758451200000.jpg
//
// Zo is er geen tabel nodig: een map lijst je in één keer op, en de naam is genoeg om de
// afbeelding onder de juiste kop te zetten. Het getal achter de streep is het tijdstip van het
// toevoegen, en bepaalt de volgorde: wie eerst kwam, staat eerst.

import type { Kleur } from './oefeningen';

export const OEFENONDERDELEN = ['opwarming', 'leskern', 'tussenspel', 'wedstrijdvorm'] as const;
export type Onderdeelnaam = (typeof OEFENONDERDELEN)[number];

/** De map van één kleur en week. `weekIndex` telt vanaf 0, de map vanaf 1: "blauw-week1". */
export function oefenmap(kleur: Kleur, weekIndex: number): string {
  return `${kleur}-week${weekIndex + 1}`;
}

/** Het pad van een nieuwe afbeelding. `tijd` is het moment van toevoegen, in milliseconden. */
export function oefenpad(map: string, onderdeel: Onderdeelnaam, tijd: number): string {
  return `${map}/${onderdeel}-${tijd}.jpg`;
}

/** Bij welk onderdeel hoort dit bestand? `null` als de naam niets herkenbaars zegt. */
export function onderdeelUitNaam(naam: string): Onderdeelnaam | null {
  const begin = naam.split('-')[0];
  return OEFENONDERDELEN.find((o) => o === begin) ?? null;
}

/**
 * De bestandsnamen uit een map, per onderdeel en in de volgorde van toevoegen. Een naam die
 * bij geen onderdeel hoort (iemand die met de hand iets in de bucket zette) valt weg: er is
 * geen kop om het onder te zetten.
 */
export function perOnderdeel(namen: readonly string[]): Record<Onderdeelnaam, string[]> {
  const uit: Record<Onderdeelnaam, string[]> = {
    opwarming: [], leskern: [], tussenspel: [], wedstrijdvorm: [],
  };
  for (const naam of namen) {
    const onderdeel = onderdeelUitNaam(naam);
    if (onderdeel) uit[onderdeel].push(naam);
  }
  // Het tijdstip achter de streep is een getal; tekstvolgorde klopt niet meer zodra het
  // aantal cijfers verspringt, dus sorteren op de waarde.
  const tijd = (naam: string): number => Number(naam.replace(/\.jpg$/, '').split('-')[1]) || 0;
  for (const o of OEFENONDERDELEN) uit[o].sort((a, b) => tijd(a) - tijd(b));
  return uit;
}
