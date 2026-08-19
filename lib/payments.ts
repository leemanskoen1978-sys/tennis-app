import type { Booking, Court, User } from './types';

const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'completed', 'synchronized'];

/** A booking needs payment handling when it is realized but has no payment_status yet. */
export function needsPayment(b: Booking): boolean {
  return (
    PAYABLE_STATUSES.includes(b.status) &&
    (b.payment_status === null || b.payment_status === undefined)
  );
}

export function filterPendingPayment(bookings: Booking[]): Booking[] {
  return bookings.filter(needsPayment);
}

/**
 * The payments a user is allowed to handle. Money stays per coach: a coach handles the
 * payments for their own bookings, a player only sees their own. Nobody settles a
 * colleague's lesson.
 */
export function pendingPaymentsFor(user: User | null, bookings: Booking[]): Booking[] {
  if (!user) return [];
  const mine = bookings.filter((b) =>
    user.role === 'coach' ? b.coach_id === user.id : b.player_id === user.id,
  );
  return filterPendingPayment(mine);
}

/** Realized cash income: sums court hourly_rate for paid, non-cancelled bookings. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const rateById = new Map(courts.map((c) => [c.id, c.hourly_rate]));
  return bookings
    .filter((b) => b.payment_status === 'paid' && b.status !== 'cancelled')
    .reduce((sum, b) => sum + (rateById.get(b.court_id) ?? 0), 0);
}
