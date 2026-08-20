// Het rekenwerk achter Beheer → Rapport. Het scherm mag alleen tonen wat hier uitkomt:
// zodra een cijfer in een component wordt uitgerekend, kan het naast de kaart erboven een
// ander verhaal gaan vertellen — precies wat er met "omzet" en "geboekt" eerder dreigde.
//
// Twee regels gelden overal in dit bestand:
//  1. Een geannuleerde les telt nergens mee. Hij is niet doorgegaan, dus hij is geen les en
//     geen geld. Dezelfde keuze als bij de bedragen op Historiek.
//  2. Een bedrag is gerealiseerde omzet: dezelfde regel als `totalRevenue`, zodat de som van
//     alle spelers en de som van alle maanden exact het getal op de omzetkaart is. Naast dat
//     bedrag staat per speler wat er nog openstaat; dat is een apart getal en telt nooit bij
//     de omzet op.
//  3. Omzet en trainersloon zijn twee verschillende bedragen. Omzet loopt op het uurtarief
//     van de baan (wat de speler betaalt), het trainersloon op het uurtarief van de trainer
//     (wat hij krijgt). Ze mogen nooit in elkaar geschoven worden.

import { bookingPrice, coachPayout, countsAsRevenue } from './payments';
import { shortMonthName } from './period';
import type { Booking, Court, PaymentMethod, User } from './types';

/** De statussen waarin een les daadwerkelijk staat te gebeuren of gebeurd is. */
const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'completed', 'synchronized'];

/** De lessen die meetellen: alles behalve de geannuleerde. */
export function countedBookings(bookings: Booking[]): Booking[] {
  return bookings.filter((b) => b.status !== 'cancelled');
}

/** Het uurtarief per terrein, één keer opgezocht in plaats van per les opnieuw. */
function ratesById(courts: Court[]): Map<string, number> {
  return new Map(courts.map((c) => [c.id, c.hourly_rate]));
}

/** Wat één les opbrengt; 0 zolang er niets betaalds is afgesproken. */
function revenueOf(b: Booking, rates: Map<string, number>): number {
  if (!PAYABLE_STATUSES.includes(b.status) || !countsAsRevenue(b.payment_method)) return 0;
  return bookingPrice(b, rates.get(b.court_id));
}

/**
 * Wat er van één les nog openstaat: de volle prijs zolang de betaalwijze 'open' is, anders 0.
 * Dezelfde prijsregel als `revenueOf`, zodat betaald en openstaand optelbaar zijn.
 *
 * Sponsor staat hier bewust niet bij, maar niet omdat er geen geld is: een gesponsorde les
 * zit in het sponsorcontract en dat is betaald geld (zie `lib/sponsor.ts` en
 * `countsAsRevenue`). Hij telt dus mee als omzet — in de kolom "betaald" — en juist daarom
 * nooit als openstaand: er komt niets meer bij.
 */
function openAmountOf(b: Booking, rates: Map<string, number>): number {
  if (!PAYABLE_STATUSES.includes(b.status) || b.payment_method !== 'open') return 0;
  return bookingPrice(b, rates.get(b.court_id));
}

