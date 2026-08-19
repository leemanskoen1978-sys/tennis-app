// Central color palette — tennisgroen as primary.
export const tennisColors = {
  primary: '#3E8E41', // tennisgroen
  primaryDark: '#2E6B30',
  accent: '#C8E063', // ball yellow-green
  court: '#2C5F8A', // court blue
  clay: '#C56B3E',
  background: '#F5F7F2',
  surface: '#FFFFFF',
  text: '#1C2B1E',
  textMuted: '#6B7B6E',
  border: '#DCE5D8',
  danger: '#C0392B',
  warning: '#E08E0B',
  success: '#3E8E41',
  white: '#FFFFFF',
} as const;

export type TennisColorKey = keyof typeof tennisColors;
