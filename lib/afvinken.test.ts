import { KOMEND_AANTAL, komendeLessen, lessenNu, toonDagErbij, VOOR_MS, NA_MS } from './afvinken';
import type { Booking } from './types';

const les = (id: string, startISO: string, patch: Partial<Booking> = {}): Booking => ({
  id,
  player_id: 'p1',
  coach_id: 'koen',
  court_id: 'court-1',
  start_time: startISO,
  end_time: new Date(new Date(startISO).getTime() + 3_600_000).toISOString(),
  status: 'confirmed',
  payment_method: 'open',
  ...patch,
});

const start = '2026-09-02T14:00:00.000Z';
const op = (offsetMs: number): Date => new Date(new Date(start).getTime() + offsetMs);

describe('lessenNu', () => {
  it('finds the lesson that is running right now', () => {
    expect(lessenNu([les('b1', start)], 'koen', op(20 * 60_000)).map((b) => b.id)).toEqual(['b1']);
  });

  it('already shows it shortly before the hour, but not long before', () => {
    expect(lessenNu([les('b1', start)], 'koen', op(-VOOR_MS)).map((b) => b.id)).toEqual(['b1']);
    expect(lessenNu([les('b1', start)], 'koen', op(-VOOR_MS - 60_000))).toEqual([]);
  });

  it('keeps it around for a while after the lesson, but not all day', () => {
    expect(lessenNu([les('b1', start)], 'koen', op(3_600_000 + NA_MS)).map((b) => b.id)).toEqual(['b1']);
    expect(lessenNu([les('b1', start)], 'koen', op(3_600_000 + NA_MS + 60_000))).toEqual([]);
  });

  it('leaves out the lessons of another coach', () => {
    const lessen = [les('b1', start), les('b2', start, { coach_id: 'leslie' })];
    expect(lessenNu(lessen, 'koen', op(0)).map((b) => b.id)).toEqual(['b1']);
  });

  it('shows the lesson to the stand-in who gives it, not to the absent coach', () => {
    const vervangen = [les('b1', start, { taught_by_id: 'leslie' })];
    expect(lessenNu(vervangen, 'leslie', op(0)).map((b) => b.id)).toEqual(['b1']);
    expect(lessenNu(vervangen, 'koen', op(0))).toEqual([]);
  });

  it('leaves out a cancelled lesson', () => {
    expect(lessenNu([les('b1', start, { status: 'cancelled' })], 'koen', op(0))).toEqual([]);
  });

  it('puts two lessons at the same time in order of start', () => {
    const laat = les('b2', '2026-09-02T14:30:00.000Z');
    expect(lessenNu([laat, les('b1', start)], 'koen', op(20 * 60_000)).map((b) => b.id))
      .toEqual(['b1', 'b2']);
  });
});

// Het uur na deze les, waar `lessenNu` niet meer bij kan: `NA_MS` houdt een les nog een
// halfuur vast, dus alles wat hierna begint is onbetwistbaar "komend".
const laterOpDeDag = '2026-09-02T17:00:00.000Z';

describe('komendeLessen', () => {
  it('shows the next lessons in order of start', () => {
    const lessen = [les('b3', '2026-09-04T14:00:00.000Z'), les('b2', '2026-09-03T14:00:00.000Z'),
      les('b1', laterOpDeDag)];
    expect(komendeLessen(lessen, 'koen', op(0)).map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('leaves out what the screen already shows on top', () => {
    // De les die nú loopt hoort bovenaan en niet nog eens in het lijstje eronder.
    const lessen = [les('b1', start), les('b2', laterOpDeDag)];
    expect(komendeLessen(lessen, 'koen', op(20 * 60_000)).map((b) => b.id)).toEqual(['b2']);
  });

  it('hands a lesson over the moment its own window opens', () => {
    const lessen = [les('b1', start)];
    expect(komendeLessen(lessen, 'koen', op(-VOOR_MS - 60_000)).map((b) => b.id)).toEqual(['b1']);
    expect(komendeLessen(lessen, 'koen', op(-VOOR_MS))).toEqual([]);
  });

  it('does not bring back a lesson that is over', () => {
    expect(komendeLessen([les('b1', start)], 'koen', op(3_600_000 + NA_MS + 60_000))).toEqual([]);
  });

  it('stops at three, however full the season is', () => {
    const lessen = [1, 2, 3, 4, 5].map((n) => les(`b${n}`, `2026-09-0${n + 2}T14:00:00.000Z`));
    expect(komendeLessen(lessen, 'koen', op(0)).map((b) => b.id))
      .toEqual(['b1', 'b2', 'b3', 'b4', 'b5'].slice(0, KOMEND_AANTAL));
  });

  it('leaves out a cancelled lesson', () => {
    const lessen = [les('b1', laterOpDeDag, { status: 'cancelled' }), les('b2', laterOpDeDag)];
    expect(komendeLessen(lessen, 'koen', op(0)).map((b) => b.id)).toEqual(['b2']);
  });

  it('leaves out the lessons of another coach', () => {
    const lessen = [les('b1', laterOpDeDag), les('b2', laterOpDeDag, { coach_id: 'leslie' })];
    expect(komendeLessen(lessen, 'koen', op(0)).map((b) => b.id)).toEqual(['b1']);
  });

  it('shows the lesson to the stand-in who gives it, not to the absent coach', () => {
    const vervangen = [les('b1', laterOpDeDag, { taught_by_id: 'leslie' })];
    expect(komendeLessen(vervangen, 'leslie', op(0)).map((b) => b.id)).toEqual(['b1']);
    expect(komendeLessen(vervangen, 'koen', op(0))).toEqual([]);
  });

  it('skips a lesson with an unreadable date instead of listing it', () => {
    const lessen = [les('b1', laterOpDeDag), { ...les('b2', laterOpDeDag), start_time: 'ooit' }];
    expect(komendeLessen(lessen, 'koen', op(0)).map((b) => b.id)).toEqual(['b1']);
  });
});

describe('toonDagErbij', () => {
  // Op de lokale klok gerekend, want dat is de dag die de trainer op zijn scherm leest.
  const dag = (y: number, m: number, d: number, u: number): Date => new Date(y, m, d, u, 0, 0);

  it('leaves the day off for a lesson later today', () => {
    expect(toonDagErbij(dag(2026, 8, 2, 18).toISOString(), dag(2026, 8, 2, 14))).toBe(false);
  });

  it('puts the day on a lesson of tomorrow, however close it is', () => {
    // 23:30 en 00:30: een half uur later, en tóch een andere dag. Zonder de dag erbij leest
    // "00:30" als straks, en dat is precies de vergissing die dit voorkomt.
    expect(toonDagErbij(dag(2026, 8, 3, 0).toISOString(), dag(2026, 8, 2, 23))).toBe(true);
  });

  it('puts the day on the same date in another month or year', () => {
    expect(toonDagErbij(dag(2026, 9, 2, 14).toISOString(), dag(2026, 8, 2, 14))).toBe(true);
    expect(toonDagErbij(dag(2027, 8, 2, 14).toISOString(), dag(2026, 8, 2, 14))).toBe(true);
  });

  it('says no on an unreadable date, so no day gets invented', () => {
    expect(toonDagErbij('ooit', dag(2026, 8, 2, 14))).toBe(false);
  });
});
