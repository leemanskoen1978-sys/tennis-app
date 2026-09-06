// Welke les er nú op de baan staat — de vraag die het afvinkscherm stelt zodra je het opent.
//
// Het scherm zoekt zelf, want dat is het hele punt: de trainer opent het bij het begin van
// de les en geeft zijn gsm door. Moest hij eerst een datum en een uur aanwijzen, dan was
// het sneller geweest om de namen zelf af te vinken.
//
// De grenzen staan hier en niet in het scherm, zodat ze te lezen en te testen zijn.
//
// Wie een les geeft wordt hier nooit zelf uitgerekend: dat vraagt dit bestand aan
// `lesgeverId` (lib/lesgever), de enige plek die die vraag beantwoordt. Stond hier een eigen
// `b.coach_id`, dan opende een vervanger dit scherm op niets terwijl de afwezige trainer de
// les nog zag staan — en dan vinkt niemand af.

import type { Booking } from './types';
import { lesgeverId } from './lesgever';

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
 * De lessen van deze lesgever die nu aan de beurt zijn, op tijd oplopend.
 *
 * Geannuleerde lessen vallen weg: die gaan niet door, dus er valt niemand af te vinken.
 * Meestal is dit er precies één; staan er twee groepen tegelijk op de baan, dan kiest de
 * trainer op het scherm zelf welke.
 *
 * "Van deze lesgever" gaat over wie hem werkelijk geeft en niet over wiens agenda hij staat:
 * een vervanger staat met die groep op de baan en moet ze dus kunnen afvinken.
 */
export function lessenNu(bookings: Booking[], lesgever: string, now: Date): Booking[] {
  const t = now.getTime();
  return bookings
    .filter((b) => lesgeverId(b) === lesgever && b.status !== 'cancelled')
    .filter((b) => {
      const start = new Date(b.start_time).getTime();
      const eind = new Date(b.end_time).getTime();
      return t >= start - VOOR_MS && t <= eind + NA_MS;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
