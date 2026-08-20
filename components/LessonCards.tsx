// Een lijst korte leskaarten met het detailblad eraan vast. Historiek en Nog te komen tonen
// dezelfde les; stond dit op beide schermen los overgeschreven, dan zou dezelfde les er per
// scherm anders uit gaan zien — en dat is precies wat het detailblad ooit kwam oplossen.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { LessonDetailSheet, paymentLabelFor } from './LessonDetailSheet';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { useIsWide } from './ui/Screen';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { formatDay, formatTimeRange } from '../lib/datetime';
import { groupSize, shortGroupLabel } from '../lib/groups';
import { bookingPaymentMeta, type PaymentMeta } from '../lib/payments';
import { isAwaitingApproval } from '../lib/inbox';
import { BOOKING_STATUS_LABELS } from '../lib/status';
import type { Booking } from '../lib/types';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, typography } from '../constants/theme';

export function LessonCards({
  bookings,
  empty,
}: {
  bookings: Booking[];
  /** Wat er staat als er niets te tonen valt. */
  empty: string;
}): React.JSX.Element {
  const { currentUser, users, courts, beurtenkaarten, clearError } = useSimpleData();
  const isWide = useIsWide();
  // Welke les zijn details laat zien; null = blad dicht.
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);

  const isCoach = currentUser?.role === 'coach';

  const nameOf = (id?: string): string => users.find((u) => u.id === id)?.name ?? 'Onbekend';
  const courtName = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? 'Onbekend terrein';

  if (bookings.length === 0) {
    return <Text style={styles.muted}>{empty}</Text>;
  }

  return (
    <>
      {/* Boven het omslagpunt twee kolommen: één korte kaart per rij liet op 960 px een
          halve rij wit achter. Daaronder blijft het één kolom, zoals op een telefoon. */}
      <View style={isWide ? styles.grid : styles.stack}>
        {bookings.map((booking) => {
          const payment: PaymentMeta = bookingPaymentMeta(booking);
          const paymentLabel = paymentLabelFor(booking, payment, beurtenkaarten);
          // Je eigen naam hoef je niet te lezen: een trainer ziet de speler, een speler de
          // trainer. Kijkt een trainer naar de agenda van een collega, dan zegt de speler
          // hem het meest — de trainer staat dan al in de filter erboven.
          // Bij een groepsles staat er "Mathis +2": de speler die de les op zijn naam heeft,
          // en hoeveel er nog bij stonden. De namen zelf staan in het detailblad — daar is
          // ruimte voor, op een korte kaart niet.
          const other = isCoach
            ? shortGroupLabel(nameOf(booking.player_id), groupSize(booking))
            : nameOf(booking.coach_id);
          return (
            <View key={booking.id} style={isWide ? styles.cell : undefined}>
              <Card
                onPress={() => {
                  clearError();
                  setOpenBooking(booking);
                }}
                accessibilityLabel={`Les van ${formatDay(booking.start_time)} met ${other}, details openen`}
              >
                <Text style={styles.cardDate}>
                  {formatTimeRange(booking.start_time, booking.end_time)} · {other}
                </Text>
                <Text style={styles.cardCourt}>
                  {formatDay(booking.start_time)} · {courtName(booking.court_id)}
                </Text>
                <View style={styles.badgeRow}>
                  {/* Zolang de trainer niet beslist heeft, is dát het enige wat er over deze
                      les te zeggen valt — vandaar vóór de betaalwijze. */}
                  {isAwaitingApproval(booking) ? (
                    <Badge
                      label={BOOKING_STATUS_LABELS.pending}
                      color={tennisColors.warningFill}
                    />
                  ) : null}
                  <Badge label={paymentLabel} color={payment.color} subtle={payment.subtle} />
                </View>
              </Card>
            </View>
          );
        })}
      </View>

      <LessonDetailSheet
        booking={openBooking}
        visible={openBooking !== null}
        canManage={isCoach}
        onClose={() => {
          clearError();
          setOpenBooking(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, color: tennisColors.textMuted },
  // Het raster om de leskaarten. `gap` doet het werk; de cellen zelf zijn net onder de
  // helft breed zodat er op een breed venster twee naast elkaar passen.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Onder het omslagpunt: gewoon onder elkaar, elk over de volle breedte.
  stack: { gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: '48%', maxWidth: '49%' },
  cardDate: { ...typography.h3, color: tennisColors.text },
  cardCourt: { fontSize: 13, color: tennisColors.textMuted },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
});
