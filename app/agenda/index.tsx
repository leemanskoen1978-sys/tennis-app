import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { PaymentMethodSheet } from '../../components/PaymentMethodSheet';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { Screen } from '../../components/ui/Screen';
import { spacing, typography, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { cardsFor, remaining } from '../../lib/beurtenkaart';
import { paymentMeta, type PaymentMeta } from '../../lib/payments';
import { BOOKING_STATUS_LABELS } from '../../lib/status';
import type { Booking, BookingStatus, PaymentMethod } from '../../lib/types';
import { useSimpleData } from '../../providers/SimpleDataProvider';

interface BadgeMeta {
  color: string;
  label: string;
  subtle: boolean;
}

const STATUS_META: Record<BookingStatus, BadgeMeta> = {
  pending: { color: tennisColors.warning, label: BOOKING_STATUS_LABELS.pending, subtle: false },
  confirmed: { color: tennisColors.primary, label: BOOKING_STATUS_LABELS.confirmed, subtle: false },
  cancelled: { color: tennisColors.textMuted, label: BOOKING_STATUS_LABELS.cancelled, subtle: false },
  completed: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.completed, subtle: false },
  synchronized: { color: tennisColors.court, label: BOOKING_STATUS_LABELS.synchronized, subtle: false },
};

function statusMeta(status: BookingStatus): BadgeMeta {
  return STATUS_META[status];
}

export default function BookingsScreen(): React.JSX.Element {
  const {
    currentUser,
    bookings,
    users,
    courts,
    updateBooking,
    beurtenkaarten,
    setPaymentMethod,
    error,
    clearError,
  } = useSimpleData();
  const router = useRouter();
  // View choice, not access control: a coach sees every booking by default and can fall
  // back to their own lessons on a busy day.
  const [onlyMine, setOnlyMine] = useState<boolean>(false);
  // Welke afspraak zijn betaalwijze laat kiezen; null = blad dicht.
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);

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

  const cardHintFor = (booking: Booking | null): string | undefined => {
    if (!booking) return undefined;
    const cards = cardsFor(beurtenkaarten, booking.player_id);
    if (cards.length === 0) return 'Deze speler heeft nog geen beurtenkaart.';
    const left = cards.reduce((sum, c) => sum + remaining(c), 0);
    return left === 1 ? 'Nog 1 beurt over.' : `Nog ${left} beurten over.`;
  };

  const pickMethod = async (method: PaymentMethod): Promise<void> => {
    if (!payingBooking) return;
    clearError();
    await setPaymentMethod(payingBooking.id, method);
    setPayingBooking(null);
  };

  return (
    <Screen>
      {isCoach ? (
        <>
          <Button
            label="Nieuwe afspraak"
            variant="primary"
            onPress={() => router.push('/agenda/new')}
          />
          <Button
            label="Betalingen verwerken"
            variant="secondary"
            onPress={() => router.push('/admin/payments')}
          />
          <Button
            label="Beurtenkaarten"
            variant="secondary"
            onPress={() => router.push('/agenda/beurtenkaarten')}
          />
          <Button
            label="Maandoverzicht"
            variant="secondary"
            onPress={() => router.push('/agenda/export')}
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {visibleBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {isCoach && onlyMine ? 'Geen afspraken van jou.' : 'Nog geen afspraken.'}
          </Text>
        </View>
      ) : (
        visibleBookings.map((booking) => {
          const status = statusMeta(booking.status);
          const payment: PaymentMeta = paymentMeta(booking.payment_method);
          const playerName = nameOf(booking.player_id);
          const coachName = nameOf(booking.coach_id);
          return (
            <Card key={booking.id}>
              <Text style={styles.cardDate}>
                {new Date(booking.start_time).toLocaleString('nl-BE')}
              </Text>
              <Text style={styles.cardCourt}>{courtName(booking.court_id)}</Text>

              {/* Both names click through: a lesson is the meeting point of the two
                  sections, so it is the natural jump between Spelers and Trainers. */}
              <View style={styles.partyRow}>
                {isCoach ? (
                  <Pressable
                    onPress={() => router.push(`/players/${booking.player_id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open dossier van ${playerName}`}
                    style={[styles.partyLine, webCursor]}
                  >
                    <Text style={styles.cardPartyLink}>Speler: {playerName}</Text>
                    <ChevronRight size={16} color={tennisColors.textMuted} />
                  </Pressable>
                ) : (
                  <Text style={styles.cardParty}>Speler: {playerName}</Text>
                )}
                <Pressable
                  onPress={() => router.push(`/coaches/${booking.coach_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open dossier van trainer ${coachName}`}
                  style={[styles.partyLine, webCursor]}
                >
                  <Text style={styles.cardPartyLink}>Trainer: {coachName}</Text>
                  <ChevronRight size={16} color={tennisColors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.badgeRow}>
                <Badge label={status.label} color={status.color} subtle={status.subtle} />
                {/* Een speler kijkt alleen; een geannuleerde les krijgt geen betaalwijze
                    meer, dus daar blijft het een gewone badge. */}
                {isCoach && booking.status !== 'cancelled' ? (
                  <Pressable
                    onPress={() => {
                      clearError();
                      setPayingBooking(booking);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Betaalwijze wijzigen, nu ${payment.label}`}
                    style={webCursor}
                  >
                    <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                  </Pressable>
                ) : (
                  <Badge label={payment.label} color={payment.color} subtle={payment.subtle} />
                )}
              </View>

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

      <PaymentMethodSheet
        visible={payingBooking !== null}
        current={payingBooking?.payment_method ?? 'open'}
        cardHint={cardHintFor(payingBooking)}
        error={error}
        onPick={(m) => {
          void pickMethod(m);
        }}
        onClose={() => {
          clearError();
          setPayingBooking(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginTop: spacing.xs,
  },
  partyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  cardParty: {
    ...typography.body,
    color: tennisColors.text,
  },
  cardPartyLink: {
    ...typography.body,
    color: tennisColors.primary,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
  },
  cancelRow: {
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
});
