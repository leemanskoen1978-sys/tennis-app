import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  paymentMeta,
  totalRevenue,
} from '../../lib/payments';
import type { Booking, PaymentMethod } from '../../lib/types';

type PaymentBreakdown = Record<PaymentMethod, number>;

function emptyBreakdown(): PaymentBreakdown {
  return { open: 0, cash: 0, invoice: 0, qr: 0, beurtenkaart: 0, sponsor: 0 };
}

function buildBreakdown(bookings: Booking[]): PaymentBreakdown {
  return bookings.reduce<PaymentBreakdown>((acc, b) => {
    acc[b.payment_method] += 1;
    return acc;
  }, emptyBreakdown());
}

export default function ReportsScreen(): React.ReactElement {
  const { currentUser, bookings, courts } = useSimpleData();

  const isCoach = currentUser?.role === 'coach';

  const coachBookings = useMemo<Booking[]>(() => {
    if (!currentUser) return [];
    return bookings.filter((b) => b.coach_id === currentUser.id);
  }, [bookings, currentUser]);

  const playerBookings = useMemo<Booking[]>(() => {
    if (!currentUser) return [];
    return bookings.filter((b) => b.player_id === currentUser.id);
  }, [bookings, currentUser]);

  const coachBreakdown = useMemo<PaymentBreakdown>(
    () => buildBreakdown(coachBookings),
    [coachBookings],
  );

  // Scoped to this coach's own bookings: a trainer sees their own revenue, never the
  // club total. totalRevenue() is pure, so the scoping has to happen here at the call.
  const revenue = useMemo<number>(
    () => totalRevenue(coachBookings, courts),
    [coachBookings, courts],
  );

  if (!currentUser) {
    return (
      <Screen scroll={false} contentStyle={styles.emptyInner}>
        <Text style={styles.emptyTitle}>Rapport</Text>
        <Text style={styles.emptyText}>Log in om je rapport te bekijken.</Text>
      </Screen>
    );
  }

  if (isCoach) {
    return (
        <Screen>
          <Card>
            <Text style={styles.cardTitle}>Inkomstenoverzicht</Text>

            <View style={styles.revenueBlock}>
              <Text style={styles.revenueLabel}>Jouw omzet</Text>
              <Text style={styles.revenueValue}>€{revenue}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Mijn boekingen per betaalwijze</Text>

            {PAYMENT_METHODS.map((method) => (
              <StatRow
                key={method}
                label={PAYMENT_LABELS[method]}
                value={coachBreakdown[method]}
                color={paymentMeta(method).color}
              />
            ))}
          </Card>
        </Screen>
    );
  }

  const playerBreakdown = buildBreakdown(playerBookings);
  // Voor de speler telt maar één ding: is er een betaalwijze afgesproken of niet.
  const playerSettled = playerBookings.length - playerBreakdown.open;

  return (
    <Screen>
      <Card>
        <Text style={styles.cardTitle}>Mijn boekingen</Text>

        <StatRow
          label="Totaal aantal boekingen"
          value={playerBookings.length}
          color={tennisColors.primary}
        />
        <View style={styles.divider} />
        <StatRow
          label="Afgesproken"
          value={playerSettled}
          color={tennisColors.success}
        />
        <StatRow
          label="Openstaand"
          value={playerBreakdown.open}
          color={tennisColors.warning}
        />
      </Card>
    </Screen>
  );
}

interface StatRowProps {
  label: string;
  value: number;
  color: string;
}

function StatRow({ label, value, color }: StatRowProps): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <View style={styles.statLabelWrap}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.h1,
    color: tennisColors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: tennisColors.textMuted,
    textAlign: 'center',
  },
  cardTitle: {
    ...typography.h2,
    color: tennisColors.text,
    marginBottom: spacing.md,
  },
  revenueBlock: {
    marginBottom: spacing.xs,
  },
  revenueLabel: {
    ...typography.body,
    color: tennisColors.textMuted,
    marginBottom: 2,
  },
  revenueValue: {
    fontSize: 30,
    fontWeight: '800',
    color: tennisColors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: tennisColors.border,
    marginVertical: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  statLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statLabel: {
    ...typography.body,
    color: tennisColors.text,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
});
