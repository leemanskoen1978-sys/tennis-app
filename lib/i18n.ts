// De taalknop, en het gereedschap eromheen.
//
// De sleutel van een vertaling is de Nederlandse zin zelf. Dat is met opzet: in de code
// staat `t('Eindtijd reserveringen')` en niet `t('settings.booking.end')`. Je leest een
// scherm dus nog steeds zoals het op het scherm staat, een vergeten vertaling valt terug
// op het Nederlands in plaats van op een sleutel die niemand herkent, en er kan geen
// sleutel achterblijven die nergens meer gebruikt wordt.
//
// De gekozen taal staat op twee plekken, en dat moet ook:
//  - in de context hieronder, zodat React weet dat een scherm opnieuw getekend moet worden;
//  - in een variabele in deze module, zodat `lib/`-code die geen React is (datumopmaak, de
//    labels bij een status of een betaalwijze) er ook bij kan zonder dat de taal door
//    tientallen functies heen gereikt moet worden.
// De provider houdt die twee gelijk — zie `LanguageProvider`.

import React, { createContext, useContext, useMemo } from 'react';
import { EN } from './i18n-en';

export type Language = 'nl' | 'en';

/** De taal voor code die buiten React draait. Wordt gezet door `LanguageProvider`. */
let current: Language = 'nl';

function setCurrentLanguage(lang: Language): void {
  current = lang;
}


/**
 * De taalcode voor `toLocaleDateString` en vrienden. Belgisch Nederlands en Brits Engels:
 * beide schrijven 24-uursnotatie en dag vóór maand, dus een datum verspringt niet van vorm
 * als je alleen de taal omzet.
 */
export function currentLocale(): string {
  return current === 'en' ? 'en-GB' : 'nl-BE';
}

/**
 * Vertaal één zin. `vars` vult plaatshouders van de vorm `{naam}` in — zo blijft een zin
 * met een getal of een naam erin één vertaalbare zin, in plaats van drie losse stukken die
 * in het Engels in een andere volgorde horen te staan.
 */
export function translate(lang: Language, nl: string, vars?: Record<string, string | number>): string {
  const base = lang === 'en' ? EN[nl] ?? nl : nl;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/** Dezelfde vertaling, buiten React. Gebruikt de taal die de provider laatst gezet heeft. */
export function t(nl: string, vars?: Record<string, string | number>): string {
  return translate(current, nl, vars);
}

export type Translate = (nl: string, vars?: Record<string, string | number>) => string;

const LanguageCtx = createContext<{ lang: Language; t: Translate }>({ lang: 'nl', t });

/**
 * Zet de taal voor de hele boom.
 *
 * De variabele in deze module wordt tijdens het renderen gezet en niet in een effect. Een
 * effect draait ná het tekenen, en dan had een scherm zijn labels al in de oude taal
 * opgehaald — je zag de omschakeling dan pas bij de vólgende keer tekenen.
 */
export function LanguageProvider({
  lang,
  children,
}: {
  lang: Language;
  children: React.ReactNode;
}): React.JSX.Element {
  setCurrentLanguage(lang);
  const value = useMemo(
    () => ({ lang, t: (nl: string, vars?: Record<string, string | number>) => translate(lang, nl, vars) }),
    [lang],
  );
  return React.createElement(LanguageCtx.Provider, { value }, children);
}

/**
 * De vertaalfunctie in een scherm. Gebruik deze en niet de losse `t`: doordat hij uit de
 * context komt, weet React dat dit scherm opnieuw getekend moet worden zodra de taal
 * verandert. `t` los werkt wel, maar vertelt React niets.
 */
export function useT(): Translate {
  return useContext(LanguageCtx).t;
}

/** De gekozen taal zelf, voor het enkele geval dat een scherm meer wil dan één zin vertalen. */
export function useLanguage(): Language {
  return useContext(LanguageCtx).lang;
}
