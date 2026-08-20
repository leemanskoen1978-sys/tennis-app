import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, spacing, minTapTarget, webCursor } from '../../constants/theme';

/** Selectable pill. Resting = surface; active = primary. Big tap target + hover. */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(state) => {
        const pressed = state.pressed;
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
          styles.chip,
          selected ? styles.selected : styles.unselected,
          webCursor,
          hovered && !disabled && !selected && styles.hovered,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ];
      }}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  selected: { backgroundColor: tennisColors.primaryFill, borderColor: tennisColors.primaryFill },
  unselected: { backgroundColor: tennisColors.surface, borderColor: tennisColors.border },
  hovered: { backgroundColor: tennisColors.primaryTint },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  textSelected: { color: tennisColors.onFill },
  textUnselected: { color: tennisColors.text },
});
