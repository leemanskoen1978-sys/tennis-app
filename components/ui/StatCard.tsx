// Eén cijfer met een icoon en een label eronder. Bewust los van ActionTile: een tegel is
// een keuze die je aantikt, dit is alleen een getal om te lezen. Ze delen de kaartvorm,
// niet het gedrag — en dit patroon (twee cijfers naast elkaar) komt vaker terug.

import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from './Card';
import { useIsWide } from './Screen';
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
  // Op een breed venster passen twee of drie kaarten altijd naast elkaar (zoals altijd);
  // op een telefoon mag een kaart nooit breder worden dan een kaart die wél naast een
  // buur staat, anders wordt een overgebleven derde kaart een volle balk onder de rest.
  const isWide = useIsWide();
  return (
    <Card style={{ ...styles.card, ...(!isWide ? styles.cardNarrow : {}) }}>
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

/**
 * De rij eromheen: de kaartjes delen de breedte gelijk. Op een breed venster blijft dat
 * altijd één rij (zoals voorheen); op een telefoon breekt de rij af zodra een kaart onder
 * zijn minimumbreedte zou zakken — zie `TileGrid` in ActionTile.tsx voor hetzelfde patroon.
 */
export function StatCardRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // flexBasis 0 met flex 1: de kaartjes delen de breedte gelijk, ook als één label langer
  // is. Op een breed venster is er altijd plek voor alle kaarten naast elkaar, dus wrapt
  // dit nooit — precies zoals voorheen.
  card: { flex: 1, flexBasis: 0, alignItems: 'center', gap: spacing.xs },
  // Op een telefoon geeft een vaste minimumbreedte de rij iets om op af te breken (twee
  // kaarten van ~140 passen nog altijd naast elkaar); de maximumbreedte voorkomt dat een
  // overgebleven derde kaart in haar eigen rij de volle breedte opeist.
  cardNarrow: { flexBasis: 140, minWidth: 140, maxWidth: '48%' },
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
