import type { Booking, Court, User } from './types';
import { csvRows, toCsv, formatEuro, CSV_HEADER, CSV_COLUMNS, parseCsv } from './csv';
import { bookingsInPeriod, monthPeriod } from './period';

const users: User[] = [
  { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach', hourly_rate: 24 },
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

describe('csvRows', () => {
  it('turns every given booking into a row', () => {
    const rows = csvRows(
      [booking(), booking({ id: 'b2', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' })],
      users, courts,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].player).toBe('Mathis');
  });

  it('sorts by start time', () => {
    const rows = csvRows(
      [
        booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
        booking({ id: 'b1' }),
      ],
      users, courts,
    );
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b2']);
  });

  it('leaves the given list untouched', () => {
    const given = [
      booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
      booking({ id: 'b1' }),
    ];
    csvRows(given, users, courts);
    expect(given.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('fills coach, court, duration, price and labels', () => {
    const [row] = csvRows([booking()], users, courts);
    expect(row.coach).toBe('Koen');
    expect(row.court).toBe('Baan 1');
    expect(row.minutes).toBe(60);
    expect(row.price).toBe(30);
    expect(row.coachPay).toBe(24);
    expect(row.status).toBe('Bevestigd');
    expect(row.payment).toBe('Cash');
  });

  it('prices a half hour at half the rate, for player and coach alike', () => {
    const [row] = csvRows([booking({ end_time: '2026-08-20T08:30:00.000Z' })], users, courts);
    expect(row.minutes).toBe(30);
    expect(row.price).toBe(15);
    expect(row.coachPay).toBe(12);
  });

  it('gives the coach nothing when he has no hourly rate set', () => {
    const zonder: User[] = [{ id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach' }, users[1]];
    const [row] = csvRows([booking()], zonder, courts);
    // De speler betaalt gewoon de baan; alleen het loon van de trainer valt op nul.
    expect(row.price).toBe(30);
    expect(row.coachPay).toBe(0);
  });

  it('gives an unknown coach nothing, without breaking the price', () => {
    const [row] = csvRows([booking({ coach_id: 'weg' })], users, courts);
    expect(row.coach).toBe('Onbekend');
    expect(row.coachPay).toBe(0);
  });

  it('names an unknown player and court instead of leaving them empty', () => {
    const [row] = csvRows([booking({ player_id: 'weg', court_id: 'weg' })], users, courts);
    expect(row.player).toBe('Onbekend');
    expect(row.court).toBe('Onbekend terrein');
  });

  it('returns nothing without bookings', () => {
    expect(csvRows([], users, courts)).toEqual([]);
  });

  it('gives zero duration and price when end_time lies before start_time', () => {
    const [row] = csvRows(
      [booking({ start_time: '2026-08-20T09:00:00.000Z', end_time: '2026-08-20T08:00:00.000Z' })],
      users, courts,
    );
    expect(row.minutes).toBe(0);
    expect(row.price).toBe(0);
    expect(row.coachPay).toBe(0);
  });

  it('gives zero duration and price when end_time cannot be parsed', () => {
    const [row] = csvRows([booking({ end_time: 'niet-een-datum' })], users, courts);
    expect(row.minutes).toBe(0);
    expect(row.price).toBe(0);
    expect(row.coachPay).toBe(0);
  });

  it('gives the rows of the export the same lessons, in the same order, as the period filter', () => {
    const given = [
      booking({ id: 'b2', start_time: '2026-08-25T08:00:00.000Z', end_time: '2026-08-25T09:00:00.000Z' }),
      booking({ id: 'b1' }),
      booking({ id: 'b3', start_time: '2026-09-02T08:00:00.000Z', end_time: '2026-09-02T09:00:00.000Z' }),
    ];
    const period = monthPeriod(new Date(2026, 7, 1));
    const kept = bookingsInPeriod(given, period);
    expect(kept.map((b) => b.id)).toEqual(csvRows(kept, users, courts).map((r) => r.id));
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
  it('are the agreed columns, in the agreed order', () => {
    expect(CSV_COLUMNS.map((c) => c.label)).toEqual([
      'Datum', 'Uur', 'Trainer', 'Speler', 'Spelers', 'Facturatie', 'Terrein', 'Duur (min)',
      'Prijs les (EUR)', 'Loon trainer (EUR)', 'Status', 'Betaalwijze',
    ]);
    expect(CSV_COLUMNS).toHaveLength(12);
  });

  it('writes the two amounts next to each other, the player first', () => {
    const [row] = csvRows([booking()], users, courts);
    const cells = CSV_COLUMNS.map((c) => c.value(row));
    expect(cells[8]).toBe('30,00');
    expect(cells[9]).toBe('24,00');
  });

  it('is the single source for the header, in the same order', () => {
    expect(CSV_COLUMNS.map((c) => c.label)).toEqual([...CSV_HEADER]);
  });

  it('gives the screen the same cells, in the same order, as the file', () => {
    const [row] = csvRows([booking()], users, courts);
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
    const rows = csvRows([booking()], users, courts);
    const lines = toCsv(rows).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].split(';')).toHaveLength(CSV_HEADER.length);
  });

  it('writes the price with a comma, as Excel here expects', () => {
    const rows = csvRows([booking({ end_time: '2026-08-20T08:30:00.000Z' })], users, courts);
    expect(toCsv(rows)).toContain('15,00');
  });

  it('quotes a field that contains the separator', () => {
    const rows = csvRows([booking()], [
      { id: 'koen', name: 'Koen; de trainer', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts);
    expect(toCsv(rows)).toContain('"Koen; de trainer"');
  });

  it('quotes and doubles a double quote in a field that also contains a semicolon', () => {
    const rows = csvRows([booking()], [
      { id: 'koen', name: 'Koen; "de trainer"', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts);
    expect(toCsv(rows)).toContain('"Koen; ""de trainer"""');
  });

  it('quotes a field that contains a bare carriage return', () => {
    const rows = csvRows([booking()], [
      { id: 'koen', name: 'Koen\rde trainer', email: 'k@x.be', role: 'coach' },
      users[1],
    ], courts);
    expect(toCsv(rows)).toContain('"Koen\rde trainer"');
  });
});

describe('csvRows bij een groepsles', () => {
  const staffel: Court[] = [
    {
      ...courts[0],
      group_rates: [{ max_players: 2, rate: 30 }, { max_players: 4, rate: 45 }],
    },
  ];
  const groep = booking({ participant_ids: ['p2', 'p3'], payment_method: 'invoice' });

  it('is one line per lesson, with the total of the whole lesson', () => {
    // Een export is een lijst lessen: één regel, ook als er apart gefactureerd wordt.
    const rows = csvRows([groep, { ...groep, payment_split: 'separate' as const }], users, staffel);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.price)).toEqual([45, 45]);
  });

  it('names the payer with how many joined him, and how many players there were', () => {
    const [row] = csvRows([groep], users, staffel);
    expect(row.player).toBe('Mathis +2');
    expect(row.players).toBe(3);
  });

  it('says whether the lesson is invoiced together or separately', () => {
    expect(csvRows([groep], users, staffel)[0].billing).toBe('Samen');
    expect(csvRows([{ ...groep, payment_split: 'separate' as const }], users, staffel)[0].billing)
      .toBe('Apart');
  });

  it('leaves a private lesson exactly as it was', () => {
    const [row] = csvRows([booking()], users, courts);
    expect(row.player).toBe('Mathis');
    expect(row.players).toBe(1);
    expect(row.billing).toBe('Samen');
  });
});

describe('parseCsv', () => {
  it('leest de puntkomma van Nederlandse Excel', () => {
    expect(parseCsv('naam;email\nJonas;jonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('leest ook een komma als dat het scheidingsteken is', () => {
    expect(parseCsv('naam,email\nJonas,jonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('leest een tab, want zo plakt Excel', () => {
    expect(parseCsv('naam\temail\nJonas\tjonas@club.be')).toEqual([
      ['naam', 'email'],
      ['Jonas', 'jonas@club.be'],
    ]);
  });

  it('haalt de BOM weg die Excel vooraan zet', () => {
    expect(parseCsv('\uFEFF' + 'naam;email')).toEqual([['naam', 'email']]);
  });

  it('houdt een scheidingsteken binnen aanhalingstekens bij elkaar', () => {
    expect(parseCsv('naam;bio\n"De Vries; Jan";"hij zei ""hallo"""')).toEqual([
      ['naam', 'bio'],
      ['De Vries; Jan', 'hij zei "hallo"'],
    ]);
  });

  it('leest regeleindes in Windows-stijl', () => {
    expect(parseCsv('a;b\r\nc;d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('houdt een lege regel middenin het bestand, maar laat de lege regel onderaan weg', () => {
    // De lege regel middenin telt mee voor het regelnummer — precies wat een trainer in
    // Excel ziet — en blijft daarom staan; de lege staart is geen echte regel en valt weg.
    expect(parseCsv('a;b\n\nc;d\n')).toEqual([['a', 'b'], [''], ['c', 'd']]);
  });

  it('laat meerdere lege regels aan het eind allemaal weg', () => {
    expect(parseCsv('a;b\nc;d\n\n\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('houdt lege cellen staan, want die dragen betekenis', () => {
    expect(parseCsv('a;;c')).toEqual([['a', '', 'c']]);
  });

  it('geeft niets terug bij een leeg bestand', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  ')).toEqual([]);
  });

  it('een ongepaard aanhalingsteken achteraan een cel houdt de volgende rij heel', () => {
    // Een lengte als "1,80"" (met het teken voor centimeter) mag de rest van het
    // bestand niet opslokken: het aanhalingsteken staat niet aan het begin van de cel.
    expect(parseCsv('naam;lengte\nJan;1,80"\nPiet;1,90')).toEqual([
      ['naam', 'lengte'],
      ['Jan', '1,80"'],
      ['Piet', '1,90'],
    ]);
  });

  it('een aanhalingsteken midden in een cel blijft gewoon in de tekst staan', () => {
    expect(parseCsv('naam;bij\nJan "Jantje" Peeters;x')).toEqual([
      ['naam', 'bij'],
      ['Jan "Jantje" Peeters', 'x'],
    ]);
  });

  it('een aanhalingsteken met alleen spaties ervoor telt nog als het begin van een cel', () => {
    // Met de hand overgetypt komt er weleens een spatie na het scheidingsteken. De cel is
    // op dat moment nog leeg op de spatie na, en wordt toch getrimd — dus mag het
    // aanhalingsteken hier nog gewoon de cel openen.
    expect(parseCsv('naam;bio\nJan; "De Vries; Jan"')).toEqual([
      ['naam', 'bio'],
      ['Jan', 'De Vries; Jan'],
    ]);
  });

  it('een titelregel zonder scheidingsteken erin verwart de detectie niet', () => {
    expect(parseCsv('Ledenlijst 2026\nnaam,email\nJan,jan@x.be')).toEqual([
      ['Ledenlijst 2026'],
      ['naam', 'email'],
      ['Jan', 'jan@x.be'],
    ]);
  });

  it('een titelregel mét een scheidingsteken erin kaapt de detectie niet', () => {
    // "Ledenlijst, seizoen 2026" geeft de komma een schijnbare meerderheid op de eerste
    // regel, maar de twee regels erna zijn het eens over de puntkomma in twee kolommen —
    // en dat moet winnen.
    // ';' wordt het scheidingsteken voor het hele bestand, dus de titelregel — die zelf
    // geen puntkomma heeft — blijft één cel, komma en al.
    expect(parseCsv('Ledenlijst, seizoen 2026\nnaam;email\nJan;jan@x.be')).toEqual([
      ['Ledenlijst, seizoen 2026'],
      ['naam', 'email'],
      ['Jan', 'jan@x.be'],
    ]);
  });

  it('een bestand van één enkele regel valt nog gewoon in kolommen uiteen', () => {
    expect(parseCsv('naam,email')).toEqual([['naam', 'email']]);
  });

  it('geen enkel scheidingsteken in het bestand valt terug op de puntkomma', () => {
    expect(parseCsv('eenkolom\ntweede')).toEqual([['eenkolom'], ['tweede']]);
  });

  it('een lege regel bovenaan het bestand verwart de scheidingsteken-detectie niet', () => {
    // De detectie zelf telt lege regels niet mee (zie scheidingstekenVan); het resultaat
    // houdt de lege regel wél aan, want ook regel 1 telt mee voor het regelnummer.
    expect(parseCsv('\nnaam,email\nJan,jan@x.be')).toEqual([
      [''],
      ['naam', 'email'],
      ['Jan', 'jan@x.be'],
    ]);
  });

  it('een regeleinde binnen een geciteerde cel blijft deel van de cel', () => {
    // Dit is precies waarom er een tekenlus staat en geen `split('\n')`.
    expect(parseCsv('naam;adres\nJan;"Straat 1\nGent"')).toEqual([
      ['naam', 'adres'],
      ['Jan', 'Straat 1\nGent'],
    ]);
  });

  it('een regeleinde binnen aanhalingstekens blijft letterlijk staan, ook een CRLF', () => {
    // De schrijfkant zet een kale '\r' bewust tussen aanhalingstekens (zie de toCsv-test
    // hierboven); de leeskant moet dat teken dus niet stilletjes ombouwen tot '\n'.
    expect(parseCsv('naam;adres\r\nJan;"Straat 1\r\nGent"')).toEqual([
      ['naam', 'adres'],
      ['Jan', 'Straat 1\r\nGent'],
    ]);
  });

  it('een kale CR binnen aanhalingstekens blijft ook letterlijk staan', () => {
    expect(parseCsv('naam;wie\nx;"Koen\rde trainer"')).toEqual([
      ['naam', 'wie'],
      ['x', 'Koen\rde trainer'],
    ]);
  });

  it('een kale CR buiten aanhalingstekens is een rijeinde, net als een CRLF', () => {
    expect(parseCsv('a;b\rc;d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('een rij met meer of minder kolommen dan de kop komt door zoals hij is', () => {
    // Opvullen of afkappen is geen zaak van de lezer — dat is regelgeving voor een latere taak.
    expect(parseCsv('a;b;c\nd;e\nf;g;h;i')).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
      ['f', 'g', 'h', 'i'],
    ]);
  });

  it('trimt spaties rond een cel, want die horen niet in een naam of e-mailadres', () => {
    expect(parseCsv('naam ; email \n Jan ; jan@x.be ')).toEqual([
      ['naam', 'email'],
      ['Jan', 'jan@x.be'],
    ]);
  });
});
