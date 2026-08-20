import type { Beurtenkaart } from './types';
import {
  SESSIONS_PER_CARD, remaining, cardsFor, usableCardFor,
  useSession, releaseSession, removeManualSession,
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
});
