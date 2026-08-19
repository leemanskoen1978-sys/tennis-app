// Lightweight design system: spacing, radius, shadow, typography scales.
// Consume these everywhere so screens stay visually consistent.
import { Platform } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8, // inputs
  md: 12, // buttons
  lg: 16, // cards
  xl: 24, // modals / sheets
  pill: 999, // chips / badges
} as const;

// Web uses boxShadow; native uses elevation. `shadow()` returns the right props.
export function shadow(level: 'sm' | 'md' | 'lg' = 'md') {
  if (Platform.OS === 'web') {
    const box = {
      sm: '0 1px 2px rgba(16,24,20,0.05)',
      md: '0 1px 3px rgba(16,24,20,0.06), 0 4px 10px rgba(16,24,20,0.05)',
      lg: '0 12px 32px rgba(16,24,20,0.16)',
    }[level];
    return { boxShadow: box } as const;
  }
  const native = {
    sm: { elevation: 1 },
    md: { elevation: 3 },
    lg: { elevation: 10 },
  }[level];
  return {
    shadowColor: '#101814',
    shadowOpacity: level === 'lg' ? 0.18 : 0.08,
    shadowRadius: level === 'lg' ? 16 : 6,
    shadowOffset: { width: 0, height: level === 'lg' ? 8 : 2 },
    ...native,
  } as const;
}

// Cursor pointer on web only (harmless no-op object on native).
export const webCursor =
  Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : ({} as const);

export const typography = {
  h1: { fontSize: 28, fontWeight: '800' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

// Content width cap so desktop web isn't full-bleed; mobile stays fluid.
export const contentMaxWidth = 640;
export const minTapTarget = 44;
