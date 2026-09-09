import {
  aanwezigheidVan, zetAanwezigheid, aanwezigheidTelling, aanwezigheidRegel, volgendeStand, magAanwezigheidZetten,
  getoondeStand, bevestigAanwezigheid, magLesBevestigen, aanwezigheidOverzicht, brusselseDag,
} from './aanwezigheid';
import type { Booking } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-09-01T10:00:00.000Z', end_time: '2026-09-01T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};
const groep: Booking = { ...base, participant_ids: ['p2', 'p3'] };

describe('brusselseDag', () => {
  it('geeft de kalenderdag in Brussel, niet die van het toestel', () => {
    // 31 december 23:00 UTC is in Brussel al 1 januari.
    expect(brusselseDag(new Date('2026-12-31T23:00:00.000Z'))).toBe('2027-01-01');
  });

  it('geeft dezelfde dag voor een moment midden op de dag', () => {
    expect(brusselseDag(new Date('2026-09-09T12:00:00.000Z'))).toBe('2026-09-09');
  });
});

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
  it('schakelt heen en weer bij een les die bezig is', () => {
    expect(volgendeStand('aanwezig', true)).toBe('afwezig');
    expect(volgendeStand('afwezig', true)).toBe('aanwezig');
  });

  it('vertrekt vanuit aanwezig als er nog niets genoteerd staat', () => {
    // Het scherm toont zo iemand als aanwezig, dus de tik moet hem op afwezig zetten.
    expect(volgendeStand(null, true)).toBe('afwezig');
  });

  it('schrijft nooit een aanwezigheid weg voor een les die nog moet beginnen', () => {
    // Daar valt nog niets waar te nemen. Afmelden mag — dat is een mededeling — maar de
    // weg terug gaat naar niets-genoteerd en niet naar "ik heb gezien dat hij er was".
    expect(volgendeStand(null, false)).toBe('afwezig');
    expect(volgendeStand('afwezig', false)).toBeNull();
    expect(volgendeStand('aanwezig', false)).toBe('afwezig');
  });

  it('laat de weg terug naar leeg bestaan buiten het scherm om', () => {
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
  const beheerder = { id: 'x', is_admin: true };

  it('lets an admin set anyone, for any day', () => {
    expect(magAanwezigheidZetten(beheerder, les('2026-08-01T10:00:00'), 'p2', [], nu)).toBe(true);
  });

  it('lets the coach set a lesson of today that already finished: the ordinary case', () => {
    // Afvinken gebeurt ná de les. Deze les was al voorbij toen "nu" begon.
    expect(magAanwezigheidZetten(trainer, les('2026-09-02T09:00:00'), 'p2', [], nu)).toBe(true);
  });

  it('stops the coach at a lesson of yesterday', () => {
    expect(magAanwezigheidZetten(trainer, les('2026-09-01T18:00:00'), 'p2', [], nu)).toBe(false);
  });

  it('lets an admin fix a lesson of yesterday', () => {
    expect(magAanwezigheidZetten(beheerder, les('2026-09-01T18:00:00'), 'p2', [], nu)).toBe(true);
  });

  it('lets a substitute set today, and takes it away from the regular coach', () => {
    const vervangenLes = les('2026-09-02T09:00:00', { taught_by_id: 'vervanger' });
    expect(magAanwezigheidZetten({ id: 'vervanger' }, vervangenLes, 'p2', [], nu)).toBe(true);
    expect(magAanwezigheidZetten(trainer, vervangenLes, 'p2', [], nu)).toBe(false);
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

describe('getoondeStand', () => {
  it('leest niets genoteerd als aanwezig', () => {
    expect(getoondeStand(null)).toBe('aanwezig');
  });

  it('laat een echte stand zichzelf blijven', () => {
    expect(getoondeStand('aanwezig')).toBe('aanwezig');
    expect(getoondeStand('afwezig')).toBe('afwezig');
  });
});

describe('bevestigAanwezigheid', () => {
  const groep = {
    ...base,
    participant_ids: ['p1', 'p2', 'p3'],
  };

  it('zet iedereen zonder aantekening op aanwezig', () => {
    expect(bevestigAanwezigheid(groep).attendance).toEqual({
      p1: 'aanwezig', p2: 'aanwezig', p3: 'aanwezig',
    });
  });

  it('laat een afwezige met rust', () => {
    const b = { ...groep, attendance: { p2: 'afwezig' as const } };
    expect(bevestigAanwezigheid(b).attendance).toEqual({
      p1: 'aanwezig', p2: 'afwezig', p3: 'aanwezig',
    });
  });

  it('gooit de aantekening weg van wie niet meer meespeelt', () => {
    // Dezelfde opruiming als zetAanwezigheid: een speler die de trainer uit de les haalde,
    // laat anders een aantekening achter die nergens op het scherm komt maar wel meetelt.
    const b = { ...groep, attendance: { weg: 'afwezig' as const } };
    expect(bevestigAanwezigheid(b).attendance).toEqual({
      p1: 'aanwezig', p2: 'aanwezig', p3: 'aanwezig',
    });
  });

  it('maakt de telling compleet: niets staat meer open', () => {
    const bevestigd = { ...groep, ...bevestigAanwezigheid(groep) };
    expect(aanwezigheidTelling(bevestigd)).toEqual({ aanwezig: 3, afwezig: 0, open: 0 });
  });

  it('verandert niets meer als je twee keer bevestigt', () => {
    const eenmaal = { ...groep, ...bevestigAanwezigheid(groep) };
    expect(bevestigAanwezigheid(eenmaal).attendance).toEqual(eenmaal.attendance);
  });
});

describe('magLesBevestigen', () => {
  const nu = new Date('2026-09-01T10:30:00.000Z');

  it('mag een les die bezig is', () => {
    expect(magLesBevestigen({ start_time: '2026-09-01T10:00:00.000Z' }, nu)).toBe(true);
  });

  it('mag een les die geweest is', () => {
    expect(magLesBevestigen({ start_time: '2026-08-25T10:00:00.000Z' }, nu)).toBe(true);
  });

  it('mag een les die nog moet beginnen niet', () => {
    // Het "Hierna"-blok van het afvinkscherm toont komende lessen zodat een trainer alvast
    // iemand kan afmelden. Die ene aantekening mag, maar de hele groep aanwezig verklaren
    // voor een les die nog niet gebeurd is niet: dan is "niemand heeft gekeken" weg terwijl
    // er nog niets te zien was.
    expect(magLesBevestigen({ start_time: '2026-09-08T10:00:00.000Z' }, nu)).toBe(false);
  });

  it('weigert bij een onleesbare begintijd', () => {
    // Bij twijfel niet bevestigen: een aantekening terugdraaien kan niet vanaf dit scherm.
    expect(magLesBevestigen({ start_time: 'geen datum' }, nu)).toBe(false);
  });
});

describe('aanwezigheidOverzicht', () => {
  const les = (id: string, attendance?: Record<string, 'aanwezig' | 'afwezig'>) => ({
    ...base, id, participant_ids: ['p1', 'p2'], attendance,
  });

  it('telt de drie standen los van elkaar', () => {
    const lessen = [
      les('a', { p1: 'aanwezig' }),
      les('b', { p1: 'afwezig' }),
      les('c'),
    ];
    expect(aanwezigheidOverzicht(lessen, 'p1')).toEqual({ aanwezig: 1, afwezig: 1, open: 1, totaal: 3 });
  });

  it('telt alleen de lessen waar deze speler in meespeelt', () => {
    const lessen = [
      les('a', { p1: 'aanwezig' }),
      { ...base, id: 'b', player_id: 'p3', participant_ids: [], attendance: { p3: 'aanwezig' as const } },
    ];
    expect(aanwezigheidOverzicht(lessen, 'p1')).toEqual({ aanwezig: 1, afwezig: 0, open: 0, totaal: 1 });
  });

  it('geeft nullen bij een lege lijst', () => {
    expect(aanwezigheidOverzicht([], 'p1')).toEqual({ aanwezig: 0, afwezig: 0, open: 0, totaal: 0 });
  });
});
