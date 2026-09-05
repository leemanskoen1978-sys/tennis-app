// Wat is een lesgroep, en welke lessen voelt een wijziging eraan? Puur rekenwerk — geen
// store, geen scherm — zodat de regels van een groep één keer vastliggen en te testen zijn.
//
// De grens die dit bestand bewaakt: een groep is "het rooster van nu", een boeking is "wie er
// die dag bij stond". Wie wil weten wie er in les X zat leest `Booking.participant_ids` via
// lib/groups, en nooit `LesGroep.roster`. Zonder die grens veranderen de groepsprijs en de
// aanwezigheid van een les van vorige maand zodra iemand vandaag een speler aan de groep
// toevoegt — de club zou haar eigen geschiedenis zien opschuiven.
//
// `groupBookingsFrom` is met opzet een tweelingbroer van `seriesFrom` in lib/series en geen
// hergebruik ervan: dezelfde `>=`-grens, dezelfde sortering, een andere sleutel. `seriesFrom`
// is getypeerd rond `series_id` en heeft een terugval ("geen reeks? dan alleen jezelf") die
// voor een groep niets betekent. Verandert daar de "vanaf"-grens, verander hem hier ook —
// twee antwoorden op dezelfde vraag is precies wat deze verwijzing moet voorkomen.

import { t } from './i18n';
import type { Booking, LesGroep } from './types';

/** De velden die een vraag over de groep nodig heeft; meer weet dit bestand niet van een les. */
export type GroepBoeking = Pick<Booking, 'id' | 'group_id' | 'start_time' | 'status' | 'participant_ids'>;

/** Het plan voor een roosterwijziging: wat er zou veranderen, nog niets weggeschreven. */
export interface RosterChangePlan {
  /** De groep zoals hij na de wijziging zou zijn. */
  group: LesGroep;
  /** Welke toekomstige boekingen hun participant_ids moeten krijgen bijgewerkt, en naar wat. */
  bookingPatches: Array<{ id: string; participant_ids: string[] }>;
}

const at = (b: GroepBoeking): number => new Date(b.start_time).getTime();

/**
 * Waarom deze lesgroep niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand nog
 * aan het invullen is, dus de melding is een zin die op het scherm past en geen foutcode.
 *
 * De trainer is hier verplicht, ook al mag `coach_id` op de groep zelf leeg zijn: een import
 * levert groepen op waarvan de trainer nog gekoppeld moet worden, maar wie er met de hand een
 * aanmaakt weet wie hem geeft.
 *
 * Wat hier bewust NIET staat is een controle op een al bestaande combinatie van naam, weekdag
 * en beginuur. Die sleutel dient om bij de import een groep te herkennen, niet om er een te
 * weigeren: twee groepen op hetzelfde uur mag — denk aan een tijdelijke tweede groep tijdens
 * een trainerswissel.
 */
export function lesGroepFout(g: Omit<LesGroep, 'id'>): string | null {
  if (g.name.trim().length === 0) return t('Geef de lesgroep een naam.');
  if (g.level.trim().length === 0) return t('Geef de lesgroep een niveau.');
  if (!Number.isInteger(g.weekday) || g.weekday < 0 || g.weekday > 6) {
    return t('Kies een lesdag van de week.');
  }
  if (!Number.isInteger(g.start_hour) || g.start_hour < 0 || g.start_hour > 23) {
    return t('Kies een beginuur tussen 0 en 23.');
  }
  if (!Number.isInteger(g.start_minute) || g.start_minute < 0 || g.start_minute > 59) {
    return t('Kies een beginminuut tussen 0 en 59.');
  }
  if (!g.coach_id) return t('Kies een trainer voor de lesgroep.');
  if (g.season_end < g.season_start) return t('Het seizoen eindigt voor het begint.');
  return null;
}

/**
 * Alle lessen van deze groep, het hele seizoen door, op tijd gesorteerd — ook de lessen die
 * al geweest zijn. Dit is de lijst voor een overzicht of een telling achteraf, niet de lijst
 * waar een wijziging op mag landen. Daarvoor is `komendeLessen`.
 */
