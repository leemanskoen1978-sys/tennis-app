// De Supabase-kant van de facturatie.
//
// Apart van providers/supabaseStore.ts, omdat het niets met de rest deelt: andere tabellen,
// een andere eigenaar-regel, en het komt niet mee in de lading die bij het opstarten
// opgehaald wordt.
//
// `laden` geeft `null` als de tabellen er nog niet zijn. Dat is iets anders dan een lege
// boekhouding, en het scherm zegt dat ook anders — dezelfde afspraak als bij `bezetteUren`.

import { alleRijen } from '../lib/paginering';
import { supabase } from '../lib/supabase';
import type {
  Factuur, Factuurles, FacturatieData, Klant, Leverancier,
} from '../lib/facturatie';

/** Kent deze databank die tabel (nog) niet? Zelfde drie signalen als in supabaseStore. */
function tabelBestaatNiet(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /schema cache/i.test(error.message ?? '');
}

/**
 * De kolommen die de app niet kent, eraf halen.
 *
 * Welke dat zijn verschilt per tabel, en dat is geen slordigheid. `eigenaar` is overal
 * huishouding. `aangemaakt` is dat bij een les — de databank zet hem en niemand leest hem —
 * maar bij een factuur is het een veld van de app zelf: `factuurUit` zet erin wanneer de
 * factuur gemaakt is, en het register toont dat. Knip je hem daar ook weg, dan is dat veld
 * na een herlaadbeurt leeg terwijl het type belooft dat er een datum in staat.
 */
function zonderKolommen<T>(rij: Record<string, unknown>, weg: readonly string[]): T {
  const uit = { ...rij };
  for (const kolom of weg) delete uit[kolom];
  return uit as T;
}

/** Overal huishouding. */
const EIGENAAR = ['eigenaar'] as const;
/** Bij een les zet de databank `aangemaakt` en leest de app hem nooit. */
const EIGENAAR_EN_AANGEMAAKT = ['eigenaar', 'aangemaakt'] as const;

/**
 * Eén tabel volledig ophalen, in stukken.
 *
 * NIET `select('*')` zonder meer. PostgREST geeft nooit meer dan duizend rijen per verzoek
 * terug, zonder foutmelding en zonder waarschuwing — zie de kop van lib/paginering, waar
 * staat wat dat op 6 september 2026 kostte: een trainer zag zijn agenda leeg staan omdat de
 * club over die grens heen gegroeid was. Een lessenlijst groeit hier met een paar honderd
 * rijen per jaar, dus die grens komt vanzelf, en hij komt stil.
 *
 * Geeft `null` als de tabel er nog niet is. Elke andere fout gooit, en die gooi wint: hij
 * komt uit de `Promise.all` hieronder naar boven ook als een andere tabel tegelijk "bestaat
 * niet" zegt. Anders zou een echte fout verdwijnen achter een melding over een SQL-bestand
 * dat allang gedraaid is.
 */
async function haalAlles(
  tabel: string,
  sorteer: string,
  oplopend = true,
): Promise<Array<Record<string, unknown>> | null> {
  let ontbreekt = false;

  const rijen = await alleRijen<Record<string, unknown>>(async (van, tot) => {
    const { data, error } = await supabase
      .from(tabel)
      .select('*')
      .order(sorteer, { ascending: oplopend })
      .range(van, tot);
    if (error) {
      if (tabelBestaatNiet(error)) {
        ontbreekt = true;
        return [];
      }
      throw new Error(`${tabel}: ${error.message}`);
    }
    return (data ?? []) as Array<Record<string, unknown>>;
  });

  return ontbreekt ? null : rijen;
}

export async function laden(): Promise<FacturatieData | null> {
  // Alle vier tegelijk: ze hangen niet van elkaar af, en na elkaar is vier keer wachten.
  const [lev, kla, les, fac] = await Promise.all([
    haalAlles('facturatie_leverancier', 'id'),
    haalAlles('facturatie_klanten', 'volgorde'),
    haalAlles('facturatie_lessen', 'datum'),
    haalAlles('facturatie_facturen', 'factuurdatum', false),
  ]);

  // Staat er één tabel niet, dan staat het SQL-bestand nog te wachten. Een echte fout is
  // hierboven al gegooid, dus er kan er geen één achter deze melding verdwijnen.
  if (lev === null || kla === null || les === null || fac === null) return null;

  const leveranciers = lev.map((r) => zonderKolommen<Leverancier>(r, EIGENAAR));

  return {
    // Er is er hoogstens één; staat er nog geen, dan maakt het scherm hem bij de eerste keer.
    leverancier: leveranciers[0] ?? { id: '', naam: '', adres: '', btw: '', iban: '', bic: '' },
    klanten: kla.map((r) => zonderKolommen<Klant>(r, EIGENAAR)),
    lessen: les.map((r) => zonderKolommen<Factuurles>(r, EIGENAAR_EN_AANGEMAAKT)),
    facturen: fac.map((r) => zonderKolommen<Factuur>(r, EIGENAAR)),
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
