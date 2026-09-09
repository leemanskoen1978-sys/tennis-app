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

/**
 * De lessen die deze kijker kan overnemen, op tijd gesorteerd — zo werkt hij de lijst van boven
 * naar beneden af. Het scherm sorteert niet nog eens.
 *
 * Wat er afvalt en waarom:
 *  - wat al begonnen is: daar valt niets meer over te beslissen;
 *  - een dag dat de club dicht is: die les gaat sowieso niet door, dezelfde regel als
 *    `lessenVoorZiekmelding`;
 *  - de eigen lessen van de kijker: jezelf overnemen betekent niets.
 *
 * Er staat met opzet GEEN bovengrens op hoe ver vooruit gekeken wordt. Een venster van een paar
 * weken is precies hoe een les blijft liggen tot hij te dichtbij is om nog op te lossen.
 *
 * Generiek in `T`, zodat het scherm er volle `Booking`-rijen in stopt en er volle rijen uit
 * krijgt — met baan, groep en spelers erin — zonder dat dit bestand daarvan hoeft te weten.
 */
export function openstaandeLessen<T extends OpenBoeking>(
  bookings: T[],
  open: OpenZiekmelding[],
  vakanties: Vakantie[],
  nu: Date,
  kijkerId: string,
): OpenstaandeLes<T>[] {
  const rijen: OpenstaandeLes<T>[] = [];
  for (const les of bookings) {
    if (les.coach_id === kijkerId) continue;
    // Een onleesbare begintijd geeft NaN, en NaN is nooit groter: bij twijfel valt de les uit
    // de lijst in plaats van het scherm te laten struikelen op een datum die niet bestaat.
    if (!(Date.parse(les.start_time) > nu.getTime())) continue;
    if (vakantieOpMoment(vakanties, les.start_time) !== null) continue;
    const reden = openReden(les, open);
    if (reden === null) continue;
    rijen.push({ les, reden });
  }
  // `rijen` is hier zelf opgebouwd, dus deze sortering raakt de meegegeven lijst niet aan.
  // `Date.parse` en niet de tekst: een tijdstip met een zone-aanduiding sorteert als tekst fout.
  return rijen.sort((a, b) => Date.parse(a.les.start_time) - Date.parse(b.les.start_time));
}

/**
 * Waarom deze trainer deze les niet kan overnemen, of `null` als het mag.
 *
 * Een zin en geen boolean, en nooit stil niets doen: twee trainers kunnen tegelijk naar dezelfde
 * lijst kijken, en wie op een knop drukt die niets doet, drukt hem nog eens en gaat daarna bellen.
 *
 * De volgorde van de controles ligt vast en de eerste die nee zegt wint — dezelfde afspraak als
 * `kanVervangen` in lib/vervanger. "Er staat al een lesgever" wordt vóór "staat niet open"
 * gevraagd, want dat is de reden die de kijker moet lezen: een collega was hem voor.
 *
 * Dit is het bezwaar van de app. De databank stelt dezelfde vragen nog eens in `les_staat_open()`
 * en in `bewaak_betaalvelden` (ZOEKT-TRAINER.sql) — dezelfde verdeling als tussen lib/rechten en
 * de policies: hier zodat er geen knop staat die daarna geweigerd wordt, daar omdat dát de
 * bewaking is.
 */
export function claimBezwaar(
  les: OpenBoeking | undefined,
  kijkerId: string,
  open: OpenZiekmelding[],
  nu: Date,
): string | null {
  if (!les) return t('Deze les bestaat niet meer.');
  if (les.coach_id === kijkerId) return t('Dit is je eigen les.');
  if (les.taught_by_id) return t('Een collega was je voor: deze les heeft al een lesgever.');
  if (!(Date.parse(les.start_time) > nu.getTime())) return t('Deze les is al begonnen.');
  if (!staatOpen(les, open)) return t('Deze les zoekt geen trainer meer.');
  return null;
}

/**
 * Waarom deze trainer deze les niet kan teruggeven, of `null` als het mag.
 *
 * Alleen wie er zelf als lesgever op staat, en alleen zolang de les nog moet beginnen. Wat
 * geweest is blijft staan zoals het was: `taught_by_id` bepaalt wie er betaald wordt, en een
 * gegeven les laat je niet achteraf van naam wisselen.
 *
 * Ook een les die de beheerder toewees mag terug. Teruggeven maakt een les niet onzichtbaar maar
 * juist weer zichtbaar: hij komt terug in deze lijst en op de werklijst van de beheerder.
 */
export function teruggeefBezwaar(
  les: OpenBoeking | undefined,
  kijkerId: string,
  nu: Date,
): string | null {
  if (!les) return t('Deze les bestaat niet meer.');
  if (les.taught_by_id !== kijkerId) return t('Deze les staat niet op jouw naam.');
  if (!(Date.parse(les.start_time) > nu.getTime())) return t('Deze les is al begonnen.');
  return null;
}
