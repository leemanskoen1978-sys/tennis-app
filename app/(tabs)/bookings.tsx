import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { PaymentStatusModal } from '../../components/PaymentStatusModal';
import { tennisColors } from '../../constants/tennis-colors';
import type { Booking, BookingStatus, PaymentStatus } from '../../lib/types';
import { useSimpleData } from '../../providers/SimpleDataProvider';

interface BadgeStyle {
  color: string;
  label: string;
}

const STATUS_META: Record<BookingStatus, BadgeStyle> = {
  pending: { color: tennisColors.warning, label: 'In afwachting' },
  confirmed: { color: tennisColors.success, label: 'Bevestigd' },
  cancelled: { color: tennisColors.danger, label: 'Geannuleerd' },
  completed: { color: tennisColors.primaryDark, label: 'Voltooid' },
  synchronized: { color: tennisColors.court, label: 'Gesynchroniseerd' },
};

function statusMeta(status: BookingStatus): BadgeStyle {
  return STATUS_META[status];
}

function paymentMeta(payment: PaymentStatus): BadgeStyle {
  switch (payment) {
    case 'paid':
      return { color: tennisColors.success, label: 'Betaald' };
    case 'unpaid':
      return { color: tennisColors.danger, label: 'Onbetaald' };
    case 'invoice':
      return { color: tennisColors.court, label: 'Factuur' };
    case null:
    default:
      return { color: tennisColors.textMuted, label: 'Open' };
  }
}

export default function BookingsScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts, updateBooking } =
    useSimpleData();
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);

  const isCoach = currentUser?.role === 'coach';

  const visibleBookings = useMemo<Booking[]>(() => {
    if (!currentUser) {
      return [];
    }
    const filtered = bookings.filter((b) =>
      isCoach ? b.coach_id === currentUser.id : b.player_id === currentUser.id,
    );
    return [...filtered].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [bookings, currentUser, isCoach]);

  const courtName = (courtId: string): string => {
    const court = courts.find((c) => c.id === courtId);
    return court ? court.name : 'Onbekend terrein';
  };

  const otherPartyName = (booking: Booking): string => {
    const otherId = isCoach ? booking.player_id : booking.coach_id;
    const user = users.find((u) => u.id === otherId);
    return user ? user.name : 'Onbekend';
  };

  const canCancel = (status: BookingStatus): boolean =>
    status !== 'cancelled' && status !== 'completed';

  const handleCancel = (booking: Booking): void => {
    void updateBooking(booking.id, { status: 'cancelled' });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Afspraken</Text>

      {isCoach ? (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setPaymentModalVisible(true)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Betalingen verwerken</Text>
        </TouchableOpacity>
      ) : null}

      {visibleBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nog geen afspraken.</Text>
        </View>
      ) : (
        visibleBookings.map((booking) => {
          const status = statusMeta(booking.status);
          const payment =
            booking.payment_status === null
              ? { color: tennisColors.textMuted, label: '—' }
              : paymentMeta(booking.payment_status);
          return (
            <View key={booking.id} style={styles.card}>
              <Text style={styles.cardDate}>
                {new Date(booking.start_time).toLocaleString('nl-BE')}
              </Text>
              <Text style={styles.cardCourt}>{courtName(booking.court_id)}</Text>
              <Text style={styles.cardParty}>
                {isCoach ? 'Speler: ' : 'Coach: '}
                {otherPartyName(booking)}
              </Text>

              <View style={styles.badgeRow}>
                <View
                  style={[styles.badge, { backgroundColor: status.color }]}
                >
                  <Text style={styles.badgeText}>{status.label}</Text>
                </View>
                <View
                  style={[styles.badge, { backgroundColor: payment.color }]}
                >
                  <Text style={styles.badgeText}>{payment.label}</Text>
                </View>
              </View>

              {canCancel(booking.status) ? (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(booking)}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelButtonText}>Annuleren</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })
      )}

      {isCoach ? (
        <PaymentStatusModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: tennisColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: tennisColors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: tennisColors.textMuted,
  },
  card: {
    backgroundColor: tennisColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 16,
    gap: 6,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: tennisColors.text,
  },
  cardCourt: {
    fontSize: 14,
    color: tennisColors.textMuted,
  },
  cardParty: {
    fontSize: 14,
    color: tennisColors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: tennisColors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tennisColors.danger,
  },
  cancelButtonText: {
    color: tennisColors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
});
