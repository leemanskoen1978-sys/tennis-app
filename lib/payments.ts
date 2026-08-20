import { tennisColors } from '../constants/tennis-colors';
import { groupSize, isGroupLesson, lessonPlayerIds, playsIn } from './groups';
import type {
  Booking, Court, CourtGroupRate, PaymentMethod, PaymentSplit, User,
} from './types';

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

// ---------------------------------------------------------------------------
// Wie betaalt wat aan deze les.
//
// Een les wordt samen of apart afgerekend. Samen is één rekening voor de betaler — zoals de
// app altijd werkte. Apart is bij een groepsles: ieder krijgt zijn eigen deel gefactureerd.
// De betaalwijze zelf is daarbij niet in het geding: een groepsles gaat altijd op factuur, dus
// alleen het BEDRAG wordt verdeeld, niet de keuze.
//
// Elke plek die over geld gaat (omzet, rapport, export, badges) leest hier uit wie wat betaalt,
// en telt nergens meer zelf een les bij één speler op. Anders boekt de ene helft van de app het
// hele bedrag bij de betaler terwijl de andere helft het over vier spelers verdeelt.
// ---------------------------------------------------------------------------

/** De velden die "wie betaalt wat" nodig heeft. */
export type SplitBooking = Pick<
  Booking, 'player_id' | 'participant_ids' | 'payment_method' | 'beurtenkaart_id' | 'payment_split'
>;

/**
 * Samen of apart. Apart heeft alleen betekenis bij een groepsles: bij één speler valt er
 * niets te verdelen, en dan is 'separate' een restant van een deelnemer die eraf gehaald is.
 */
export function splitOf(b: SplitBooking): PaymentSplit {
  return b.payment_split === 'separate' && isGroupLesson(b) ? 'separate' : 'together';
}

/** Eén betalende partij van een les: wie, met welke betaalwijze, op welke kaart. */
export interface PaymentEntry {
  player_id: string;
  method: PaymentMethod;
  beurtenkaart_id?: string;
}

/**
 * Wie er voor deze les betaalt. Bij samen is dat één regel — de betaler. Bij apart één regel
 * per speler op de baan, in dezelfde volgorde als de les ze kent (betaler eerst).
 *
 * De betaalwijze is voor iedereen dezelfde: die van de les. Bij een groepsles is dat per
 * definitie 'invoice'. De kaart hoort alleen bij de betaler thuis, en een groepsles heeft er
 * toch geen — beurten gelden alleen voor een privéles.
 */
export function paymentEntriesOf(b: SplitBooking): PaymentEntry[] {
  if (splitOf(b) === 'together') {
    return [{
      player_id: b.player_id,
      method: b.payment_method,
      beurtenkaart_id: b.beurtenkaart_id,
    }];
  }
  return lessonPlayerIds(b).map((id) => ({ player_id: id, method: b.payment_method }));
}

/** De betaalregel van één speler bij deze les, of `null` als hij niets betaalt. */
export function paymentEntryFor(b: SplitBooking, playerId: string): PaymentEntry | null {
  return paymentEntriesOf(b).find((e) => e.player_id === playerId) ?? null;
}

/**
 * Een bedrag in gelijke delen, zó dat de delen samen exact het totaal zijn. Rekenen gebeurt
 * in centen: € 45 door 7 is anders zeven keer € 6,43 en dat is een cent te veel. De centen
 * die overblijven gaan naar de eerste delen — één iemand betaalt dus een cent meer dan de
 * ander, en dat is de enige verdeling waarbij er geen cent verdwijnt of dubbel geteld wordt.
 */
export function splitEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / parts);
  const rest = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

/** Eén betalende partij mét het bedrag dat zij voor deze les betaalt. */
export interface LessonShare extends PaymentEntry {
  /** Wat deze persoon voor deze les betaalt: bij samen de hele les, bij apart zijn deel. */
  amount: number;
}

/**
 * Wie betaalt wat, in euro's. De som van de delen is altijd exact `bookingPrice` van de les:
 * apart betalen verdeelt het bedrag, het verandert het niet. Daar staat of valt de omzet mee.
 */
export function lessonShares(
  b: SplitBooking & TimedBooking,
  court: PricedCourt | undefined,
): LessonShare[] {
  const entries = paymentEntriesOf(b);
  const total = bookingPrice(b, court);
  const parts = splitEvenly(total, entries.length);
  return entries.map((e, i) => ({ ...e, amount: parts[i] ?? 0 }));
}

/**
 * De badge van een les: de betaalwijze, en bij apart factureren dat erbij. "Factuur" alleen
 * zou namelijk niet verraden dat er vier facturen uitgaan in plaats van één.
 */
export function bookingPaymentMeta(b: SplitBooking): PaymentMeta {
  const meta = paymentMeta(b.payment_method);
  if (splitOf(b) === 'together') return meta;
  return { ...meta, label: `${meta.label} · apart` };
}

