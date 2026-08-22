// Goedkeuring: een les die de trainer niet zelf inzette, gaat pas door als hij ja zegt.
//
// Een speler kan zelf boeken, maar de agenda is die van de trainer: hij bepaalt of die les
// er komt. Daarom krijgt zo'n boeking de status 'pending' en niet 'confirmed'. Dat is geen
// apart lijstje naast de les, maar de status van de les zelf — zo telt hij vanzelf nergens
// mee waar hij niet hoort: niet in de omzet, niet in de openstaande betalingen en niet in
// het openstaande saldo van de speler (zie de PAYABLE_STATUSES in lib/payments en
// lib/reports, die 'pending' bewust overslaan).
//
// Het tijdslot houdt hij wél bezet zolang er niet beslist is (`overlaps` in de provider
// kijkt alleen naar geannuleerde lessen). Anders zou de trainer een aanvraag goedkeuren die
// intussen door iemand anders is ingepikt.

import { playsIn } from './groups';
import type { Booking, BookingStatus } from './types';

/**
 * De status waarmee een nieuwe les begint.
 *
 * Zet de trainer van die les hem zelf in, dan staat hij meteen vast: hij hoeft zichzelf
 * niets te vragen. Doet iemand anders het — een speler, of een trainer die bij een collega
 * boekt — dan wacht de les op goedkeuring van de trainer die hem moet geven.
 *
 * Een beheerder is de uitzondering: hij maakt het lesrooster van de club, en een rooster
 * dat pas geldt als iedereen het goedkeurt, is geen rooster. Zijn les staat dus meteen
 * vast — ook in de agenda van een collega. Die ziet hem gewoon in zijn agenda staan.
 */
export function initialStatusFor(
  creatorId: string,
  coachId: string,
  doorBeheerder = false,
): BookingStatus {
  if (doorBeheerder) return 'confirmed';
  return creatorId === coachId ? 'confirmed' : 'pending';
}

/** Wacht deze les nog op een beslissing? */
export function isAwaitingApproval(b: Booking): boolean {
  return b.status === 'pending';
}

/** Moet déze trainer erover beslissen? */
export function needsApproval(b: Booking, coachId: string, magAlles = false): boolean {
  if (!isAwaitingApproval(b)) return false;
  // Een beheerder beslist over de hele club. Anders blijft een aanvraag liggen zodra de
  // trainer van dat uur een week weg is, en dan wacht de speler op iemand die niet kijkt.
  return magAlles || b.coach_id === coachId;
}

/**
 * Alles wat op de goedkeuring van deze trainer wacht, de eerstvolgende les vooraan.
 *
 * Op tijd van de les en niet op moment van boeken: wat morgen gebeurt is dringender dan
 * wat over drie weken gebeurt, ook als het later aangevraagd werd.
 */
export function awaitingApprovalFor(
  bookings: Booking[],
  coachId: string | null | undefined,
  magAlles = false,
): Booking[] {
  if (!coachId) return [];
  return bookings
    .filter((b) => needsApproval(b, coachId, magAlles))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

/** De aanvragen van een speler die nog op een antwoord wachten. */
export function awaitingApprovalOf(
  bookings: Booking[],
  playerId: string | null | undefined,
): Booking[] {
  if (!playerId) return [];
  return bookings
    .filter((b) => isAwaitingApproval(b) && b.player_id === playerId)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

// ---------------------------------------------------------------------------
// Terug naar de speler: wat is er met mijn aanvraag gebeurd?
// ---------------------------------------------------------------------------

/**
 * Hoe lang een weigering nieuws blijft. Daarna verdwijnt hij vanzelf van het startscherm —
 * er is niets weg te klikken en niets bij te houden. Een bericht van drie weken oud is geen
 * bericht meer, en een speler die er niets mee deed, doet er ook niets meer mee.
 */
export const WEIGERING_DAGEN = 7;

/**
 * De aanvragen van deze speler die de trainer onlangs geweigerd heeft, nieuwste eerst.
 *
 * Een goedgekeurde les staat hier niet bij: die verschijnt gewoon in zijn agenda, en dat is
 * het bericht. Een weigering is het enige dat anders nergens te zien is — de les verdwijnt
 * en niemand zegt waarom.
 *
 * Meespelers tellen mee: die stonden ook op die baan te wachten.
 */
export function recentGeweigerd(
  bookings: Booking[],
  // Leeg mag: een ouder zonder gekozen kind heeft niemand om berichten over te tonen, en
  // dat is een antwoord — geen lege lijst afdwingen bij elke aanroeper.
  playerId: string | null | undefined,
  now: Date,
  dagen: number = WEIGERING_DAGEN,
): Booking[] {
  if (!playerId) return [];
  const grens = now.getTime() - dagen * 24 * 60 * 60 * 1000;
  return bookings
    .filter((b) => b.status === 'cancelled' && b.rejected_at !== undefined && playsIn(b, playerId))
    .filter((b) => {
      const t = new Date(b.rejected_at as string).getTime();
      return Number.isFinite(t) && t >= grens;
    })
    .sort((a, b) => (b.rejected_at ?? '').localeCompare(a.rejected_at ?? ''));
}
