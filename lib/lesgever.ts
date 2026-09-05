// "Wie gaf deze les écht" is precies één vraag met precies één antwoord, en dat antwoord
// hoort maar op één plek te staan. `coach_id` blijft altijd "van wie is deze les" — zijn
// agenda, zijn rooster, zijn dubbele-boekingscontrole. `taught_by_id` is de vervanger, leeg
// betekent "de vaste trainer gaf hem zelf". Loon, uren en het trainersrapport lezen hier, en
// nergens anders, wie er werkelijk op de baan stond.
//
// Dezelfde discipline als `planMethodChange` in lib/beurtenkaart: het gat dat daar gedicht
// werd, liet een speler twee keer betalen; hier zou het gat de vaste trainer laten uitbetalen
// voor een les die hij niet gaf, of de vervanger niets. Wie hier een tweede antwoord naast
// zet — een `b.taught_by_id ?? b.coach_id` in een scherm of een rapport — krijgt dat gat
// terug op de plek die hij vergat mee te wijzigen.

import type { Booking } from './types';

/** De velden die deze vraag nodig heeft; meer weet dit bestand niet van een les. */
export type LesgeverBoeking = Pick<Booking, 'coach_id' | 'taught_by_id'>;

/**
 * Wie deze les werkelijk gaf: de vervanger als die er is, anders de vaste trainer.
 * Dit is de ENIGE plek die deze vraag beantwoordt — zie het kopcommentaar hierboven.
 *
 * De meegegeven boeking blijft onaangeroerd: het antwoord wordt berekend, `coach_id` wordt
 * nooit overschreven.
 */
export function lesgeverId(b: LesgeverBoeking): string {
  return b.taught_by_id ?? b.coach_id;
}
