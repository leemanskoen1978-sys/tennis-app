// Berichten die de gebruiker heeft weggeklikt.
//
// Dit wordt op het toestel bewaard en niet in de databank, en dat is een keuze: een speler
// mag een boeking helemaal niet wijzigen — die rechten liggen bij de trainer van dat uur
// (zie `bookings_update` in supabase-schema.sql). Die rechten verruimen om een berichtje af
// te vinken, is de verkeerde ruil. Het gevolg is dat wegklikken per toestel geldt: klik je
// het weg op je telefoon, dan staat het op je laptop nog. Voor een bericht dat sowieso na
// een week vanzelf verdwijnt, is dat de goedkoopste eerlijke oplossing.

import type { Booking } from './types';

/** Wat er nog getoond moet worden. */
export function zonderWeggeklikt(bookings: Booking[], weggeklikt: string[]): Booking[] {
  const weg = new Set(weggeklikt);
  return bookings.filter((b) => !weg.has(b.id));
}

/**
 * De weggeklikte id's, ontdaan van wat er toch niet meer getoond wordt.
 *
 * Zonder dit groeit die lijst eindeloos: elk bericht dat na een week vanzelf verdwijnt, zou
 * zijn id er voor altijd in achterlaten.
 */
export function opgeruimd(weggeklikt: string[], bookings: Booking[]): string[] {
  const bestaat = new Set(bookings.map((b) => b.id));
  return weggeklikt.filter((id) => bestaat.has(id));
}
