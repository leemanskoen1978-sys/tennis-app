import { useEffect, useState } from 'react';
import { usePendingPaymentBookings, useSimpleData } from '../providers/SimpleDataProvider';
import { PaymentStatusModal } from './PaymentStatusModal';

/**
 * Auto-opens the payment modal for coaches when there are unhandled bookings.
 * Never automatic for players. "Later" hides it for the rest of the session.
 * Respects settings.blocked_popups_until.
 */
export function PaymentGate() {
  const { currentUser, settings } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const blocked = settings.blocked_popups_until
    ? new Date(settings.blocked_popups_until).getTime() > Date.now()
    : false;

  useEffect(() => {
    if (currentUser?.role === 'coach' && pending.length > 0 && !dismissed && !blocked) {
      setOpen(true);
    }
  }, [currentUser, pending.length, dismissed, blocked]);

  if (currentUser?.role !== 'coach') return null;
  return (
    <PaymentStatusModal
      visible={open}
      onClose={() => {
        setOpen(false);
        setDismissed(true);
      }}
    />
  );
}
