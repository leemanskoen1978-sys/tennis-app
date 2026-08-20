// Rekenwerk rond het sponsorbudget. Hetzelfde idee als de 10-beurtenkaart, maar in euro's:
// een speler met een sponsorcontract heeft een bedrag dat hij mag verlessen, en elke
// gesponsorde les knabbelt daaraan. Puur rekenwerk — geen store, geen scherm — zodat elke
// overgang te testen is in plaats van met de hand na te spelen in de app.
//
// Een gesponsorde les kost hier evenveel als elke andere les: `bookingPrice`, dus het
// tarief van het terrein naar rato van de duur. Een half uur eet zo een half uurtarief
// van het contract op, precies zoals het in de omzet terechtkomt.
//
// Een groepsles komt hier nooit voorbij: sponsorbudget geldt alleen voor een privéles, net
// als de beurtenkaart. Een groepsles gaat altijd op factuur. Dat wordt afgedwongen in
// `planMethodChange` (lib/beurtenkaart); hier is het alleen de reden dat het verbruik nooit
// een groepsbedrag kan bevatten.

import { formatEuro } from './csv';
import { bookingPrice, lessonShares } from './payments';
import type { Booking, Court, User } from './types';

/** De spelersvelden die het budget nodig heeft; meer weet dit bestand niet van een speler. */
export type SponsorPlayer = Pick<User, 'id' | 'sponsor_budget'>;

/** De lessenvelden die het verbruik nodig heeft. */
export type SponsorBooking = Pick<
  Booking,
  | 'id' | 'player_id' | 'participant_ids' | 'court_id' | 'status' | 'payment_method'
  | 'beurtenkaart_id' | 'payment_split' | 'start_time' | 'end_time'
>;

/** De lessenvelden die nodig zijn om te weten wat één les kost. */
export type PricedBooking = Pick<
  Booking, 'id' | 'player_id' | 'participant_ids' | 'court_id' | 'start_time' | 'end_time'
>;

