import type { Booking } from './types';
import {
  formatUren, isDezeWeek, weekAgenda, weekLessen, weekMinuten, weekPeriod,
} from './week';
import { shiftPeriod } from './period';

/**
 * Een tijdstip in lokale tijd. De weekindeling kijkt naar de klok zoals de trainer hem
 * ziet, dus een test met een vaste UTC-string zou in de ene tijdzone slagen en in de
 * andere zakken.
 */
function lokaal(y: number, m: number, d: number, u: number, min = 0): string {
  return new Date(y, m - 1, d, u, min).toISOString();
}

function les(over: Partial<Booking> & Pick<Booking, 'start_time' | 'end_time'>): Booking {
  return {
    id: over.start_time, player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    status: 'confirmed', payment_method: 'open', ...over,
  };
}

describe('weekPeriod', () => {
  it('runs Monday to Sunday around a midweek day', () => {
    // Woensdag 26 augustus 2026.
    const week = weekPeriod(new Date(2026, 7, 26, 15, 0));
    expect(week.from.getDate()).toBe(24);
    expect(week.from.getDay()).toBe(1);
    expect(week.to.getDate()).toBe(30);
    expect(week.to.getDay()).toBe(0);
  });

  it('keeps a Sunday in the week that ends on it, not the one that starts the next day', () => {
    const week = weekPeriod(new Date(2026, 7, 30, 22, 0));
    expect(week.from.getDate()).toBe(24);
    expect(week.to.getDate()).toBe(30);
  });

  it('starts at midnight and ends just before the next one', () => {
    const week = weekPeriod(new Date(2026, 7, 26));
    expect([week.from.getHours(), week.from.getMinutes()]).toEqual([0, 0]);
    expect([week.to.getHours(), week.to.getMinutes(), week.to.getSeconds()]).toEqual([23, 59, 59]);
  });

  it('shifts a whole week at a time, also across a daylight-saving change', () => {
    // De laatste zondag van oktober 2026 valt in deze week; de dag telt 25 uur.
    const week = weekPeriod(new Date(2026, 9, 20));
    const volgende = shiftPeriod(week, 1);
    expect(volgende.from.getDate()).toBe(26);
    expect(volgende.from.getDay()).toBe(1);
    expect(volgende.to.getDate()).toBe(1);
  });
});

describe('isDezeWeek', () => {
  it('is true for the week around now and false for the one before it', () => {
    const now = new Date(2026, 7, 26, 9, 0);
    expect(isDezeWeek(weekPeriod(now), now)).toBe(true);
    expect(isDezeWeek(shiftPeriod(weekPeriod(now), -1), now)).toBe(false);
  });
});

describe('weekAgenda', () => {
  const week = weekPeriod(new Date(2026, 7, 26));

  it('always has seven days, empty ones included', () => {
    const dagen = weekAgenda([], week);
    expect(dagen).toHaveLength(7);
    expect(dagen.map((d) => d.dag.getDate())).toEqual([24, 25, 26, 27, 28, 29, 30]);
    expect(dagen.every((d) => d.minuten === 0 && d.bookings.length === 0)).toBe(true);
  });

  it('adds up the effective minutes per day', () => {
    const dagen = weekAgenda([
      les({ start_time: lokaal(2026, 8, 24, 9), end_time: lokaal(2026, 8, 24, 10) }),
      les({ start_time: lokaal(2026, 8, 24, 18), end_time: lokaal(2026, 8, 24, 19, 30) }),
      les({ start_time: lokaal(2026, 8, 26, 14), end_time: lokaal(2026, 8, 26, 15) }),
    ], week);

    expect(dagen[0].minuten).toBe(150);
    expect(dagen[2].minuten).toBe(60);
    expect(weekMinuten(dagen)).toBe(210);
    expect(weekLessen(dagen)).toBe(3);
  });

  it('leaves a cancelled lesson out of both the list and the total', () => {
    const dagen = weekAgenda([
      les({ start_time: lokaal(2026, 8, 25, 9), end_time: lokaal(2026, 8, 25, 10) }),
      les({
        start_time: lokaal(2026, 8, 25, 11), end_time: lokaal(2026, 8, 25, 12),
        status: 'cancelled',
      }),
    ], week);

    expect(dagen[1].bookings).toHaveLength(1);
    expect(dagen[1].minuten).toBe(60);
  });

  it('ignores lessons outside the week', () => {
    const dagen = weekAgenda([
      les({ start_time: lokaal(2026, 8, 23, 9), end_time: lokaal(2026, 8, 23, 10) }),
      les({ start_time: lokaal(2026, 8, 31, 9), end_time: lokaal(2026, 8, 31, 10) }),
    ], week);
    expect(weekLessen(dagen)).toBe(0);
  });

  it('keeps a late Sunday lesson in the week', () => {
    const dagen = weekAgenda([
      les({ start_time: lokaal(2026, 8, 30, 23, 30), end_time: lokaal(2026, 8, 31, 0, 30) }),
    ], week);
    expect(dagen[6].bookings).toHaveLength(1);
    expect(dagen[6].minuten).toBe(60);
  });

  it('sorts a day by starting time', () => {
    const dagen = weekAgenda([
      les({ id: 'laat', start_time: lokaal(2026, 8, 27, 18), end_time: lokaal(2026, 8, 27, 19) }),
      les({ id: 'vroeg', start_time: lokaal(2026, 8, 27, 8), end_time: lokaal(2026, 8, 27, 9) }),
    ], week);
    expect(dagen[3].bookings.map((b) => b.id)).toEqual(['vroeg', 'laat']);
  });
});

describe('formatUren', () => {
  it('writes a round hour without decimals and a half hour with one', () => {
    expect(formatUren(180)).toBe('3 u');
    expect(formatUren(90)).toBe('1,5 u');
    expect(formatUren(0)).toBe('0 u');
  });

  it('rounds a quarter of an hour to one decimal', () => {
    expect(formatUren(135)).toBe('2,3 u');
  });
});
