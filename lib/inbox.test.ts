import {
  awaitingApprovalFor, awaitingApprovalOf, initialStatusFor, isAwaitingApproval, needsApproval,
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
