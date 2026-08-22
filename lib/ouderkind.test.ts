import {
  aanvraagLabel, aanvraagVoor, eigenAanvragen, geweigerdeAanvragen, isMijnKind, kandidaten,
  kinderenVan, kinderenVoor, openAanvragen,
} from './ouderkind';
import type { OuderKind, User } from './types';

const wim: User = { id: 'wim', email: 'wim@x.be', name: 'Wim', role: 'parent' };
const els: User = { id: 'els', email: 'els@x.be', name: 'Els', role: 'parent' };
const nova: User = { id: 'nova', email: 'nova@x.be', name: 'Nova', role: 'player' };
const arne: User = { id: 'arne', email: 'arne@x.be', name: 'Arne', role: 'player' };
const koen: User = { id: 'koen', email: 'koen@x.be', name: 'Koen', role: 'coach' };
const users = [wim, els, nova, arne, koen];

const rel = (over: Partial<OuderKind>): OuderKind => ({
  id: 'r1', parent_id: 'wim', child_id: 'nova', status: 'approved', ...over,
});

describe('kinderenVan', () => {
  it('telt alleen goedgekeurde koppelingen', () => {
    const relaties = [
      rel({ id: 'a', child_id: 'nova', status: 'approved' }),
      rel({ id: 'b', child_id: 'arne', status: 'pending' }),
    ];
    expect(kinderenVan('wim', relaties)).toEqual(['nova']);
  });

  it('houdt de kinderen van een andere ouder erbuiten', () => {
    const relaties = [rel({ id: 'a', parent_id: 'els', child_id: 'arne' })];
    expect(kinderenVan('wim', relaties)).toEqual([]);
  });

  it('geeft niets terug zonder ouder', () => {
    expect(kinderenVan(null, [rel({})])).toEqual([]);
    expect(kinderenVan(undefined, [rel({})])).toEqual([]);
  });
});

describe('kinderenVoor', () => {
  it('geeft de gebruikers, op naam', () => {
    const relaties = [
      rel({ id: 'a', child_id: 'nova' }),
      rel({ id: 'b', child_id: 'arne' }),
    ];
    expect(kinderenVoor('wim', relaties, users).map((u) => u.name)).toEqual(['Arne', 'Nova']);
  });
});

describe('isMijnKind', () => {
  it('is de vraag die elk scherm stelt voor het iets toont', () => {
    const relaties = [rel({})];
    expect(isMijnKind('wim', 'nova', relaties)).toBe(true);
    expect(isMijnKind('wim', 'arne', relaties)).toBe(false);
    expect(isMijnKind('els', 'nova', relaties)).toBe(false);
  });

  it('zegt nee zolang de aanvraag niet goedgekeurd is', () => {
    expect(isMijnKind('wim', 'nova', [rel({ status: 'pending' })])).toBe(false);
    expect(isMijnKind('wim', 'nova', [rel({ status: 'rejected' })])).toBe(false);
  });
});

describe('aanvraagVoor', () => {
  it('vindt de aanvraag ongeacht zijn stand', () => {
    const relaties = [rel({ status: 'rejected' })];
    expect(aanvraagVoor('wim', 'nova', relaties)?.status).toBe('rejected');
    expect(aanvraagVoor('wim', 'arne', relaties)).toBeNull();
  });
});

describe('openAanvragen', () => {
  it('zet de oudste vraag bovenaan', () => {
    const relaties = [
      rel({ id: 'nieuw', status: 'pending', created_at: '2026-08-02T10:00:00.000Z' }),
      rel({ id: 'oud', status: 'pending', child_id: 'arne', created_at: '2026-08-01T10:00:00.000Z' }),
      rel({ id: 'klaar', status: 'approved' }),
    ];
    expect(openAanvragen(relaties).map((r) => r.id)).toEqual(['oud', 'nieuw']);
  });
});

describe('eigenAanvragen', () => {
  it('is de open vragen van één ouder', () => {
    const relaties = [
      rel({ id: 'a', status: 'pending' }),
      rel({ id: 'b', parent_id: 'els', status: 'pending' }),
    ];
    expect(eigenAanvragen('wim', relaties).map((r) => r.id)).toEqual(['a']);
  });
});

describe('geweigerdeAanvragen', () => {
  it('houdt een geweigerde vraag zichtbaar', () => {
    const relaties = [rel({ id: 'a', status: 'rejected' }), rel({ id: 'b', child_id: 'arne' })];
    expect(geweigerdeAanvragen('wim', relaties).map((r) => r.id)).toEqual(['a']);
  });
});

describe('kandidaten', () => {
  it('laat alleen spelers zien waar nog geen vraag over loopt', () => {
    const relaties = [rel({ child_id: 'nova', status: 'pending' })];
    expect(kandidaten('wim', relaties, users).map((u) => u.name)).toEqual(['Arne']);
  });

  it('biedt geen trainers en geen ouders aan', () => {
    expect(kandidaten('wim', [], users).map((u) => u.name)).toEqual(['Arne', 'Nova']);
  });

  it('biedt ook een geweigerd kind niet opnieuw aan', () => {
    // De vraag is gesteld en beantwoord. Opnieuw vragen loopt bovendien stuk op de
    // databank, die één rij per paar toestaat.
    const relaties = [rel({ child_id: 'nova', status: 'rejected' })];
    expect(kandidaten('wim', relaties, users).map((u) => u.name)).toEqual(['Arne']);
  });
});

describe('aanvraagLabel', () => {
  it('zegt per stand wat er aan de hand is', () => {
    expect(aanvraagLabel(rel({ status: 'pending' }))).toBe('Wacht op goedkeuring');
    expect(aanvraagLabel(rel({ status: 'rejected' }))).toBe('Niet goedgekeurd');
    expect(aanvraagLabel(rel({ status: 'approved' }))).toBe('Goedgekeurd');
  });
});
