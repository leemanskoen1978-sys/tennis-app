import {
  awaitingApprovalFor, awaitingApprovalOf, initialStatusFor, isAwaitingApproval, needsApproval,
  recentGeweigerd,
} from './inbox';
import { filterPendingPayment, openBalanceFor, totalRevenue } from './payments';
import type { Booking, Court, User } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'c1',
  start_time: '2026-08-21T10:00:00.000Z', end_time: '2026-08-21T11:00:00.000Z',
  status: 'pending', payment_method: 'open', created_by: 'p1',
};

const courts: Court[] = [
  { id: 'c1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

describe('initialStatusFor', () => {
  it('zet een les van de trainer zelf meteen vast', () => {
    expect(initialStatusFor('koen', 'koen')).toBe('confirmed');
  });

  it('laat een les van iemand anders op goedkeuring wachten', () => {
    expect(initialStatusFor('p1', 'koen')).toBe('pending');
    // Ook een trainer die bij een collega boekt: het is de agenda van die collega.
    expect(initialStatusFor('sanne', 'koen')).toBe('pending');
  });

  it('laat een beheerder meteen inplannen, ook bij een collega', () => {
    expect(initialStatusFor('koen', 'sanne', true)).toBe('confirmed');
    expect(initialStatusFor('koen', 'koen', true)).toBe('confirmed');
  });

  it('verandert niets als er geen beheerder in het spel is', () => {
    expect(initialStatusFor('koen', 'sanne', false)).toBe('pending');
  });
});

describe('needsApproval', () => {
  it('geldt voor de trainer van de les', () => {
    expect(needsApproval(base, 'koen')).toBe(true);
    expect(needsApproval(base, 'sanne')).toBe(false);
  });

  it('geldt niet meer zodra de les bevestigd of geweigerd is', () => {
    expect(needsApproval({ ...base, status: 'confirmed' }, 'koen')).toBe(false);
    expect(needsApproval({ ...base, status: 'cancelled' }, 'koen')).toBe(false);
  });
});

describe('awaitingApprovalFor', () => {
  it('zet de eerstvolgende les vooraan', () => {
    const later: Booking = {
      ...base, id: 'b2',
      start_time: '2026-09-01T10:00:00.000Z', end_time: '2026-09-01T11:00:00.000Z',
    };
    expect(awaitingApprovalFor([later, base], 'koen').map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('is leeg zonder trainer', () => {
    expect(awaitingApprovalFor([base], null)).toEqual([]);
  });
});

describe('awaitingApprovalOf', () => {
  it('geeft de speler zijn eigen openstaande aanvragen', () => {
    const vanIemandAnders: Booking = { ...base, id: 'b9', player_id: 'p2' };
    expect(awaitingApprovalOf([base, vanIemandAnders], 'p1').map((b) => b.id)).toEqual(['b1']);
  });
});

describe('een les die nog niet is goedgekeurd', () => {
  const speler: User = { id: 'p1', email: 'p1@x.be', name: 'Mathis', role: 'player' };

  it('telt nergens als geld', () => {
    // Dit is de reden dat goedkeuring een status is en geen apart lijstje: zolang de les
    // niet doorgaat, is er geen omzet, geen openstaande betaling en geen saldo.
    expect(isAwaitingApproval(base)).toBe(true);
    expect(totalRevenue([{ ...base, payment_method: 'cash' }], courts)).toBe(0);
    expect(filterPendingPayment([base])).toEqual([]);
    expect(openBalanceFor(speler, [base], courts)).toEqual({ amount: 0, lessons: 0 });
  });

  it('telt wel mee zodra hij is goedgekeurd', () => {
    const goedgekeurd: Booking = { ...base, status: 'confirmed' };
    expect(filterPendingPayment([goedgekeurd])).toHaveLength(1);
    expect(openBalanceFor(speler, [goedgekeurd], courts)).toEqual({ amount: 30, lessons: 1 });
  });
});

describe('recentGeweigerd', () => {
  const NU = new Date('2026-08-22T12:00:00.000Z');
  const geleden = (uren: number): string =>
    new Date(NU.getTime() - uren * 60 * 60 * 1000).toISOString();

  const geweigerd = (id: string, over: Partial<Booking> = {}): Booking => ({
    ...base, id, status: 'cancelled', rejected_at: geleden(2), ...over,
  });

  it('geeft de weigeringen van deze speler, nieuwste eerst', () => {
    const lijst = [
      geweigerd('oud', { rejected_at: geleden(48) }),
      geweigerd('nieuw', { rejected_at: geleden(1) }),
    ];
    expect(recentGeweigerd(lijst, 'p1', NU).map((b) => b.id)).toEqual(['nieuw', 'oud']);
  });

  it('laat een les die gewoon is afgezegd erbuiten', () => {
    // Zelfde status, maar niemand heeft hem afgewezen: dan is er niets te melden.
    const lijst = [geweigerd('x', { rejected_at: undefined })];
    expect(recentGeweigerd(lijst, 'p1', NU)).toEqual([]);
  });

  it('laat een goedgekeurde les erbuiten', () => {
    expect(recentGeweigerd([{ ...base, status: 'confirmed' }], 'p1', NU)).toEqual([]);
  });

  it('vergeet een weigering van vorige maand', () => {
    expect(recentGeweigerd([geweigerd('x', { rejected_at: geleden(24 * 30) })], 'p1', NU))
      .toEqual([]);
  });

  it('houdt de grens van zeven dagen aan', () => {
    const net = geweigerd('net', { rejected_at: geleden(24 * 7 - 1) });
    const netNiet = geweigerd('netniet', { rejected_at: geleden(24 * 7 + 1) });
    expect(recentGeweigerd([net, netNiet], 'p1', NU).map((b) => b.id)).toEqual(['net']);
  });

  it('is niet van een andere speler', () => {
    expect(recentGeweigerd([geweigerd('x', { player_id: 'iemand-anders' })], 'p1', NU))
      .toEqual([]);
  });

  it('geldt ook voor een meespeler: die stond ook te wachten', () => {
    const groep = geweigerd('g', { player_id: 'betaler', participant_ids: ['p1'] });
    expect(recentGeweigerd([groep], 'p1', NU).map((b) => b.id)).toEqual(['g']);
  });
});
