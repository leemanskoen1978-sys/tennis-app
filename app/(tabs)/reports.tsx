import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { tennisColors } from '../../constants/tennis-colors';
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

  const revenue = useMemo<number>(
    () => totalRevenue(bookings, courts),
    [bookings, courts],
  );

  if (!currentUser) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Rapport</Text>
        <Text style={styles.emptyText}>Log in om je rapport te bekijken.</Text>
      </View>
    );
  }

  if (isCoach) {
    return (
      <>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.pageTitle}>Rapport</Text>

          <CoachDashboard
            onOpenPayments={() => setPaymentsOpen(true)}
            onOpenUsers={() => setUsersOpen(true)}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inkomstenoverzicht</Text>

            <View style={styles.revenueBlock}>
              <Text style={styles.revenueLabel}>Totale omzet</Text>
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
              color={tennisColors.danger}
            />
            <StatRow
              label="Openstaand"
              value={coachBreakdown.open}
              color={tennisColors.warning}
            />
          </View>
        </ScrollView>

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
  const playerUnpaidOpen = playerBreakdown.unpaid + playerBreakdown.open + playerBreakdown.invoice;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Rapport</Text>

      <View style={styles.card}>
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
      </View>
    </ScrollView>
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
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: tennisColors.background,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: tennisColors.textMuted,
    textAlign: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 4,
  },
  card: {
    backgroundColor: tennisColors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: tennisColors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 14,
  },
  revenueBlock: {
    marginBottom: 4,
  },
  revenueLabel: {
    fontSize: 14,
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
    marginVertical: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statLabel: {
    fontSize: 15,
    color: tennisColors.text,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
});
