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
 * Hoeveel lessen er onder het afvinkscherm komen te staan: drie.
 *
 * Niet alles wat er nog komt — dat staat op Nog te komen, en een seizoen aan lessen onder een
 * scherm dat een kind in handen krijgt is een lijst om in te verdwalen. Drie is wat een
 * trainer op een namiddag na elkaar geeft: hij vinkt de groep van nu af, en de volgende twee
 * staan er al voor als hij ze vóór zit. Meer regels winnen niets en duwen de namen omhoog.
 */
export const KOMEND_AANTAL = 3;

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

/**
 * De eerstvolgende lessen van deze lesgever die nog niet op het scherm staan, op tijd
 * oplopend en hoogstens `aantal` lang.
 *
 * Wat `lessenNu` al toont valt hier weg, en dat is de hele grens: één les mag maar op één
 * plaats staan, anders vinkt de trainer de groep van nu af in het lijstje van straks en
 * denkt hij dat hij twee keer hetzelfde zag. De grens is precies dezelfde `VOOR_MS` als
 * hierboven — is het venster van een les eenmaal open, dan hoort ze bovenaan en niet
 * onderaan. Wat voorbij is komt evenmin terug: dat viel al uit `lessenNu` en "komend"
 * betekent hier letterlijk komend.
 *
 * Geannuleerde lessen vallen weg om dezelfde reden als bij `lessenNu`: die gaan niet door.
 */
export function komendeLessen(
  bookings: Booking[],
  lesgever: string,
  now: Date,
  aantal: number = KOMEND_AANTAL,
): Booking[] {
  const t = now.getTime();
  return bookings
    .filter((b) => lesgeverId(b) === lesgever && b.status !== 'cancelled')
    .filter((b) => {
      const start = new Date(b.start_time).getTime();
      // Een onleesbare datum belandt nergens: liever één les niet getoond dan een rij met
      // "datum onbekend" bovenaan de lijst van straks.
      return !Number.isNaN(start) && t < start - VOOR_MS;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, Math.max(0, aantal));
}

/**
 * Hoort de dag bij het uur van deze les te staan?
 *
 * Alleen als ze niet van vandaag is. Een kale "18:00" onder een scherm dat over dit uur gaat
 * leest een trainer als "straks", en dan tikt hij de groep van morgen open terwijl de kinderen
 * van nu voor hem staan. Dit is de enige reden dat deze vraag bestaat, en daarom staat ze
 * hier en niet als algemene datumhulp: het is een regel van het afvinkscherm.
 *
 * Gerekend op de kalenderdag zoals ze op de klok staat, niet op een verschil in uren — om
 * 23:30 is de les van 00:30 niet "over een uur" maar morgen.
 */
export function toonDagErbij(startIso: string, now: Date): boolean {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return false;
  return start.getFullYear() !== now.getFullYear()
    || start.getMonth() !== now.getMonth()
    || start.getDate() !== now.getDate();
}
