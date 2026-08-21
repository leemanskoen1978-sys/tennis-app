// Eén tegel voor alle keuzeschermen. Het hoofdscherm bepaalde ooit hoe een keuze eruitziet
// (icoonvlak, titel, ondertitel, badge); dat patroon staat hier zodat Beheer en de agenda
// er niet ieder hun eigen variant van maken.

import { View, Text, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Card } from './Card';
import { useIsWide } from './Screen';
import { Badge } from './Badge';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography } from '../../constants/theme';

export function ActionTile({
  title,
  subtitle,
  icon: Icon,
  onPress,
  primary,
  selected,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onPress: () => void;
  /** Vult de hele breedte en keert de kleuren om: de ene actie die je meestal wilt. */
  primary?: boolean;
  /**
   * Voor een rij tegels die samen één keuze zijn: deze staat aan. Hij krijgt dezelfde
   * omgekeerde kleuren als een primaire tegel, maar niet diens volle breedte — anders
   * springt een rij van drie uit elkaar zodra je een andere kiest.
   */
  selected?: boolean;
  /** Een aantal dat je aandacht vraagt; 0 laat de badge weg. */
  badge?: number;
}) {
  const isWide = useIsWide();
  // Eén vraag voor alle kleuren hieronder: staat deze tegel in de omgekeerde stand?
  const filled = Boolean(primary || selected);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={title}
      selected={selected}
      style={{
        ...styles.tile,
        // De maximumbreedte geldt alleen op een breed venster; op een telefoon zou een
        // cap juist ruimte weggooien in een rij van twee.
        ...(isWide && !primary ? styles.tileWide : {}),
        ...(filled ? styles.tileFilled : {}),
        ...(primary ? styles.tilePrimary : {}),
      }}
    >
      <View style={styles.tileTop}>
        <View style={[styles.iconWrap, filled && styles.iconWrapPrimary]}>
          <Icon color={filled ? tennisColors.onFill : tennisColors.primary} size={24} />
        </View>
        {badge && badge > 0 ? <Badge label={String(badge)} color={tennisColors.warningFill} /> : null}
      </View>
      <Text style={[styles.tileTitle, filled && styles.textOnPrimary]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.tileSub, filled && styles.subOnPrimary]}>{subtitle}</Text>
      ) : null}
    </Card>
  );
}

/**
 * Het raster eromheen: tegels vullen de rij en breken vanzelf af op een smal scherm.
 * Op een breed venster passen er vanzelf meer naast elkaar; de maximumbreedte per tegel
 * zorgt dat een laatste, alleenstaande tegel geen brede balk wordt.
 */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // 132 hoog is ruim boven minTapTarget (44), dus het aanraakgebied is altijd groot genoeg.
  tile: { flexGrow: 1, flexBasis: 150, minHeight: 132, justifyContent: 'flex-start' },
  // Alleen boven het omslagpunt: 150 is de smalste tegel waarin titel en ondertitel nog
  // passen, 260 de breedte waarboven een tegel als een balk gaat ogen.
  tileWide: { minWidth: 150, maxWidth: 260 },
  // De omgekeerde stand: primair, of gekozen uit een rij.
  tileFilled: { backgroundColor: tennisColors.primaryFill },
  // De primaire tegel is bewust de volle rij breed; die mag de maximumbreedte negeren.
  tilePrimary: { flexBasis: '100%', maxWidth: '100%' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryTint,
  },
  iconWrapPrimary: { backgroundColor: tennisColors.onFillWash },
  tileTitle: { ...typography.h3, color: tennisColors.text, marginTop: spacing.sm },
  tileSub: { fontSize: 13, color: tennisColors.textMuted },
  textOnPrimary: { color: tennisColors.onFill },
  subOnPrimary: { color: tennisColors.onFillMuted },
});
