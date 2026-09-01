// Welke les er nú op de baan staat — de vraag die het afvinkscherm stelt zodra je het opent.
//
// Het scherm zoekt zelf, want dat is het hele punt: de trainer opent het bij het begin van
// de les en geeft zijn gsm door. Moest hij eerst een datum en een uur aanwijzen, dan was
// het sneller geweest om de namen zelf af te vinken.
//
// De grenzen staan hier en niet in het scherm, zodat ze te lezen en te testen zijn.

import type { Booking } from './types';

/**
 * Hoe lang vóór het uur een les al meetelt. De kinderen staan er vóór het uur begint, en
 * dat is precies het moment waarop de gsm rondgaat — niet vijf over.
 */
export const VOOR_MS = 15 * 60_000;

/**
 * En hoe lang erna. Een les die net gedaan is blijft nog een halfuur staan: vergat de
 * trainer af te vinken, dan vindt hij ze terug zonder ergens een datum te moeten kiezen.
 * Langer niet — dan zou de les van deze ochtend nog boven de les van straks staan.
 */
export const NA_MS = 30 * 60_000;

/**
 * De lessen van deze trainer die nu aan de beurt zijn, op tijd oplopend.
 *
 * Geannuleerde lessen vallen weg: die gaan niet door, dus er valt niemand af te vinken.
 * Meestal is dit er precies één; staan er twee groepen tegelijk op de baan, dan kiest de
 * trainer op het scherm zelf welke.
 */
export function lessenNu(bookings: Booking[], coachId: string, now: Date): Booking[] {
  const t = now.getTime();
  return bookings
    .filter((b) => b.coach_id === coachId && b.status !== 'cancelled')
    .filter((b) => {
      const start = new Date(b.start_time).getTime();
      const eind = new Date(b.end_time).getTime();
      return t >= start - VOOR_MS && t <= eind + NA_MS;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
