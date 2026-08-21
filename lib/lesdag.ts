// De lesdag van één trainer: wat het startscherm tekent als hij de app op de baan opent.
//
// Dit bestand beantwoordt drie vragen die allemaal op het scherm terechtkomen: welke lessen
// heb ik vandaag, wie staat daarin, en welke daarvan hoor ik nú te zien. Vooral die laatste
// vraag hoort hier en niet in het scherm: "de les die nu bezig is" klinkt eenvoudig tot je
// om kwart voor vijf, tussen twee lessen in of om negen uur 's avonds kijkt.

import { bookingsOnDay } from './hub';
import { lessonPlayerIds } from './groups';
import type { Booking } from './types';

/** Eén les van vandaag, met de spelers die erin staan. */
export interface Lesuur {
  booking: Booking;
  /** De spelers, betaler voorop. De namen worden op het scherm opgezocht. */
  playerIds: string[];
  /** Is deze les nu bezig? Hoogstens één les kan dit zijn. */
  loopt: boolean;
  /** Is hij al voorbij? Dan staat hij grijs — maar hij blijft staan. */
  voorbij: boolean;
  /**
   * De les die het scherm opengeklapt toont. Precies één les heeft dit, zolang er lessen
   * zijn: een trainer op een baan hoort niet eerst te moeten tikken voor hij iets ziet.
   */
  open: boolean;
}

/**
 * De lesdag van één trainer: zijn lessen van vandaag, op tijd oplopend.
 *
 * "Vandaag" komt van `bookingsOnDay`, dezelfde definitie die het hoofdscherm en de agenda
 * al gebruiken — een les van 's avonds laat hoort bij de dag zoals je hem op de klok ziet.
 * Geannuleerde lessen vallen daar al af: die gaan niet door, dus daar valt niets over in
 * te spreken.
 *
 * Welke les opengeklapt staat, in deze volgorde:
 *  1. de les die nu bezig is;
 *  2. is die er niet, de eerstvolgende — om kwart voor vijf wil je de les van vijf uur zien;
 *  3. is die er ook niet (de dag zit erop), de laatste les, want dáár gaat een memo
 *     achteraf over.
 */
export function lesdagVan(bookings: Booking[], coachId: string, now: Date): Lesuur[] {
  const mijne = bookingsOnDay(bookings, now).filter((b) => b.coach_id === coachId);
  const moment = now.getTime();

  const uren: Lesuur[] = mijne.map((booking) => {
    const start = new Date(booking.start_time).getTime();
    const eind = new Date(booking.end_time).getTime();
    return {
      booking,
      playerIds: lessonPlayerIds(booking),
      loopt: start <= moment && moment < eind,
      voorbij: eind <= moment,
      open: false,
    };
  });

  if (uren.length === 0) return uren;

  const lopend = uren.findIndex((u) => u.loopt);
  const volgend = uren.findIndex((u) => !u.voorbij);
  const gekozen = lopend >= 0 ? lopend : volgend >= 0 ? volgend : uren.length - 1;
  uren[gekozen].open = true;

  return uren;
}
