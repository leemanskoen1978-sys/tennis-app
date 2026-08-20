import type { Booking } from './types';
import {
  bookingsInPeriod, currentPeriod, customPeriod, formatDayInput, isInPeriod, monthPeriod,
  parseDayInput, pastBookings, periodFilename, periodLabel, previousMonthPeriod,
  quarterPeriod, shiftPeriod, upcomingBookings, yearPeriod,
} from './period';

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: '2026-08-20T08:00:00.000Z', end_time: '2026-08-20T09:00:00.000Z',
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

/** Een les die op deze lokale dag en dit lokale uur begint. */
function onDay(id: string, y: number, m: number, d: number, hour = 12): Booking {
  const start = new Date(y, m, d, hour, 0, 0, 0);
  const end = new Date(y, m, d, hour + 1, 0, 0, 0);
  return booking({ id, start_time: start.toISOString(), end_time: end.toISOString() });
}

describe('de soorten periode', () => {
  it('loopt bij een maand van de eerste tot en met de laatste dag', () => {
    const p = monthPeriod(new Date(2026, 7, 15));
    expect(p.kind).toBe('month');
    expect(p.from).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 31, 23, 59, 59, 999));
  });

  it('kent de lengte van februari in een schrikkeljaar', () => {
    expect(monthPeriod(new Date(2028, 1, 10)).to).toEqual(new Date(2028, 1, 29, 23, 59, 59, 999));
  });

  it('neemt bij een kwartaal de drie maanden eromheen', () => {
    const p = quarterPeriod(new Date(2026, 7, 20));
    expect(p.from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999));
  });

  it('loopt bij een jaar van 1 januari tot en met 31 december', () => {
    const p = yearPeriod(new Date(2026, 7, 20));
    expect(p.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });

  it('neemt bij een eigen periode de hele eerste en hele laatste dag', () => {
    const p = customPeriod(new Date(2026, 7, 1, 15), new Date(2026, 7, 15, 3));
    expect(p.from).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 15, 23, 59, 59, 999));
  });

  it('maakt van één dag een periode van die ene dag', () => {
    const p = customPeriod(new Date(2026, 7, 5), new Date(2026, 7, 5));
    expect(p.from).toEqual(new Date(2026, 7, 5, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 5, 23, 59, 59, 999));
  });

  it('draait een omgekeerde eigen periode om in plaats van hem leeg te laten', () => {
    const p = customPeriod(new Date(2026, 7, 15), new Date(2026, 7, 1));
    expect(p.from).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 15, 23, 59, 59, 999));
  });

  it('opent op de huidige maand', () => {
    expect(currentPeriod(new Date(2026, 7, 20))).toEqual(monthPeriod(new Date(2026, 7, 1)));
  });

  it('geeft de vorige maand, ook over een jaargrens heen', () => {
    expect(previousMonthPeriod(new Date(2026, 0, 15)).from).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0));
  });
});

describe('bladeren', () => {
  it('gaat een maand terug over de jaargrens heen', () => {
    const p = shiftPeriod(monthPeriod(new Date(2026, 0, 10)), -1);
    expect(p.from).toEqual(new Date(2025, 11, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999));
  });

  it('gaat een kwartaal vooruit over de jaargrens heen', () => {
    const p = shiftPeriod(quarterPeriod(new Date(2026, 10, 1)), 1);
    expect(p.kind).toBe('quarter');
    expect(p.from).toEqual(new Date(2027, 0, 1, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2027, 2, 31, 23, 59, 59, 999));
  });

  it('gaat een jaar terug', () => {
    expect(shiftPeriod(yearPeriod(new Date(2026, 5, 1)), -1).from).toEqual(new Date(2025, 0, 1, 0, 0, 0, 0));
  });

  it('schuift een eigen periode op met zijn eigen lengte', () => {
    const p = shiftPeriod(customPeriod(new Date(2026, 7, 15), new Date(2026, 7, 21)), -1);
    expect(p.from).toEqual(new Date(2026, 7, 8, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 14, 23, 59, 59, 999));
  });

  it('houdt een eigen periode van één dag één dag lang', () => {
    const p = shiftPeriod(customPeriod(new Date(2026, 7, 5), new Date(2026, 7, 5)), 1);
    expect(p.from).toEqual(new Date(2026, 7, 6, 0, 0, 0, 0));
    expect(p.to).toEqual(new Date(2026, 7, 6, 23, 59, 59, 999));
  });

  it('brengt heen en terug bladeren op dezelfde periode uit', () => {
    const start = monthPeriod(new Date(2026, 7, 1));
    expect(shiftPeriod(shiftPeriod(start, 1), -1)).toEqual(start);
  });
});

