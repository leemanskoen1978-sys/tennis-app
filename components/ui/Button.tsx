import React from 'react';
import { Pressable, Text, StyleSheet, View, type ViewStyle } from 'react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, minTapTarget, webCursor } from '../../constants/theme';

type Variant = 'primary' | 'secondary' | 'danger';

/** Consistent, large-tap-target button with web hover/cursor + disabled state. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? tennisColors.primaryFill
      : variant === 'danger'
        ? tennisColors.dangerFill
        : tennisColors.surface;
  const fg = variant === 'secondary' ? tennisColors.text : tennisColors.onFill;
  const border = variant === 'secondary' ? tennisColors.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const pressed = state.pressed;
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
        styles.base,
        { backgroundColor: bg, borderColor: border },
        fullWidth && styles.fullWidth,
        webCursor,
        hovered && !disabled && styles.hovered,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ];
      }}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  fullWidth: { alignSelf: 'stretch' },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  hovered: { opacity: 0.92 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
