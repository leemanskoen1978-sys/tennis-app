import { bookingsToday, countPlayers, countCoaches } from './hub';
import type { Booking, User } from './types';

const at = (iso: string, status: Booking['status'] = 'confirmed'): Booking => ({
  id: iso, player_id: 'p', coach_id: 'c', court_id: 'court1',
  start_time: iso, end_time: iso, status, payment_method: 'open',
});

describe('bookingsToday', () => {
  const now = new Date(2026, 7, 19, 12, 0, 0); // 19 aug 2026, lokale tijd
  const iso = (d: number, h: number) => new Date(2026, 7, d, h, 0, 0).toISOString();

  it('counts only bookings that start today', () => {
    const list = [at(iso(19, 9)), at(iso(19, 20)), at(iso(18, 9)), at(iso(20, 9))];
    expect(bookingsToday(list, now)).toBe(2);
  });

  it('ignores cancelled bookings', () => {
    expect(bookingsToday([at(iso(19, 9), 'cancelled'), at(iso(19, 10))], now)).toBe(1);
  });

  it('is zero on an empty list', () => {
    expect(bookingsToday([], now)).toBe(0);
  });
});

describe('countPlayers / countCoaches', () => {
  const users: User[] = [
    { id: '1', name: 'Koen', email: 'k@x', role: 'coach' },
    { id: '2', name: 'Sanne', email: 's@x', role: 'coach' },
    { id: '3', name: 'Mathis', email: 'm@x', role: 'player' },
    { id: '4', name: 'Ouder', email: 'o@x', role: 'parent' },
  ];
  it('counts coaches, and treats parents as non-coaches', () => {
    expect(countCoaches(users)).toBe(2);
    expect(countPlayers(users)).toBe(2);
  });
});
