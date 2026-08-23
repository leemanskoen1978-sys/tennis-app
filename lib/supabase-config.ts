// Zijn er bruikbare Supabase-sleutels, en zo niet: waarmee vult de app dan de client?
//
// Dit staat los van lib/supabase omdat het daar niet te testen valt (dat bestand trekt de
// halve React Native-wereld mee), en omdat hier precies de fout zat die de eerste versie
// van de website blanco liet: bij `expo export` wordt een ontbrekende omgevingsvariabele
// een LEGE TEKST en geen `undefined`. `url ?? 'https://…'` liet die lege tekst dus staan,
// en supabase-js weigert te starten met "supabaseUrl is required" — waarna er niets meer
// getekend werd. Leeg en afwezig moeten hier hetzelfde betekenen.

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** Praat de app met een echte databank, of met de opslag van dit toestel? */
  configured: boolean;
}

/**
 * Een adres dat nooit bestaat maar wel een geldig adres is. supabase-js maakt zijn client
 * bij het laden van de module, ook als er nooit een verzoek uitgaat; hij moet dus altijd
 * iets krijgen dat hij accepteert.
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export function resolveSupabaseConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined,
): SupabaseConfig {
  const url = (rawUrl ?? '').trim();
  const anonKey = (rawKey ?? '').trim();
  const configured = url.length > 0 && anonKey.length > 0;
  return {
    url: configured ? url : PLACEHOLDER_URL,
    anonKey: configured ? anonKey : PLACEHOLDER_KEY,
    configured,
  };
}

/**
 * De sleutel waaronder Supabase de sessie van deze gebruiker bewaart.
 *
 * Supabase leidt hem af van de project-URL: `https://abcdef.supabase.co` wordt
 * `sb-abcdef-auth-token`. Daarnaast zet hij er nog een paar naast met hetzelfde begin
 * (`-code-verifier`, `-user`), dus wie de sessie echt wil wissen, moet op dat begin zoeken
 * en niet op één sleutel.
 *
 * Waarom de app dat zou willen: `signOut()` van supabase-js laat de sessie STAAN als de
 * oproep naar de server mislukt — geen netwerk, een tunnel, een blokkeerder. Je bent dan
 * uitgelogd in het scherm maar niet in de opslag, en bij de volgende keer openen ben je
 * gewoon weer binnen. Zie `wisBewaardeSessie` in providers/supabaseStore.
 *
 * Geeft `null` bij een adres waar geen projectnaam uit te halen valt; dan is er ook niets
 * te wissen.
 */
export function sessieSleutel(url: string): string | null {
  const schoon = (url ?? '').trim();
  if (schoon.length === 0) return null;
  // Geen `new URL`: die bestaat op een telefoon pas na de polyfill, en dit moet ook los
  // van de app te testen zijn.
  const zonderSchema = schoon.replace(/^https?:\/\//i, '');
  const host = zonderSchema.split('/')[0] ?? '';
  const naam = host.split('.')[0] ?? '';
  if (naam.length === 0 || naam === PLACEHOLDER_URL.replace(/^https?:\/\//i, '').split('.')[0]) {
    return null;
  }
  return `sb-${naam}-auth-token`;
}
