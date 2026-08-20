import type { Booking, Court, User } from './types';
import { bookingsInMonth, monthRows, toCsv, formatEuro, CSV_HEADER, CSV_COLUMNS } from './csv';

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

describe('bookingsInMonth', () => {
  it('keeps only bookings in the chosen month', () => {
    const kept = bookingsInMonth(
      [booking(), booking({ id: 'b2', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' })],
      new Date(2026, 7, 1),
    );
    expect(kept.map((b) => b.id)).toEqual(['b1']);
  });

  it('keeps a lesson on the first day of the month', () => {
    const kept = bookingsInMonth(
      [booking({ start_time: '2026-08-01T08:00:00.000Z', end_time: '2026-08-01T09:00:00.000Z' })],
      new Date(2026, 7, 1),
    );
    expect(kept).toHaveLength(1);
  });

  it('keeps a lesson on the last day of the month', () => {
    const kept = bookingsInMonth(
      [booking({ start_time: '2026-08-31T18:00:00.000Z', end_time: '2026-08-31T19:00:00.000Z' })],
      new Date(2026, 7, 1),
    );
    expect(kept).toHaveLength(1);
  });

  it('sorts by start time', () => {
    const kept = bookingsInMonth(
      [
        booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
        booking({ id: 'b1' }),
      ],
      new Date(2026, 7, 1),
    );
    expect(kept.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('leaves the given list untouched', () => {
    const given = [
      booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
      booking({ id: 'b1' }),
    ];
    bookingsInMonth(given, new Date(2026, 7, 1));
    expect(given.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('returns nothing for an empty month', () => {
    expect(bookingsInMonth([booking()], new Date(2026, 0, 1))).toEqual([]);
  });

  it('gives the rows of the export the same lessons, in the same order', () => {
    const given = [
      booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
      booking({ id: 'b1' }),
      booking({ id: 'b3', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' }),
    ];
    const month = new Date(2026, 7, 1);
    expect(bookingsInMonth(given, month).map((b) => b.id)).toEqual(
      monthRows(given, users, courts, month).map((r) => r.id),
    );
  });
});

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

  it('gives zero duration and price when end_time lies before start_time', () => {
    const [row] = monthRows(
      [booking({ start_time: '2026-08-20T09:00:00.000Z', end_time: '2026-08-20T08:00:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(row.minutes).toBe(0);
    expect(row.price).toBe(0);
  });

  it('gives zero duration and price when end_time cannot be parsed', () => {
    const [row] = monthRows(
      [booking({ end_time: 'niet-een-datum' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(row.minutes).toBe(0);
    expect(row.price).toBe(0);
  });

  it('keeps a booking that starts at 23:30 local time and crosses midnight in the month of its start', () => {
    const rows = monthRows(
      [booking({ start_time: '2026-08-31T21:30:00.000Z', end_time: '2026-08-31T22:30:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows).toHaveLength(1);
  });

  it('puts a booking on the first day of the next month in that month, not the previous one', () => {
    const rows = monthRows(
      [booking({ start_time: '2026-09-01T08:00:00.000Z', end_time: '2026-09-01T09:00:00.000Z' })],
      users, courts, new Date(2026, 7, 1),
    );
    expect(rows).toHaveLength(0);
    const nextMonthRows = monthRows(
      [booking({ start_time: '2026-09-01T08:00:00.000Z', end_time: '2026-09-01T09:00:00.000Z' })],
      users, courts, new Date(2026, 8, 1),
    );
    expect(nextMonthRows).toHaveLength(1);
  });
});

describe('formatEuro', () => {
  it('writes two decimals with a comma', () => {
    expect(formatEuro(15)).toBe('15,00');
    expect(formatEuro(7.5)).toBe('7,50');
  });

  it('writes zero as 0,00', () => {
    expect(formatEuro(0)).toBe('0,00');
  });

  it('rounds to two decimals', () => {
    expect(formatEuro(12.345)).toBe('12,35');
    expect(formatEuro(0.005)).toBe('0,01');
  });
});

describe('CSV_COLUMNS', () => {
  it('is the single source for the header, in the same order', () => {
    expect(CSV_COLUMNS.map((c) => c.label)).toEqual([...CSV_HEADER]);
  });

  it('gives the screen the same cells, in the same order, as the file', () => {
    const [row] = monthRows([booking()], users, courts, new Date(2026, 7, 1));
    const cells = CSV_COLUMNS.map((c) => c.value(row));
    expect(cells).toHaveLength(CSV_HEADER.length);
    expect(toCsv([row]).split('\n')[1].split(';')).toEqual(cells);
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

  it('quotes and doubles a double quote in a field that also contains a semicolon', () => {
    const rows = monthRows([booking()], [
      { id: 'koen', name: 'Koen; "de trainer"', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('"Koen; ""de trainer"""');
  });

  it('quotes a field that contains a bare carriage return', () => {
    const rows = monthRows([booking()], [
      { id: 'koen', name: 'Koen\rde trainer', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts, new Date(2026, 7, 1));
    expect(toCsv(rows)).toContain('"Koen\rde trainer"');
  });
});
