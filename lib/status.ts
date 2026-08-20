// Nederlandse labels voor de status van een boeking, op één plek: het agendascherm en de
// maandexport moeten hetzelfde woord gebruiken.

import type { BookingStatus } from './types';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'In afwachting',
  confirmed: 'Bevestigd',
  cancelled: 'Geannuleerd',
  completed: 'Voltooid',
  synchronized: 'Gesynchroniseerd',
};
