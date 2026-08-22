import { isAdmin, magInElkeAgenda, rolLabel } from './rechten';
import type { User } from './types';

const speler: User = { id: 'p1', email: 'p@x.be', name: 'Mathis', role: 'player' };
const trainer: User = { id: 'koen', email: 'k@x.be', name: 'Koen', role: 'coach' };
const baas: User = { ...trainer, is_admin: true };

describe('isAdmin', () => {
  it('is alleen waar als het vinkje aanstaat', () => {
    expect(isAdmin(baas)).toBe(true);
    expect(isAdmin(trainer)).toBe(false);
    expect(isAdmin(speler)).toBe(false);
  });

  it('rekent niemand als admin', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it('maakt van een speler met het vinkje geen halve trainer', () => {
    // Het vinkje geeft rechten binnen de app; het maakt van een speler geen trainer.
    // Wie dit ooit op een speler zet, doet dat bewust en met dezelfde gevolgen.
    expect(isAdmin({ ...speler, is_admin: true })).toBe(true);
  });
});

describe('magInElkeAgenda', () => {
  it('laat een admin in de agenda van elke trainer werken', () => {
    expect(magInElkeAgenda(baas)).toBe(true);
  });

  it('houdt een gewone trainer bij zijn eigen agenda', () => {
    expect(magInElkeAgenda(trainer)).toBe(false);
    expect(magInElkeAgenda(speler)).toBe(false);
    expect(magInElkeAgenda(null)).toBe(false);
  });
});

describe('rolLabel', () => {
  it('noemt een admin bij naam, zonder zijn rol te verbergen', () => {
    expect(rolLabel(baas)).toBe('Trainer · beheerder');
    expect(rolLabel(trainer)).toBe('Trainer');
    expect(rolLabel(speler)).toBe('Speler');
  });
});
