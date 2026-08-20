import { tennisColors } from '../constants/tennis-colors';
import type { Booking, Court, PaymentMethod, User } from './types';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'open', 'cash', 'invoice', 'qr', 'beurtenkaart', 'sponsor',
] as const;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  open: 'Open',
  cash: 'Cash',
  invoice: 'Factuur',
  qr: 'QR-code',
  beurtenkaart: '10-beurtenkaart',
  sponsor: 'Sponsor',
};

export interface PaymentMeta {
  color: string;
  label: string;
  subtle: boolean;
}

/** Kleur en label voor de badge. 'open' is bewust ingetogen: het is nog geen keuze. */
export function paymentMeta(method: PaymentMethod): PaymentMeta {
  const label = PAYMENT_LABELS[method];
  switch (method) {
    case 'cash':
      return { color: tennisColors.success, label, subtle: false };
    case 'invoice':
      return { color: tennisColors.court, label, subtle: false };
    case 'qr':
      return { color: tennisColors.primaryDark, label, subtle: false };
    case 'beurtenkaart':
      return { color: tennisColors.clay, label, subtle: false };
    case 'sponsor':
      return { color: tennisColors.warning, label, subtle: false };
    case 'open':
      return { color: tennisColors.textMuted, label, subtle: true };
  }
}

const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'completed', 'synchronized'];

/** Een les vraagt nog om afhandeling zolang de betaalwijze op 'open' staat. */
export function needsPayment(b: Booking): boolean {
  return PAYABLE_STATUSES.includes(b.status) && b.payment_method === 'open';
}

export function filterPendingPayment(bookings: Booking[]): Booking[] {
  return bookings.filter(needsPayment);
}

/**
 * "Welke lessen zijn van mij" — één regel voor de hele app: een trainer kijkt naar de
 * lessen die hij geeft, een speler naar de lessen die hij volgt. Stond eerder op meerdere
 * schermen los overgeschreven, en dat is precies het soort regel dat uit elkaar groeit.
 */
export function bookingsFor(user: User | null, bookings: Booking[]): Booking[] {
  if (!user) return [];
  return bookings.filter((b) =>
    user.role === 'coach' ? b.coach_id === user.id : b.player_id === user.id,
  );
}

/**
 * De lessen die iemand in een overzicht mag zien vóór hij zelf filtert. Een speler ziet
 * alleen zijn eigen lessen — dat blijft de harde regel, ook als hij op één trainer filtert.
 * Een trainer mag over de schutting kijken: hij kan de agenda van een collega opvragen, dus
 * bij hem is de hele lijst de basis en kiest de trainerfilter erin.
 */
export function visibleBookings(user: User | null, bookings: Booking[]): Booking[] {
  if (!user) return [];
  return user.role === 'coach' ? bookings : bookingsFor(user, bookings);
}

/**
 * Filteren op één trainer; null betekent "alle trainers" en laat alles staan. Bewust een
 * losse functie naast `visibleBookings`: wie mag wat zien is een andere vraag dan wat je op
 * dit moment wílt zien, en alleen zo blijft de eerste regel altijd gelden.
 */
export function bookingsByCoach(bookings: Booking[], coachId: string | null): Booking[] {
  if (coachId === null) return bookings;
  return bookings.filter((b) => b.coach_id === coachId);
}

/**
 * De betalingen die een gebruiker mag afhandelen. Geld blijft per trainer: een trainer
 * handelt zijn eigen lessen af, een speler ziet alleen die van hemzelf.
 */
export function pendingPaymentsFor(user: User | null, bookings: Booking[]): Booking[] {
  return filterPendingPayment(bookingsFor(user, bookings));
}

const REVENUE_METHODS: PaymentMethod[] = ['cash', 'invoice', 'qr', 'beurtenkaart', 'sponsor'];

/**
 * Alleen 'open' telt niet mee: daar is nog niets afgesproken, dus er is nog geen geld.
 *
 * Sponsor telt bewust wél mee. Een gesponsorde les zit in het sponsorcontract, en dat
 * contract is betaald geld: de speler heeft een bedrag dat hij mag verlessen (zie
 * `lib/sponsor.ts`), en elke gesponsorde les haalt daar zijn deel uit. Hem uit de omzet
 * laten zou betekenen dat de trainer werk levert dat nergens in zijn cijfers terugkomt,
 * terwijl het geld er wel degelijk is. Niet terugdraaien zonder ook het budget te herzien.
 */
export function countsAsRevenue(method: PaymentMethod): boolean {
  return REVENUE_METHODS.includes(method);
}

/** De tijdvelden die een prijsberekening nodig heeft. */
export type TimedBooking = Pick<Booking, 'start_time' | 'end_time'>;

/**
 * De duur van een les in minuten. Een kapotte of omgekeerde eindtijd telt als 0, zodat
 * er nergens een NaN of een negatief bedrag uit rolt.
 */
export function bookingMinutes(b: TimedBooking): number {
  const raw = Math.round((new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 60000);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Wat een les kost: het uurtarief van de baan naar rato van de duur, op de cent afgerond.
 * Eén berekening voor omzet én maandoverzicht, anders toont het exportscherm twee
 * bedragen naast elkaar die bij een half uur les een factor twee schelen.
 */
export function bookingPrice(b: TimedBooking, hourlyRate: number | undefined): number {
  const minutes = bookingMinutes(b);
  if (minutes === 0) return 0;
  return Math.round(((hourlyRate ?? 0) * minutes) / 60 * 100) / 100;
}

/** Gerealiseerde omzet: de prijs per bevestigde les met een betalende betaalwijze. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const rateById = new Map(courts.map((c) => [c.id, c.hourly_rate]));
  const sum = bookings
    // Een les die nog niet bevestigd is (bv. 'pending'), is nog geen geld.
    .filter((b) => PAYABLE_STATUSES.includes(b.status) && countsAsRevenue(b.payment_method))
    .reduce((total, b) => total + bookingPrice(b, rateById.get(b.court_id)), 0);
  // Centen bij elkaar optellen laat kommagetallen driften; het totaal blijft een bedrag.
  return Math.round(sum * 100) / 100;
}

/** De betaalwijze die een nieuwe les van deze speler krijgt. */
export function defaultMethodFor(player: User | null | undefined): PaymentMethod {
  return player?.default_payment_method ?? 'open';
}
