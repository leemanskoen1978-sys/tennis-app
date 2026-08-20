// Welke lessen horen bij een herhaalreeks? Puur rekenwerk — geen store, geen scherm — zodat
// "vanaf deze les" één keer vastligt en te testen is, in plaats van op elk scherm opnieuw
// bedacht te worden.
//
// De reeks is niets meer dan een gedeeld `series_id` op gewone boekingen. Dat is met opzet:
// een les uit de reeks verzetten of schrappen raakt de rest niet, want er is geen aparte
// reeks-administratie die daarna zou moeten worden bijgewerkt.

import type { Booking } from './types';

/** De velden die een vraag over de reeks nodig heeft; meer weet dit bestand niet van een les. */
export type SeriesBooking = Pick<Booking, 'id' | 'series_id' | 'start_time'>;

const at = (b: SeriesBooking): number => new Date(b.start_time).getTime();

/**
 * De gegeven les plus alle latere uit dezelfde reeks, op tijd gesorteerd.
 *
 * Nooit de eerdere: een les die al gegeven is, is geschiedenis en hoort niet mee te
 * veranderen omdat iemand de reeks vanaf volgende week stopzet. Even laat beginnende lessen
 * tellen wél mee (`>=`), zodat een les niet ontsnapt doordat hij toevallig op precies
 * hetzelfde moment begint.
 *
 * Een losse les (geen `series_id`) levert alleen zichzelf op — dan gedraagt "vanaf deze les"
 * zich als de gewone actie op één les. Een onbekend id levert niets op.
 */
export function seriesFrom<B extends SeriesBooking>(bookings: B[], bookingId: string): B[] {
  const target = bookings.find((b) => b.id === bookingId);
  if (!target) return [];
  if (!target.series_id) return [target];
  const from = at(target);
  return bookings
    .filter((b) => b.series_id === target.series_id && at(b) >= from)
    .sort((a, b) => at(a) - at(b));
}
