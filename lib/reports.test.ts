import { totalRevenue } from './payments';
import { countByPaymentMethod, monthlySeries, revenueByPlayer } from './reports';
import type { Booking, Court, User } from './types';

const courts: Court[] = [
  { id: 'court-1', name: 'Terrein 1', number: 1, indoor: false, hourly_rate: 40 },
  { id: 'court-2', name: 'Terrein 2', number: 2, indoor: true, hourly_rate: 60 },
];

const users: User[] = [
  { id: 'anna', email: 'anna@x.be', name: 'Anna', role: 'player' },
  { id: 'bram', email: 'bram@x.be', name: 'Bram', role: 'player' },
  { id: 'cato', email: 'cato@x.be', name: 'Cato', role: 'player' },
];

/** Een les van één uur op de gevraagde lokale dag, tenzij anders gevraagd. */
function lesson(over: Partial<Booking> & { id: string }): Booking {
  return {
    player_id: 'anna',
    coach_id: 'koen',
    court_id: 'court-1',
    start_time: new Date(2026, 7, 10, 10).toISOString(),
    end_time: new Date(2026, 7, 10, 11).toISOString(),
    status: 'confirmed',
    payment_method: 'cash',
    ...over,
  };
}

/** Een les op een lokale dag, met een duur in hele uren. */
function onDay(id: string, y: number, m: number, d: number, over: Partial<Booking> = {}): Booking {
  return lesson({
    id,
    start_time: new Date(y, m, d, 10).toISOString(),
    end_time: new Date(y, m, d, 11).toISOString(),
    ...over,
  });
}

describe('uitsplitsing per speler', () => {
  it('geeft een lege lijst als er in de periode niets is', () => {
    expect(revenueByPlayer([], users, courts)).toEqual([]);
  });

  it('telt één les als één les met het uurtarief van het terrein', () => {
    expect(revenueByPlayer([lesson({ id: 'b1' })], users, courts)).toEqual([
      { playerId: 'anna', name: 'Anna', lessons: 1, amount: 40 },
    ]);
  });

  it('rekent een half uur naar rato af', () => {
    const half = lesson({
      id: 'b1',
      end_time: new Date(2026, 7, 10, 10, 30).toISOString(),
    });
    expect(revenueByPlayer([half], users, courts)[0].amount).toBe(20);
  });

  it('zet de speler met het hoogste bedrag bovenaan', () => {
    const rows = revenueByPlayer(
      [
        onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
        onDay('b2', 2026, 7, 2, { player_id: 'bram', court_id: 'court-2' }),
        onDay('b3', 2026, 7, 3, { player_id: 'bram', court_id: 'court-2' }),
        onDay('b4', 2026, 7, 4, { player_id: 'cato' }),
        onDay('b5', 2026, 7, 5, { player_id: 'cato' }),
      ],
      users,
      courts,
    );
    expect(rows.map((r) => [r.name, r.lessons, r.amount])).toEqual([
      ['Bram', 2, 120],
      ['Cato', 2, 80],
      ['Anna', 1, 40],
    ]);
  });

  it('laat bij een gelijk bedrag de naam beslissen, zodat de volgorde niet wisselt', () => {
    const rows = revenueByPlayer(
      [
        onDay('b1', 2026, 7, 1, { player_id: 'cato' }),
        onDay('b2', 2026, 7, 2, { player_id: 'anna' }),
      ],
      users,
      courts,
    );
    expect(rows.map((r) => r.name)).toEqual(['Anna', 'Cato']);
  });

  it('laat een geannuleerde les nergens meetellen', () => {
    const rows = revenueByPlayer(
      [
        onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
        onDay('b2', 2026, 7, 2, { player_id: 'anna', status: 'cancelled' }),
      ],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 1, amount: 40 }]);
  });

  it('telt een les zonder afgesproken betaalwijze wel als les, maar niet als geld', () => {
    const rows = revenueByPlayer(
      [onDay('b1', 2026, 7, 1, { payment_method: 'open' })],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 1, amount: 0 }]);
  });

  it('houdt een speler die niet meer bestaat in het overzicht, als Onbekend', () => {
    const rows = revenueByPlayer([onDay('b1', 2026, 7, 1, { player_id: 'weg' })], users, courts);
    expect(rows).toEqual([{ playerId: 'weg', name: 'Onbekend', lessons: 1, amount: 40 }]);
  });

  it('telt samen op tot precies de omzet op de kaart erboven', () => {
    const bookings = [
      onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
      onDay('b2', 2026, 7, 2, { player_id: 'bram', court_id: 'court-2' }),
      onDay('b3', 2026, 7, 3, { player_id: 'cato', payment_method: 'open' }),
      onDay('b4', 2026, 7, 4, { player_id: 'cato', status: 'cancelled' }),
    ];
    const sum = revenueByPlayer(bookings, users, courts).reduce((t, r) => t + r.amount, 0);
    expect(sum).toBe(totalRevenue(bookings, courts));
  });
});

