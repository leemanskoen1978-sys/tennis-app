// Tussen welke uren er bij een trainer geboekt kan worden — en wanneer daar iets anders
// geldt dan gewoonlijk.
//
// Drie lagen, van breed naar smal, en elke smallere wint:
//
//  1. De club. `settings.booking_end_time` zegt tot hoe laat er in het algemeen geboekt
//     wordt; de dag begint om 09:00. Dat is wat een trainer krijgt die niets invulde.
//  2. De trainer. Zijn `working_hours` zijn zijn eigen standaard, en die mag buiten de
//     clubtijd vallen: geeft hij les tot tien uur 's avonds, dan hoort dat te kunnen zonder
//     dat de hele club tot tien uur openstaat. (Vroeger was de clubtijd een harde grens en
//     kon een trainer er alleen binnen schuiven.)
//  3. De periode. Een zomerrooster, een maand waarin hij later begint, een week waarin hij
//     er niet is — zie `Boekingsperiode` in lib/types.
//
// Overlappen twee periodes elkaar, dan wint de eerste in de lijst. Dat is de volgorde
// waarin ze ingevoerd zijn, en dus de enige volgorde die de trainer op zijn scherm terugziet
// en zelf kan bijsturen; slimmer doen (de kortste, de laatst gemaakte) is een regel die
// niemand kan navertellen als het misgaat.
//
// De vakanties van de club staan hier bewust niet in. Die sluiten iedereen, gelden dus niet
// per trainer, en worden op de schermen apart getoond — met de naam van de vakantie erbij,
// wat hier niet zou passen.

import { dagSleutel, parseDag } from './vakanties';
import type { Boekingsperiode, User } from './types';

/** De velden die dit bestand van een trainer nodig heeft. */
export type BoekingsTrainer = Pick<User, 'working_hours' | 'booking_periods'>;

/** Een begin- en einduur, allebei als 'HH:MM'. */
export interface Uren {
  start: string;
  end: string;
}

/** Waar de dag begint als niemand iets anders zegt. Zie ook `generateSlots` in lib/slots. */
export const CLUB_START = '09:00';

/**
 * De uren waaruit een mens kan kiezen: de hele dag, van 06:00 tot en met 23:00.
 *
 * Bewust niet begrensd door de clubtijd. Wie zijn eigen boekingstijd zet, moet die juist
 * buiten de clubtijd kunnen leggen — anders zet hij het veld dat hem daarvan zou bevrijden
 * met dezelfde grens weer vast.
 */
export function keuzeUren(): string[] {
  const uren: string[] = [];
  for (let h = 6; h <= 23; h++) uren.push(`${String(h).padStart(2, '0')}:00`);
  return uren;
}

/** De periodes op volgorde van begindag; wat kapot is valt weg. */
export function sorteerPeriodes(periodes: Boekingsperiode[]): Boekingsperiode[] {
  return periodes
    .filter((p) => parseDag(p.van) !== null && parseDag(p.tot) !== null)
    .sort((a, b) => a.van.localeCompare(b.van) || a.tot.localeCompare(b.tot));
}

/**
 * De periode waarin deze dag valt, of `null`. Beide grenzen tellen mee, en omgekeerd
 * ingevuld (tot vóór van) wordt gelezen als de dagen ertussen — dezelfde afspraak als bij
 * een vakantie, zodat een omgedraaide invoer overal hetzelfde doet.
 */
export function periodeOpDag(
  trainer: BoekingsTrainer,
  dag: string,
): Boekingsperiode | null {
  return (trainer.booking_periods ?? []).find((p) => {
    if (parseDag(p.van) === null || parseDag(p.tot) === null) return false;
    const [van, tot] = p.van <= p.tot ? [p.van, p.tot] : [p.tot, p.van];
    return dag >= van && dag <= tot;
  }) ?? null;
}

/** Idem, voor een `Date`. */
export function periodeOp(trainer: BoekingsTrainer, d: Date): Boekingsperiode | null {
  return periodeOpDag(trainer, dagSleutel(d));
}

/**
 * De uren die op deze dag bij deze trainer gelden, of `null` als hij die dag niet boekbaar
 * is. De drie lagen bovenaan dit bestand, in één antwoord.
 */
export function urenOp(
  trainer: BoekingsTrainer,
  dag: Date,
  clubEinde: string,
): Uren | null {
  const periode = periodeOp(trainer, dag);
  if (periode !== null) return periode.uren ?? null;
  return trainer.working_hours ?? { start: CLUB_START, end: clubEinde };
}

/** De hele uren tussen twee tijdstippen: '09:00' tot '12:00' geeft 09, 10 en 11. */
export function urenTussen(start: string, eind: string): string[] {
  const uur = (t: string): number => parseInt(t.slice(0, 2), 10);
  const van = uur(start);
  const tot = uur(eind);
  const uren: string[] = [];
  for (let h = van; h < tot; h++) uren.push(`${String(h).padStart(2, '0')}:00`);
  return uren;
}

/**
 * De uren waarop je bij deze trainer op deze dag kunt boeken. Leeg betekent: die dag niet —
 * omdat een periode het zegt, of omdat zijn eigen uren elkaar raken.
 */
export function slotsOp(
  trainer: BoekingsTrainer,
  dag: Date,
  clubEinde: string,
): string[] {
  const uren = urenOp(trainer, dag, clubEinde);
  if (uren === null) return [];
  return urenTussen(uren.start, uren.end);
}

/** Is er bij deze trainer op deze dag überhaupt een uur te boeken? */
export function boekbaarOp(
  trainer: BoekingsTrainer,
  dag: Date,
  clubEinde: string,
): boolean {
  return slotsOp(trainer, dag, clubEinde).length > 0;
}

/**
 * Waarom deze periode niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand nog
 * aan het typen is, dus "nog niet af" telt hier als fout zonder dat er iets ergs gebeurt.
 */
export function periodeFout(
  van: string,
  tot: string,
  uren: Uren | null,
  taal: (nl: string) => string,
): string | null {
  if (parseDag(van) === null || parseDag(tot) === null) {
    return taal('Vul beide dagen in als dd/mm/jjjj.');
  }
  if (uren !== null && uren.start >= uren.end) {
    return taal('Kies een van-uur en een tot-uur, met het van-uur eerst.');
  }
  return null;
}

/** "09:00 – 21:00", of wat er staat als deze periode juist géén les betekent. */
export function urenTekst(uren: Uren | null, taal: (nl: string) => string): string {
  return uren === null ? taal('Geen les') : `${uren.start} – ${uren.end}`;
}
