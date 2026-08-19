import { needsPayment, filterPendingPayment, totalRevenue } from './payments';
import type { Booking, Court } from './types';

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
});
