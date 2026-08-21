import { leesRol, leesUurtarief, kolomIndexen, LEDEN_KOPPEN } from './import-leden';

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

describe('kolomIndexen', () => {
  it('vindt de kolommen ongeacht volgorde en hoofdletters', () => {
    expect(kolomIndexen(['Email', 'NAAM'])).toStrictEqual({ naam: 1, email: 0 });
  });

  it('neemt de gangbare andere schrijfwijzen aan', () => {
    expect(kolomIndexen(['naam', 'e-mail', 'gsm'])).toStrictEqual({ naam: 0, email: 1, telefoon: 2 });
  });

  it('neemt schrijfwijzen met een spatie erin ook aan', () => {
    expect(kolomIndexen(['naam', 'E mail', 'Uur tarief', 'Telefoon nummer'])).toStrictEqual({
      naam: 0, email: 1, uurtarief: 2, telefoon: 3,
    });
  });

  it('geeft null als een verplichte kolom ontbreekt', () => {
    expect(kolomIndexen(['naam', 'telefoon'])).toBeNull();
    expect(kolomIndexen(['email'])).toBeNull();
  });

  it('laat de eerste kolom winnen als een naam dubbel voorkomt', () => {
    expect(kolomIndexen(['naam', 'email', 'e-mail'])).toStrictEqual({ naam: 0, email: 1 });
  });

  it('stoort zich niet aan een lege kop', () => {
    expect(kolomIndexen(['naam', '', 'email'])).toStrictEqual({ naam: 0, email: 2 });
  });

  it('kent de koppen van het voorbeeldbestand allemaal', () => {
    expect(kolomIndexen([...LEDEN_KOPPEN])).toStrictEqual({
      naam: 0, email: 1, rol: 2, telefoon: 3, uurtarief: 4,
    });
  });
});
