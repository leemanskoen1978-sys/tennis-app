import { lessenNu, VOOR_MS, NA_MS } from './afvinken';
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

  it('leaves out a cancelled lesson', () => {
    expect(lessenNu([les('b1', start, { status: 'cancelled' })], 'koen', op(0))).toEqual([]);
  });

  it('puts two lessons at the same time in order of start', () => {
    const laat = les('b2', '2026-09-02T14:30:00.000Z');
    expect(lessenNu([laat, les('b1', start)], 'koen', op(20 * 60_000)).map((b) => b.id))
      .toEqual(['b1', 'b2']);
  });
});
