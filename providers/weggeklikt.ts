// Waar de weggeklikte berichten op dit toestel staan. Zelfde opzet als providers/session:
// AsyncStorage, en een leesfout is geen fout maar "er staat niets".

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { opgeruimd } from '../lib/weggeklikt';
import type { Booking } from '../lib/types';

const KEY = 'tennis.weggeklikt.v1';

async function lees(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const waarde: unknown = JSON.parse(raw);
    return Array.isArray(waarde) ? waarde.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function schrijf(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * De berichten die op dit toestel zijn weggeklikt, plus de knop om er een weg te klikken.
 *
 * `zichtbaar` is de lijst waarmee dit wordt schoongehouden: alles wat daar niet meer in
 * staat, hoeft ook niet meer onthouden te worden als weggeklikt.
 */
export function useWeggeklikt(zichtbaar: Booking[]): {
  weggeklikt: string[];
  klikWeg: (id: string) => void;
  klikAllesWeg: (ids: string[]) => void;
} {
  const [weggeklikt, setWeggeklikt] = useState<string[]>([]);

  useEffect(() => {
    let gestopt = false;
    void lees().then((ids) => { if (!gestopt) setWeggeklikt(ids); });
    return () => { gestopt = true; };
  }, []);

  // Opruimen zodra duidelijk is wat er nog te tonen valt. Gebeurt na het inladen, dus een
  // lege eerste render maakt niets kapot: er valt dan nog niets op te ruimen.
  useEffect(() => {
    setWeggeklikt((huidig) => {
      const schoon = opgeruimd(huidig, zichtbaar);
      if (schoon.length === huidig.length) return huidig;
      void schrijf(schoon);
      return schoon;
    });
  }, [zichtbaar]);

  const klikWeg = useCallback((id: string) => {
    setWeggeklikt((huidig) => {
      if (huidig.includes(id)) return huidig;
      const volgende = [...huidig, id];
      void schrijf(volgende);
      return volgende;
    });
  }, []);

  // In één keer opruimen. Als los ding en niet als lusje over `klikWeg`: dat zou per
  // bericht een keer wegschrijven, en dan wint bij een trage opslag de laatste van de rest.
  const klikAllesWeg = useCallback((ids: string[]) => {
    setWeggeklikt((huidig) => {
      const volgende = [...new Set([...huidig, ...ids])];
      if (volgende.length === huidig.length) return huidig;
      void schrijf(volgende);
      return volgende;
    });
  }, []);

  return { weggeklikt, klikWeg, klikAllesWeg };
}
