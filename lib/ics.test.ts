import type { Booking, Court, User } from './types';
import { icsFilename, icsMoment, icsSequence, icsTekst, toIcs, vouw, type IcsContext } from './ics';

const users: User[] = [
  { id: 'koen', email: 'k@x.be', name: 'Koen', role: 'coach' },
  { id: 'p1', email: 'm@x.be', name: 'Mathis', role: 'player' },
  { id: 'p2', email: 'l@x.be', name: 'Lies', role: 'player' },
];

const courts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

const alsTrainer: IcsContext = { users, courts, viewerIsCoach: true };
const alsSpeler: IcsContext = { users, courts, viewerIsCoach: false };

const NU = new Date('2026-08-25T08:00:00.000Z');

function les(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: '2026-08-26T07:00:00.000Z', end_time: '2026-08-26T08:00:00.000Z',
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

/** De regels van een bestand — makkelijker om iets in terug te zoeken. */
function regels(tekst: string): string[] {
  return tekst.split('\r\n');
}

/** Idem, maar met de opgevouwen regels weer aan elkaar geplakt. */
function uitgevouwen(tekst: string): string[] {
  return tekst.split('\r\n').reduce<string[]>((uit, regel) => {
    if (regel.startsWith(' ') && uit.length > 0) {
      uit[uit.length - 1] += regel.slice(1);
      return uit;
    }
    return [...uit, regel];
  }, []);
}

describe('icsMoment', () => {
  it('writes a moment in UTC with the trailing Z', () => {
    expect(icsMoment('2026-08-26T07:00:00.000Z')).toBe('20260826T070000Z');
  });

  it('pads every part to two digits', () => {
    expect(icsMoment('2026-01-02T03:04:05.000Z')).toBe('20260102T030405Z');
  });

  it('gives an empty string for a broken moment, never "NaN"', () => {
    expect(icsMoment('geen datum')).toBe('');
  });
});

describe('icsTekst', () => {
  it('escapes the characters that would cut a field in two', () => {
    expect(icsTekst('ballen, netje; en een \\ erin'))
      .toBe(String.raw`ballen\, netje\; en een \\ erin`);
  });

  it('turns a line break into the two-character escape', () => {
    expect(icsTekst('eerste\nregel')).toBe('eerste\\nregel');
    expect(icsTekst('eerste\r\nregel')).toBe('eerste\\nregel');
  });
});

describe('vouw', () => {
  it('leaves a short line alone', () => {
    expect(vouw('SUMMARY:Tennisles')).toBe('SUMMARY:Tennisles');
  });

  it('folds a long line and starts every continuation with a space', () => {
    const stukken = vouw(`SUMMARY:${'a'.repeat(200)}`).split('\r\n');
    expect(stukken[0]).toHaveLength(75);
    expect(stukken.slice(1).every((r) => r.startsWith(' '))).toBe(true);
    // Opgevouwen en weer uitgevouwen is hetzelfde als ervoor.
    expect(stukken.map((r, i) => (i === 0 ? r : r.slice(1))).join('')).toBe(
      `SUMMARY:${'a'.repeat(200)}`,
    );
  });
});

describe('icsSequence', () => {
  it('rises with every later export, so an agenda accepts the newer version', () => {
    const eerder = icsSequence(new Date('2026-08-25T08:00:00.000Z'));
    const later = icsSequence(new Date('2026-08-25T08:01:00.000Z'));
    expect(later).toBe(eerder + 1);
  });

  it('never goes negative for a clock set before the zero point', () => {
    expect(icsSequence(new Date('2019-01-01T00:00:00.000Z'))).toBe(0);
  });
});

describe('toIcs', () => {
  it('wraps the events in a calendar that says how to read it', () => {
    const r = regels(toIcs([les()], alsTrainer, NU));
    expect(r[0]).toBe('BEGIN:VCALENDAR');
    expect(r).toContain('VERSION:2.0');
    expect(r).toContain('CALSCALE:GREGORIAN');
    expect(r).toContain('METHOD:PUBLISH');
    expect(r[r.length - 2]).toBe('END:VCALENDAR');
  });

  it('ends on a complete line', () => {
    expect(toIcs([les()], alsTrainer, NU).endsWith('\r\n')).toBe(true);
  });

  it('gives a lesson the same UID on every export, so a second import is not a duplicate', () => {
    const eerste = regels(toIcs([les()], alsTrainer, NU));
    const tweede = regels(toIcs([les()], alsTrainer, new Date('2026-09-01T08:00:00.000Z')));
    const uid = (r: string[]) => r.find((l) => l.startsWith('UID:'));
    expect(uid(eerste)).toBe('UID:b1@tennis-app');
    expect(uid(tweede)).toBe(uid(eerste));
  });

  it('raises the sequence on a later export, so the newer version wins', () => {
    const nummer = (tekst: string) =>
      Number(regels(tekst).find((l) => l.startsWith('SEQUENCE:'))?.slice(9));
    expect(nummer(toIcs([les()], alsTrainer, new Date('2026-09-01T08:00:00.000Z'))))
      .toBeGreaterThan(nummer(toIcs([les()], alsTrainer, NU)));
  });

  it('puts start, end, court and stamp in the event', () => {
    const r = regels(toIcs([les()], alsTrainer, NU));
    expect(r).toContain('DTSTART:20260826T070000Z');
    expect(r).toContain('DTEND:20260826T080000Z');
    expect(r).toContain('DTSTAMP:20260825T080000Z');
    expect(r).toContain('LOCATION:Baan 1');
  });

  it('names the court in the title, not the person', () => {
    expect(regels(toIcs([les()], alsTrainer, NU))).toContain('SUMMARY:Tennis Baan 1');
  });

  it('names the other person in the description: a coach sees the player', () => {
    expect(regels(toIcs([les()], alsTrainer, NU))).toContain('DESCRIPTION:Mathis');
  });

  it('and a player sees the coach', () => {
    expect(regels(toIcs([les()], alsSpeler, NU))).toContain('DESCRIPTION:Koen');
  });

  it('counts a group lesson in the description', () => {
    const r = regels(toIcs([les({ participant_ids: ['p2'] })], alsTrainer, NU));
    expect(r).toContain('DESCRIPTION:Mathis +1');
  });

  it('holds nothing but the date, the time, the name and the court', () => {
    const r = uitgevouwen(toIcs([les({ notes: 'ballen, netje' })], alsTrainer, NU));
    const inhoud = r.filter((l) => /^(SUMMARY|LOCATION|DESCRIPTION|DTSTART|DTEND):/.test(l));
    expect(inhoud).toEqual([
      'DTSTART:20260826T070000Z',
      'DTEND:20260826T080000Z',
      'SUMMARY:Tennis Baan 1',
      'LOCATION:Baan 1',
      'DESCRIPTION:Mathis',
    ]);
  });

  it('escapes a comma in a name, so the description cannot cut the field in two', () => {
    const metKomma: IcsContext = {
      ...alsTrainer,
      users: [...users, { id: 'p3', email: 'j@x.be', name: 'Jan, junior', role: 'player' }],
    };
    const r = uitgevouwen(toIcs([les({ player_id: 'p3' })], metKomma, NU));
    expect(r).toContain(String.raw`DESCRIPTION:Jan\, junior`);
  });

  it('leaves out the location when the court is unknown, and keeps a title that reads', () => {
    const r = regels(toIcs([les({ court_id: 'weg' })], alsTrainer, NU));
    expect(r.some((l) => l.startsWith('LOCATION:'))).toBe(false);
    expect(r).toContain('SUMMARY:Tennis');
  });

  it('leaves a cancelled lesson out: it is not happening', () => {
    const r = regels(toIcs([les(), les({ id: 'b2', status: 'cancelled' })], alsTrainer, NU));
    expect(r.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });

  it('is a valid, empty calendar when there is nothing to export', () => {
    const r = regels(toIcs([], alsTrainer, NU));
    expect(r).toContain('BEGIN:VCALENDAR');
    expect(r.some((l) => l === 'BEGIN:VEVENT')).toBe(false);
  });

  it('opens and closes every event', () => {
    const r = regels(toIcs([les(), les({ id: 'b2' })], alsTrainer, NU));
    expect(r.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(r.filter((l) => l === 'END:VEVENT')).toHaveLength(2);
  });
});

describe('icsFilename', () => {
  it('carries the day of the export, so two downloads stay apart', () => {
    expect(icsFilename(new Date(2026, 7, 25))).toBe('tennislessen-2026-08-25.ics');
  });
});
