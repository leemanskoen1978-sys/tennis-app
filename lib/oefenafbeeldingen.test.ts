import { oefenmap, oefenpad, onderdeelUitNaam, perOnderdeel } from './oefenafbeeldingen';

describe('oefenmap', () => {
  it('telt de week vanaf 1', () => {
    expect(oefenmap('blauw', 0)).toBe('blauw-week1');
    expect(oefenmap('groen', 1)).toBe('groen-week2');
  });
});

describe('oefenpad', () => {
  it('zet het onderdeel en het tijdstip in de bestandsnaam', () => {
    expect(oefenpad('rood-week2', 'leskern', 1758451200000)).toBe('rood-week2/leskern-1758451200000.jpg');
  });
});

describe('onderdeelUitNaam', () => {
  it('leest het onderdeel uit het begin van de naam', () => {
    expect(onderdeelUitNaam('wedstrijdvorm-1.jpg')).toBe('wedstrijdvorm');
  });

  it('kent een vreemde naam niet', () => {
    expect(onderdeelUitNaam('foto.jpg')).toBeNull();
    expect(onderdeelUitNaam('leskerns-1.jpg')).toBeNull();
  });
});

describe('perOnderdeel', () => {
  it('deelt de bestanden in per onderdeel', () => {
    const uit = perOnderdeel(['leskern-2.jpg', 'wedstrijdvorm-3.jpg', 'leskern-1.jpg']);
    expect(uit.leskern).toEqual(['leskern-1.jpg', 'leskern-2.jpg']);
    expect(uit.wedstrijdvorm).toEqual(['wedstrijdvorm-3.jpg']);
    expect(uit.opwarming).toEqual([]);
    expect(uit.tussenspel).toEqual([]);
  });

  // Tekstvolgorde zet 999 voor 1000; het tijdstip moet als getal tellen.
  it('sorteert op het tijdstip als getal', () => {
    expect(perOnderdeel(['leskern-1000.jpg', 'leskern-999.jpg']).leskern)
      .toEqual(['leskern-999.jpg', 'leskern-1000.jpg']);
  });

  it('laat een bestand zonder onderdeel weg', () => {
    const uit = perOnderdeel(['.emptyFolderPlaceholder', 'leskern-1.jpg']);
    expect(uit.leskern).toEqual(['leskern-1.jpg']);
  });
});
