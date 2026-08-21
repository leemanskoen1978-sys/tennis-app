// Nederlandse labels voor de status van een boeking, op één plek: het agendascherm en de
// maandexport moeten hetzelfde woord gebruiken.

import { t } from './i18n';
import type { BookingStatus } from './types';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Wacht op goedkeuring',
  confirmed: 'Bevestigd',
  cancelled: 'Geannuleerd',
  completed: 'Voltooid',
  synchronized: 'Gesynchroniseerd',
};

/** Hetzelfde label, in de taal die de gebruiker gekozen heeft. */
export function bookingStatusLabel(status: BookingStatus): string {
  return t(BOOKING_STATUS_LABELS[status]);
}
