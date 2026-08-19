import {
  needsPayment, filterPendingPayment, pendingPaymentsFor, totalRevenue,
} from './payments';
import type { Booking, Court, User } from './types';

const base: Booking = {
  id: '1', player_id: 'p', coach_id: 'c', court_id: 'court1',
  start_time: '2026-08-20T09:00:00Z', end_time: '2026-08-20T10:00:00Z',
  status: 'confirmed', payment_status: null,
};

describe('needsPayment', () => {
  it('is true for confirmed/completed/synchronized without payment_status', () => {
    expect(needsPayment({ ...base, status: 'confirmed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'completed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'synchronized' })).toBe(true);
  });
  it('is false when already paid/invoiced/unpaid', () => {
    expect(needsPayment({ ...base, payment_status: 'paid' })).toBe(false);
    expect(needsPayment({ ...base, payment_status: 'invoice' })).toBe(false);
    expect(needsPayment({ ...base, payment_status: 'unpaid' })).toBe(false);
  });
  it('is false for pending/cancelled status', () => {
    expect(needsPayment({ ...base, status: 'pending' })).toBe(false);
    expect(needsPayment({ ...base, status: 'cancelled' })).toBe(false);
  });
});

describe('filterPendingPayment', () => {
  it('returns only bookings that need payment', () => {
    const list = [base, { ...base, id: '2', payment_status: 'paid' as const }];
    expect(filterPendingPayment(list).map((b) => b.id)).toEqual(['1']);
  });
});

describe('totalRevenue', () => {
  const courts: Court[] = [
    { id: 'court1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
  ];
  it('sums hourly_rate for paid bookings only', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_status: 'paid' },
      { ...base, id: '2', payment_status: 'invoice' },
      { ...base, id: '3', payment_status: null },
    ];
    expect(totalRevenue(list, courts)).toBe(30);
  });
  it('excludes cancelled bookings even if marked paid', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_status: 'paid' },
      { ...base, id: '2', payment_status: 'paid', status: 'cancelled' },
    ];
    expect(totalRevenue(list, courts)).toBe(30);
  });

  // A coach may only see their own revenue, never the club total. totalRevenue is
  // pure, so scoping is the caller's job: hand it the coach's bookings, not all of
  // them. This test pins that the distinction is real and measurable.
  it('is scoped by whatever list it is given, so a coach total differs from the club total', () => {
    const all: Booking[] = [
      { ...base, id: '1', coach_id: 'koen', payment_status: 'paid' },
      { ...base, id: '2', coach_id: 'sanne', payment_status: 'paid' },
    ];
    const koensBookings = all.filter((b) => b.coach_id === 'koen');
    expect(totalRevenue(all, courts)).toBe(60);
    expect(totalRevenue(koensBookings, courts)).toBe(30);
    expect(totalRevenue(koensBookings, courts)).not.toBe(totalRevenue(all, courts));
  });
});

describe('pendingPaymentsFor', () => {
  const koen: User = { id: 'koen', name: 'Koen', email: 'k@x', role: 'coach' };
  const sanne: User = { id: 'sanne', name: 'Sanne', email: 's@x', role: 'coach' };
  const mathis: User = { id: 'mathis', name: 'Mathis', email: 'm@x', role: 'player' };
  const list: Booking[] = [
    { ...base, id: '1', coach_id: 'koen', player_id: 'mathis' },
    { ...base, id: '2', coach_id: 'sanne', player_id: 'mathis' },
    { ...base, id: '3', coach_id: 'sanne', player_id: 'lotte' },
  ];

  it('gives a coach only their own bookings, never a colleague\'s', () => {
    expect(pendingPaymentsFor(koen, list).map((b) => b.id)).toEqual(['1']);
    expect(pendingPaymentsFor(sanne, list).map((b) => b.id)).toEqual(['2', '3']);
  });

  it('gives a player only their own bookings', () => {
    expect(pendingPaymentsFor(mathis, list).map((b) => b.id)).toEqual(['1', '2']);
  });

  it('is empty without a user', () => {
    expect(pendingPaymentsFor(null, list)).toEqual([]);
  });

  it('still only returns bookings that actually need payment', () => {
    const settled: Booking[] = [{ ...base, id: '1', coach_id: 'koen', payment_status: 'paid' }];
    expect(pendingPaymentsFor(koen, settled)).toEqual([]);
  });
});
