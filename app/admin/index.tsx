import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CreditCard, BarChart3, LayoutGrid, Settings as SettingsIcon, UserPlus, Target,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { UserManagement } from '../../components/UserManagement';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

interface Tile {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onPress: () => void;
  badge?: number;
}

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

  // Zes gelijkwaardige tegels op een rij zeggen niets. Gegroepeerd zie je in één oogopslag
  // waar je moet zijn: gaat het over geld, over de club zelf, of over de app.
  const groups: Array<{ key: string; label: string; tiles: Tile[] }> = [
    {
      key: 'geld',
      label: 'Geld',
      tiles: [
        { key: 'pay', title: 'Betalingen', subtitle: 'Openstaande lessen afhandelen', icon: CreditCard, onPress: () => router.push('/admin/payments'), badge: pending.length },
        { key: 'rep', title: 'Rapport', subtitle: 'Omzet en aantallen', icon: BarChart3, onPress: () => router.push('/admin/reports') },
      ],
    },
    {
      key: 'club',
      label: 'Club',
      tiles: [
        { key: 'courts', title: 'Banen', subtitle: 'Namen en uurtarieven', icon: LayoutGrid, onPress: () => router.push('/admin/courts') },
        { key: 'goals', title: 'Doelen', subtitle: 'Woordenlijst voor spelersdoelen', icon: Target, onPress: () => router.push('/admin/goals') },
        { key: 'add', title: 'Speler toevoegen', subtitle: 'Nieuw lid aanmaken', icon: UserPlus, onPress: () => setAddOpen(true) },
      ],
    },
    {
      key: 'systeem',
      label: 'Systeem',
      tiles: [
        { key: 'set', title: 'Instellingen', subtitle: 'Boekingstijden, thema en taal', icon: SettingsIcon, onPress: () => router.push('/admin/settings') },
      ],
    },
  ];

  return (
    <Screen>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text style={styles.sectionLabel}>{g.label}</Text>
          <TileGrid>
            {g.tiles.map((t) => (
              <ActionTile
                key={t.key}
                title={t.title}
                subtitle={t.subtitle}
                icon={t.icon}
                onPress={t.onPress}
                badge={t.badge}
              />
            ))}
          </TileGrid>
        </View>
      ))}
      <UserManagement visible={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  group: { gap: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
