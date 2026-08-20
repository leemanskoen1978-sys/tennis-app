import { seriesFrom } from './series';
import type { Booking } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

/** Een reeks van vier weken, zoals de provider hem aanmaakt. */
const week = (n: number, extra: Partial<Booking> = {}): Booking => {
  const day = new Date(`2026-08-20T10:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 7 * (n - 1));
  const start = day.toISOString();
  day.setUTCHours(day.getUTCHours() + 1);
  return {
    ...base,
    id: `b${n}`,
    series_id: 'r1',
    start_time: start,
    end_time: day.toISOString(),
    ...extra,
  };
};

describe('seriesFrom', () => {
  it('returns nothing for an unknown booking', () => {
    expect(seriesFrom([week(1)], 'weg')).toEqual([]);
  });

  it('returns only the lesson itself when it is not part of a series', () => {
    const loose = { ...base, id: 'los' };
    expect(seriesFrom([loose, week(1)], 'los')).toEqual([loose]);
  });

  it('takes this lesson and every later one from the same series', () => {
    const list = [week(1), week(2), week(3)];
    expect(seriesFrom(list, 'b2').map((b) => b.id)).toEqual(['b2', 'b3']);
  });

  it('never touches earlier lessons — the past stays as it is', () => {
    const list = [week(1), week(2), week(3)];
    expect(seriesFrom(list, 'b3').map((b) => b.id)).toEqual(['b3']);
  });

  it('leaves other series and loose lessons alone', () => {
    const other = { ...week(2), id: 'x', series_id: 'r2' };
    const loose = { ...week(2), id: 'los', series_id: undefined };
    const list = [week(1), other, loose, week(2), week(3)];
    expect(seriesFrom(list, 'b1').map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('sorts by time, whatever order the store keeps them in', () => {
    const list = [week(3), week(1), week(2)];
    expect(seriesFrom(list, 'b1').map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('includes a lesson that starts at exactly the same moment', () => {
    const twin = { ...week(2), id: 'tweeling' };
    expect(seriesFrom([week(2), twin], 'b2').map((b) => b.id)).toEqual(['b2', 'tweeling']);
  });

  it('takes a lesson that was moved earlier along only when it is still later', () => {
    // Eén les uit de reeks is verzet naar een dag vóór de gekozen les: die blijft staan.
    const verzet = { ...week(3), start_time: '2026-08-21T10:00:00.000Z' };
    const list = [week(1), week(2), verzet];
    expect(seriesFrom(list, 'b2').map((b) => b.id)).toEqual(['b2']);
  });
});