/** Centen bij elkaar optellen laat kommagetallen driften; een bedrag blijft een bedrag. */
function euro(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Vergelijken doe je in centen: 0.1 + 0.2 is anders net te veel voor een budget van 0.3. */
function cents(n: number): number {
  return Math.round(n * 100);
}

export interface SponsorState {
  /** Het contractbedrag; 0 als er geen contract is. */
  budget: number;
  /** Heeft deze speler überhaupt een sponsorcontract? Een leeg veld betekent van niet. */
  hasBudget: boolean;
  /** Wat er al verlest is. Kan hoger zijn dan het budget als de trainer dat verlaagde. */
  used: number;
  /** Wat er nog over is. Nooit negatief — zie `sponsorState`. */
  left: number;
}

/** Wat één les kost volgens het tarief van zijn terrein, groepsstaffel meegerekend. */
export function sponsorPriceOf(booking: PricedBooking, courts: Court[]): number {
  return bookingPrice(booking, courts.find((c) => c.id === booking.court_id));
}

/**
 * Wat er van het budget verbruikt is: de waarde van de niet-geannuleerde lessen van deze
 * speler met betaalwijze 'sponsor'. Een geannuleerde les is niet doorgegaan en hoort het
 * contract dus niets te kosten — dezelfde regel als overal elders bij geld.
 *
 * `ignoreBookingId` laat één les buiten de telling. Dat is de les die je op dit moment op
 * sponsor wilt zetten: stond hij daar al op, dan zou hij anders twee keer meetellen en van
 * zichzelf de conclusie "past niet meer" afdwingen.
 */
export function sponsorUsed(
  bookings: SponsorBooking[],
  courts: Court[],
  playerId: string,
  ignoreBookingId?: string,
): number {
  const sum = bookings
    .filter((b) => b.status !== 'cancelled' && b.id !== ignoreBookingId)
    // Per betalend deel, niet per les: bij apart betalen spreekt deze speler alleen zijn
    // eigen deel van de groepsles aan, en bij samen betalen de hele les. Dat de kolom
    // "verlest" en de omzet uit dezelfde bron komen is precies de bedoeling.
    .reduce((total, b) => total + lessonShares(b, courts.find((c) => c.id === b.court_id))
      .filter((s) => s.player_id === playerId && s.method === 'sponsor')
      .reduce((sub, s) => sub + s.amount, 0), 0);
  return euro(sum);
}

/**
 * Budget, verbruik en rest van één speler in één blik.
 *
 * Wat er over is, wordt nooit negatief. Verlaagt een trainer het contractbedrag tot onder
 * wat er al verlest is, dan blijven die lessen gewoon staan — ze zijn gegeven en betaald,
 * daar valt met terugwerkende kracht niets meer aan te doen — maar er kan niets meer bij:
 * de rest is 0 en elke nieuwe sponsorles wordt geweigerd. Dat is de minst schadelijke
 * uitkomst: geen les die zichzelf omkeert, en nooit een min-bedrag op het scherm.
 */
export function sponsorState(
  player: SponsorPlayer | null | undefined,
  bookings: SponsorBooking[],
  courts: Court[],
  ignoreBookingId?: string,
): SponsorState {
  const raw = player?.sponsor_budget;
  const hasBudget = typeof raw === 'number' && Number.isFinite(raw) && raw > 0;
  const budget = hasBudget ? euro(raw as number) : 0;
  const used = player ? sponsorUsed(bookings, courts, player.id, ignoreBookingId) : 0;
  return { budget, hasBudget, used, left: Math.max(0, euro(budget - used)) };
}

/** Past een les van dit bedrag nog binnen wat er over is? Zonder contract past niets. */
export function fitsInSponsorBudget(state: SponsorState, price: number): boolean {
  if (!state.hasBudget) return false;
  return cents(price) <= cents(state.left);
}

/**
 * Wat de trainer in het veld typt, als bedrag. Leeg — of onzin, of een negatief bedrag —
 * betekent: geen sponsorcontract. Een komma mag: zo schrijft men hier een bedrag.
 */
export function parseSponsorBudget(text: string): number | undefined {
  const cleaned = text.replace(/[€\s]/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return euro(value);
}

/** Alles wat één beslissing over het sponsorbudget nodig heeft. */
export interface SponsorContext {
  player: SponsorPlayer | null | undefined;
  /** Alle lessen; welke ervan meetellen bepaalt `sponsorUsed` zelf. */
  bookings: SponsorBooking[];
  courts: Court[];
}

/**
 * Waarom deze les niet op sponsor mag, of `null` als het gewoon mag. Eén formulering voor
 * elk scherm dat de betaalwijze laat kiezen, zodat de trainer overal hetzelfde leest.
 */
export function sponsorRefusal(booking: PricedBooking, ctx: SponsorContext): string | null {
  const state = sponsorState(ctx.player, ctx.bookings, ctx.courts, booking.id);
  if (!state.hasBudget) return 'Deze speler heeft geen sponsorbudget.';
  const price = sponsorPriceOf(booking, ctx.courts);
  if (fitsInSponsorBudget(state, price)) return null;
  if (state.left === 0) return 'Het sponsorbudget van deze speler is op.';
  return `Deze les past niet meer in het sponsorbudget: nog € ${formatEuro(state.left)} over.`;
}

/**
 * De regel onder de betaalwijzen: wat deze speler nog te besteden heeft. Zelfde vorm als
 * "Nog 4 beurten over." bij de beurtenkaart, want het is dezelfde vraag in euro's. Hij
 * noemt het budget bij naam: naast de beurtenregel moet een bedrag zichzelf verklaren.
 */
export function sponsorHint(state: SponsorState): string {
  if (!state.hasBudget) return 'Deze speler heeft geen sponsorbudget.';
  return `Sponsorbudget: nog € ${formatEuro(state.left)} van € ${formatEuro(state.budget)} over.`;
}
