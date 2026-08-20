import type { Booking, Court, User } from './types';
import { monthRows, toCsv, CSV_HEADER } from './csv';

const users: User[] = [
  { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach' },
  { id: 'p1', name: 'Mathis', email: 'm@x.be', role: 'player' },
];

const courts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: '2026-08-20T08:00:00.000Z', end_time: '2026-08-20T09:00:00.000Z',
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

describe('monthRows', () => {
  it('keeps only bookings in the chosen month', () => {
    const rows = monthRows(
      [booking(), booking({ id: 'b2', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].player).toBe('Mathis');
  });

  it('sorts by start time', () => {
    const rows = monthRows(
      [
        booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
        booking({ id: 'b1' }),
      ],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b2']);
  });

  it('fills coach, court, duration, price and labels', () => {
    const [row] = monthRows([booking()], users, courts, new Date(2026, 7, 1));
    expect(row.coach).toBe('Koen');
    expect(row.court).toBe('Baan 1');
    expect(row.minutes).toBe(60);
    expect(row.price).toBe(30);
    expect(row.status).toBe('Bevestigd');
    expect(row.payment).toBe('Cash');
  });

  it('prices a half hour at half the rate', () => {
    const [row] = monthRows(
      [booking({ end_time: '2026-08-20T08:30:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(row.minutes).toBe(30);
    expect(row.price).toBe(15);
  });

  it('names an unknown player and court instead of leaving them empty', () => {
    const [row] = monthRows(
      [booking({ player_id: 'weg', court_id: 'weg' })], users, courts, new Date(2026, 7, 1),
    );
    expect(row.player).toBe('Onbekend');
    expect(row.court).toBe('Onbekend terrein');
  });

  it('returns nothing for an empty month', () => {
    expect(monthRows([booking()], users, courts, new Date(2026, 0, 1))).toEqual([]);
  });
});

describe('toCsv', () => {
  it('starts with the header row', () => {
    expect(toCsv([]).split('\n')[0]).toBe(CSV_HEADER.join(';'));
  });

  it('writes one line per row, semicolon separated', () => {
    const rows = monthRows([booking()], users, courts, new Date(2026, 7, 1));
    const lines = toCsv(rows).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split(';')).toHaveLength(CSV_HEADER.length);
  });

  it('writes the price with a comma, as Excel here expects', () => {
    const rows = monthRows([booking({ end_time: '2026-08-20T08:30:00.000Z' })], users, courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('15,00');
  });

  it('quotes a field that contains the separator', () => {
    const rows = monthRows([booking()], [
      { id: 'koen', name: 'Koen; de trainer', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('"Koen; de trainer"');
  });
});
