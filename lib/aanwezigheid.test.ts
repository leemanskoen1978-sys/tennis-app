import {
  aanwezigheidVan, zetAanwezigheid, aanwezigheidTelling, aanwezigheidRegel, volgendeStand, magAanwezigheidZetten,
} from './aanwezigheid';
import type { Booking } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-09-01T10:00:00.000Z', end_time: '2026-09-01T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};
const groep: Booking = { ...base, participant_ids: ['p2', 'p3'] };

describe('aanwezigheidVan', () => {
  it('is empty for a lesson nobody ticked off yet', () => {
    expect(aanwezigheidVan(base, 'p1')).toBeNull();
  });

  it('reads what was noted for the payer and for a participant', () => {
    const b = { ...groep, attendance: { p1: 'aanwezig' as const, p3: 'afwezig' as const } };
    expect(aanwezigheidVan(b, 'p1')).toBe('aanwezig');
    expect(aanwezigheidVan(b, 'p2')).toBeNull();
    expect(aanwezigheidVan(b, 'p3')).toBe('afwezig');
  });

  it('ignores a note for someone who does not play in this lesson', () => {
    // Zo'n aantekening blijft over als een deelnemer uit de les gehaald wordt.
    expect(aanwezigheidVan({ ...base, attendance: { p9: 'aanwezig' } }, 'p9')).toBeNull();
  });

  it('ignores a value that is not one of the two', () => {
    const rommel = { ...base, attendance: { p1: 'misschien' } } as unknown as Booking;
    expect(aanwezigheidVan(rommel, 'p1')).toBeNull();
  });
});

describe('zetAanwezigheid', () => {
  it('notes one player and leaves the others alone', () => {
    const eerst = zetAanwezigheid(groep, 'p2', 'afwezig');
    expect(eerst.attendance).toEqual({ p2: 'afwezig' });
    const daarna = zetAanwezigheid({ ...groep, ...eerst }, 'p1', 'aanwezig');
    expect(daarna.attendance).toEqual({ p2: 'afwezig', p1: 'aanwezig' });
  });

  it('clears the note when the same button is tapped again', () => {
    const b = { ...groep, attendance: { p1: 'aanwezig' as const, p2: 'aanwezig' as const } };
    expect(zetAanwezigheid(b, 'p1', 'aanwezig').attendance).toEqual({ p2: 'aanwezig' });
  });

  it('switches from present to absent in one tap', () => {
    const b = { ...base, attendance: { p1: 'aanwezig' as const } };
    expect(zetAanwezigheid(b, 'p1', 'afwezig').attendance).toEqual({ p1: 'afwezig' });
  });

  it('drops notes of players who no longer play in the lesson', () => {
    // p3 stond erbij toen hij afgevinkt werd, maar is er intussen uitgehaald.
    const b: Booking = { ...base, participant_ids: ['p2'], attendance: { p2: 'aanwezig', p3: 'afwezig' } };
    expect(zetAanwezigheid(b, 'p1', 'aanwezig').attendance).toEqual({ p2: 'aanwezig', p1: 'aanwezig' });
  });

  it('does not note someone who is not in the lesson', () => {
    expect(zetAanwezigheid(base, 'p9', 'aanwezig').attendance).toEqual({});
  });
});

describe('aanwezigheidTelling', () => {
  it('counts every player of the lesson, ticked off or not', () => {
    expect(aanwezigheidTelling(groep)).toEqual({ aanwezig: 0, afwezig: 0, open: 3 });
    const b = { ...groep, attendance: { p1: 'aanwezig' as const, p2: 'afwezig' as const } };
    expect(aanwezigheidTelling(b)).toEqual({ aanwezig: 1, afwezig: 1, open: 1 });
  });
});

describe('aanwezigheidRegel', () => {
  it('says so when nothing has been ticked off', () => {
    expect(aanwezigheidRegel(groep)).toBe('Nog niets afgevinkt.');
  });

  it('names what is still open', () => {
    const b = { ...groep, attendance: { p1: 'aanwezig' as const } };
    expect(aanwezigheidRegel(b)).toBe('1 van 3 aanwezig · 2 nog niet afgevinkt');
  });

  it('drops the tail once every player is done', () => {
    const b = {
      ...groep,
      attendance: { p1: 'aanwezig' as const, p2: 'aanwezig' as const, p3: 'afwezig' as const },
    };
    expect(aanwezigheidRegel(b)).toBe('2 van 3 aanwezig');
  });
});

describe('volgendeStand', () => {
  it('walks one circle: empty, present, absent, empty', () => {
    expect(volgendeStand(null)).toBe('aanwezig');
    expect(volgendeStand('aanwezig')).toBe('afwezig');
    expect(volgendeStand('afwezig')).toBeNull();
  });

  it('clears the note when the screen passes null', () => {
    const b = { ...base, attendance: { p1: 'aanwezig' as const } };
    expect(zetAanwezigheid(b, 'p1', null).attendance).toEqual({});
  });
});

describe('magAanwezigheidZetten', () => {
  const nu = new Date('2026-09-02T15:00:00');
  const les = (startISO: string, patch: Partial<Booking> = {}): Booking => ({
    ...groep, start_time: startISO, end_time: startISO, ...patch,
  });
  const trainer = { id: 'koen' };
  const speler = { id: 'p1' };
  const ouder = { id: 'ouder' };

  it('lets the coach of the lesson set anyone, whenever', () => {
    expect(magAanwezigheidZetten(trainer, les('2026-08-01T10:00:00'), 'p2', [], nu)).toBe(true);
  });

  it('lets an admin set anyone', () => {
    expect(magAanwezigheidZetten({ id: 'x', is_admin: true }, les('2026-08-01T10:00:00'), 'p2', [], nu))
      .toBe(true);
  });

  it('lets a player set himself for a lesson later today', () => {
    expect(magAanwezigheidZetten(speler, les('2026-09-02T18:00:00'), 'p1', ['p1'], nu)).toBe(true);
  });

  it('also lets him for a lesson earlier today: the day itself counts', () => {
    expect(magAanwezigheidZetten(speler, les('2026-09-02T09:00:00'), 'p1', ['p1'], nu)).toBe(true);
  });

  it('stops him for a lesson that was yesterday', () => {
    expect(magAanwezigheidZetten(speler, les('2026-09-01T18:00:00'), 'p1', ['p1'], nu)).toBe(false);
  });

  it('stops him at somebody else in the same lesson', () => {
    expect(magAanwezigheidZetten(speler, les('2026-09-03T18:00:00'), 'p2', ['p1'], nu)).toBe(false);
  });

  it('lets a parent set his own child', () => {
    expect(magAanwezigheidZetten(ouder, les('2026-09-03T18:00:00'), 'p2', ['p2'], nu)).toBe(true);
    expect(magAanwezigheidZetten(ouder, les('2026-09-03T18:00:00'), 'p3', ['p2'], nu)).toBe(false);
  });

  it('stops someone who does not play in the lesson at all', () => {
    expect(magAanwezigheidZetten({ id: 'p9' }, les('2026-09-03T18:00:00'), 'p9', ['p9'], nu))
      .toBe(false);
  });

  it('says no when the start time is unreadable', () => {
    expect(magAanwezigheidZetten(speler, les('ooit'), 'p1', ['p1'], nu)).toBe(false);
  });
});
