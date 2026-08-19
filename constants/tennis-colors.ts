// Central color palette — tennisgroen as primary.
export const tennisColors = {
  primary: '#2F7D34', // tennisgroen (deeper, richer)
  primaryDark: '#245C29',
  primaryTint: '#E8F1E6', // subtle fills, hover, selected rows
  accent: '#C8E063', // fills / badges ONLY — never text on white
  court: '#2C5F8A', // info / invoice — reserve for one meaning
  clay: '#C56B3E',
  background: '#F6F8F4',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFCFA', // nested panels inside cards/modals
  text: '#16221A',
  textMuted: '#55655A', // darkened for WCAG AA on background
  border: '#E2E9DD',
  danger: '#C0392B',
  warning: '#B5730A', // darkened so white text passes AA
  success: '#2F7D34',
  white: '#FFFFFF',
} as const;

export type TennisColorKey = keyof typeof tennisColors;
