// De uurwisseltest heeft een tijdzone nodig die de klok écht verzet; op een machine in
// UTC zou hij groen worden zonder iets te bewijzen. Dit is de zone waarin de club staat.
process.env.TZ = 'Europe/Brussels';

import type { Booking } from './types';
import { MAX_LESSONS, laatsteDagVan, planSeries, seriesSummary, type RecurrenceRule } from './recurrence';

/** Een les op een lokale dag en uur; ISO eruit, precies zoals de app zelf boekt. */
function iso(y: number, m: number, d: number, hour: number, minute = 0): string {
  return new Date(y, m, d, hour, minute, 0, 0).toISOString();
}

function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
    start_time: iso(2026, 7, 20, 10), end_time: iso(2026, 7, 20, 11),
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

/** Een bezette les van koen op deze lokale dag, van 10:00 tot 11:00. */
function busy(id: string, y: number, m: number, d: number, hour = 10): Booking {
  return booking({ id, start_time: iso(y, m, d, hour), end_time: iso(y, m, d, hour + 1) });
}

const weekly: RecurrenceRule = { frequency: 'weekly', until: '2026-09-17' };

/** De lokale begindagen van een reeks, als "d/m", zodat een test leesbaar blijft. */
function days(slots: { start_time: string }[]): string[] {
  return slots.map((s) => {
    const d = new Date(s.start_time);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
}

describe('de reeks opbouwen', () => {
  it('begint bij de eerste les en herhaalt wekelijks tot en met de einddag', () => {
    // 20 aug 2026 is een donderdag; tot en met 17 sep zijn dat vijf donderdagen.
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', []);
    expect(days(plan.usable)).toEqual(['20/8', '27/8', '3/9', '10/9', '17/9']);
    expect(plan.skipped).toEqual([]);
  });

  it('houdt bij tweewekelijks één week over en loopt gewoon de maandgrens over', () => {
    const rule: RecurrenceRule = { frequency: 'biweekly', until: '2026-10-01' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(days(plan.usable)).toEqual(['20/8', '3/9', '17/9', '1/10']);
  });

  it('loopt over de jaargrens zonder de datum kwijt te raken', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2027-01-14' };
    const plan = planSeries(iso(2026, 11, 24, 10), iso(2026, 11, 24, 11), rule, 'koen', []);
    expect(days(plan.usable)).toEqual(['24/12', '31/12', '7/1', '14/1']);
    expect(new Date(plan.usable[3].start_time).getFullYear()).toBe(2027);
  });

  it('houdt het lesuur vast over de zomer-winteruurwissel heen', () => {
    // Eind oktober gaat de klok een uur terug; een les van 10:00 blijft 10:00.
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2026-11-12' };
    const plan = planSeries(iso(2026, 9, 15, 10), iso(2026, 9, 15, 11, 30), rule, 'koen', []);
    expect(plan.usable).toHaveLength(5);
    for (const slot of plan.usable) {
      const s = new Date(slot.start_time);
      const e = new Date(slot.end_time);
      expect([s.getHours(), s.getMinutes()]).toEqual([10, 0]);
      expect([e.getHours(), e.getMinutes()]).toEqual([11, 30]);
    }
  });

  it('geeft de lessen op tijd oplopend terug', () => {
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', []);
    const times = plan.usable.map((s) => new Date(s.start_time).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('de randen van de einddag', () => {
  it('geeft één les als de einddag de dag van de eerste les zelf is', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2026-08-20' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(days(plan.usable)).toEqual(['20/8']);
  });

  it('telt een avondles op de einddag nog mee', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2026-08-27' };
    const plan = planSeries(iso(2026, 7, 20, 21), iso(2026, 7, 20, 22), rule, 'koen', []);
    expect(days(plan.usable)).toEqual(['20/8', '27/8']);
  });

  it('geeft een lege reeks als de einddag vóór de eerste les ligt', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2026-08-19' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(plan).toEqual({ usable: [], skipped: [] });
  });
});

describe('botsingen met een bestaande boeking', () => {
  it('slaat alleen de eerste les over als daar al een les staat', () => {
    const plan = planSeries(
      iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen',
      [busy('bezet', 2026, 7, 20)],
    );
    expect(days(plan.skipped)).toEqual(['20/8']);
    expect(days(plan.usable)).toEqual(['27/8', '3/9', '10/9', '17/9']);
  });

  it('kan de hele reeks overslaan als de trainer elke week al bezet is', () => {
    const bezet = [20, 27].map((d) => busy(`a${d}`, 2026, 7, d))
      .concat([3, 10, 17].map((d) => busy(`s${d}`, 2026, 8, d)));
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', bezet);
    expect(plan.usable).toEqual([]);
    expect(days(plan.skipped)).toEqual(['20/8', '27/8', '3/9', '10/9', '17/9']);
  });

  it('botst ook bij gedeeltelijke overlap, maar niet als de lessen op elkaar aansluiten', () => {
    const overlapt = booking({ id: 'x', start_time: iso(2026, 7, 27, 10, 30), end_time: iso(2026, 7, 27, 11, 30) });
    const sluitAan = booking({ id: 'y', start_time: iso(2026, 8, 3, 11), end_time: iso(2026, 8, 3, 12) });
    const plan = planSeries(
      iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', [overlapt, sluitAan],
    );
    expect(days(plan.skipped)).toEqual(['27/8']);
    expect(days(plan.usable)).toEqual(['20/8', '3/9', '10/9', '17/9']);
  });

  it('laat een les van een andere trainer de reeks niet blokkeren', () => {
    const andere = booking({ id: 'x', coach_id: 'sofie', start_time: iso(2026, 7, 20, 10), end_time: iso(2026, 7, 20, 11) });
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', [andere]);
    expect(plan.skipped).toEqual([]);
    expect(plan.usable).toHaveLength(5);
  });

  it('houdt een geannuleerde les niet voor bezet', () => {
    const geannuleerd = booking({ ...busy('x', 2026, 7, 20), status: 'cancelled' });
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', [geannuleerd]);
    expect(plan.skipped).toEqual([]);
    expect(days(plan.usable)).toEqual(['20/8', '27/8', '3/9', '10/9', '17/9']);
  });
});

describe('onbruikbare invoer laat geen scherm crashen', () => {
  it('geeft een lege reeks bij een onleesbare begintijd', () => {
    expect(planSeries('morgen om tien', iso(2026, 7, 20, 11), weekly, 'koen', []))
      .toEqual({ usable: [], skipped: [] });
  });

  it('geeft een lege reeks bij een omgekeerde of nul-lange les', () => {
    expect(planSeries(iso(2026, 7, 20, 11), iso(2026, 7, 20, 10), weekly, 'koen', []).usable).toEqual([]);
    expect(planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 10), weekly, 'koen', []).usable).toEqual([]);
  });

  it('geeft een lege reeks bij een einddag die niet bestaat of niet te lezen is', () => {
    const start = iso(2026, 7, 20, 10), end = iso(2026, 7, 20, 11);
    for (const until of ['', '17/09/2026', '2026-13-01', '2026-02-30', 'ooit']) {
      expect(planSeries(start, end, { frequency: 'weekly', until }, 'koen', []).usable).toEqual([]);
    }
  });
});

describe('de bovengrens', () => {
  it('stopt bij MAX_LESSONS ook al reikt de einddag veel verder', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2099-12-31' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(MAX_LESSONS).toBe(104);
    expect(plan.usable.length + plan.skipped.length).toBe(MAX_LESSONS);
    // Twee jaar wekelijks: de laatste les valt binnen twee jaar na de eerste.
    const laatste = new Date(plan.usable[plan.usable.length - 1].start_time);
    expect(laatste.getFullYear()).toBe(2028);
  });
});

describe('de samenvatting', () => {
  it('noemt de frequentie, de einddag en het aantal lessen', () => {
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', []);
    expect(seriesSummary(plan, weekly)).toBe('Wekelijks tot en met do 17 sep · 5 lessen');
  });

  it('zegt "1 les" in het enkelvoud', () => {
    const rule: RecurrenceRule = { frequency: 'biweekly', until: '2026-08-20' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(seriesSummary(plan, rule)).toBe('Tweewekelijks tot en met do 20 aug · 1 les');
  });

  it('telt alleen de bruikbare lessen, niet de overgeslagen', () => {
    const plan = planSeries(
      iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), weekly, 'koen', [busy('bezet', 2026, 7, 20)],
    );
    expect(seriesSummary(plan, weekly)).toContain('4 lessen');
  });

  it('zegt "geen lessen" in plaats van een nul bij een lege reeks', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: '2026-08-19' };
    const plan = planSeries(iso(2026, 7, 20, 10), iso(2026, 7, 20, 11), rule, 'koen', []);
    expect(seriesSummary(plan, rule)).toBe('Wekelijks tot en met wo 19 aug · geen lessen');
  });

  it('valt terug op "datum onbekend" bij een onleesbare einddag, zonder te gooien', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', until: 'ooit' };
    expect(seriesSummary({ usable: [], skipped: [] }, rule))
      .toBe('Wekelijks tot en met datum onbekend · geen lessen');
  });
});

