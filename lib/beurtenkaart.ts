// Rekenwerk rond de 10-beurtenkaart. Puur: elke functie geeft een nieuwe kaart terug.

import { isGroupLesson } from './groups';
import { sponsorRefusal, type SponsorContext } from './sponsor';
import type { Beurtenkaart, Booking, PaymentMethod } from './types';

/**
 * Een groepsles gaat altijd op factuur. Een beurt op een 10-beurtenkaart staat voor één
 * PRIVÉles, en het sponsorbudget net zo; bij een groep geldt de tariefstaffel van de baan, en
 * die kost een ander bedrag dan één beurt. Cash of QR laat zich evenmin over vier spelers
 * verdelen. Wat er bij een groepsles nog te kiezen valt, is alleen wie de factuur krijgt:
 * de betaler alleen, of ieder zijn deel (`Booking.payment_split`).
 *
 * De weigering staat hier, in de enige weg waarlangs een betaalwijze wordt vastgesteld, en
 * niet op een scherm: een scherm kun je omzeilen.
 */
export const GROEPSLES_METHOD: PaymentMethod = 'invoice';
export const GROEPSLES_ALLEEN_FACTUUR = 'Een groepsles gaat altijd op factuur.';

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
 * Bij gelijkspel wint de oudste kaart: die is al langer in gebruik en hoort eerst op te raken.
 */
