import { leesRol, leesUurtarief, leesKopregel, LEDEN_KOPPEN } from './import-leden';

describe('leesRol', () => {
  it('vertaalt de Nederlandse rolnamen naar wat de databank kent', () => {
    expect(leesRol('speler')).toBe('player');
    expect(leesRol('trainer')).toBe('coach');
    expect(leesRol('ouder')).toBe('parent');
  });

  it('trekt zich niets aan van hoofdletters en spaties', () => {
    expect(leesRol('  Trainer ')).toBe('coach');
  });

  it('neemt de Engelse namen ook aan, want zo staat het in een export', () => {
    expect(leesRol('coach')).toBe('coach');
  });

  it('maakt van een lege cel een speler — dat is verreweg het vaakst waar', () => {
    expect(leesRol('')).toBe('player');
    expect(leesRol('   ')).toBe('player');
  });

  it('weigert een rol die niet bestaat, in plaats van er speler van te maken', () => {
    expect(leesRol('hoofdtrainer')).toBeNull();
  });

  it('trapt niet in prototype-namen als "constructor" of "__proto__"', () => {
    expect(leesRol('constructor')).toBeNull();
    expect(leesRol('__proto__')).toBeNull();
  });
});

describe('leesUurtarief', () => {
  it('leest een bedrag met een komma, want zo schrijft Excel het hier', () => {
    expect(leesUurtarief('45,50')).toBe(45.5);
  });

  it('leest een bedrag met een punt ook', () => {
    expect(leesUurtarief('45.50')).toBe(45.5);
  });

  it('laat een euroteken en spaties weg', () => {
    expect(leesUurtarief(' € 45 ')).toBe(45);
  });

  it('geeft undefined bij een lege cel — geen tarief is iets anders dan nul', () => {
    expect(leesUurtarief('')).toBeUndefined();
  });

  it('weigert wat geen getal is', () => {
    expect(leesUurtarief('veel')).toBeNull();
  });

  it('laat nul gewoon nul zijn — dat is een geldig tarief', () => {
    expect(leesUurtarief('0')).toBe(0);
  });

  it('weigert een negatief bedrag, in plaats van de club geld te laten toeleggen', () => {
    expect(leesUurtarief('-45')).toBeNull();
  });

  it('rondt af op centen, net als de rest van de app', () => {
    expect(leesUurtarief('12,999')).toBe(13);
  });
});

describe('leesKopregel', () => {
  it('vindt de kolommen ongeacht volgorde en hoofdletters', () => {
    expect(leesKopregel(['Email', 'NAAM'])).toStrictEqual({
      kolommen: { naam: 1, email: 0 },
      nietHerkend: [],
    });
  });

  it('neemt de gangbare andere schrijfwijzen aan', () => {
    expect(leesKopregel(['naam', 'e-mail', 'gsm'])).toStrictEqual({
      kolommen: { naam: 0, email: 1, telefoon: 2 },
      nietHerkend: [],
    });
  });

  it('neemt schrijfwijzen met een spatie erin ook aan', () => {
    expect(leesKopregel(['naam', 'E mail', 'Uur tarief', 'Telefoon nummer'])).toStrictEqual({
      kolommen: { naam: 0, email: 1, uurtarief: 2, telefoon: 3 },
      nietHerkend: [],
    });
  });

  it('geeft null als een verplichte kolom ontbreekt', () => {
    expect(leesKopregel(['naam', 'telefoon'])).toBeNull();
    expect(leesKopregel(['email'])).toBeNull();
  });

  it('laat de eerste kolom winnen als een naam dubbel voorkomt', () => {
    expect(leesKopregel(['naam', 'email', 'e-mail'])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: [],
    });
  });

  it('stoort zich niet aan een lege kop', () => {
    expect(leesKopregel(['naam', '', 'email'])).toStrictEqual({
      kolommen: { naam: 0, email: 2 },
      nietHerkend: [],
    });
  });

  it('kent de koppen van het voorbeeldbestand allemaal', () => {
    expect(leesKopregel([...LEDEN_KOPPEN])).toStrictEqual({
      kolommen: { naam: 0, email: 1, rol: 2, telefoon: 3, uurtarief: 4 },
      nietHerkend: [],
    });
  });

  it('geeft een niet-herkende kop terug zoals hij in het bestand staat', () => {
    expect(leesKopregel(['naam', 'email', 'Tarief/uur'])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: ['Tarief/uur'],
    });
  });

  it('telt een lege kop niet mee als niet-herkend', () => {
    expect(leesKopregel(['naam', 'email', '', '  '])).toStrictEqual({
      kolommen: { naam: 0, email: 1 },
      nietHerkend: [],
    });
  });
});
