import { lesdagVan, lesdagVanSpeler } from './lesdag';
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

describe('lesdagVanSpeler', () => {
  it('geeft de lessen van vandaag, op tijd oplopend', () => {
    const laat = les('l2', OM(19), OM(20));
    const vroeg = les('l1', OM(17), OM(18));
    const dag = lesdagVanSpeler([laat, vroeg], 'mathis', NU(12));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1', 'l2']);
    expect(dag.volgende).toBeNull();
  });

  // Een les die al voorbij is blijft staan: hij is vandaag geweest, en dat is wat het blok
  // vertelt. Zo klopt het ook met de lesdag van de trainer.
  it('houdt een les van vanochtend erin', () => {
    const dag = lesdagVanSpeler([les('l1', OM(9), OM(10))], 'mathis', NU(20));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
  });

  it('laat een geannuleerde les weg', () => {
    const dag = lesdagVanSpeler(
      [les('l1', OM(17), OM(18), { status: 'cancelled' })], 'mathis', NU(12),
    );
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende).toBeNull();
  });

  // Meespelen telt: een deelnemer aan een groepsles moet zijn les net zo goed zien als de
  // betaler. Dezelfde regel als in zijn dossier (`playsIn`).
  it('telt een groepsles mee waarin hij meespeelt zonder betaler te zijn', () => {
    const groep = les('l1', OM(17), OM(18), { player_id: 'lotte', participant_ids: ['lotte', 'mathis'] });
    const dag = lesdagVanSpeler([groep], 'mathis', NU(12));
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
  });

  it('laat de les van een ander weg', () => {
    const dag = lesdagVanSpeler([les('l1', OM(17), OM(18), { player_id: 'lotte' })], 'mathis', NU(12));
    expect(dag.vandaag).toEqual([]);
  });

  // Staat er vandaag niets, dan is de eerstvolgende les het antwoord op "wanneer heb ik les".
  it('geeft de eerstvolgende les als vandaag leeg is', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const morgenEind = new Date(2026, 7, 26, 18).toISOString();
    const overmorgen = new Date(2026, 7, 27, 17).toISOString();
    const overmorgenEind = new Date(2026, 7, 27, 18).toISOString();
    const dag = lesdagVanSpeler(
      [les('l2', overmorgen, overmorgenEind), les('l1', morgen, morgenEind)],
      'mathis', NU(12),
    );
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende?.id).toBe('l1');
  });

  it('heeft geen volgende les als er alleen verleden is', () => {
    const gisteren = new Date(2026, 7, 24, 17).toISOString();
    const gisterenEind = new Date(2026, 7, 24, 18).toISOString();
    const dag = lesdagVanSpeler([les('l1', gisteren, gisterenEind)], 'mathis', NU(12));
    expect(dag.vandaag).toEqual([]);
    expect(dag.volgende).toBeNull();
  });

  // Is er vandaag wél les, dan is de volgende niet interessant: het blok toont er één ding.
  it('laat de volgende leeg zolang er vandaag les is', () => {
    const morgen = new Date(2026, 7, 26, 17).toISOString();
    const morgenEind = new Date(2026, 7, 26, 18).toISOString();
    const dag = lesdagVanSpeler(
      [les('l1', OM(17), OM(18)), les('l2', morgen, morgenEind)], 'mathis', NU(12),
    );
    expect(dag.vandaag.map((b) => b.id)).toEqual(['l1']);
    expect(dag.volgende).toBeNull();
  });
});
