// Een store die met een oudere versie is weggeschreven kent nog `payment_status`. Die
// omzetten bij het laden is goedkoper dan de gebruiker zijn boekingen laten wissen.
//
// Deze functie mag NOOIT gooien: ze draait binnen de `try` van `loadStore()`, en een fout
// laat de app terugvallen op verse demo-data die bij de eerste wijziging over de echte
// agenda van de gebruiker heen wordt geschreven. Opgeslagen JSON is dus `unknown`.

import { PAYMENT_METHODS } from './payments';
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

/** Alleen een van de zes bekende betaalwijzen mag ongewijzigd blijven staan. */
function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value);
}

function fromLegacyStatus(value: unknown): PaymentMethod | null {
  return typeof value === 'string' ? LEGACY_MAP[value] ?? null : null;
}

/** Een boeking die geen object is (null, tekst, getal) levert `null` op in plaats van een fout. */
export function migrateBooking(raw: unknown): Booking | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const { payment_status: legacy, payment_method: current, ...rest } = raw as Record<string, unknown>;
  const method: PaymentMethod = isPaymentMethod(current)
    ? current
    : fromLegacyStatus(legacy) ?? 'open';

  return { ...(rest as Omit<Booking, 'payment_method'>), payment_method: method };
}

export function migrateBookings(list: unknown): Booking[] {
  if (!Array.isArray(list)) return [];
  return list
    .map(migrateBooking)
    .filter((b): b is Booking => b !== null);
}