export function usableCardFor(cards: Beurtenkaart[], playerId: string): Beurtenkaart | null {
  const usable = cards.filter((c) => c.player_id === playerId && remaining(c) > 0);
  if (usable.length === 0) return null;
  return usable.reduce((best, c) => {
    if (remaining(c) < remaining(best)) return c;
    if (remaining(c) > remaining(best)) return best;
    return c.created_at.localeCompare(best.created_at) < 0 ? c : best;
  });
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

/** De boekinggegevens die een betaalwijzewissel nodig heeft. */
export type MethodChangeBooking = Pick<
  Booking,
  | 'id' | 'player_id' | 'participant_ids' | 'court_id' | 'start_time' | 'end_time'
  | 'status' | 'payment_method' | 'beurtenkaart_id' | 'payment_split'
>;

export interface MethodChangePlan {
  cards: Beurtenkaart[];
  cardId: string | undefined;
  /** Gezet als de wissel niet doorgaat; `cards` en `cardId` blijven dan zoals ze waren. */
  error: string | null;
}

/**
 * De hele beslissing achter een betaalwijzewissel op één plek, zonder store of state:
 * zo is elke overgang te testen in plaats van met de hand na te spelen in de app.
 * De aanroeper commit het resultaat alleen als `error` leeg is.
 */
export function planMethodChange(
  cards: Beurtenkaart[],
  booking: MethodChangeBooking,
  method: PaymentMethod,
  /**
   * Wat er nodig is om 'sponsor' te bewaken: de speler met zijn contractbedrag, alle lessen
   * en de tarieven. Weggelaten wordt sponsor niet bewaakt — de app geeft hem altijd mee;
   * de tests laten hem weg waar het over de beurtenkaart gaat.
   */
  sponsor?: SponsorContext,
): MethodChangePlan {
  const unchanged = { cards, cardId: booking.beurtenkaart_id };

  // Een geannuleerde les mag geen beurt opeten en hoort geen betaalwijze te krijgen.
  if (booking.status === 'cancelled') {
    return { ...unchanged, error: 'Een geannuleerde les krijgt geen betaalwijze.' };
  }

  // Een groepsles kent maar één betaalwijze. Dit vangt de beurtenkaart én het sponsorbudget
  // af: allebei zijn ze er voor een privéles.
  if (isGroupLesson(booking) && method !== GROEPSLES_METHOD) {
    return { ...unchanged, error: GROEPSLES_ALLEEN_FACTUUR };
  }

  // Sponsor is de beurtenkaart in euro's: het contract heeft een bodem. Past de les er niet
  // meer in, dan verandert er niets — anders zou een trainer stilzwijgend over het contract
  // van zijn sponsor heen boeken en dat pas op het rapport ontdekken.
  if (method === 'sponsor' && sponsor) {
    const refusal = sponsorRefusal(booking, sponsor);
    if (refusal) return { ...unchanged, error: refusal };
  }

  let next = cards;
  let cardId = booking.beurtenkaart_id;

  // Weg van de beurtenkaart: de beurt komt terug voor hij ergens anders heen kan.
  if (cardId && method !== 'beurtenkaart') {
    const previous = cardId;
    next = next.map((c) => (c.id === previous ? releaseSession(c, booking.id) : c));
    cardId = undefined;
  }

  // Dezelfde kaart nog eens kiezen kost geen tweede beurt: `cardId` staat er al.
  // Staat de les wél op 'beurtenkaart' zonder kaart (bv. via de standaard betaalwijze
  // van een speler), dan wordt de beurt hier alsnog afgeboekt. De vraag is niet of er een
  // id staat, maar of dat id nog ergens op slaat: een verweesde verwijzing zou anders
  // stilzwijgend gratis les opleveren.
  const booked = !!cardId && next.some((c) => c.id === cardId);
  if (method === 'beurtenkaart' && !booked) {
    const card = usableCardFor(next, booking.player_id);
    if (!card) {
      return { ...unchanged, error: 'Geen beurtenkaart met beurten over voor deze speler.' };
    }
    next = next.map((c) => (c.id === card.id ? useSession(c, booking.id, booking.start_time) : c));
    cardId = card.id;
  }

  return { cards: next, cardId, error: null };
}

// ---------------------------------------------------------------------------
// Wijzigingen aan de les zelf die het geld raken: er komt een deelnemer bij, er gaat er een
// af, of de trainer wisselt tussen samen en apart betalen. Steeds dezelfde afhandeling als bij
// een betaalwijzewissel: een beurt die niet meer mag blijven staan komt terug op de kaart, de
// betaalwijze valt terug op 'Open', en de trainer krijgt te lezen dát dat gebeurd is.
// ---------------------------------------------------------------------------

/** Het resultaat van zo'n wijziging: nieuwe kaarten, wat er op de les moet, en de uitleg. */
export interface BookingChangePlan {
  cards: Beurtenkaart[];
  patch: Partial<Booking>;
  /** Wat er ongevraagd meeveranderde; `null` als er niets te melden valt. */
  notice: string | null;
}

/**
 * De deelnemers van een les wijzigen.
 *
 * Het gevaarlijke geval staat hier: een privéles staat op een beurtenkaart (de beurt is
 * afgeboekt) of op het sponsorbudget, en de trainer zet er een tweede speler bij. Dan is het
 * een groepsles, en die gaat op factuur. De beurt komt terug op de kaart, het sponsorbudget
 * komt vanzelf vrij — dat wordt uit de lessen berekend en niet apart bijgehouden — en de
 * trainer krijgt te lezen dát dat gebeurd is. Een betaalwijze die stilletjes verandert is een
 * verdwenen afspraak.
 *
 * Andersom net zo: gaat de laatste deelnemer eraf, dan is het weer een privéles. De
 * betaalwijze valt dan terug op 'Open' en niet op de factuur die er stond, want die factuur
 * was een gevolg van de groep en geen keuze van de trainer. Zo komt de les weer in de
 * werklijst van Beheer → Betalingen en kiest er alsnog iemand bewust.
 */
export function planParticipantsChange(
  cards: Beurtenkaart[],
  booking: MethodChangeBooking,
  participantIds: string[],
): BookingChangePlan {
  const wasGroup = isGroupLesson(booking);
  const isGroup = isGroupLesson({ ...booking, participant_ids: participantIds });
  const patch: Partial<Booking> = { participant_ids: participantIds };

  if (isGroup && !wasGroup) {
    const previous = booking.payment_method;
    const cardId = booking.beurtenkaart_id;
    patch.payment_method = GROEPSLES_METHOD;
    patch.beurtenkaart_id = undefined;
    const extra = previous === 'beurtenkaart'
      ? ' De beurt is teruggegeven op de kaart.'
      : previous === 'sponsor'
        ? ' Het sponsorbudget komt weer vrij.'
        : '';
    return {
      cards: cardId ? cards.map((c) => (c.id === cardId ? releaseSession(c, booking.id) : c)) : cards,
      patch,
      notice: previous === GROEPSLES_METHOD
        ? null
        : `${GROEPSLES_ALLEEN_FACTUUR}${extra} De betaalwijze staat nu op “Factuur”.`,
    };
  }

  if (wasGroup && !isGroup) {
    patch.payment_method = 'open';
    patch.beurtenkaart_id = undefined;
    patch.payment_split = undefined;
    return {
      cards,
      patch,
      notice: 'Dit is weer een privéles. De betaalwijze staat op “Open”, zodat er opnieuw '
        + 'gekozen kan worden — beurtenkaart en sponsor kunnen nu weer.',
    };
  }

  // Groep blijft groep, of privé blijft privé: aan het geld verandert niets.
  return { cards, patch, notice: null };
}

/**
 * Wisselen tussen samen en apart factureren. Aan de betaalwijze verandert dat niets — een
 * groepsles staat toch al op factuur — en er komt geen beurt of sponsorbudget bij kijken.
 * Alleen wie de rekening krijgt verandert, en dat is precies wat `payment_split` zegt.
 *
 * Bij een privéles is er niets te verdelen: dan blijft de les staan zoals hij staat.
 */
export function planSplitChange(
  booking: MethodChangeBooking,
  split: NonNullable<Booking['payment_split']>,
): Partial<Booking> {
  return isGroupLesson(booking) ? { payment_split: split } : {};
}

/** De boekinggegevens die een annulering nodig heeft. */
export type CancelBooking = Pick<Booking, 'id' | 'status' | 'beurtenkaart_id'>;

export interface CancelPlan {
  cards: Beurtenkaart[];
  /**
   * Wat er bovenop de geannuleerde les moet. `null` als de betaalwijze blijft staan:
   * cash, factuur of sponsor is al betaald en hoort door een annulering niet te wijzigen.
   */
  patch: Pick<Booking, 'payment_method' | 'beurtenkaart_id'> | null;
}

/**
 * Annuleren van een les. Alleen een teruggegeven beurt dwingt een nieuwe keuze af: de les
 * gaat terug op 'Open' en laat de kaart los. Twee keer annuleren geeft niet twee beurten
 * terug — de tweede keer is de les al geannuleerd en is er niets meer los te laten.
 */
export function planCancel(cards: Beurtenkaart[], booking: CancelBooking): CancelPlan {
  const cardId = booking.beurtenkaart_id;
  if (booking.status === 'cancelled' || !cardId) return { cards, patch: null };
  return {
    cards: cards.map((c) => (c.id === cardId ? releaseSession(c, booking.id) : c)),
    patch: { payment_method: 'open', beurtenkaart_id: undefined },
  };
}

/** De boekinggegevens die het verwijderen van een kaart raakt. */
export type CardBooking = Pick<Booking, 'payment_method' | 'beurtenkaart_id'>;

export interface CardDeletionPlan<B extends CardBooking> {
  cards: Beurtenkaart[];
  bookings: B[];
}

/**
 * Een kaart weggooien. De lessen die eraan hingen verliezen hun beurt, dus ze moeten
 * opnieuw afgehandeld worden: terug op 'Open' en zonder verwijzing naar de weg kaart.
 */
export function planCardDeletion<B extends CardBooking>(
  cards: Beurtenkaart[],
  bookings: B[],
  cardId: string,
): CardDeletionPlan<B> {
  return {
    cards: cards.filter((c) => c.id !== cardId),
    bookings: bookings.map((b) =>
      b.beurtenkaart_id === cardId
        ? { ...b, payment_method: 'open' as PaymentMethod, beurtenkaart_id: undefined }
        : b,
    ),
  };
}

/** De min-knop op het kaartscherm: haalt alleen een handmatig gezette beurt weg. */
export function removeManualSession(card: Beurtenkaart): Beurtenkaart {
  const index = card.uses.map((u) => u.booking_id).lastIndexOf('');
  if (index === -1) return card;
  return { ...card, uses: [...card.uses.slice(0, index), ...card.uses.slice(index + 1)] };
}
