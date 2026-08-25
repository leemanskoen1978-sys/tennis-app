import {
  isAdmin, isCoach, magClubcijfersZien, magInElkeAgenda, magKaartenSchrijven, magLesVerwijderen,
  magLoonZien, roleLabel, rolLabel,
} from './rechten';
import type { Booking, User } from './types';

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

describe('roleLabel', () => {
  it('noemt de twee rollen bij naam', () => {
    expect(roleLabel('player')).toBe('Speler');
    expect(roleLabel('coach')).toBe('Trainer');
  });

  it('valt terug op Speler bij een rol die deze app niet kent', () => {
    // De rol komt uit de databank. Draaide een club het schema nog niet opnieuw, dan staat
    // daar mogelijk nog 'parent'. Een leeg label of een fout op iemands profiel is een
    // slechter antwoord dan "Speler".
    expect(roleLabel('parent' as unknown as 'player')).toBe('Speler');
  });
});

describe('magLesVerwijderen', () => {
  const NU = new Date('2026-08-25T12:00:00.000Z');
  const ouder: User = { id: 'papa', email: 'pa@x.be', name: 'Papa', role: 'player' };
  const collega: User = { id: 'lies', email: 'l@x.be', name: 'Lies', role: 'coach' };

  function les(over: Partial<Booking> = {}): Booking {
    return {
      id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'c1',
      start_time: '2026-08-26T09:00:00.000Z', end_time: '2026-08-26T10:00:00.000Z',
      status: 'confirmed', payment_method: 'open', ...over,
    };
  }

  const geweest = les({
    start_time: '2026-08-20T09:00:00.000Z', end_time: '2026-08-20T10:00:00.000Z',
  });

  it('laat de trainer van de les alles weghalen, ook wat geweest is', () => {
    expect(magLesVerwijderen(trainer, trainer, les(), NU)).toBe(true);
    expect(magLesVerwijderen(trainer, trainer, geweest, NU)).toBe(true);
  });

  it('laat de beheerder ook in de agenda van een collega opruimen', () => {
    expect(magLesVerwijderen(baas, baas, les({ coach_id: 'lies' }), NU)).toBe(true);
  });

  it('houdt een gewone trainer uit de agenda van een collega', () => {
    expect(magLesVerwijderen(collega, collega, les(), NU)).toBe(false);
  });

  it('laat de speler zijn eigen les schrappen zolang ze nog moet beginnen', () => {
    expect(magLesVerwijderen(speler, speler, les(), NU)).toBe(true);
  });

  it('laat de ouder de komende les van zijn kind schrappen', () => {
    // De ouder kijkt naar Mathis: `speler` is het kind, `kijker` de ouder.
    expect(magLesVerwijderen(ouder, speler, les(), NU)).toBe(true);
  });

  it('houdt speler en ouder van een les af die al begonnen is', () => {
    expect(magLesVerwijderen(speler, speler, geweest, NU)).toBe(false);
    expect(magLesVerwijderen(ouder, speler, geweest, NU)).toBe(false);
  });

  it('rekent een les die nu begint niet meer als toekomst', () => {
    const nuMeteen = les({ start_time: NU.toISOString() });
    expect(magLesVerwijderen(speler, speler, nuMeteen, NU)).toBe(false);
  });

  it('laat een ouder niet aan de les van andermans kind komen', () => {
    expect(magLesVerwijderen(ouder, speler, les({ player_id: 'iemand-anders' }), NU)).toBe(false);
  });

  it('laat een medespeler de les van de betaler niet wegvegen', () => {
    // Wie meespeelt is geen betaler: één boeking schrappen zou de les van de anderen
    // meenemen. Zie de uitleg bij de functie.
    const groepsles = les({ player_id: 'p2', participant_ids: ['p1'] });
    expect(magLesVerwijderen(speler, speler, groepsles, NU)).toBe(false);
  });

  it('laat een kapotte begintijd de les staan in plaats van hem vrij te geven', () => {
    expect(magLesVerwijderen(speler, speler, les({ start_time: 'geen datum' }), NU)).toBe(false);
  });

  it('geeft niemand zonder login iets', () => {
    expect(magLesVerwijderen(null, speler, les(), NU)).toBe(false);
    expect(magLesVerwijderen(undefined, null, les(), NU)).toBe(false);
  });
});

describe('magKaartenSchrijven', () => {
  it('is voor de trainer en de beheerder', () => {
    expect(magKaartenSchrijven(trainer)).toBe(true);
    expect(magKaartenSchrijven(baas)).toBe(true);
  });

  it('is niet voor een speler: die zou zijn eigen beurten kunnen terugzetten', () => {
    expect(magKaartenSchrijven(speler)).toBe(false);
    expect(magKaartenSchrijven(null)).toBe(false);
  });
});