export function lessenVanGroep<B extends GroepBoeking>(bookings: B[], groupId: string): B[] {
  return bookings.filter((b) => b.group_id === groupId).sort((a, b) => at(a) - at(b));
}

/**
 * De lessen van deze groep vanaf nu, op tijd gesorteerd.
 *
 * Nooit de eerdere: een les die al gegeven is, is geschiedenis en hoort niet mee te veranderen
 * omdat iemand de groep vandaag aanpast. Een les die precies op `now` begint telt wél mee
 * (`>=`), zodat de les van dit uur niet ontsnapt doordat hij toevallig net begonnen is —
 * dezelfde grens als `seriesFrom` in lib/series. Een onbekende groep levert niets op, geen
 * fout: een groep zonder lessen is een gewone toestand aan het begin van een seizoen.
 *
 * Afgezegde lessen blijven hier staan. Dit is de lijst om mee te tonen en te tellen, en een
 * afgezegde les hoort de trainer te zien; wie een wijziging wil doorvoeren neemt
 * `komendeLessen`.
 */
export function groupBookingsFrom<B extends GroepBoeking>(
  bookings: B[],
  groupId: string,
  now: Date,
): B[] {
  const vanaf = now.getTime();
  return bookings
    .filter((b) => b.group_id === groupId && at(b) >= vanaf)
    .sort((a, b) => at(a) - at(b));
}

/**
 * De lessen die er nog echt aankomen: `groupBookingsFrom` zonder de afgezegde.
 *
 * Een afgezegde les wordt nooit meer gegeven. Zou een roosterwijziging haar deelnemerslijst
 * toch overschrijven, dan veranderde de geschiedenis van die afzegging — er stond achteraf
 * iemand ingeschreven die er nooit voor afgezegd is — zonder dat iemand daar iets aan heeft.
 */
export function komendeLessen<B extends GroepBoeking>(
  bookings: B[],
  groupId: string,
  now: Date,
): B[] {
  return groupBookingsFrom(bookings, groupId, now).filter((b) => b.status !== 'cancelled');
}

/**
 * Wat er zou veranderen als de groep dit rooster kreeg: de groep zelf, plus per komende les
 * de nieuwe deelnemerslijst. Er wordt hier niets weggeschreven en niets gemuteerd — de
 * provider zet het plan in één keer weg, zodat groep en lessen nooit half bijgewerkt raken.
 *
 * `participant_ids` bevat nooit de betaler van de les; zie `participantIdsOf` in lib/groups.
 * De betaler van elke boeking blijft dus ongemoeid, ook als hij niet in het nieuwe rooster
 * staat.
 */
export function planRosterChange(
  group: LesGroep,
  newRoster: string[],
  bookings: GroepBoeking[],
  now: Date,
): RosterChangePlan {
  const raken = komendeLessen(bookings, group.id, now);
  return {
    group: { ...group, roster: [...newRoster] },
    bookingPatches: raken.map((b) => ({ id: b.id, participant_ids: [...newRoster] })),
  };
}

/**
 * De sleutel waaraan een groep te herkennen is: naam, lesdag en beginuur. Eén naam kan in een
 * seizoen op drie momenten voorkomen met heel andere spelers, dus de naam alleen zegt niets.
 *
 * Dit is een herkenningssleutel om een groep uit een geïmporteerde planning terug te vinden,
 * en geen uniciteitsregel — zie `lesGroepFout`.
 */
export function groepSleutel(g: Pick<LesGroep, 'name' | 'weekday' | 'start_hour'>): string {
  return `${g.name.trim().toLowerCase()}|${g.weekday}|${g.start_hour}`;
}

/** De groepen die de club dit moment lesgeeft. */
export function actieveGroepen(groepen: LesGroep[]): LesGroep[] {
  return groepen.filter((g) => !g.archived);
}

/**
 * De groepen van een afgelopen seizoen. Ze blijven opvraagbaar in plaats van te verdwijnen:
 * hun lessen staan er nog, en wie er volgend jaar naar terugkijkt hoort te zien bij welke
 * groep die lessen hoorden.
 */
export function gearchiveerdeGroepen(groepen: LesGroep[]): LesGroep[] {
  return groepen.filter((g) => g.archived);
}
