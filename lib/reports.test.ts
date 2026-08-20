import { totalCoachPayout, totalRevenue } from './payments';
import { countByPaymentMethod, monthlySeries, payoutsByCoach, totalsByPlayer } from './reports';
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
    expect(totalsByPlayer([], users, courts)).toEqual([]);
  });

  it('telt één les als één les met het uurtarief van het terrein', () => {
    expect(totalsByPlayer([lesson({ id: 'b1' })], users, courts)).toEqual([
      { playerId: 'anna', name: 'Anna', lessons: 1, paid: 40, open: 0 },
    ]);
  });

  it('rekent een half uur naar rato af', () => {
    const half = lesson({
      id: 'b1',
      end_time: new Date(2026, 7, 10, 10, 30).toISOString(),
    });
    expect(totalsByPlayer([half], users, courts)[0].paid).toBe(20);
  });

  it('zet de speler met het hoogste totaal bovenaan', () => {
    const rows = totalsByPlayer(
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
    expect(rows.map((r) => [r.name, r.lessons, r.paid])).toEqual([
      ['Bram', 2, 120],
      ['Cato', 2, 80],
      ['Anna', 1, 40],
    ]);
  });

  it('sorteert op betaald plus openstaand, zodat een speler die nog niets afrekende niet onderaan zakt', () => {
    const rows = totalsByPlayer(
      [
        // Anna: één betaalde les van 40. Bram: twee openstaande lessen van 60, samen 120.
        onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
        onDay('b2', 2026, 7, 2, { player_id: 'bram', court_id: 'court-2', payment_method: 'open' }),
        onDay('b3', 2026, 7, 3, { player_id: 'bram', court_id: 'court-2', payment_method: 'open' }),
      ],
      users,
      courts,
    );
    expect(rows.map((r) => [r.name, r.paid, r.open])).toEqual([
      ['Bram', 0, 120],
      ['Anna', 40, 0],
    ]);
  });

  it('laat bij een gelijk totaal de naam beslissen, zodat de volgorde niet wisselt', () => {
    const rows = totalsByPlayer(
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
    const rows = totalsByPlayer(
      [
        onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
        onDay('b2', 2026, 7, 2, { player_id: 'anna', status: 'cancelled' }),
      ],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 1, paid: 40, open: 0 }]);
  });

  it('laat een geannuleerde openstaande les ook niet als openstaand meetellen', () => {
    const rows = totalsByPlayer(
      [onDay('b1', 2026, 7, 1, { payment_method: 'open', status: 'cancelled' })],
      users,
      courts,
    );
    expect(rows).toEqual([]);
  });

  it('zet een les zonder afgesproken betaalwijze volledig bij openstaand', () => {
    const rows = totalsByPlayer(
      [
        onDay('b1', 2026, 7, 1, { payment_method: 'open' }),
        onDay('b2', 2026, 7, 2, { payment_method: 'open' }),
      ],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 2, paid: 0, open: 80 }]);
  });

  it('splitst een mengeling van betaald en openstaand over de twee kolommen', () => {
    const rows = totalsByPlayer(
      [
        onDay('b1', 2026, 7, 1, { payment_method: 'cash' }),
        onDay('b2', 2026, 7, 2, { payment_method: 'invoice', court_id: 'court-2' }),
        onDay('b3', 2026, 7, 3, { payment_method: 'open' }),
      ],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 3, paid: 100, open: 40 }]);
  });

  it('zet een gesponsorde les bij het betaalde bedrag, niet bij het openstaande', () => {
    // Het sponsorcontract is betaald geld: het bedrag gaat van het sponsorbudget van de
    // speler af (zie lib/sponsor.ts), dus het is omzet en geen uitstel.
    const rows = totalsByPlayer(
      [onDay('b1', 2026, 7, 1, { payment_method: 'sponsor' })],
      users,
      courts,
    );
    expect(rows).toEqual([{ playerId: 'anna', name: 'Anna', lessons: 1, paid: 40, open: 0 }]);
  });

  it('houdt een speler die niet meer bestaat in het overzicht, als Onbekend', () => {
    const rows = totalsByPlayer([onDay('b1', 2026, 7, 1, { player_id: 'weg' })], users, courts);
    expect(rows).toEqual([{ playerId: 'weg', name: 'Onbekend', lessons: 1, paid: 40, open: 0 }]);
  });

  it('telt samen op tot precies de omzet op de kaart erboven', () => {
    const bookings = [
      onDay('b1', 2026, 7, 1, { player_id: 'anna' }),
      onDay('b2', 2026, 7, 2, { player_id: 'bram', court_id: 'court-2' }),
      onDay('b3', 2026, 7, 3, { player_id: 'cato', payment_method: 'open' }),
      onDay('b4', 2026, 7, 4, { player_id: 'cato', status: 'cancelled' }),
      onDay('b5', 2026, 7, 5, { player_id: 'bram', payment_method: 'sponsor' }),
    ];
    const sum = totalsByPlayer(bookings, users, courts).reduce((t, r) => t + r.paid, 0);
    expect(sum).toBe(totalRevenue(bookings, courts));
  });
});

