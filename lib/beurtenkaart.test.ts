import type { Beurtenkaart, Booking } from './types';
import {
  SESSIONS_PER_CARD, remaining, cardsFor, usableCardFor,
  useSession, releaseSession, removeManualSession, planMethodChange,
  planCancel, planCardDeletion,
  type MethodChangeBooking,
} from './beurtenkaart';

function card(over: Partial<Beurtenkaart> = {}): Beurtenkaart {
  return {
    id: 'k1', player_id: 'p1', total_sessions: SESSIONS_PER_CARD,
    created_at: '2026-08-01T09:00:00.000Z', uses: [], ...over,
  };
}

const iso = '2026-08-20T10:00:00.000Z';

describe('remaining', () => {
  it('is the card size minus the used sessions', () => {
    expect(remaining(card())).toBe(10);
    expect(remaining(card({ uses: [{ booking_id: 'b1', date: iso }] }))).toBe(9);
  });

  it('never goes below zero', () => {
    const uses = Array.from({ length: 12 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(remaining(card({ uses }))).toBe(0);
  });
});

describe('cardsFor', () => {
  it('returns only the cards of that player, newest first', () => {
    const a = card({ id: 'k1', created_at: '2026-01-01T00:00:00.000Z' });
    const b = card({ id: 'k2', created_at: '2026-06-01T00:00:00.000Z' });
    const other = card({ id: 'k3', player_id: 'p2' });
    expect(cardsFor([a, b, other], 'p1').map((c) => c.id)).toEqual(['k2', 'k1']);
  });
});

describe('usableCardFor', () => {
  it('picks the card with the fewest sessions left', () => {
    const fuller = card({ id: 'k1', uses: [] });
    const emptier = card({ id: 'k2', uses: [{ booking_id: 'b1', date: iso }] });
    expect(usableCardFor([fuller, emptier], 'p1')?.id).toBe('k2');
  });

  it('skips full cards', () => {
    const uses = Array.from({ length: 10 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(usableCardFor([card({ uses })], 'p1')).toBeNull();
  });

  it('skips cards of another player', () => {
    expect(usableCardFor([card({ player_id: 'p2' })], 'p1')).toBeNull();
  });

  it('picks the oldest card when the remaining sessions are tied, regardless of order', () => {
    const old = card({ id: 'k1', created_at: '2026-01-01T00:00:00.000Z' });
    const fresh = card({ id: 'k2', created_at: '2026-06-01T00:00:00.000Z' });
    expect(usableCardFor([old, fresh], 'p1')?.id).toBe('k1');
    expect(usableCardFor([fresh, old], 'p1')?.id).toBe('k1');
  });
});

describe('useSession', () => {
  it('adds a use for the booking', () => {
    const out = useSession(card(), 'b1', iso);
    expect(out.uses).toEqual([{ booking_id: 'b1', date: iso }]);
  });

  it('never books the same booking twice', () => {
    const once = useSession(card(), 'b1', iso);
    expect(useSession(once, 'b1', iso).uses).toHaveLength(1);
  });

  it('does nothing on a full card', () => {
    const uses = Array.from({ length: 10 }, (_, i) => ({ booking_id: `b${i}`, date: iso }));
    expect(useSession(card({ uses }), 'b99', iso).uses).toHaveLength(10);
  });

  it('allows several manual sessions with an empty booking id', () => {
    const out = useSession(useSession(card(), '', iso), '', iso);
    expect(out.uses).toHaveLength(2);
  });
});

describe('releaseSession', () => {
  it('gives the session of that booking back', () => {
    const used = useSession(card(), 'b1', iso);
    expect(releaseSession(used, 'b1').uses).toEqual([]);
  });

  it('leaves other bookings alone', () => {
    const used = useSession(useSession(card(), 'b1', iso), 'b2', iso);
    expect(releaseSession(used, 'b1').uses.map((u) => u.booking_id)).toEqual(['b2']);
  });

  it('ignores an empty booking id, so manual sessions stay put', () => {
    const manual = useSession(card(), '', iso);
    expect(releaseSession(manual, '').uses).toHaveLength(1);
  });
});

describe('removeManualSession', () => {
  it('removes the last manual session', () => {
    const out = removeManualSession(useSession(card(), '', iso));
    expect(out.uses).toEqual([]);
  });

  it('never removes a session that belongs to a lesson', () => {
    const booked = useSession(card(), 'b1', iso);
    expect(removeManualSession(booked).uses).toHaveLength(1);
  });

  it('with several manual sessions, removes only the last one', () => {
    const stacked = useSession(useSession(useSession(card(), '', iso), 'b1', iso), '', iso);
    const out = removeManualSession(stacked);
    expect(out.uses).toEqual([
      { booking_id: '', date: iso },
      { booking_id: 'b1', date: iso },
    ]);
  });
});

describe('planMethodChange', () => {
  function booking(over: Partial<MethodChangeBooking> = {}): MethodChangeBooking {
    return {
      id: 'b1', player_id: 'p1', start_time: iso, status: 'confirmed', ...over,
    };
  }

  /** Hoe vaak een les in de hele kaartenstapel een beurt kost. */
  const usesOf = (cards: Beurtenkaart[], bookingId: string): number =>
    cards.reduce((n, c) => n + c.uses.filter((u) => u.booking_id === bookingId).length, 0);

  it('takes one session when the lesson moves onto a card', () => {
    const plan = planMethodChange([card()], booking(), 'beurtenkaart');
    expect(plan.error).toBeNull();
    expect(plan.cardId).toBe('k1');
    expect(usesOf(plan.cards, 'b1')).toBe(1);
  });

  it('does not take a second session when beurtenkaart is chosen again', () => {
    const used = card({ uses: [{ booking_id: 'b1', date: iso }] });
    const plan = planMethodChange([used], booking({ beurtenkaart_id: 'k1' }), 'beurtenkaart');
    expect(plan.error).toBeNull();
    expect(plan.cardId).toBe('k1');
    expect(usesOf(plan.cards, 'b1')).toBe(1);
  });

  it('books a session anyway when the lesson says beurtenkaart without a card', () => {
    // Ontstaat via de standaard betaalwijze van een speler: 'beurtenkaart' zonder kaart.
    const plan = planMethodChange([card()], booking({ beurtenkaart_id: undefined }), 'beurtenkaart');
    expect(plan.error).toBeNull();
    expect(plan.cardId).toBe('k1');
    expect(usesOf(plan.cards, 'b1')).toBe(1);
  });

  it('gives the session back and clears the card when moving away from beurtenkaart', () => {
    const used = card({ uses: [{ booking_id: 'b1', date: iso }] });
    const plan = planMethodChange([used], booking({ beurtenkaart_id: 'k1' }), 'cash');
    expect(plan.error).toBeNull();
    expect(plan.cardId).toBeUndefined();
    expect(usesOf(plan.cards, 'b1')).toBe(0);
  });

  it('via cash and back costs exactly one session again, possibly on another card', () => {
    const k1 = card({ id: 'k1', uses: [{ booking_id: 'b1', date: iso }] });
    const k2 = card({
      id: 'k2',
      created_at: '2026-02-01T00:00:00.000Z',
      uses: ['x1', 'x2', 'x3'].map((id) => ({ booking_id: id, date: iso })),
    });

    const toCash = planMethodChange([k1, k2], booking({ beurtenkaart_id: 'k1' }), 'cash');
    expect(usesOf(toCash.cards, 'b1')).toBe(0);

    const back = planMethodChange(
      toCash.cards,
      booking({ beurtenkaart_id: toCash.cardId }),
      'beurtenkaart',
    );
    expect(back.error).toBeNull();
    // De volste kaart raakt eerst op, dus de beurt landt nu op de andere kaart.
    expect(back.cardId).toBe('k2');
    expect(usesOf(back.cards, 'b1')).toBe(1);
  });

  it('refuses when the player has no card at all and leaves the cards untouched', () => {
    const other = card({ id: 'k9', player_id: 'p2' });
    const plan = planMethodChange([other], booking(), 'beurtenkaart');
    expect(plan.error).toBe('Geen beurtenkaart met beurten over voor deze speler.');
    expect(plan.cards).toEqual([other]);
    expect(plan.cardId).toBeUndefined();
  });

  it('refuses when every card of the player is full', () => {
    const full = card({
      uses: Array.from({ length: SESSIONS_PER_CARD }, (_, i) => ({ booking_id: `x${i}`, date: iso })),
    });
    const plan = planMethodChange([full], booking(), 'beurtenkaart');
    expect(plan.error).toBe('Geen beurtenkaart met beurten over voor deze speler.');
    expect(plan.cards).toEqual([full]);
  });

  it('refuses a payment method on a cancelled lesson', () => {
    const plan = planMethodChange([card()], booking({ status: 'cancelled' }), 'beurtenkaart');
    expect(plan.error).toBe('Een geannuleerde les krijgt geen betaalwijze.');
    expect(usesOf(plan.cards, 'b1')).toBe(0);
  });

  it('books a session when the lesson points at a card that no longer exists', () => {
    // Een verweesde verwijzing mag geen gratis les worden: de beurt hoort alsnog ergens af.
    const plan = planMethodChange(
      [card({ id: 'k2' })],
      booking({ beurtenkaart_id: 'weg' }),
      'beurtenkaart',
    );
    expect(plan.error).toBeNull();
    expect(plan.cardId).toBe('k2');
    expect(usesOf(plan.cards, 'b1')).toBe(1);
  });

  it('refuses when the lesson points at a card that no longer exists and there is no other', () => {
    const plan = planMethodChange([], booking({ beurtenkaart_id: 'weg' }), 'beurtenkaart');
    expect(plan.error).toBe('Geen beurtenkaart met beurten over voor deze speler.');
    // De les blijft bij zijn oude verwijzing staan; er is niets gewijzigd.
    expect(plan.cardId).toBe('weg');
  });
});

describe('planCancel', () => {
  const used = () => card({ uses: [{ booking_id: 'b1', date: iso }] });

  it('gives the session back and puts the lesson on Open', () => {
    const plan = planCancel([used()], { id: 'b1', status: 'confirmed', beurtenkaart_id: 'k1' });
    expect(plan.patch).toEqual({ payment_method: 'open', beurtenkaart_id: undefined });
    expect(plan.cards[0].uses).toEqual([]);
  });

  it('leaves a cash lesson on cash and the cards untouched', () => {
    const cards = [used()];
    const plan = planCancel(cards, { id: 'b9', status: 'confirmed' });
    expect(plan.patch).toBeNull();
    expect(plan.cards).toBe(cards);
  });

  it('gives nothing back a second time', () => {
    const first = planCancel([used()], { id: 'b1', status: 'confirmed', beurtenkaart_id: 'k1' });
    // Zoals de les er ná de eerste annulering bij staat: geannuleerd en zonder kaart.
    const second = planCancel(first.cards, { id: 'b1', status: 'cancelled', beurtenkaart_id: undefined });
    expect(second.patch).toBeNull();
    expect(second.cards[0].uses).toEqual([]);
  });

  it('gives nothing back when the same lesson is cancelled again with its old card still on it', () => {
    const plan = planCancel([used()], { id: 'b1', status: 'cancelled', beurtenkaart_id: 'k1' });
    expect(plan.patch).toBeNull();
    expect(plan.cards[0].uses).toHaveLength(1);
  });

  it('leaves other cards alone', () => {
    const other = card({ id: 'k2', uses: [{ booking_id: 'b2', date: iso }] });
    const plan = planCancel([used(), other], { id: 'b1', status: 'confirmed', beurtenkaart_id: 'k1' });
    expect(plan.cards[1]).toBe(other);
  });
});

describe('planCardDeletion', () => {
  const booking = (over: Partial<Booking> = {}): Booking => ({
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: iso, end_time: iso, status: 'confirmed', payment_method: 'beurtenkaart',
    beurtenkaart_id: 'k1', ...over,
  });

  it('removes the card and puts both of its lessons back on Open', () => {
    const plan = planCardDeletion(
      [card(), card({ id: 'k2' })],
      [booking({ id: 'b1' }), booking({ id: 'b2' })],
      'k1',
    );
    expect(plan.cards.map((c) => c.id)).toEqual(['k2']);
    expect(plan.bookings.map((b) => b.payment_method)).toEqual(['open', 'open']);
    // Geen verweesde verwijzing naar een kaart die er niet meer is.
    expect(plan.bookings.every((b) => b.beurtenkaart_id === undefined)).toBe(true);
  });

  it('leaves lessons of another card alone', () => {
    const other = booking({ id: 'b2', beurtenkaart_id: 'k2' });
    const plan = planCardDeletion([card(), card({ id: 'k2' })], [booking(), other], 'k1');
    expect(plan.bookings[1]).toBe(other);
  });

  it('removes a card that no lesson is attached to, changing nothing else', () => {
    const cash = booking({ payment_method: 'cash', beurtenkaart_id: undefined });
    const plan = planCardDeletion([card(), card({ id: 'k2' })], [cash], 'k2');
    expect(plan.cards.map((c) => c.id)).toEqual(['k1']);
    expect(plan.bookings).toEqual([cash]);
  });
});