/** Een les vraagt nog om afhandeling zolang er iemand op 'open' staat. */
export function needsPayment(b: Booking): boolean {
  return PAYABLE_STATUSES.includes(b.status)
    && paymentEntriesOf(b).some((e) => e.method === 'open');
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
  // Een speler ziet ook de groepslessen waarin hij meedoet zonder te betalen: hij staat wel
  // degelijk op die baan, dus die les hoort in zijn agenda, in "Vandaag" en in zijn historiek.
  // Wat hij daar ziet is de les — niet de rekening; die blijft bij de betaler, zie
  // `bookingsBilledTo` hieronder.
  return bookings.filter((b) =>
    user.role === 'coach' ? b.coach_id === user.id : playsIn(b, user.id),
  );
}

/**
 * De lessen die op de REKENING van deze gebruiker staan. Bewust iets anders dan `bookingsFor`:
 * daar gaat het over meedoen, hier over betalen. Een deelnemer aan een groepsles betaalt
 * niets, dus zijn les hoort niet in zijn openstaande betalingen — anders zou dezelfde les bij
 * twee mensen tegelijk om afhandeling vragen en zou het bedrag dubbel geteld kunnen worden.
 */
export function bookingsBilledTo(user: User | null, bookings: Booking[]): Booking[] {
  if (!user) return [];
  return bookings.filter((b) => (user.role === 'coach'
    ? b.coach_id === user.id
    : paymentEntriesOf(b).some((e) => e.player_id === user.id)));
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
  if (!user) return [];
  // Bewust niet `bookingsFor`: afhandelen doet wie betaalt. Een trainer ziet elke les van
  // hemzelf waar nog iemand op 'Open' staat; een speler alleen de lessen waar zijn EIGEN
  // deel nog open staat — het deel van een ander is niet zijn rekening.
  if (user.role === 'coach') {
    return bookings.filter((b) => b.coach_id === user.id && needsPayment(b));
  }
  return bookings.filter((b) =>
    PAYABLE_STATUSES.includes(b.status)
    && paymentEntriesOf(b).some((e) => e.player_id === user.id && e.method === 'open'));
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

/** Een uurtarief naar rato van de duur, op de cent afgerond. De enige plek die dat rekent. */
function proRata(hourlyRate: number | undefined, minutes: number): number {
  const rate = typeof hourlyRate === 'number' && Number.isFinite(hourlyRate) ? hourlyRate : 0;
  return Math.round((rate * minutes) / 60 * 100) / 100;
}

/** De tariefvelden die een prijs nodig heeft; meer weet de berekening niet van een baan. */
export type PricedCourt = Pick<Court, 'hourly_rate' | 'group_rates'>;

/** Alles wat een prijs nodig heeft: de tijden én wie er meedoen. */
export type PricedBooking = TimedBooking & Pick<Booking, 'player_id' | 'participant_ids'>;

/**
 * De bruikbare stappen van de staffel, oplopend op groepsgrootte. Een stap zonder echt
 * bedrag of zonder echt aantal spelers valt weg: een half ingevulde stap hoort de prijs niet
 * op 0 of op NaN te zetten. Blijft er niets over, dan is er gewoon geen staffel en geldt het
 * uurtarief — de app doet dan precies wat ze zonder staffel ook deed.
 */
function usableSteps(court: PricedCourt | undefined): CourtGroupRate[] {
  return (court?.group_rates ?? [])
    .filter((s): s is CourtGroupRate =>
      !!s
      && typeof s.max_players === 'number' && Number.isFinite(s.max_players) && s.max_players >= 1
      && typeof s.rate === 'number' && Number.isFinite(s.rate) && s.rate >= 0)
    .sort((a, b) => a.max_players - b.max_players);
}

/**
 * Het uurtarief dat voor een groep van deze grootte geldt: de laagste stap die groot genoeg
 * is. Bij één speler, of zonder (bruikbare) staffel, blijft het gewone uurtarief van de baan
 * gelden — precies zoals vandaag.
 *
 * Een groep die groter is dan de hoogste stap valt terug op die hoogste stap. Dat is bewust
 * geen verzonnen doorrekening: staat er "tot 4 spelers € 45" en komt er een vijfde bij, dan
 * is € 45 het duurste dat de club zelf heeft opgeschreven, en een bedrag verzinnen zou een
 * rekening opleveren die nergens in Beheer terug te vinden is.
 *
 * Let op: dit is het TOTAAL per uur voor de hele les, niet per speler. Zie `CourtGroupRate`.
 */
export function rateForGroup(court: PricedCourt | undefined, size: number): number {
  const hourly = court?.hourly_rate;
  const base = typeof hourly === 'number' && Number.isFinite(hourly) ? hourly : 0;
  const steps = usableSteps(court);
  if (size <= 1 || steps.length === 0) return base;
  const step = steps.find((s) => size <= s.max_players) ?? steps[steps.length - 1];
  return step.rate;
}

/**
 * Wat een les kost: het tarief van de baan naar rato van de duur, op de cent afgerond.
 * Eén berekening voor omzet én maandoverzicht, anders toont het exportscherm twee
 * bedragen naast elkaar die bij een half uur les een factor twee schelen.
 *
 * Bij een groepsles telt de groepsgrootte mee via de staffel van de baan (`rateForGroup`).
 * Het is en blijft één bedrag voor de hele les: een half uur met vier spelers kost de helft
 * van de groepsstap, niet vier keer iets.
 *
 * Dit is wat de BETALER betaalt — één iemand, ook bij een groepsles. Wat de TRAINER eraan
 * overhoudt is een ander bedrag met een ander tarief; zie `coachPayout` hieronder.
 */
export function bookingPrice(b: PricedBooking, court: PricedCourt | undefined): number {
  const minutes = bookingMinutes(b);
  if (minutes === 0) return 0;
  return proRata(rateForGroup(court, groupSize(b)), minutes);
}

/**
 * Wat de TRAINER voor één les krijgt: zijn eigen uurtarief (`User.hourly_rate`) naar rato
 * van de duur. Bewust dezelfde rekenregel als `bookingPrice` — zelfde afronding op de cent,
 * en een kapotte of omgekeerde eindtijd geeft ook hier 0 — zodat de twee bedragen naast
 * elkaar op één scherm nooit een andere duur blijken te gebruiken.
 *
 * De groepsgrootte doet hier NIET mee: de trainer geeft één uur les, of daar nu één of vier
 * spelers op de baan staan. Alleen wat de club vraagt loopt op met de groep, niet wat de
 * trainer krijgt.
 *
 * Geen tarief ingevuld telt als 0. Dat is met opzet zichtbaar nul en niet "onbekend": de
 * schermen tonen er een waarschuwing bij, zodat een vergeten tarief opvalt in plaats van
 * stilletjes uit de som te verdwijnen.
 */
export function coachPayout(b: TimedBooking, hourlyRate: number | undefined): number {
  return proRata(hourlyRate, bookingMinutes(b));
}

/** Gerealiseerde omzet: de prijs per bevestigde les met een betalende betaalwijze. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const sum = bookings
    // Een les die nog niet bevestigd is (bv. 'pending'), is nog geen geld.
    .filter((b) => PAYABLE_STATUSES.includes(b.status))
    // Per betalende partij: bij apart betalen kan het ene deel betaald zijn en het andere
    // nog open staan. Samen opgeteld is dat nooit meer dan de prijs van de les.
    .reduce((total, b) => total + lessonShares(b, courtById.get(b.court_id))
      .filter((s) => countsAsRevenue(s.method))
      .reduce((sub, s) => sub + s.amount, 0), 0);
  // Centen bij elkaar optellen laat kommagetallen driften; het totaal blijft een bedrag.
  return Math.round(sum * 100) / 100;
}

/**
 * Wat er aan trainers uitbetaald wordt over deze lessen: per les het uurtarief van de
 * trainer die hem gaf, naar rato van de duur.
 *
 * Bewust NIET afhankelijk van de betaalwijze: een trainer heeft zijn uur gegeven, ook als de
 * speler nog niet betaald heeft of de les gesponsord is. Wat wél telt is of de les doorgaat —
 * dezelfde statussen als bij de omzet, dus een geannuleerde (of nog niet bevestigde) les
 * telt nergens mee.
 *
 * Een trainer die niet meer in de ledenlijst staat, of die nog geen tarief heeft, levert 0
 * op. Zijn lessen blijven wel gewoon lessen; zie `payoutsByCoach` in lib/reports voor de
 * uitsplitsing die daar een waarschuwing bij toont.
 */
export function totalCoachPayout(bookings: Booking[], users: User[]): number {
  const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
  const sum = bookings
    .filter((b) => PAYABLE_STATUSES.includes(b.status))
    .reduce((total, b) => total + coachPayout(b, rateById.get(b.coach_id)), 0);
  // Zelfde reden als bij `totalRevenue`: centen bij elkaar optellen laat kommagetallen driften.
  return Math.round(sum * 100) / 100;
}

/**
 * Wat de club overhoudt: de omzet van de banen min wat er naar de trainers gaat. Kan negatief
 * zijn — een trainer die duurder is dan de baan opbrengt kost de club geld, en dat hoort te
 * zien te zijn in plaats van weggerond te worden naar 0.
 */
export function clubMargin(bookings: Booking[], users: User[], courts: Court[]): number {
  return Math.round((totalRevenue(bookings, courts) - totalCoachPayout(bookings, users)) * 100) / 100;
}

/** De betaalwijze die een nieuwe les van deze speler krijgt. */
export function defaultMethodFor(player: User | null | undefined): PaymentMethod {
  return player?.default_payment_method ?? 'open';
}
