import {
  urenOp, urenTussen, slotsOp, boekbaarOp, periodeOp, sorteerPeriodes, periodeFout, keuzeUren,
} from './boekingstijd';
import type { Boekingsperiode, User } from './types';

const t = (nl: string): string => nl;
const trainer = (patch: Partial<User> = {}): Pick<User, 'working_hours' | 'booking_periods'> => ({
  working_hours: patch.working_hours,
  booking_periods: patch.booking_periods,
});

const zomer: Boekingsperiode = {
  id: 'p1', naam: 'Zomerrooster', van: '2026-07-01', tot: '2026-08-15',
  uren: { start: '08:00', end: '12:00' },
};
const weg: Boekingsperiode = { id: 'p2', van: '2026-09-07', tot: '2026-09-11' };

const dag = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

describe('urenOp', () => {
  it('falls back to the club window for a coach who set nothing', () => {
    expect(urenOp(trainer(), dag('2026-09-02'), '21:00')).toEqual({ start: '09:00', end: '21:00' });
  });

  it('uses the coach his own hours, also outside the club window', () => {
    const koen = trainer({ working_hours: { start: '10:00', end: '22:00' } });
    expect(urenOp(koen, dag('2026-09-02'), '21:00')).toEqual({ start: '10:00', end: '22:00' });
  });

  it('lets a period win from the standard', () => {
    const koen = trainer({
      working_hours: { start: '10:00', end: '22:00' },
      booking_periods: [zomer],
    });
    expect(urenOp(koen, dag('2026-07-20'), '21:00')).toEqual({ start: '08:00', end: '12:00' });
    // Buiten de periode geldt de standaard weer.
    expect(urenOp(koen, dag('2026-09-02'), '21:00')).toEqual({ start: '10:00', end: '22:00' });
  });

  it('counts both edges of a period', () => {
    const koen = trainer({ booking_periods: [zomer] });
    expect(urenOp(koen, dag('2026-07-01'), '21:00')).toEqual({ start: '08:00', end: '12:00' });
    expect(urenOp(koen, dag('2026-08-15'), '21:00')).toEqual({ start: '08:00', end: '12:00' });
    expect(urenOp(koen, dag('2026-08-16'), '21:00')).toEqual({ start: '09:00', end: '21:00' });
  });

  it('gives no hours at all for a period without hours', () => {
    const koen = trainer({ working_hours: { start: '09:00', end: '21:00' }, booking_periods: [weg] });
    expect(urenOp(koen, dag('2026-09-09'), '21:00')).toBeNull();
    expect(boekbaarOp(koen, dag('2026-09-09'), '21:00')).toBe(false);
    expect(boekbaarOp(koen, dag('2026-09-12'), '21:00')).toBe(true);
  });

  it('lets the first period win when two overlap', () => {
    const later: Boekingsperiode = {
      id: 'p3', van: '2026-07-10', tot: '2026-07-20', uren: { start: '18:00', end: '20:00' },
    };
    const koen = trainer({ booking_periods: [zomer, later] });
    expect(urenOp(koen, dag('2026-07-15'), '21:00')).toEqual({ start: '08:00', end: '12:00' });
  });

  it('reads a period that was filled in back to front', () => {
    const omgekeerd: Boekingsperiode = {
      id: 'p4', van: '2026-07-20', tot: '2026-07-10', uren: { start: '18:00', end: '20:00' },
    };
    expect(periodeOp(trainer({ booking_periods: [omgekeerd] }), dag('2026-07-15'))?.id).toBe('p4');
  });

  it('ignores a period with a broken date', () => {
    const kapot: Boekingsperiode = { id: 'p5', van: 'ooit', tot: '2026-07-10' };
    expect(periodeOp(trainer({ booking_periods: [kapot] }), dag('2026-07-05'))).toBeNull();
  });
});

describe('urenTussen', () => {
  it('gives whole hours, the closing hour excluded', () => {
    expect(urenTussen('09:00', '12:00')).toEqual(['09:00', '10:00', '11:00']);
    expect(urenTussen('09:00', '09:00')).toEqual([]);
  });
});

describe('slotsOp', () => {
  it('runs from the coach his own start to his own end', () => {
    const koen = trainer({ working_hours: { start: '19:00', end: '22:00' } });
    expect(slotsOp(koen, dag('2026-09-02'), '21:00')).toEqual(['19:00', '20:00', '21:00']);
  });
});

describe('sorteerPeriodes', () => {
  it('sorts by first day and drops the broken ones', () => {
    const kapot: Boekingsperiode = { id: 'p5', van: 'ooit', tot: '2026-07-10' };
    expect(sorteerPeriodes([weg, zomer, kapot]).map((p) => p.id)).toEqual(['p1', 'p2']);
  });
});

describe('periodeFout', () => {
  it('asks for both days first', () => {
    expect(periodeFout('', '2026-07-01', null, t)).toBe('Vul beide dagen in als dd/mm/jjjj.');
  });

  it('refuses hours that end before they start', () => {
    expect(periodeFout('2026-07-01', '2026-07-05', { start: '12:00', end: '09:00' }, t))
      .toBe('Kies een van-uur en een tot-uur, met het van-uur eerst.');
  });

  it('is happy with a closed period', () => {
    expect(periodeFout('2026-07-01', '2026-07-05', null, t)).toBeNull();
  });
});

describe('keuzeUren', () => {
  it('runs the whole day, so a coach can sit outside the club window', () => {
    const uren = keuzeUren();
    expect(uren[0]).toBe('06:00');
    expect(uren[uren.length - 1]).toBe('23:00');
  });
});