describe('laatsteDagVan', () => {
  const eerste = new Date(2026, 7, 25); // dinsdag 25 augustus

  it('rekent weken om naar een einddatum, de eerste les meegerekend', () => {
    // Tien wekelijkse lessen: de tiende valt negen weken later.
    const d = laatsteDagVan(eerste, 'weekly', 10);
    expect([d.getDate(), d.getMonth() + 1]).toEqual([27, 10]);
  });

  it('telt bij tweewekelijks in stappen van veertien dagen', () => {
    const d = laatsteDagVan(eerste, 'biweekly', 3);
    expect([d.getDate(), d.getMonth() + 1]).toEqual([22, 9]);
  });

  it('geeft bij één les de dag zelf terug', () => {
    const d = laatsteDagVan(eerste, 'weekly', 1);
    expect([d.getDate(), d.getMonth() + 1]).toEqual([25, 8]);
  });

  it('vertrouwt geen onzin uit een invoerveld', () => {
    for (const onzin of [0, -3, Number.NaN]) {
      const d = laatsteDagVan(eerste, 'weekly', onzin);
      expect([d.getDate(), d.getMonth() + 1]).toEqual([25, 8]);
    }
  });

  it('stapt netjes over een jaargrens', () => {
    const d = laatsteDagVan(new Date(2026, 11, 22), 'weekly', 3);
    expect([d.getDate(), d.getMonth() + 1, d.getFullYear()]).toEqual([5, 1, 2027]);
  });
});
