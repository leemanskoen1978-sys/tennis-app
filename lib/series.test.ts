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

// Een les uit een lesgroep blijft een gewone boeking (GROEP-04): te verzetten, af te zeggen
// en af te vinken als elke andere. `group_id` en `series_id` bestaan naast elkaar en nooit in
// elkaar — een reeks is de batch waarin lessen zijn aangemaakt, een groep is wie er traint —
// dus "vanaf deze les" hoort zich met een groep erbij precies hetzelfde te gedragen.
describe('seriesFrom met een group_id erbij', () => {
  it('behandelt een reeks met een groep precies als een reeks zonder', () => {
    const zonder = [week(1), week(2), week(3)];
    const met = zonder.map((b) => ({ ...b, group_id: 'g-1' }));
    expect(seriesFrom(met, 'b2').map((b) => b.id)).toEqual(seriesFrom(zonder, 'b2').map((b) => b.id));
    expect(seriesFrom(met, 'b2').map((b) => b.id)).toEqual(['b2', 'b3']);
  });

  it('geeft alleen de les zelf terug als die wel een groep heeft maar geen reeks', () => {
    // De les hoort bij een groep, maar is nooit in een batch aangemaakt: "vanaf deze les"
    // gedraagt zich dan als de gewone actie op één les, en raakt de rest van de groep niet.
    const losseGroepsles: Booking = { ...base, id: 'los', group_id: 'g-1', series_id: undefined };
    expect(seriesFrom([losseGroepsles, ...[week(1), week(2)].map((b) => ({ ...b, group_id: 'g-1' }))], 'los'))
      .toEqual([losseGroepsles]);
  });
});
