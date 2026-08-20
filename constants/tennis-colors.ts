// Central color palette — tennisgroen as primary.
//
// Er zijn twee paletten met exact dezelfde sleutels: licht en donker. Wat een scherm
// schrijft is altijd `tennisColors.text` — nooit een van de twee paletten rechtstreeks.
//
// Op het web is `tennisColors` géén tabel met kleuren maar met verwijzingen naar CSS-
// variabelen: `text` is de tekst `var(--tc-text)`. Die truc is nodig omdat StyleSheet.create
// zijn kleuren vastlegt op het moment dat het bestand geladen wordt; een omschakeling later
// zou niets meer veranderen aan die 600+ regels stijl. Nu staat er overal een verwijzing en
// verandert alleen wat die verwijzing betekent — één regel CSS op de <html>. react-native-web,
// expo-linear-gradient en react-native-svg laten `var(...)` allemaal met opzet door.
//
// Op een telefoon-build bestaan CSS-variabelen niet. Daar staat het lichte palet, vast.
import { Platform } from 'react-native';

const light = {
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
  warningTint: '#FAF0DE', // zachte vulling achter een waarschuwingsicoon, zoals primaryTint
  success: '#2F7D34',
  dangerTint: '#FDECEA', // zachte vulling achter een foutmelding, zoals warningTint

  // De kleuren hierboven zijn kleuren om mee te schríjven: tekst, een icoon, een lijn.
  // Die hieronder zijn dezelfde kleuren om mee te vúllen: een knop, een badge, de hero.
  // Twee rijen, omdat het in donker twee verschillende kleuren moeten zijn — zie het
  // donkere palet. Op de vullingen staat altijd `onFill`.
  primaryFill: '#2F7D34',
  primaryFillDeep: '#245C29', // de diepe kant van het verloop in de hero
  successFill: '#2F7D34',
  dangerFill: '#C0392B',
  warningFill: '#B5730A',
  courtFill: '#2C5F8A',
  clayFill: '#C56B3E',
  mutedFill: '#55655A',

  onFill: '#FFFFFF', // tekst en iconen bóvenop een gevulde kleur (knop, badge, hero)
  onFillMuted: 'rgba(255,255,255,0.85)', // bijschrift op zo'n vulling
  onFillWash: 'rgba(255,255,255,0.20)', // een vlak dat lichtjes oplicht ín de vulling
} as const;

// Donker is geen omgekeerd licht palet: de groenen zijn opgetrokken zodat ze op een donkere
// achtergrond nog leesbaar zijn (een tennisgroen van #2F7D34 verdwijnt daar bijna), en
// `onFill` is juist bijna zwart. Dat is de gebruikelijke omkering: op donker is de vulling
// het lichte vlak, dus staat het label daar donker op. Alle combinaties die in de app
// voorkomen halen zo minstens 5,5:1 — ruim boven de AA-grens van 4,5:1.
//
// `primaryDark` is in dit palet lichter dan `primary` en niet donkerder. De naam zegt niet
// "donkerder" maar "de tweede groentint": de rustige partner in de hero-verloop en de kleur
// van tekst op een groene vulling. Op donker moet die tint omhoog, niet omlaag.
const dark = {
  primary: '#57B25D',
  primaryDark: '#8ACF8F',
  primaryTint: '#1D2C21',
  accent: '#C8E063',
  court: '#68A8DD',
  clay: '#DE8F63',
  background: '#0E1411',
  surface: '#171F1A',
  surfaceAlt: '#1E2822',
  text: '#E7EEE8',
  textMuted: '#A2B2A7',
  border: '#2B372F',
  danger: '#EC6F62',
  warning: '#E0A63F',
  warningTint: '#2B2414',
  success: '#57B25D',
  dangerTint: '#2E1613',

  // Hier lopen de twee rijen uiteen. Om te schríjven moet een kleur op donker juist
  // omhóóg (het tennisgroen van #2F7D34 is op bijna zwart nauwelijks te lezen); om te
  // vúllen moet hij juist diep blijven, want er staat witte tekst op en een vlak dat
  // helder oplicht is op een donkere pagina een schreeuw. Vandaar dat de vullingen hier
  // bijna gelijk zijn aan die van het lichte palet, een tikje dieper zodat ze niet
  // blakeren, en dat wit op elk van hen boven 4,2:1 blijft.
  primaryFill: '#2E7A33',
  primaryFillDeep: '#215227',
  successFill: '#2E7A33',
  dangerFill: '#B33F32',
  warningFill: '#9E680E',
  courtFill: '#2F6494',
  clayFill: '#B5643C',
  mutedFill: '#4C5C51',

  onFill: '#FFFFFF',
  onFillMuted: 'rgba(255,255,255,0.85)',
  onFillWash: 'rgba(255,255,255,0.20)',
} as const;

// Een schaduw is op donker niet dezelfde schaduw met een andere kleur: een grijze rand
// rond een donkere kaart leest als vuil. Op donker doet de schaduw daarom minder werk (de
// kaart licht al op ten opzichte van de achtergrond) en is hij dieper zwart.
export const shadows = {
  light: {
    sm: '0 1px 2px rgba(16,24,20,0.05)',
    md: '0 1px 3px rgba(16,24,20,0.06), 0 4px 10px rgba(16,24,20,0.05)',
    lg: '0 12px 32px rgba(16,24,20,0.16)',
  },
  dark: {
    sm: '0 1px 2px rgba(0,0,0,0.40)',
    md: '0 1px 3px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.35)',
    lg: '0 14px 36px rgba(0,0,0,0.60)',
  },
} as const;

export type ShadowLevel = keyof typeof shadows.light;

// Het COACH-merkteken achter de app is een PNG in één vaste groentint (zie AppBackground).
// Op wit valt die tint bij 0,16 nog net op; op een bijna zwarte achtergrond verdwijnt hij
// dan helemaal. Alleen de dekking verschilt dus per thema, de afbeelding niet.
export const decor = {
  light: { markOpacity: '0.16' },
  dark: { markOpacity: '0.30' },
} as const;

export type TennisColorKey = keyof typeof light;
export type ThemeMode = 'light' | 'dark';

export const palettes: Record<ThemeMode, Record<TennisColorKey, string>> = { light, dark };

/** De CSS-naam van één kleur, bv. `--tc-primary`. Eén plek, zodat de twee kanten niet uiteenlopen. */
export const cssVarName = (key: TennisColorKey): string => `--tc-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const asCssVars = (): Record<TennisColorKey, string> => {
  const out = {} as Record<TennisColorKey, string>;
  for (const key of Object.keys(light) as TennisColorKey[]) {
    out[key] = `var(${cssVarName(key)})`;
  }
  return out;
};

export const tennisColors: Record<TennisColorKey, string> =
  Platform.OS === 'web' ? asCssVars() : light;