describe('periodLabel', () => {
  it('noemt een maand bij naam en jaar', () => {
    expect(periodLabel(monthPeriod(new Date(2026, 7, 1)))).toBe('augustus 2026');
  });

  it('nummert een kwartaal', () => {
    expect(periodLabel(quarterPeriod(new Date(2026, 7, 1)))).toBe('3e kwartaal 2026');
    expect(periodLabel(quarterPeriod(new Date(2026, 0, 1)))).toBe('1e kwartaal 2026');
  });

  it('noemt een jaar alleen bij het jaartal', () => {
    expect(periodLabel(yearPeriod(new Date(2026, 3, 1)))).toBe('2026');
  });

  it('schrijft een eigen periode uit met het jaartal achteraan', () => {
    expect(periodLabel(customPeriod(new Date(2026, 7, 1), new Date(2026, 7, 15))))
      .toBe('1 aug – 15 aug 2026');
  });

  it('zet bij een eigen periode over de jaargrens beide jaartallen erbij', () => {
    expect(periodLabel(customPeriod(new Date(2026, 11, 28), new Date(2027, 0, 3))))
      .toBe('28 dec 2026 – 3 jan 2027');
  });

  it('schrijft een eigen periode van één dag als die ene dag', () => {
    expect(periodLabel(customPeriod(new Date(2026, 7, 5), new Date(2026, 7, 5)))).toBe('5 aug 2026');
  });
});

describe('periodFilename', () => {
  it('zet de maand in de bestandsnaam', () => {
    expect(periodFilename(monthPeriod(new Date(2026, 7, 1)))).toBe('lessen-2026-08.csv');
  });

  it('zet het kwartaal in de bestandsnaam', () => {
    expect(periodFilename(quarterPeriod(new Date(2026, 7, 1)))).toBe('lessen-2026-K3.csv');
  });

  it('zet het jaar in de bestandsnaam', () => {
    expect(periodFilename(yearPeriod(new Date(2026, 7, 1)))).toBe('lessen-2026.csv');
  });

  it('zet beide datums in de bestandsnaam van een eigen periode', () => {
    expect(periodFilename(customPeriod(new Date(2026, 7, 1), new Date(2026, 7, 15))))
      .toBe('lessen-2026-08-01-tot-2026-08-15.csv');
  });
});

