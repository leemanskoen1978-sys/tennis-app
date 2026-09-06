import { alleRijen, PAGINAGROOTTE } from './paginering';

/** Een nagebootste tabel: geeft precies de rijen terug die in het gevraagde bereik vallen. */
function tabel(aantal: number, grens: number): {
  haal: (van: number, tot: number) => Promise<number[]>;
  verzoeken: Array<[number, number]>;
} {
  const verzoeken: Array<[number, number]> = [];
  const haal = async (van: number, tot: number): Promise<number[]> => {
    verzoeken.push([van, tot]);
    // Zoals PostgREST het doet: het bereik wordt gerespecteerd, maar nooit meer dan de grens.
    const einde = Math.min(tot, van + grens - 1, aantal - 1);
    const uit: number[] = [];
    for (let i = van; i <= einde; i++) uit.push(i);
    return uit;
  };
  return { haal, verzoeken };
}

describe('alleRijen', () => {
  it('haalt een tabel die in één stuk past met één verzoek op', async () => {
    const { haal, verzoeken } = tabel(300, 1000);
    expect(await alleRijen(haal)).toHaveLength(300);
    expect(verzoeken).toHaveLength(1);
  });

  it('haalt een tabel van 6396 rijen volledig op', async () => {
    // Het echte geval: 6396 lessen achter een grens van 1000. Zonder paginering kwamen er 1000
    // binnen en zag een trainer zijn agenda leeg staan.
    const { haal, verzoeken } = tabel(6396, 1000);
    const rijen = await alleRijen(haal);
    expect(rijen).toHaveLength(6396);
    // Geen enkele rij dubbel of overgeslagen: 0 tot en met 6395, op volgorde.
    expect(rijen[0]).toBe(0);
    expect(rijen[6395]).toBe(6395);
    expect(new Set(rijen).size).toBe(6396);
    // Zeven verzoeken: zes volle stukken en een staartje van 396.
    expect(verzoeken).toHaveLength(7);
  });

  it('doet een tweede verzoek als het eerste stuk precies vol is', async () => {
    // Precies 1000 rijen ziet er hetzelfde uit als "er komt nog meer". Er is geen manier om dat
    // te onderscheiden zonder nog een keer te vragen, en dat tweede verzoek is de prijs.
    const { haal, verzoeken } = tabel(1000, 1000);
    expect(await alleRijen(haal)).toHaveLength(1000);
    expect(verzoeken).toHaveLength(2);
  });

  it('geeft een lege lijst bij een lege tabel, met één verzoek', async () => {
    const { haal, verzoeken } = tabel(0, 1000);
    expect(await alleRijen(haal)).toEqual([]);
    expect(verzoeken).toHaveLength(1);
  });

  it('vraagt bereiken waarvan begin en eind allebei meetellen', async () => {
    const { haal, verzoeken } = tabel(2500, 1000);
    await alleRijen(haal);
    expect(verzoeken).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stopt bij de noodrem als de server het bereik negeert', async () => {
    // Een server die elk verzoek met een vol stuk beantwoordt, zou deze lus eeuwig laten draaien
    // en de app bij het opstarten laten hangen. Drie stukken en klaar.
    const altijdVol = async (): Promise<number[]> => Array.from({ length: 10 }, (_, i) => i);
    const uit = await alleRijen(altijdVol, 10, 3);
    expect(uit).toHaveLength(30);
  });

  it('gebruikt de standaardgrens van Supabase', () => {
    expect(PAGINAGROOTTE).toBe(1000);
  });
});
