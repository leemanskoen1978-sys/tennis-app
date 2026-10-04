// Dezelfde vorm als de Supabase-kant, op de opslag van dit toestel.
//
// Niet om echt te factureren — zonder .env is er geen login en dus geen eigenaar — maar zodat
// het scherm te openen is tijdens het werken eraan, en zodat de app niet omvalt op een
// backend die deze vraag niet kent.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Factuur, Factuurles, FacturatieData, Klant, Leverancier,
} from '../lib/facturatie';

const SLEUTEL = 'tennis.facturatie.v1';

const LEEG: FacturatieData = {
  leverancier: { id: '', naam: '', adres: '', btw: '', iban: '', bic: '' },
  klanten: [],
  lessen: [],
  facturen: [],
};

async function lees(): Promise<FacturatieData> {
  try {
    const ruw = await AsyncStorage.getItem(SLEUTEL);
    return ruw ? (JSON.parse(ruw) as FacturatieData) : LEEG;
  } catch {
    return LEEG;
  }
}

async function schrijf(data: FacturatieData): Promise<void> {
  try {
    await AsyncStorage.setItem(SLEUTEL, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Een rij op zijn id vervangen, of achteraan toevoegen als hij er nog niet is. */
function metRij<T extends { id: string }>(rijen: T[], rij: T): T[] {
  const i = rijen.findIndex((r) => r.id === rij.id);
  if (i === -1) return [...rijen, rij];
  const uit = [...rijen];
  uit[i] = rij;
  return uit;
}

export const facturatieLokaal = {
  laden: async (): Promise<FacturatieData | null> => lees(),

  leverancierBewaren: async (l: Leverancier) => schrijf({ ...(await lees()), leverancier: l }),

  klantBewaren: async (k: Klant) => {
    const data = await lees();
    await schrijf({ ...data, klanten: metRij(data.klanten, k) });
  },

  klantVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, klanten: data.klanten.filter((k) => k.id !== id) });
  },

  lessenToevoegen: async (lessen: readonly Factuurles[]) => {
    const data = await lees();
    const gekend = new Set(data.lessen.map((l) => l.sleutel));
    const nieuw: Factuurles[] = [];
    for (const les of lessen) {
      // Ook binnen één plakbeurt: twee regels met dezelfde sleutel zijn dezelfde les. Aan
      // de kant van de databank houdt de unieke index dat tegen; hier moet het met de hand,
      // anders doen de twee kanten iets anders en merk je dat pas op een toestel zonder
      // .env.
      if (gekend.has(les.sleutel)) continue;
      gekend.add(les.sleutel);
      nieuw.push(les);
    }
    await schrijf({ ...data, lessen: [...data.lessen, ...nieuw] });
  },

  lesBewaren: async (les: Factuurles) => {
    const data = await lees();
    await schrijf({ ...data, lessen: metRij(data.lessen, les) });
  },

  lesVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, lessen: data.lessen.filter((l) => l.id !== id) });
  },

  factuurBewaren: async (f: Factuur) => {
    const data = await lees();
    await schrijf({ ...data, facturen: metRij(data.facturen, f) });
  },

  factuurVerwijderen: async (id: string) => {
    const data = await lees();
    await schrijf({ ...data, facturen: data.facturen.filter((f) => f.id !== id) });
  },
};
