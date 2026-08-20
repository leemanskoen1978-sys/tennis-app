import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, UserPlus, Target,
  ChevronRight, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { UserManagement } from '../../components/UserManagement';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

/** The club, the money and the system. Everything here used to hide in a bottom sheet. */
export default function Admin() {
  const router = useRouter();
  const { currentUser } = useSimpleData();
  const pending = usePendingPaymentBookings();
  const [addOpen, setAddOpen] = useState(false);

  if (currentUser?.role !== 'coach') {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Beheer is alleen voor trainers.</Text>
      </Screen>
    );
  }

  const rows: Array<{ key: string; label: string; icon: LucideIcon; onPress: () => void; badge?: number }> = [
    { key: 'pay', label: 'Betalingen', icon: CreditCard, onPress: () => router.push('/admin/payments'), badge: pending.length },
    { key: 'rep', label: 'Rapport', icon: BarChart3, onPress: () => router.push('/admin/reports') },
    { key: 'courts', label: 'Banen', icon: LayoutGrid, onPress: () => router.push('/admin/courts') },
    { key: 'goals', label: 'Doelen', icon: Target, onPress: () => router.push('/admin/goals') },
    { key: 'set', label: 'Instellingen', icon: SettingsIcon, onPress: () => router.push('/admin/settings') },
    { key: 'add', label: 'Speler toevoegen', icon: UserPlus, onPress: () => setAddOpen(true) },
  ];

  return (
    <Screen>
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <Card key={r.key} onPress={r.onPress} accessibilityLabel={r.label} style={styles.row}>
            <View style={styles.rowContent}>
              <View style={styles.icon}><Icon size={20} color={tennisColors.primary} /></View>
              <Text style={styles.label}>{r.label}</Text>
              {r.badge && r.badge > 0 ? <Badge label={String(r.badge)} color={tennisColors.warning} /> : null}
              <ChevronRight size={20} color={tennisColors.textMuted} />
            </View>
          </Card>
        );
      })}
      <UserManagement visible={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  row: {},
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  label: { flex: 1, ...typography.h3, color: tennisColors.text },
});
