// Rekenwerk rond de 10-beurtenkaart. Puur: elke functie geeft een nieuwe kaart terug.

import type { Beurtenkaart } from './types';

export const SESSIONS_PER_CARD = 10;

export function remaining(card: Beurtenkaart): number {
  return Math.max(0, card.total_sessions - card.uses.length);
}

/** De kaarten van één speler, nieuwste eerst. */
export function cardsFor(cards: Beurtenkaart[], playerId: string): Beurtenkaart[] {
  return cards
    .filter((c) => c.player_id === playerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * De kaart waarop een beurt geboekt wordt: die met de minste beurten over, zodat een
 * begonnen kaart eerst leeg raakt in plaats van dat er drie halfvolle blijven liggen.
 */
export function usableCardFor(cards: Beurtenkaart[], playerId: string): Beurtenkaart | null {
  const usable = cards.filter((c) => c.player_id === playerId && remaining(c) > 0);
  if (usable.length === 0) return null;
  return usable.reduce((best, c) => (remaining(c) < remaining(best) ? c : best));
}

/**
 * Boekt een beurt af. Een lege `bookingId` is een handmatige beurt van het kaartscherm;
 * die mag meermaals. Een beurt van dezelfde les wordt nooit dubbel geteld.
 */
export function useSession(card: Beurtenkaart, bookingId: string, date: string): Beurtenkaart {
  if (remaining(card) <= 0) return card;
  if (bookingId && card.uses.some((u) => u.booking_id === bookingId)) return card;
  return { ...card, uses: [...card.uses, { booking_id: bookingId, date }] };
}

/** Geeft de beurt van één les terug. Handmatige beurten blijven staan. */
export function releaseSession(card: Beurtenkaart, bookingId: string): Beurtenkaart {
  if (!bookingId) return card;
  return { ...card, uses: card.uses.filter((u) => u.booking_id !== bookingId) };
}

/** De min-knop op het kaartscherm: haalt alleen een handmatig gezette beurt weg. */
export function removeManualSession(card: Beurtenkaart): Beurtenkaart {
  const lastManual = [...card.uses].reverse().find((u) => u.booking_id === '');
  if (!lastManual) return card;
  const index = card.uses.lastIndexOf(lastManual);
  return { ...card, uses: [...card.uses.slice(0, index), ...card.uses.slice(index + 1)] };
}
