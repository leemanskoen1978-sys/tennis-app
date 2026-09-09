// Staat deze les open om over te nemen, en welke staan er open voor deze trainer?
//
// Puur rekenwerk — geen store, geen scherm, geen schrijfweg — en de ENIGE plek die die vraag
// beantwoordt. Er zijn twee manieren waarop een les zonder trainer komt te staan: de vaste
// trainer is ziek gemeld, of iemand heeft de les vrijgegeven met `zoekt_trainer`. Wie die twee
// ergens anders nog eens optelt, laat een les uit de lijst vallen op de plek die hij vergat mee
// te wijzigen — en een les die niemand ziet, blijft zonder trainer staan. Dat is precies de
// fout waarvoor deze module en lib/ziekmelding bestaan.
//
// De ziektekant wordt hier niet nagebouwd maar aangeroepen: `zoektVervanger` in lib/ziekmelding
// weet al wat een openstaande melding is en op welke dag een les valt. Zou dit bestand zijn eigen
// periodevergelijking schrijven, dan is er een kopie van `van <= dag <= tot` bij, en een kopie
// die ooit uiteenloopt zegt iets anders dan de werklijst van de beheerder.
//
// Er wordt hier nooit iets weggeschreven. Wie er uiteindelijk aan de les hangt, doet de provider
// met `claimLes` — en die vraagt eerst hier of het mag.

import { t } from './i18n';
import { vakantieOpMoment } from './vakanties';
import { zoektVervanger } from './ziekmelding';
import type { OpenZiekmelding } from './ziekmelding';
import type { Booking, Vakantie } from './types';

/** De velden die deze vragen van een les nodig hebben; meer weet dit bestand er niet van. */
export type OpenBoeking = Pick<
  Booking, 'coach_id' | 'taught_by_id' | 'start_time' | 'status' | 'zoekt_trainer'
> & { id?: string };

/** Waarom een les openstaat. Het scherm toont dit; het leidt het niet zelf af. */
export type OpenReden = 'ziek' | 'vrijgegeven';

/** Eén openstaande les met de reden erbij. Nooit alleen de reden: het scherm toont de les. */
export interface OpenstaandeLes<T> {
  les: T;
  reden: OpenReden;
}

/**
 * Waarom deze les openstaat, of `null` als hij niet openstaat.
 *
 * Ziekte gaat voor het merkteken als ze allebei gelden: de ziekmelding verklaart ook de andere
 * lessen van diezelfde trainer, en dat is wat de kijker moet weten.
 */
export function openReden(les: OpenBoeking, open: OpenZiekmelding[]): OpenReden | null {
  if (les.status === 'cancelled') return null;
  if (les.taught_by_id) return null;
  // `zoektVervanger` stelt dezelfde drie vragen nog eens (afgezegd, lesgever, ziek). Dat is
  // geen verspilling maar de reden dat dit bestand geen eigen ziektelogica heeft.
  if (zoektVervanger({ ...les, id: les.id ?? '' }, open)) return 'ziek';
  return les.zoekt_trainer === true ? 'vrijgegeven' : null;
}

/** Staat deze les open om over te nemen? Zie `openReden` — dezelfde vraag, korter. */
export function staatOpen(les: OpenBoeking, open: OpenZiekmelding[]): boolean {
  return openReden(les, open) !== null;
}
