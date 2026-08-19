import type { Booking, Court } from './types';

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

/** Realized cash income: sums court hourly_rate for bookings marked 'paid'. */
export function totalRevenue(bookings: Booking[], courts: Court[]): number {
  const rate = (id: string) => courts.find((c) => c.id === id)?.hourly_rate ?? 0;
  return bookings
    .filter((b) => b.payment_status === 'paid')
    .reduce((sum, b) => sum + rate(b.court_id), 0);
}
