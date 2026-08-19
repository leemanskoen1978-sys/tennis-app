import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Screen } from '../../components/ui/Screen';
import { PaymentStatusModal } from '../../components/PaymentStatusModal';
import { spacing, typography, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import type { Booking, BookingStatus, PaymentStatus } from '../../lib/types';
import { useSimpleData } from '../../providers/SimpleDataProvider';

interface BadgeMeta {
  color: string;
  label: string;
  subtle: boolean;
}

const STATUS_META: Record<BookingStatus, BadgeMeta> = {
  pending: { color: tennisColors.warning, label: 'In afwachting', subtle: false },
  confirmed: { color: tennisColors.primary, label: 'Bevestigd', subtle: false },
  cancelled: { color: tennisColors.textMuted, label: 'Geannuleerd', subtle: false },
  completed: { color: tennisColors.court, label: 'Voltooid', subtle: false },
  synchronized: { color: tennisColors.court, label: 'Gesynchroniseerd', subtle: false },
};

function statusMeta(status: BookingStatus): BadgeMeta {
  return STATUS_META[status];
}

function paymentMeta(payment: PaymentStatus): BadgeMeta {
  switch (payment) {
    case 'paid':
      return { color: tennisColors.success, label: 'Betaald', subtle: false };
    case 'invoice':
      return { color: tennisColors.court, label: 'Factuur', subtle: false };
    case 'unpaid':
      return { color: tennisColors.warning, label: 'Onbetaald', subtle: false };
    case null:
    default:
      return { color: tennisColors.textMuted, label: 'Open', subtle: true };
  }
}

export default function BookingsScreen(): React.JSX.Element {
  const { currentUser, bookings, users, courts, updateBooking } =
    useSimpleData();
  const router = useRouter();
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
  // View choice, not access control: a coach sees every booking by default and can fall
  // back to their own lessons on a busy day.
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  const isCoach = currentUser?.role === 'coach';

  const visibleBookings = useMemo<Booking[]>(() => {
    if (!currentUser) {
      return [];
    }
    const filtered = bookings.filter((b) =>
      isCoach
        ? !onlyMine || b.coach_id === currentUser.id
        : b.player_id === currentUser.id,
    );
    return [...filtered].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
  }, [bookings, currentUser, isCoach, onlyMine]);

  const courtName = (courtId: string): string => {
    const court = courts.find((c) => c.id === courtId);
    return court ? court.name : 'Onbekend terrein';
  };

  const nameOf = (id?: string): string => {
    const user = users.find((u) => u.id === id);
    return user ? user.name : 'Onbekend';
  };

  const canCancel = (status: BookingStatus): boolean =>
    status !== 'cancelled' && status !== 'completed';

  const handleCancel = (booking: Booking): void => {
    void updateBooking(booking.id, { status: 'cancelled' });
  };

  return (
    <Screen>
      <Text style={styles.title}>Afspraken</Text>

      {isCoach ? (
        <>
          <Button
            label="Betalingen verwerken"
            variant="primary"
            onPress={() => setPaymentModalVisible(true)}
          />
          <View style={styles.filterRow}>
            <Chip
              label="Alleen die van mij"
              selected={onlyMine}
              onPress={() => setOnlyMine((v) => !v)}
            />
          </View>
        </>
      ) : null}

      {visibleBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isCoach && onlyMine ? 'Geen afspraken van jou.' : 'Nog geen afspraken.'}
          </Text>
        </View>
      ) : (
        visibleBookings.map((booking) => {
          const status = statusMeta(booking.status);
          const payment = paymentMeta(booking.payment_status);
          const info = (
            <>
              <Text style={styles.cardDate}>
                {new Date(booking.start_time).toLocaleString('nl-BE')}
              </Text>
              <Text style={styles.cardCourt}>{courtName(booking.court_id)}</Text>
              <View style={styles.partyRow}>
                <View>
                  <Text style={styles.cardParty}>Speler: {nameOf(booking.player_id)}</Text>
                  <Text style={styles.cardParty}>Trainer: {nameOf(booking.coach_id)}</Text>
                </View>
                {isCoach ? <ChevronRight size={18} color={tennisColors.textMuted} /> : null}
              </View>
              <View style={styles.badgeRow}>
                <Badge label={status.label} color={status.color} subtle={status.subtle} />
                <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
              </View>
            </>
          );
          return (
            <Card key={booking.id}>
              {isCoach ? (
                <Pressable
                  onPress={() => router.push(`/player/${booking.player_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open dossier van ${nameOf(booking.player_id)}`}
                  style={webCursor}
                >
                  {info}
                </Pressable>
              ) : (
                info
              )}

              {canCancel(booking.status) ? (
                <View style={styles.cancelRow}>
                  <Button
                    label="Annuleren"
                    variant="danger"
                    fullWidth={false}
                    onPress={() => handleCancel(booking)}
                  />
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {isCoach ? (
        <PaymentStatusModal
          visible={paymentModalVisible}
          onClose={() => setPaymentModalVisible(false)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: tennisColors.text,
  },
  emptyState: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: tennisColors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  cardDate: {
    ...typography.h3,
    color: tennisColors.text,
  },
  cardCourt: {
    ...typography.body,
    color: tennisColors.textMuted,
  },
  partyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardParty: {
    ...typography.body,
    color: tennisColors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelRow: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});
