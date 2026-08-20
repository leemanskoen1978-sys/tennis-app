import { normalizeName, nameExists, canCreateName } from './students';
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
