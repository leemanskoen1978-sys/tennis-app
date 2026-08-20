// Het omzetten van licht naar donker, op één plek.
//
// Er wordt niets opnieuw gerenderd om van thema te wisselen. Elk scherm schrijft
// `tennisColors.text`, en dat is op het web de tekst `var(--tc-text)` (zie
// constants/tennis-colors). Hier staat wat die variabelen betekenen: één blok voor licht,
// één blok voor donker, en een `data-theme` op <html> dat kiest welk blok geldt. De browser
// verft de rest. Daarom kost een omschakeling geen enkele re-render en hoeft geen van de
// 600+ stijlregels in de app iets van thema's te weten.
//
// Op een telefoon-build bestaat dit alles niet; daar is `tennisColors` gewoon het lichte
// palet en doen deze functies niets.

import { Platform } from 'react-native';
import {
  palettes, shadows, decor, cssVarName, type TennisColorKey, type ThemeMode,
} from '../constants/tennis-colors';

const STYLE_ID = 'tc-theme';
const STORAGE_KEY = 'tc-theme-mode';

export const isWeb = Platform.OS === 'web' && typeof document !== 'undefined';

const varsFor = (mode: ThemeMode): string => {
  const palette = palettes[mode];
  const colors = (Object.keys(palette) as TennisColorKey[])
    .map((key) => `  ${cssVarName(key)}: ${palette[key]};`)
    .join('\n');
  const shadow = (Object.keys(shadows[mode]) as Array<keyof typeof shadows.light>)
    .map((level) => `  --tc-shadow-${level}: ${shadows[mode][level]};`)
    .join('\n');
  return `${colors}\n${shadow}\n  --tc-mark-opacity: ${decor[mode].markOpacity};`;
};

/**
 * Het volledige blad. Licht staat op `:root` en is dus ook wat je krijgt als er nog geen
 * keuze bekend is; donker overschrijft alleen de waarden.
 *
 * De achtergrond op html en body staat er los bij: de app tekent zijn eigen achtergrond in
 * een View, maar daarbuiten (de rand die je ziet bij doorscrollen voorbij het einde, en de
 * balk achter een adresbalk op een telefoon) verft de browser zelf. Zonder deze regel is
 * die rand wit, ook in donker.
 */
const buildCss = (): string => `:root {
${varsFor('light')}
}

:root[data-theme='dark'] {
${varsFor('dark')}
}

html, body {
  background-color: var(--tc-background);
}
`;

/**
 * Zet het thema om. Veilig om zo vaak aan te roepen als je wilt: het blad wordt één keer
 * gemaakt en daarna verandert alleen het `data-theme`-attribuut.
 */
export function applyThemeMode(mode: ThemeMode): void {
  if (!isWeb) return;

  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCss();
    document.head.appendChild(style);
  }

  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  // Zegt aan de browser zelf welk thema er staat: formuliervelden, keuzelijsten en de
  // schuifbalk komen van het besturingssysteem en zouden anders licht blijven.
  root.style.colorScheme = mode;

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Privémodus of geblokkeerde opslag: dan is er alleen geen voorsprong bij de volgende
    // start. De keuze zelf staat in de instellingen, niet hier.
  }
}

/**
 * Het thema van de vorige keer, uit de opslag van deze browser.
 *
 * De echte keuze staat in de instellingen van de club en is er pas ná het laden van de
 * databank. Zonder deze voorsprong zou de app dus altijd eerst licht opkomen en dan pas
 * omslaan — één flits wit bij elke start in donkere modus.
 */
export function rememberedThemeMode(): ThemeMode | null {
  if (!isWeb) return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}
