import { lesdagVan } from './lesdag';
import type { Booking } from './types';

/** Een les op een gekozen dag en uur, van trainer `koen`, tenzij anders gezegd. */
const les = (id: string, start: string, eind: string, over: Partial<Booking> = {}): Booking => ({
  id,
  player_id: 'mathis',
  coach_id: 'koen',
  court_id: 'baan2',
  start_time: start,
  end_time: eind,
  status: 'confirmed',
  payment_method: 'open',
  ...over,
});

// Alles speelt zich af op dinsdag 25 augustus 2026, in lokale tijd — dezelfde dagbepaling
// als `bookingsOnDay` gebruikt.
const OM = (uur: number, minuut = 0): string =>
  new Date(2026, 7, 25, uur, minuut).toISOString();
const NU = (uur: number, minuut = 0): Date => new Date(2026, 7, 25, uur, minuut);

describe('lesdagVan', () => {
  it('is leeg op een dag zonder lessen', () => {
    expect(lesdagVan([], 'koen', NU(17))).toEqual([]);
  });

  it('geeft de lessen van vandaag op tijd oplopend', () => {
    const dag = lesdagVan(
      [les('c', OM(19), OM(20)), les('a', OM(17), OM(18)), les('b', OM(18), OM(19))],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.booking.id)).toEqual(['a', 'b', 'c']);
  });

  it('laat de lessen van een andere trainer weg', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(18), OM(19), { coach_id: 'sanne' })],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.booking.id)).toEqual(['a']);
  });

  it('laat een geannuleerde les weg', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18), { status: 'cancelled' })],
      'koen',
      NU(17, 30),
    );
    expect(dag).toEqual([]);
  });

  it('laat een les van een andere dag weg', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const dag = lesdagVan([les('a', morgen, morgen)], 'koen', NU(17, 30));
    expect(dag).toEqual([]);
  });

  it('zet de betaler voorop en de meespelers erachter', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18), { participant_ids: ['lotte', 'sam'] })],
      'koen',
      NU(17, 30),
    );
    expect(dag[0].playerIds).toEqual(['mathis', 'lotte', 'sam']);
  });

  it('weet welke les nu bezig is, en klapt die open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(18), OM(19))],
      'koen',
      NU(17, 30),
    );
    expect(dag.map((l) => l.loopt)).toEqual([true, false]);
    expect(dag.map((l) => l.open)).toEqual([true, false]);
  });

  it('rekent het einde niet meer tot de les', () => {
    const dag = lesdagVan([les('a', OM(17), OM(18))], 'koen', NU(18));
    expect(dag[0].loopt).toBe(false);
    expect(dag[0].voorbij).toBe(true);
  });

  it('klapt tussen twee lessen de eerstvolgende open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(18, 30),
    );
    expect(dag.map((l) => l.open)).toEqual([false, true]);
    expect(dag.map((l) => l.voorbij)).toEqual([true, false]);
  });

  it('klapt voor de eerste les die eerste les open', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(16, 45),
    );
    expect(dag.map((l) => l.open)).toEqual([true, false]);
  });

  it('klapt na de laatste les die laatste open, want daar gaat een memo achteraf over', () => {
    const dag = lesdagVan(
      [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
      'koen',
      NU(21),
    );
    expect(dag.map((l) => l.voorbij)).toEqual([true, true]);
    expect(dag.map((l) => l.open)).toEqual([false, true]);
  });

  it('klapt er altijd precies een open zolang er lessen zijn', () => {
    for (const uur of [16, 17, 18, 19, 20, 21]) {
      const dag = lesdagVan(
        [les('a', OM(17), OM(18)), les('b', OM(19), OM(20))],
        'koen',
        NU(uur, 30),
      );
      expect(dag.filter((l) => l.open)).toHaveLength(1);
    }
  });
});
