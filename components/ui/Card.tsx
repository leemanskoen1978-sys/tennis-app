import React from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, shadow, webCursor } from '../../constants/theme';

/** Elevated surface. Pass onPress to make it a tappable card (with hover on web). */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  selected,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Voor een kaart die een keuze is: staat hij aan? Een schermlezer zegt het dan mee. */
  selected?: boolean;
  style?: ViewStyle;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={selected === undefined ? undefined : { selected }}
        onPress={onPress}
        style={(state) => {
          const pressed = state.pressed;
          const hovered = (state as { hovered?: boolean }).hovered;
          return [
            styles.card,
            webCursor,
            hovered && styles.hovered,
            pressed && styles.pressed,
            style,
          ];
        }}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tennisColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow('md'),
  },
  hovered: { ...shadow('lg') },
  pressed: { opacity: 0.92 },
});
