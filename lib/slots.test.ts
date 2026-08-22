import {
  generateSlots,
  isDateBookable,
  worksOnDay,
  slotsForCoach,
  slotsStillToCome,
  formatWorkingDays,
  DAY_LABELS,
} from './slots';

describe('generateSlots', () => {
  it('generates hourly slots from 09:00 to end time (exclusive)', () => {
    expect(generateSlots('21:00')).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
      '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
    ]);
  });
  it('respects a custom earlier end time', () => {
    expect(generateSlots('12:00')).toEqual(['09:00', '10:00', '11:00']);
  });
});

describe('isDateBookable', () => {
  const today = new Date('2026-08-19T10:00:00');
  it('blocks today', () => {
    expect(isDateBookable(new Date('2026-08-19T00:00:00'), today)).toBe(false);
  });
  it('blocks past days', () => {
    expect(isDateBookable(new Date('2026-08-18T00:00:00'), today)).toBe(false);
  });
  it('allows future days', () => {
    expect(isDateBookable(new Date('2026-08-20T00:00:00'), today)).toBe(true);
  });
});

describe('worksOnDay', () => {
  // 2026-08-24 is een maandag, 2026-08-25 een dinsdag.
  const maandag = new Date('2026-08-24T10:00:00');
  const dinsdag = new Date('2026-08-25T10:00:00');

  it('treats a coach without working_days as available every day', () => {
    expect(worksOnDay({}, maandag)).toBe(true);
    expect(worksOnDay({}, dinsdag)).toBe(true);
  });

  it('treats an empty working_days list as available every day', () => {
    expect(worksOnDay({ working_days: [] }, maandag)).toBe(true);
  });

  it('allows a day that is in working_days', () => {
    expect(worksOnDay({ working_days: [1, 3, 5] }, maandag)).toBe(true);
  });

  it('blocks a day that is not in working_days', () => {
    expect(worksOnDay({ working_days: [1, 3, 5] }, dinsdag)).toBe(false);
  });

  it('counts Sunday as 0, like Date.getDay()', () => {
    const zondag = new Date('2026-08-23T10:00:00');
    expect(worksOnDay({ working_days: [0] }, zondag)).toBe(true);
    expect(worksOnDay({ working_days: [0] }, maandag)).toBe(false);
  });
});

describe('slotsForCoach', () => {
  it('gives the full club window to a coach without working_hours', () => {
    expect(slotsForCoach({}, '12:00')).toEqual(['09:00', '10:00', '11:00']);
  });

  it('drops slots before the start hour', () => {
    expect(slotsForCoach({ working_hours: { start: '11:00', end: '21:00' } }, '13:00'))
      .toEqual(['11:00', '12:00']);
  });

  it('drops slots from the end hour onwards', () => {
    expect(slotsForCoach({ working_hours: { start: '09:00', end: '11:00' } }, '13:00'))
      .toEqual(['09:00', '10:00']);
  });

  it('never gives more than the club allows', () => {
    expect(slotsForCoach({ working_hours: { start: '07:00', end: '23:00' } }, '12:00'))
      .toEqual(['09:00', '10:00', '11:00']);
  });

  it('gives nothing when start equals end', () => {
    expect(slotsForCoach({ working_hours: { start: '09:00', end: '09:00' } }, '21:00'))
      .toEqual([]);
  });
});

describe('formatWorkingDays', () => {
  it('says every day when nothing is set', () => {
    expect(formatWorkingDays({})).toBe('Elke dag');
    expect(formatWorkingDays({ working_days: [] })).toBe('Elke dag');
  });

  it('lists the days Monday first, whatever order they were stored in', () => {
    expect(formatWorkingDays({ working_days: [5, 1, 3] })).toBe('Ma · Wo · Vr');
  });

  it('puts Sunday last', () => {
    expect(formatWorkingDays({ working_days: [0, 1] })).toBe('Ma · Zo');
  });
});

describe('DAY_LABELS', () => {
  it('is indexed by Date.getDay(), so Sunday comes first', () => {
    expect(DAY_LABELS[0]).toBe('Zo');
    expect(DAY_LABELS[1]).toBe('Ma');
    expect(DAY_LABELS[6]).toBe('Za');
  });
});

describe('isDateBookable — vandaag', () => {
  const nu = new Date(2026, 7, 22, 13, 0);
  const vandaag = new Date(2026, 7, 22);
  const morgen = new Date(2026, 7, 23);
  const gisteren = new Date(2026, 7, 21);

  it('houdt vandaag dicht voor wie de uitzondering niet heeft', () => {
    expect(isDateBookable(vandaag, nu)).toBe(false);
    expect(isDateBookable(vandaag, nu, false)).toBe(false);
  });

  it('laat vandaag toe voor wie hem wel heeft', () => {
    expect(isDateBookable(vandaag, nu, true)).toBe(true);
  });

  it('houdt het verleden altijd dicht, ook met de uitzondering', () => {
    expect(isDateBookable(gisteren, nu, true)).toBe(false);
  });

  it('laat morgen voor iedereen toe', () => {
    expect(isDateBookable(morgen, nu)).toBe(true);
    expect(isDateBookable(morgen, nu, true)).toBe(true);
  });
});

describe('slotsStillToCome', () => {
  const uren = ['09:00', '10:00', '11:00', '12:00', '13:00'];

  it('laat op een andere dag alle uren staan', () => {
    const morgen = new Date(2026, 7, 23);
    const nu = new Date(2026, 7, 22, 13, 0);
    expect(slotsStillToCome(uren, morgen, nu)).toEqual(uren);
  });

  it('gooit vandaag de uren weg die al begonnen zijn', () => {
    const vandaag = new Date(2026, 7, 22);
    const nu = new Date(2026, 7, 22, 10, 30);
    expect(slotsStillToCome(uren, vandaag, nu)).toEqual(['11:00', '12:00', '13:00']);
  });

  it('rekent het uur dat nu net begint niet meer mee', () => {
    const vandaag = new Date(2026, 7, 22);
    const nu = new Date(2026, 7, 22, 11, 0);
    expect(slotsStillToCome(uren, vandaag, nu)).toEqual(['12:00', '13:00']);
  });

  it('houdt niets over als de dag erop zit', () => {
    const vandaag = new Date(2026, 7, 22);
    expect(slotsStillToCome(uren, vandaag, new Date(2026, 7, 22, 23, 0))).toEqual([]);
  });
});
