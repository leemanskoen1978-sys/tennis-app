import { normalizeName, nameExists, canCreateName, zelfdeNaamOngeachtVolgorde, zoekOpNaam } from './students';
import type { User } from './types';

const player = (id: string, name: string): User => ({
  id, name, email: '', role: 'player',
});

const students: User[] = [player('u1', 'Jonas'), player('u2', 'Marie Claire')];

describe('normalizeName', () => {
  it('haalt spaties eraf en maakt alles klein', () => {
    expect(normalizeName('  Jonas ')).toBe('jonas');
  });

  it('houdt een lege naam leeg', () => {
    expect(normalizeName('   ')).toBe('');
  });
});

describe('nameExists', () => {
  it('herkent dezelfde naam ongeacht hoofdletters en spaties', () => {
    expect(nameExists(students, 'jonas')).toBe(true);
    expect(nameExists(students, ' JONAS ')).toBe(true);
    expect(nameExists(students, 'Marie Claire')).toBe(true);
  });

  it('zegt nee bij een naam die er nog niet is', () => {
    expect(nameExists(students, 'Jonass')).toBe(false);
    expect(nameExists(students, 'Marie')).toBe(false);
  });

  it('telt een lege naam nooit als bestaand', () => {
    expect(nameExists(students, '')).toBe(false);
    expect(nameExists(students, '  ')).toBe(false);
  });
});

describe('canCreateName', () => {
  it('biedt aanmaken aan voor een naam die nog niet bestaat', () => {
    expect(canCreateName(students, 'Ella', true)).toBe(true);
  });

  it('biedt niets aan zolang aanmaken niet ondersteund is', () => {
    expect(canCreateName(students, 'Ella', false)).toBe(false);
  });

  it('biedt niets aan bij een bestaande naam, ook met andere hoofdletters', () => {
    expect(canCreateName(students, 'jonas', true)).toBe(false);
    expect(canCreateName(students, ' Jonas', true)).toBe(false);
  });

  it('biedt niets aan zolang er niets getypt is', () => {
    expect(canCreateName(students, '', true)).toBe(false);
    expect(canCreateName(students, '   ', true)).toBe(false);
  });
});

describe('zelfdeNaamOngeachtVolgorde', () => {
  it('herkent de achternaam-vooraan-schrijfwijze uit de seizoensplanning', () => {
    expect(zelfdeNaamOngeachtVolgorde('Leemans Koen', 'Koen Leemans')).toBe(true);
  });

  it('breekt niet op een achternaam van twee woorden', () => {
    expect(zelfdeNaamOngeachtVolgorde('de Clippele Antoine', 'Antoine de Clippele')).toBe(true);
  });

  it('trekt zich niets aan van hoofdletters, spaties eromheen of dubbele spaties', () => {
    expect(zelfdeNaamOngeachtVolgorde('  KOEN   leemans ', 'Leemans Koen')).toBe(true);
  });

  it('zegt nee tegen twee verschillende mensen', () => {
    expect(zelfdeNaamOngeachtVolgorde('Koen Leemans', 'Koen Peeters')).toBe(false);
  });

  it('zegt nee tegen twee mensen die alleen de achternaam delen', () => {
    expect(zelfdeNaamOngeachtVolgorde('Koen Leemans', 'Sofie Leemans')).toBe(false);
  });

  it('is geen gedeeltelijke treffer: minder woorden is een andere naam', () => {
    expect(zelfdeNaamOngeachtVolgorde('Koen Leemans', 'Koen')).toBe(false);
  });

  it('laat een tweede voornaam een andere naam zijn', () => {
    expect(zelfdeNaamOngeachtVolgorde('Koen Jan Leemans', 'Koen Leemans')).toBe(false);
  });

  it('telt een lege naam nooit als treffer', () => {
    expect(zelfdeNaamOngeachtVolgorde('', 'Koen')).toBe(false);
    expect(zelfdeNaamOngeachtVolgorde('Koen', '')).toBe(false);
    expect(zelfdeNaamOngeachtVolgorde('   ', '  ')).toBe(false);
  });
});

describe('zoekOpNaam', () => {
  const gebruikers: User[] = [
    player('u1', 'Koen Leemans'),
    player('u2', 'Antoine de Clippele'),
    player('u3', 'Sofie Leemans'),
  ];

  it('vindt de trainer die in het bestand met zijn achternaam vooraan staat', () => {
    expect(zoekOpNaam(gebruikers, 'Leemans Koen')?.id).toBe('u1');
  });

  it('vindt de speler met een achternaam van twee woorden', () => {
    expect(zoekOpNaam(gebruikers, 'de Clippele Antoine')?.id).toBe('u2');
  });

  it('geeft null als niemand past', () => {
    expect(zoekOpNaam(gebruikers, 'Jonas Peeters')).toBeNull();
  });

  it('geeft null bij een lege naam', () => {
    expect(zoekOpNaam(gebruikers, '  ')).toBeNull();
  });

  it('geeft null als twee gebruikers allebei passen, in plaats van de eerste te gokken', () => {
    const dubbel: User[] = [player('a', 'Koen Leemans'), player('b', 'Leemans Koen')];
    expect(zoekOpNaam(dubbel, 'Koen Leemans')).toBeNull();
  });
});