describe('uitsplitsing per trainer', () => {
  // Koen verdient 24 per uur, Nele vulde nog niets in, Sam werkt aan nul.
  const coaches: User[] = [
    { id: 'koen', email: 'koen@x.be', name: 'Koen', role: 'coach', hourly_rate: 24 },
    { id: 'nele', email: 'nele@x.be', name: 'Nele', role: 'coach' },
    { id: 'sam', email: 'sam@x.be', name: 'Sam', role: 'coach', hourly_rate: 0 },
  ];
  const everyone = [...users, ...coaches];

  it('geeft een lege lijst als er in de periode niets is', () => {
    expect(payoutsByCoach([], everyone)).toEqual([]);
  });

  it('rekent met het uurtarief van de trainer, niet met dat van het terrein', () => {
    // Het terrein kost 40 per uur; de trainer krijgt zijn eigen 24.
    expect(payoutsByCoach([onDay('b1', 2026, 7, 1)], everyone)).toEqual([
      { coachId: 'koen', name: 'Koen', lessons: 1, amount: 24, missingRate: false },
    ]);
  });

  it('rekent een half uur naar rato af', () => {
    const half = onDay('b1', 2026, 7, 1, {
      end_time: new Date(2026, 7, 1, 10, 30).toISOString(),
    });
    expect(payoutsByCoach([half], everyone)[0].amount).toBe(12);
  });

  it('zet een trainer zonder ingesteld tarief op nul, met een melding', () => {
    expect(payoutsByCoach([onDay('b1', 2026, 7, 1, { coach_id: 'nele' })], everyone)).toEqual([
      { coachId: 'nele', name: 'Nele', lessons: 1, amount: 0, missingRate: true },
    ]);
  });

  it('meldt niets bij een tarief dat wél ingevuld is, ook al is het nul', () => {
    expect(payoutsByCoach([onDay('b1', 2026, 7, 1, { coach_id: 'sam' })], everyone)).toEqual([
      { coachId: 'sam', name: 'Sam', lessons: 1, amount: 0, missingRate: false },
    ]);
  });

  it('houdt een trainer die niet meer bestaat in het overzicht, als Onbekend', () => {
    expect(payoutsByCoach([onDay('b1', 2026, 7, 1, { coach_id: 'weg' })], everyone)).toEqual([
      { coachId: 'weg', name: 'Onbekend', lessons: 1, amount: 0, missingRate: true },
    ]);
  });

  it('laat een geannuleerde les nergens meetellen, ook niet als les', () => {
    expect(payoutsByCoach([onDay('b1', 2026, 7, 1, { status: 'cancelled' })], everyone)).toEqual([]);
  });

  it('betaalt een gesponsorde of nog openstaande les gewoon uit: het uur is gegeven', () => {
    const rows = payoutsByCoach(
      [
        onDay('b1', 2026, 7, 1, { payment_method: 'sponsor' }),
        onDay('b2', 2026, 7, 2, { payment_method: 'open' }),
      ],
      everyone,
    );
    expect(rows[0].amount).toBe(48);
  });

  it('zet de trainer met het hoogste bedrag bovenaan', () => {
    const rows = payoutsByCoach(
      [
        onDay('b1', 2026, 7, 1, { coach_id: 'nele' }),
        onDay('b2', 2026, 7, 2, { coach_id: 'koen' }),
      ],
      everyone,
    );
    expect(rows.map((r) => r.coachId)).toEqual(['koen', 'nele']);
  });

  it('telt samen op tot precies wat er in totaal uitbetaald wordt', () => {
    const bookings = [
      onDay('b1', 2026, 7, 1, { coach_id: 'koen' }),
      onDay('b2', 2026, 7, 2, { coach_id: 'nele' }),
      onDay('b3', 2026, 7, 3, { coach_id: 'koen', payment_method: 'open' }),
      onDay('b4', 2026, 7, 4, { coach_id: 'koen', status: 'cancelled' }),
    ];
    const sum = payoutsByCoach(bookings, everyone).reduce((t, r) => t + r.amount, 0);
    expect(sum).toBe(totalCoachPayout(bookings, everyone));
    expect(sum).toBe(48);
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
