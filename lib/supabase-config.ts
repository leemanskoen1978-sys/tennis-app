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
