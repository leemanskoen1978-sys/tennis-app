import type { User } from './types';
import { dossierPad } from './dossier';

function lid(over: Partial<User> & Pick<User, 'id' | 'role'>): User {
  return { name: over.id, email: `${over.id}@club.be`, ...over };
}

const trainer = lid({ id: 'koen', role: 'coach' });
const speler = lid({ id: 'lotte', role: 'player' });
const ouder = lid({ id: 'marc', role: 'player' });

describe('dossierPad', () => {
  it('stuurt een trainer naar zijn trainersdossier', () => {
    expect(dossierPad(trainer, trainer)).toBe('/coaches/koen');
  });

  it('stuurt een speler naar zijn spelersdossier', () => {
    expect(dossierPad(speler, speler)).toBe('/players/lotte');
  });

  it('stuurt een ouder naar het dossier van het kind dat hij koos', () => {
    expect(dossierPad(ouder, speler)).toBe('/players/lotte');
  });

  // Een trainer is soms ook gewoon vader. Kijkt hij naar zijn kind, dan is de vraag "wiens
  // week is dit" beantwoord met dat kind en niet met zijn eigen lesrooster.
  it('stuurt een trainer die naar zijn kind kijkt naar het kind', () => {
    expect(dossierPad(trainer, speler)).toBe('/players/lotte');
  });

  it('heeft zonder ingelogde gebruiker geen bestemming', () => {
    expect(dossierPad(null, null)).toBeNull();
  });

  // Een speler zonder actieve speler komt niet voor, maar een pad naar `/players/undefined`
  // wél als niemand die vraag stelt.
  it('heeft zonder speler nog altijd het eigen dossier', () => {
    expect(dossierPad(speler, null)).toBe('/players/lotte');
  });
});