describe('uitsplitsing per betaalwijze', () => {
  it('geeft overal nul terug bij een lege periode', () => {
    expect(countByPaymentMethod([])).toEqual({
      open: 0, cash: 0, invoice: 0, qr: 0, beurtenkaart: 0, sponsor: 0,
    });
  });

  it('telt per betaalwijze, zonder de geannuleerde lessen', () => {
    const breakdown = countByPaymentMethod([
      onDay('b1', 2026, 7, 1, { payment_method: 'cash' }),
      onDay('b2', 2026, 7, 2, { payment_method: 'cash' }),
      onDay('b3', 2026, 7, 3, { payment_method: 'qr' }),
      onDay('b4', 2026, 7, 4, { payment_method: 'cash', status: 'cancelled' }),
    ]);
    expect(breakdown.cash).toBe(2);
    expect(breakdown.qr).toBe(1);
    expect(breakdown.open).toBe(0);
  });
});

describe('het verloop per maand', () => {
  it('geeft evenveel maanden terug als gevraagd, ook zonder lessen', () => {
    const series = monthlySeries([], courts, new Date(2026, 7, 20), 6);
    expect(series).toHaveLength(6);
    expect(series.map((p) => p.label)).toEqual(['mrt', 'apr', 'mei', 'jun', 'jul', 'aug']);
    expect(series.every((p) => p.amount === 0 && p.lessons === 0)).toBe(true);
  });

  it('eindigt op de maand van de meegegeven datum', () => {
    const series = monthlySeries([], courts, new Date(2026, 7, 20), 3);
    expect(series[series.length - 1]).toMatchObject({ year: 2026, month: 7 });
  });

  it('zet lessen en omzet in de juiste maand', () => {
    const series = monthlySeries(
      [
        onDay('b1', 2026, 6, 5),
        onDay('b2', 2026, 7, 5),
        onDay('b3', 2026, 7, 6, { court_id: 'court-2' }),
      ],
      courts,
      new Date(2026, 7, 20),
      3,
    );
    expect(series.map((p) => [p.label, p.lessons, p.amount])).toEqual([
      ['jun', 0, 0],
      ['jul', 1, 40],
      ['aug', 2, 100],
    ]);
  });

  it('loopt over een jaargrens heen door', () => {
    const series = monthlySeries(
      [onDay('b1', 2025, 11, 20), onDay('b2', 2026, 0, 8)],
      courts,
      new Date(2026, 1, 3),
      4,
    );
    expect(series.map((p) => [p.year, p.label, p.lessons])).toEqual([
      [2025, 'nov', 0],
      [2025, 'dec', 1],
      [2026, 'jan', 1],
      [2026, 'feb', 0],
    ]);
  });

  it('laat een geannuleerde les ook in de grafiek weg', () => {
    const series = monthlySeries(
      [onDay('b1', 2026, 7, 5, { status: 'cancelled' })],
      courts,
      new Date(2026, 7, 20),
      2,
    );
    expect(series[1]).toMatchObject({ lessons: 0, amount: 0 });
  });

  it('laat lessen van vóór de reeks buiten beschouwing', () => {
    const series = monthlySeries([onDay('b1', 2025, 0, 5)], courts, new Date(2026, 7, 20), 6);
    expect(series.reduce((t, p) => t + p.lessons, 0)).toBe(0);
  });

  it('slikt een kapotte begintijd zonder de reeks te verstoren', () => {
    const series = monthlySeries(
      [lesson({ id: 'b1', start_time: 'geen datum' })],
      courts,
      new Date(2026, 7, 20),
      3,
    );
    expect(series.reduce((t, p) => t + p.lessons, 0)).toBe(0);
  });
});
