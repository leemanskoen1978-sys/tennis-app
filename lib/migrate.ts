// Een store die met een oudere versie is weggeschreven kent nog `payment_status`. Die
// omzetten bij het laden is goedkoper dan de gebruiker zijn boekingen laten wissen.

import type { Booking, PaymentMethod } from './types';

type LegacyPaymentStatus = 'paid' | 'unpaid' | 'invoice' | null;

export type LegacyBooking = Omit<Booking, 'payment_method'> & {
  payment_method?: PaymentMethod;
  payment_status?: LegacyPaymentStatus;
};

const LEGACY_MAP: Record<string, PaymentMethod> = {
  paid: 'cash',
  invoice: 'invoice',
  unpaid: 'open',
};

export function migrateBooking(b: LegacyBooking): Booking {
  const { payment_status: legacy, payment_method: current, ...rest } = b;
  const method: PaymentMethod =
    current ?? (legacy ? LEGACY_MAP[legacy] ?? 'open' : 'open');
  return { ...rest, payment_method: method };
}

export function migrateBookings(list: LegacyBooking[] | undefined): Booking[] {
  return (list ?? []).map(migrateBooking);
}
