import { pastBij, zoekOp } from './zoeken';

describe('pastBij', () => {
  it('vindt een woord ergens in de tekst', () => {
    expect(pastBij('Kidstennis rood - Groep 3', 'groep')).toBe(true);
    expect(pastBij('Kidstennis rood - Groep 3', 'rood')).toBe(true);
  });

  it('trekt zich niets aan van hoofdletters of accenten', () => {
    // Een beheerder typt geen accent, en op een telefoon al helemaal niet — dezelfde reden als
    // bij `searchPlayers`.
    expect(pastBij('Privéles', 'priveles')).toBe(true);
    expect(pastBij('Priveles', 'privéles')).toBe(true);
    expect(pastBij('Ann Devries', 'ANN')).toBe(true);
  });

  it('eist elk woord, maar niet de volgorde', () => {
    expect(pastBij('Kidstennis rood - Groep 3', 'groep rood')).toBe(true);
    expect(pastBij('Kidstennis rood - Groep 3', 'groep geel')).toBe(false);
  });

  it('laat een lege zoekregel alles door', () => {
    expect(pastBij('wat dan ook', '')).toBe(true);
    expect(pastBij('wat dan ook', '   ')).toBe(true);
  });
});

describe('zoekOp', () => {
  const groepen = [
    { id: 'g-1', naam: 'Kidstennis rood - Groep 3' },
    { id: 'g-2', naam: 'Privéles' },
    { id: 'g-3', naam: 'Groep' },
  ];

  it('geeft de lijst ongewijzigd terug bij een lege zoekregel', () => {
    expect(zoekOp(groepen, '', (g) => g.naam)).toEqual(groepen);
  });

  it('filtert op het label', () => {
    expect(zoekOp(groepen, 'priveles', (g) => g.naam).map((g) => g.id)).toEqual(['g-2']);
    expect(zoekOp(groepen, 'groep', (g) => g.naam).map((g) => g.id)).toEqual(['g-1', 'g-3']);
  });

  it('raakt de meegegeven lijst niet aan', () => {
    const kopie = [...groepen];
    zoekOp(groepen, 'groep', (g) => g.naam);
    expect(groepen).toEqual(kopie);
  });
});
