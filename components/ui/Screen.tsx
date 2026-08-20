import React from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import {
  spacing, contentMaxWidth, wideBreakpoint, wideContentMaxWidth, readingMaxWidth,
} from '../../constants/theme';

/**
 * Is het venster breed genoeg voor een indeling met twee kolommen?
 * Schermen die zelf iets anders willen neerzetten op een breed venster (de agenda)
 * gebruiken dezelfde grens als Screen, zodat de indeling op één punt omslaat.
 */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= wideBreakpoint;
}

/**
 * Paginaraamwerk: op een telefoon volle breedte, op web gecentreerd met een maximum.
 *
 * Boven het omslagpunt krijgt de inhoud meer breedte, want een agenda of een raster
 * tegels kan die ruimte gebruiken. Lopende tekst kan dat niet: een regel van 960 px
 * leest slecht. Daarom is er `reading` als opt-out per scherm — een scherm dat vooral
 * tekst toont vraagt de smallere tekstkolom aan. Opt-out en niet opt-in, omdat de
 * meeste schermen lijsten en tegels tonen; die zijn beter af met de volle breedte.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
  reading = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Dit scherm bestaat vooral uit lopende tekst: houd de regels leesbaar kort. */
  reading?: boolean;
}) {
  const isWide = useIsWide();
  // Onder het omslagpunt verandert er niets: telefoon en smal venster houden 640.
  const maxWidth = !isWide
    ? contentMaxWidth
    : reading
      ? readingMaxWidth
      : wideContentMaxWidth;

  const inner = <View style={[styles.inner, { maxWidth }, contentStyle]}>{children}</View>;
  if (!scroll) {
    return <View style={styles.outer}>{inner}</View>;
  }
  return (
    <ScrollView style={styles.outer} contentContainerStyle={styles.scrollContent}>
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Transparent: the app-wide background lives behind the stack (see AppBackground).
  outer: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: spacing.xxxl },
  inner: {
    width: '100%',
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
