import {
  isAdmin, isCoach, magClubcijfersZien, magInElkeAgenda, magLoonZien, rolLabel,
} from './rechten';
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

describe('isCoach', () => {
  it('kijkt naar de rol en niet naar het beheerdersvinkje', () => {
    expect(isCoach(trainer)).toBe(true);
    expect(isCoach(baas)).toBe(true);
    expect(isCoach(speler)).toBe(false);
    expect(isCoach({ ...speler, is_admin: true })).toBe(false);
  });

  it('rekent niemand als trainer', () => {
    expect(isCoach(null)).toBe(false);
    expect(isCoach(undefined)).toBe(false);
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

describe('magLoonZien', () => {
  const collega: User = { id: 'sanne', email: 's@x.be', name: 'Sanne', role: 'coach' };

  it('laat je je eigen loon zien', () => {
    expect(magLoonZien(trainer, trainer)).toBe(true);
  });

  it('houdt het loon van een collega dicht', () => {
    expect(magLoonZien(trainer, collega)).toBe(false);
    expect(magLoonZien(collega, trainer)).toBe(false);
  });

  it('laat de beheerder alles zien', () => {
    expect(magLoonZien(baas, collega)).toBe(true);
    expect(magLoonZien(baas, trainer)).toBe(true);
  });

  it('zegt nee tegen een speler en tegen niemand', () => {
    expect(magLoonZien(speler, trainer)).toBe(false);
    expect(magLoonZien(null, trainer)).toBe(false);
    expect(magLoonZien(trainer, null)).toBe(false);
  });
});

describe('magClubcijfersZien', () => {
  it('is alleen de beheerder', () => {
    expect(magClubcijfersZien(baas)).toBe(true);
    expect(magClubcijfersZien(trainer)).toBe(false);
    expect(magClubcijfersZien(speler)).toBe(false);
    expect(magClubcijfersZien(null)).toBe(false);
  });
});

describe('rolLabel', () => {
  it('noemt een admin bij naam, zonder zijn rol te verbergen', () => {
    expect(rolLabel(baas)).toBe('Trainer · beheerder');
    expect(rolLabel(trainer)).toBe('Trainer');
    expect(rolLabel(speler)).toBe('Speler');
  });
});