/** Centen bij elkaar optellen laat kommagetallen driften; een bedrag blijft een bedrag. */
function euro(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PlayerTotal {
  playerId: string;
  name: string;
  /** Aantal lessen van deze speler in de selectie, geannuleerde niet meegerekend. */
  lessons: number;
  /** Gerealiseerde omzet van die lessen: het geld dat binnen is of onderweg is. */
  paid: number;
  /** De waarde van de lessen waarvan de betaalwijze nog 'open' staat. */
  open: number;
}

/**
 * Wie hoeveel lessen had, wat daarvan betaald is en wat er nog openstaat.
 *
 * Gesorteerd op betaald plus openstaand, aflopend: dat is wat een speler in totaal waard is
 * geweest, en alleen zo blijft een speler die twee lessen nog niet afrekende bovenaan staan
 * in plaats van onderaan bij de spelers zonder lessen. Bij een gelijk totaal beslist de naam,
 * anders wisselen twee spelers met hetzelfde totaal bij elke hertekening van plaats.
 *
 * Een gesponsorde les staat bij het betaalde bedrag en niet bij het openstaande — zie
 * `openAmountOf`. Een geannuleerde les telt nergens mee, ook niet als les.
 *
 * Een speler die niet meer bestaat verdwijnt niet uit het overzicht: zijn lessen zijn wél
 * gegeven en zijn geld is wél binnengekomen, dus hij blijft staan als "Onbekend".
 */
export function totalsByPlayer(
  bookings: Booking[],
  users: User[],
  courts: Court[],
): PlayerTotal[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rates = ratesById(courts);
  const totals = new Map<string, PlayerTotal>();

  for (const b of countedBookings(bookings)) {
    const row = totals.get(b.player_id) ?? {
      playerId: b.player_id,
      name: nameById.get(b.player_id) ?? 'Onbekend',
      lessons: 0,
      paid: 0,
      open: 0,
    };
    row.lessons += 1;
    row.paid += revenueOf(b, rates);
    row.open += openAmountOf(b, rates);
    totals.set(b.player_id, row);
  }

  return [...totals.values()]
    .map((r) => ({ ...r, paid: euro(r.paid), open: euro(r.open) }))
    .sort((a, b) => ((b.paid + b.open) - (a.paid + a.open)) || a.name.localeCompare(b.name, 'nl'));
}

export interface CoachTotal {
  coachId: string;
  name: string;
  /** Aantal lessen van deze trainer in de selectie, geannuleerde niet meegerekend. */
  lessons: number;
  /** Wat hij daarvoor krijgt: zijn eigen uurtarief naar rato van de duur. */
  amount: number;
  /**
   * Waar zijn `amount` bewust 0 is omdat er nog geen uurtarief is ingevuld. Het scherm zet
   * daar een waarschuwing bij: een vergeten tarief moet opvallen, niet stilzwijgend uit het
   * overzicht verdwijnen.
   */
  missingRate: boolean;
}

/**
 * Wie hoeveel lessen gaf en wat daarvoor uitbetaald wordt. Zelfde opbouw als
 * `totalsByPlayer`: aflopend op bedrag, bij een gelijk bedrag beslist de naam, zodat twee
 * trainers met hetzelfde bedrag niet bij elke hertekening van plaats wisselen.
 *
 * Let op het verschil met de omzet: die loopt op het uurtarief van de BAAN en is wat de
 * speler betaalt. Dit loopt op het uurtarief van de TRAINER. Het verschil tussen beide is
 * wat de club overhoudt (`clubMargin` in lib/payments).
 *
 * Een trainer die niet meer bestaat blijft staan als "Onbekend": zijn lessen zijn gegeven.
 * Hij heeft dan ook geen tarief meer, dus hij krijgt dezelfde melding als een trainer die
 * er nooit een invulde.
 */
export function payoutsByCoach(bookings: Booking[], users: User[]): CoachTotal[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const totals = new Map<string, CoachTotal>();

  for (const b of countedBookings(bookings)) {
    const coach = byId.get(b.coach_id);
    const row = totals.get(b.coach_id) ?? {
      coachId: b.coach_id,
      name: coach?.name ?? 'Onbekend',
      lessons: 0,
      amount: 0,
      // Een tarief van 0 is een ingevuld tarief; alleen "niets ingevuld" is de melding waard.
      missingRate: coach?.hourly_rate === undefined,
    };
    row.lessons += 1;
    // Alleen een les die doorgaat levert werk op — dezelfde statussen als bij de omzet.
    if (PAYABLE_STATUSES.includes(b.status)) {
      row.amount += coachPayout(b, coach?.hourly_rate);
    }
    totals.set(b.coach_id, row);
  }

  return [...totals.values()]
    .map((r) => ({ ...r, amount: euro(r.amount) }))
    .sort((a, b) => (b.amount - a.amount) || a.name.localeCompare(b.name, 'nl'));
}

export type PaymentBreakdown = Record<PaymentMethod, number>;

/** Hoeveel lessen er per betaalwijze staan. Geannuleerde lessen tellen ook hier niet mee. */
export function countByPaymentMethod(bookings: Booking[]): PaymentBreakdown {
  const empty: PaymentBreakdown = {
    open: 0, cash: 0, invoice: 0, qr: 0, beurtenkaart: 0, sponsor: 0,
  };
  return countedBookings(bookings).reduce<PaymentBreakdown>((acc, b) => {
    acc[b.payment_method] += 1;
    return acc;
  }, empty);
}

export interface MonthPoint {
  year: number;
  /** 0 = januari, zoals `Date#getMonth`. */
  month: number;
  /** "aug" — kort genoeg om onder een staafje te passen. */
  label: string;
  lessons: number;
  amount: number;
}

/** De maand waarin een les begint, als sleutel. Ongeldige tijden vallen weg. */
function monthKeyOf(b: Booking): string | null {
  const d = new Date(b.start_time);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/**
 * De omzet per maand over de laatste `months` maanden tot en met de maand waarin `until`
 * valt. Een lege maand blijft in de reeks staan met 0: een gat in het verloop is zelf de
 * informatie ("in juli lag alles stil"), en zonder die maanden zouden de staafjes ongelijk
 * verdeeld naast elkaar komen te staan.
 *
 * De reeks wordt bewust niet op de gekozen periode gefilterd: één maand omzet zegt niets
 * zonder de maanden ervoor. Het scherm rekent hem daarom over álle zichtbare lessen en zegt
 * erbij welke maanden er staan.
 *
 * Over een jaargrens heen loopt hij gewoon door — de maanden worden met `Date` uitgerekend,
 * dus december wordt vanzelf januari van het jaar erna.
 */
export function monthlySeries(
  bookings: Booking[],
  courts: Court[],
  until: Date,
  months: number,
): MonthPoint[] {
  const count = Math.max(0, Math.floor(months));
  const rates = ratesById(courts);

  const series: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(until.getFullYear(), until.getMonth() - i, 1);
    const point: MonthPoint = {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: shortMonthName(d.getMonth()),
      lessons: 0,
      amount: 0,
    };
    series.push(point);
    index.set(`${point.year}-${point.month}`, point);
  }

  for (const b of countedBookings(bookings)) {
    const key = monthKeyOf(b);
    const point = key === null ? undefined : index.get(key);
    // Lessen buiten de reeks tellen niet mee: de grafiek toont wat er onder de staafjes staat.
    if (!point) continue;
    point.lessons += 1;
    point.amount += revenueOf(b, rates);
  }

  return series.map((p) => ({ ...p, amount: euro(p.amount) }));
}
