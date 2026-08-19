import React from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { spacing, contentMaxWidth } from '../../constants/theme';

/**
 * Page wrapper: full-width on mobile, centered with a max width on desktop web.
 * Keeps line lengths readable and avoids the full-bleed RN-Web look.
 */
export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}) {
  const inner = <View style={[styles.inner, contentStyle]}>{children}</View>;
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
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
