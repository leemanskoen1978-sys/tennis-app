// Eén cijfer met een icoon en een label eronder. Bewust los van ActionTile: een tegel is
// een keuze die je aantikt, dit is alleen een getal om te lezen. Ze delen de kaartvorm,
// niet het gedrag — en dit patroon (twee cijfers naast elkaar) komt vaker terug.

import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from './Card';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function StatCard({
  icon: Icon,
  value,
  label,
  tone = 'primary',
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  /** 'warning' voor een getal dat om actie vraagt; anders het gewone tennisgroen. */
  tone?: 'primary' | 'warning';
}) {
  const color = tone === 'warning' ? tennisColors.warning : tennisColors.primary;
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, tone === 'warning' && styles.iconWrapWarning]}>
        <Icon color={color} size={20} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

/** De rij eromheen: de kaartjes delen de breedte gelijk en breken niet af. */
export function StatCardRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  // flexBasis 0 met flex 1: beide kaartjes even breed, ook als het ene label langer is.
  card: { flex: 1, flexBasis: 0, alignItems: 'center', gap: spacing.xs },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  iconWrapWarning: { backgroundColor: '#F6EEDC' },
  value: { ...typography.h1, color: tennisColors.text },
  label: { ...typography.caption, color: tennisColors.textMuted, textAlign: 'center' },
});
