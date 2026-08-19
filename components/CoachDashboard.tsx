import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CreditCard, Euro, Users } from 'lucide-react-native';

import { tennisColors } from '../constants/tennis-colors';
import {
  useSimpleData,
  usePendingPaymentBookings,
} from '../providers/SimpleDataProvider';
import { totalRevenue } from '../lib/payments';

type CoachDashboardProps = {
  onOpenPayments: () => void;
  onOpenUsers: () => void;
};

export function CoachDashboard(props: CoachDashboardProps): JSX.Element {
  const { onOpenPayments, onOpenUsers } = props;
  const { currentUser, bookings, courts } = useSimpleData();
  const pendingBookings = usePendingPaymentBookings();

  // Own revenue only — a coach never sees the club total. Same rule as reports.tsx.
  const myBookings = currentUser
    ? bookings.filter((b) => b.coach_id === currentUser.id)
    : [];
  const revenue = totalRevenue(myBookings, courts);
  const pendingCount = pendingBookings.length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coach-overzicht</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenPayments}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Betalingen"
        >
          <CreditCard size={20} color={tennisColors.white} />
          <Text style={styles.actionButtonText}>Betalingen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenUsers}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Speler toevoegen"
        >
          <Users size={20} color={tennisColors.white} />
          <Text style={styles.actionButtonText}>Speler toevoegen</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Euro size={22} color={tennisColors.primary} />
          </View>
          <Text style={styles.statValue}>{`€${revenue}`}</Text>
          <Text style={styles.statLabel}>Jouw inkomsten (cash)</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <CreditCard size={22} color={tennisColors.warning} />
          </View>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Openstaand</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tennisColors.background,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: tennisColors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tennisColors.primary,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: tennisColors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: tennisColors.surface,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: tennisColors.text,
  },
  statLabel: {
    fontSize: 13,
    color: tennisColors.textMuted,
  },
});
