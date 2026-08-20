import { resolveSupabaseConfig } from './supabase-config';

describe('resolveSupabaseConfig', () => {
  it('gebruikt de sleutels als ze er zijn', () => {
    const config = resolveSupabaseConfig('https://abc.supabase.co', 'eyJhbGciOi');
    expect(config).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'eyJhbGciOi',
      configured: true,
    });
  });

  it('valt terug op de lokale opslag zonder sleutels', () => {
    expect(resolveSupabaseConfig(undefined, undefined).configured).toBe(false);
  });

  it('behandelt een lege tekst als afwezig', () => {
    // Dit is de fout die de website blanco liet: `expo export` vult een ontbrekende
    // omgevingsvariabele in als '' en niet als undefined, waarna supabase-js weigerde
    // te starten en er niets meer getekend werd.
    const config = resolveSupabaseConfig('', '');
    expect(config.configured).toBe(false);
    expect(config.url.startsWith('https://')).toBe(true);
    expect(config.anonKey.length).toBeGreaterThan(0);
  });

  it('telt spaties niet als sleutel, en een halve set ook niet', () => {
    expect(resolveSupabaseConfig('   ', '  ').configured).toBe(false);
    expect(resolveSupabaseConfig('https://abc.supabase.co', '').configured).toBe(false);
    expect(resolveSupabaseConfig('', 'eyJhbGciOi').configured).toBe(false);
  });
});
