// De Supabase-kant van de facturatie.
//
// Apart van providers/supabaseStore.ts, omdat het niets met de rest deelt: andere tabellen,
// een andere eigenaar-regel, en het komt niet mee in de lading die bij het opstarten
// opgehaald wordt.
//
// `laden` geeft `null` als de tabellen er nog niet zijn. Dat is iets anders dan een lege
// boekhouding, en het scherm zegt dat ook anders — dezelfde afspraak als bij `bezetteUren`.

import { supabase } from '../lib/supabase';
import type {
  Factuur, Factuurles, FacturatieData, Klant, Leverancier,
} from '../lib/facturatie';

/** Kent deze databank die tabel (nog) niet? Zelfde drie signalen als in supabaseStore. */
function tabelBestaatNiet(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /schema cache/i.test(error.message ?? '');
}

/** De kolommen die de app niet kent en niet terugschrijft. */
function zonderHuishouding<T>(rij: Record<string, unknown>): T {
  const { eigenaar, aangemaakt, ...rest } = rij;
  void eigenaar;
  void aangemaakt;
  return rest as T;
}

export async function laden(): Promise<FacturatieData | null> {
  const [lev, kla, les, fac] = await Promise.all([
    supabase.from('facturatie_leverancier').select('*'),
    supabase.from('facturatie_klanten').select('*').order('volgorde'),
    supabase.from('facturatie_lessen').select('*').order('datum'),
    supabase.from('facturatie_facturen').select('*').order('factuurdatum', { ascending: false }),
  ]);

  for (const uitkomst of [lev, kla, les, fac]) {
    if (uitkomst.error) {
      if (tabelBestaatNiet(uitkomst.error)) return null;
      throw new Error(`facturatie: ${uitkomst.error.message}`);
    }
  }

  const leveranciers = (lev.data ?? []).map((r) => zonderHuishouding<Leverancier>(r));

  return {
    // Er is er hoogstens één; staat er nog geen, dan maakt het scherm hem bij de eerste keer.
    leverancier: leveranciers[0] ?? { id: '', naam: '', adres: '', btw: '', iban: '', bic: '' },
    klanten: (kla.data ?? []).map((r) => zonderHuishouding<Klant>(r)),
    lessen: (les.data ?? []).map((r) => zonderHuishouding<Factuurles>(r)),
    facturen: (fac.data ?? []).map((r) => zonderHuishouding<Factuur>(r)),
  };
}

/** Eén rij wegschrijven of bijwerken. `upsert` omdat het scherm niet bijhoudt wat nieuw is. */
async function bewaarRij(tabel: string, rij: object): Promise<void> {
  const { error } = await supabase.from(tabel).upsert(rij);
  if (error) throw new Error(`${tabel}: ${error.message}`);
}

async function verwijderRij(tabel: string, id: string): Promise<void> {
  const { error } = await supabase.from(tabel).delete().eq('id', id);
  if (error) throw new Error(`${tabel}: ${error.message}`);
}

export const facturatieSupabase = {
  laden,
  leverancierBewaren: (l: Leverancier) => bewaarRij('facturatie_leverancier', l),
  klantBewaren: (k: Klant) => bewaarRij('facturatie_klanten', k),
  klantVerwijderen: (id: string) => verwijderRij('facturatie_klanten', id),
  lessenToevoegen: async (lessen: readonly Factuurles[]): Promise<void> => {
    if (lessen.length === 0) return;
    // `ignoreDuplicates`: botst een sleutel met wat er al staat, dan is die les al gekend en
    // is overslaan precies goed. Zonder dit zou één dubbel de hele plakbeurt laten mislukken.
    const { error } = await supabase
      .from('facturatie_lessen')
      .upsert([...lessen], { onConflict: 'eigenaar,sleutel', ignoreDuplicates: true });
    if (error) throw new Error(`facturatie_lessen: ${error.message}`);
  },
  lesBewaren: (les: Factuurles) => bewaarRij('facturatie_lessen', les),
  lesVerwijderen: (id: string) => verwijderRij('facturatie_lessen', id),
  factuurBewaren: (f: Factuur) => bewaarRij('facturatie_facturen', f),
  factuurVerwijderen: (id: string) => verwijderRij('facturatie_facturen', id),
};
