import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { CoachDashboard } from '../../components/CoachDashboard';
import { PaymentStatusModal } from '../../components/PaymentStatusModal';
import { UserManagement } from '../../components/UserManagement';
import { totalRevenue } from '../../lib/payments';
import type { Booking, PaymentStatus } from '../../lib/types';

interface PaymentBreakdown {
  paid: number;
  invoice: number;
  unpaid: number;
  open: number;
}

function buildBreakdown(bookings: Booking[]): PaymentBreakdown {
  return bookings.reduce<PaymentBreakdown>(
    (acc, b) => {
      const status: PaymentStatus = b.payment_status;
      if (status === 'paid') acc.paid += 1;
      else if (status === 'invoice') acc.invoice += 1;
      else if (status === 'unpaid') acc.unpaid += 1;
      else acc.open += 1;
      return acc;
    },
    { paid: 0, invoice: 0, unpaid: 0, open: 0 },
  );
}

export default function ReportsScreen(): React.ReactElement {
  const { currentUser, bookings, courts } = useSimpleData();
  const [paymentsOpen, setPaymentsOpen] = useState<boolean>(false);
  const [usersOpen, setUsersOpen] = useState<boolean>(false);

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
      <>
        <Screen>
          <Text style={styles.pageTitle}>Rapport</Text>

          <CoachDashboard
            onOpenPayments={() => setPaymentsOpen(true)}
            onOpenUsers={() => setUsersOpen(true)}
          />

          <Card>
            <Text style={styles.cardTitle}>Inkomstenoverzicht</Text>

            <View style={styles.revenueBlock}>
              <Text style={styles.revenueLabel}>Jouw omzet</Text>
              <Text style={styles.revenueValue}>€{revenue}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>Mijn boekingen per status</Text>

            <StatRow
              label="Betaald"
              value={coachBreakdown.paid}
              color={tennisColors.success}
            />
            <StatRow
              label="Op factuur"
              value={coachBreakdown.invoice}
              color={tennisColors.court}
            />
            <StatRow
              label="Onbetaald"
              value={coachBreakdown.unpaid}
              color={tennisColors.warning}
            />
            <StatRow
              label="Openstaand"
              value={coachBreakdown.open}
              color={tennisColors.textMuted}
            />
          </Card>
        </Screen>

        <PaymentStatusModal
          visible={paymentsOpen}
          onClose={() => setPaymentsOpen(false)}
        />
        <UserManagement
          visible={usersOpen}
          onClose={() => setUsersOpen(false)}
        />
      </>
    );
  }

  const playerBreakdown = buildBreakdown(playerBookings);
  const playerUnpaidOpen =
    playerBreakdown.unpaid + playerBreakdown.open + playerBreakdown.invoice;

  return (
    <Screen>
      <Text style={styles.pageTitle}>Rapport</Text>

      <Card>
        <Text style={styles.cardTitle}>Mijn boekingen</Text>

        <StatRow
          label="Totaal aantal boekingen"
          value={playerBookings.length}
          color={tennisColors.primary}
        />
        <View style={styles.divider} />
        <StatRow
          label="Betaald"
          value={playerBreakdown.paid}
          color={tennisColors.success}
        />
        <StatRow
          label="Onbetaald / openstaand"
          value={playerUnpaidOpen}
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
  pageTitle: {
    ...typography.h1,
    color: tennisColors.text,
    marginBottom: spacing.xs,
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
