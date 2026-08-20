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

import type { Booking, BookingStatus } from './types';

/**
 * De status waarmee een nieuwe les begint.
 *
 * Zet de trainer van die les hem zelf in, dan staat hij meteen vast: hij hoeft zichzelf
 * niets te vragen. Doet iemand anders het — een speler, of een trainer die bij een collega
 * boekt — dan wacht de les op goedkeuring van de trainer die hem moet geven.
 */
export function initialStatusFor(creatorId: string, coachId: string): BookingStatus {
  return creatorId === coachId ? 'confirmed' : 'pending';
}

/** Wacht deze les nog op een beslissing? */
export function isAwaitingApproval(b: Booking): boolean {
  return b.status === 'pending';
}

/** Moet déze trainer erover beslissen? */
export function needsApproval(b: Booking, coachId: string): boolean {
  return isAwaitingApproval(b) && b.coach_id === coachId;
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
): Booking[] {
  if (!coachId) return [];
  return bookings
    .filter((b) => needsApproval(b, coachId))
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