describe('bookingsInPeriod', () => {
  const august = monthPeriod(new Date(2026, 7, 1));

  it('houdt alleen de lessen binnen de periode over', () => {
    const kept = bookingsInPeriod([onDay('b1', 2026, 7, 20), onDay('b2', 2026, 8, 2)], august);
    expect(kept.map((b) => b.id)).toEqual(['b1']);
  });

  it('telt een les op de eerste dag mee, ook vroeg in de ochtend', () => {
    expect(bookingsInPeriod([onDay('b1', 2026, 7, 1, 0)], august)).toHaveLength(1);
  });

  it('telt een les op de laatste dag mee, ook laat op de avond', () => {
    expect(bookingsInPeriod([onDay('b1', 2026, 7, 31, 23)], august)).toHaveLength(1);
  });

  it('laat de eerste dag van de volgende maand buiten deze periode', () => {
    expect(bookingsInPeriod([onDay('b1', 2026, 8, 1, 0)], august)).toHaveLength(0);
    expect(bookingsInPeriod([onDay('b1', 2026, 8, 1, 0)], monthPeriod(new Date(2026, 8, 1)))).toHaveLength(1);
  });

  it('houdt bij een eigen periode van één dag alleen die dag over', () => {
    const oneDay = customPeriod(new Date(2026, 7, 5), new Date(2026, 7, 5));
    const kept = bookingsInPeriod(
      [onDay('b1', 2026, 7, 4, 23), onDay('b2', 2026, 7, 5, 0), onDay('b3', 2026, 7, 5, 23), onDay('b4', 2026, 7, 6, 0)],
      oneDay,
    );
    expect(kept.map((b) => b.id)).toEqual(['b2', 'b3']);
  });

  it('sorteert op begintijd', () => {
    const kept = bookingsInPeriod([onDay('b2', 2026, 7, 25), onDay('b1', 2026, 7, 20)], august);
    expect(kept.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('laat de gegeven lijst ongemoeid', () => {
    const given = [onDay('b2', 2026, 7, 25), onDay('b1', 2026, 7, 20)];
    bookingsInPeriod(given, august);
    expect(given.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('laat een onleesbare begintijd weg in plaats van hem te tonen', () => {
    expect(bookingsInPeriod([booking({ start_time: 'niet-een-datum' })], august)).toEqual([]);
  });

  it('geeft niets terug voor een lege periode', () => {
    expect(bookingsInPeriod([onDay('b1', 2026, 7, 20)], monthPeriod(new Date(2026, 0, 1)))).toEqual([]);
  });
});

describe('isInPeriod', () => {
  it('telt de grenzen zelf mee', () => {
    const p = customPeriod(new Date(2026, 7, 1), new Date(2026, 7, 1));
    expect(isInPeriod(new Date(2026, 7, 1, 0, 0, 0, 0).toISOString(), p)).toBe(true);
    expect(isInPeriod(new Date(2026, 7, 1, 23, 59, 59, 999).toISOString(), p)).toBe(true);
    expect(isInPeriod(new Date(2026, 7, 2, 0, 0, 0, 0).toISOString(), p)).toBe(false);
  });
});

describe('geweest en nog te komen', () => {
  const now = new Date(2026, 7, 20, 12, 0, 0, 0);

  it('scheidt de lessen op het huidige tijdstip', () => {
    const given = [onDay('later', 2026, 7, 20, 14), onDay('eerder', 2026, 7, 20, 9)];
    expect(pastBookings(given, now).map((b) => b.id)).toEqual(['eerder']);
    expect(upcomingBookings(given, now).map((b) => b.id)).toEqual(['later']);
  });

  it('rekent een les die precies nu begint tot wat nog komt', () => {
    const given = [onDay('nu', 2026, 7, 20, 12)];
    expect(upcomingBookings(given, now)).toHaveLength(1);
    expect(pastBookings(given, now)).toHaveLength(0);
  });

  it('laat een geannuleerde les weg uit wat nog komt, maar niet uit de historiek', () => {
    const later = { ...onDay('b1', 2026, 7, 25), status: 'cancelled' as const };
    const earlier = { ...onDay('b2', 2026, 7, 10), status: 'cancelled' as const };
    expect(upcomingBookings([later], now)).toEqual([]);
    expect(pastBookings([earlier], now)).toHaveLength(1);
  });

  it('sorteert allebei op begintijd', () => {
    const given = [onDay('b3', 2026, 7, 25), onDay('b1', 2026, 7, 21), onDay('b2', 2026, 7, 22)];
    expect(upcomingBookings(given, now).map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });
});

describe('parseDayInput', () => {
  it('leest 1/8/2026 en 01-08-2026 als dezelfde dag', () => {
    expect(parseDayInput('1/8/2026')).toEqual(new Date(2026, 7, 1));
    expect(parseDayInput('01-08-2026')).toEqual(new Date(2026, 7, 1));
  });

  it('leest ook de omgekeerde schrijfwijze 2026-08-01', () => {
    expect(parseDayInput('2026-08-01')).toEqual(new Date(2026, 7, 1));
  });

  it('geeft niets terug voor een dag die niet bestaat', () => {
    expect(parseDayInput('31/02/2026')).toBeNull();
    expect(parseDayInput('32/01/2026')).toBeNull();
  });

  it('geeft niets terug voor onzin', () => {
    expect(parseDayInput('')).toBeNull();
    expect(parseDayInput('vandaag')).toBeNull();
    expect(parseDayInput('1/8/26')).toBeNull();
  });

  it('leest terug wat het invulveld toont', () => {
    const d = new Date(2026, 7, 5);
    expect(parseDayInput(formatDayInput(d))).toEqual(d);
  });
});
