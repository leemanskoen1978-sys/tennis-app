// Eén tegel voor alle keuzeschermen. Het hoofdscherm bepaalde ooit hoe een keuze eruitziet
// (icoonvlak, titel, ondertitel, badge); dat patroon staat hier zodat Beheer en de agenda
// er niet ieder hun eigen variant van maken.

import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from './Card';
import { Badge } from './Badge';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function ActionTile({
  title,
  subtitle,
  icon: Icon,
  onPress,
  primary,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Vult de hele breedte en keert de kleuren om: de ene actie die je meestal wilt. */
  primary?: boolean;
  /** Een aantal dat je aandacht vraagt; 0 laat de badge weg. */
  badge?: number;
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={title}
      style={{ ...styles.tile, ...(primary ? styles.tilePrimary : {}) }}
    >
      <View style={styles.tileTop}>
        <View style={[styles.iconWrap, primary && styles.iconWrapPrimary]}>
          <Icon color={primary ? tennisColors.white : tennisColors.primary} size={24} />
        </View>
        {badge && badge > 0 ? <Badge label={String(badge)} color={tennisColors.warning} /> : null}
      </View>
      <Text style={[styles.tileTitle, primary && styles.textOnPrimary]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.tileSub, primary && styles.subOnPrimary]}>{subtitle}</Text>
      ) : null}
    </Card>
  );
}

/** Het raster eromheen: tegels vullen de rij en breken vanzelf af op een smal scherm. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // 132 hoog is ruim boven minTapTarget (44), dus het aanraakgebied is altijd groot genoeg.
  tile: { flexGrow: 1, flexBasis: 150, minHeight: 132, justifyContent: 'flex-start' },
  tilePrimary: { flexBasis: '100%', backgroundColor: tennisColors.primary },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  iconWrapPrimary: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tileTitle: { ...typography.h3, color: tennisColors.text, marginTop: spacing.sm },
  tileSub: { fontSize: 13, color: tennisColors.textMuted },
  textOnPrimary: { color: tennisColors.white },
  subOnPrimary: { color: 'rgba(255,255,255,0.85)' },
});
