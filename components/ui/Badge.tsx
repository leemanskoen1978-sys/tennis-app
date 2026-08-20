import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing } from '../../constants/theme';

/** Small status pill. Pass a background color; text auto-contrasts to white/dark. */
export function Badge({
  label,
  color = tennisColors.primaryFill,
  subtle = false,
}: {
  label: string;
  color?: string;
  subtle?: boolean;
}) {
  return (
    <View
      style={[
        styles.badge,
        subtle
          ? { backgroundColor: tennisColors.primaryTint }
          : { backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { color: subtle ? tennisColors.primaryDark : tennisColors.onFill }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
