import { diffStores, sameRow, type SyncableStore } from './sync';
import type { Booking, LesGroep, Lesplanning, Memo, Settings, SickLeave, User } from './types';

const settings: Settings = { booking_end_time: '21:00', theme: 'light', language: 'nl' };

const koen: User = { id: 'u-koen', email: 'koen@x.be', name: 'Koen', role: 'coach' };
const mathis: User = { id: 'u-mathis', email: 'mathis@x.be', name: 'Mathis', role: 'player' };

const les: Booking = {
  id: 'b1', player_id: 'u-mathis', coach_id: 'u-koen', court_id: 'c-1',
  start_time: '2026-08-21T10:00:00.000Z', end_time: '2026-08-21T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

const store = (extra: Partial<SyncableStore> = {}): SyncableStore => ({
  users: [koen, mathis],
  courts: [],
  bookings: [les],
  lessons: [],
  progress: [],
  goals: [],
  beurtenkaarten: [],
  memos: [],
  relaties: [],
  lesGroepen: [],
  sickLeaves: [],
  lesPlanning: [],
  settings,
  installed_catalogues: ['u9-kdt-v1'],
  ...extra,
});

describe('sameRow', () => {
  it('trekt zich niets aan van de volgorde van de sleutels', () => {
    expect(sameRow({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('ziet een ontbrekend veld en een leeg veld als hetzelfde', () => {
    // De app laat een leeg veld weg; de databank geeft null terug dat naar undefined gaat.
    expect(sameRow({ id: 'b1' }, { id: 'b1', notes: undefined })).toBe(true);
  });

  it('ziet een echte wijziging', () => {
    expect(sameRow({ id: 'b1', status: 'pending' }, { id: 'b1', status: 'confirmed' }))
      .toBe(false);
  });

  it('kijkt in lijsten en in geneste velden', () => {
    expect(sameRow({ uses: [{ date: 'a' }] }, { uses: [{ date: 'a' }] })).toBe(true);
    expect(sameRow({ uses: [{ date: 'a' }] }, { uses: [{ date: 'b' }] })).toBe(false);
    expect(sameRow({ uses: [] }, { uses: [{ date: 'a' }] })).toBe(false);
  });
});

describe('diffStores', () => {
  it('geeft niets terug als er niets veranderde', () => {
    const change = diffStores(store(), store());
    expect(change.empty).toBe(true);
    expect(change.tables).toEqual([]);
    expect(change.settings).toBeNull();
    expect(change.catalogues).toEqual([]);
  });

  it('schrijft een lesgroep vóór de lessen die eraan hangen', () => {
    // `bookings.group_id` verwijst in de databank naar `lesson_groups(id)`. Komt de les eerst,
    // dan weigert Postgres haar omdat de groep nog niet bestaat — en dan mislukt de hele
    // trainingenimport op zijn eerste nieuwe groep.
    const groep: LesGroep = {
      id: 'lg-1', name: 'Groep 8', level: 'Oranje', weekday: 3, start_hour: 17, start_minute: 0,
      season_start: '2026-09-09', season_end: '2027-06-23', roster: [], archived: false,
    };
    const change = diffStores(store(), store({
      lesGroepen: [groep],
      bookings: [les, { ...les, id: 'b2', group_id: 'lg-1' }],
    }));
    expect(change.tables.map((c) => c.table)).toEqual(['lesGroepen', 'bookings']);
  });

  it('ziet een gewijzigde rij, en alleen die', () => {
    const change = diffStores(store(), store({ bookings: [{ ...les, status: 'cancelled' }] }));
    expect(change.tables).toHaveLength(1);
    expect(change.tables[0].table).toBe('bookings');
    expect(change.tables[0].upsert.map((r) => r.id)).toEqual(['b1']);
    expect(change.tables[0].remove).toEqual([]);
  });

  it('ziet een nieuwe rij', () => {
    const tweede: Booking = { ...les, id: 'b2' };
    const change = diffStores(store(), store({ bookings: [les, tweede] }));
    expect(change.tables[0].upsert.map((r) => r.id)).toEqual(['b2']);
  });

  it('ziet een verwijderde rij', () => {
    const change = diffStores(store(), store({ bookings: [] }));
    expect(change.tables[0].remove).toEqual(['b1']);
    expect(change.tables[0].upsert).toEqual([]);
  });

  it('herkent dezelfde rij met de sleutels in een andere volgorde niet als wijziging', () => {
    // Precies wat er gebeurt na `{ ...booking, status }`: dezelfde les, andere volgorde.
    const { status, ...rest } = les;
    const herbouwd = { status, ...rest } as Booking;
    expect(diffStores(store(), store({ bookings: [herbouwd] })).empty).toBe(true);
  });

  it('geeft de instellingen alleen door als ze veranderden', () => {
    expect(diffStores(store(), store()).settings).toBeNull();
    const anders = diffStores(store(), store({ settings: { ...settings, theme: 'dark' } }));
    expect(anders.settings?.theme).toBe('dark');
  });

  it('geeft alleen de nieuw toegevoegde lessenreeksen door', () => {
    const change = diffStores(store(), store({ installed_catalogues: ['u9-kdt-v1', 'u11'] }));
    expect(change.catalogues).toEqual(['u11']);
  });

  it('behandelt zonder vorige toestand alles als nieuw', () => {
    const change = diffStores(null, store());
    const tabellen = change.tables.map((t) => t.table);
    expect(tabellen).toEqual(['users', 'bookings']);
    expect(change.settings).toEqual(settings);
    expect(change.catalogues).toEqual(['u9-kdt-v1']);
    expect(change.empty).toBe(false);
  });
});

const memo = (id: string): Memo => ({
  id,
  student_id: 'u-mathis',
  coach_id: 'u-koen',
  booking_id: 'b1',
  audio_uri: 'data:audio/webm;base64,AAAA',
  duration_ms: 8000,
  created_at: '2026-08-25T17:12:00.000Z',
});

describe('diffStores — memos', () => {
  it('ziet een nieuwe memo als iets dat weggeschreven moet worden', () => {
    const verschil = diffStores(store(), store({ memos: [memo('m1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'memos');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['m1']);
    expect(verschil.empty).toBe(false);
  });

  it('ziet een uitgewerkte memo als een verwijdering', () => {
    const verschil = diffStores(store({ memos: [memo('m1')] }), store({ memos: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'memos');
    expect(tabel?.remove).toEqual(['m1']);
  });

  it('zwijgt als er aan de memos niets veranderde', () => {
    const zelfde = diffStores(store({ memos: [memo('m1')] }), store({ memos: [memo('m1')] }));
    expect(zelfde.empty).toBe(true);
  });
});

const groep = (id: string, roster: string[] = ['u-mathis']): LesGroep => ({
  id,
  name: 'U9 dinsdag',
  level: 'U9',
  weekday: 2,
  start_hour: 17,
  start_minute: 0,
  coach_id: 'u-koen',
  season_start: '2026-09-01',
  season_end: '2027-06-30',
  roster,
  archived: false,
  created_at: '2026-09-05T10:00:00.000Z',
});

describe('diffStores — lesGroepen', () => {
  it('ziet een nieuwe lesgroep als iets dat weggeschreven moet worden', () => {
    const verschil = diffStores(store(), store({ lesGroepen: [groep('lg1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesGroepen');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['lg1']);
    expect(verschil.empty).toBe(false);
  });

  it('ziet een verdwenen lesgroep als een verwijdering', () => {
    const verschil = diffStores(store({ lesGroepen: [groep('lg1')] }), store({ lesGroepen: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesGroepen');
    expect(tabel?.remove).toEqual(['lg1']);
    expect(tabel?.upsert).toEqual([]);
  });

  it('ziet een gewijzigd rooster als een upsert en niet als iets nieuws', () => {
    const verschil = diffStores(
      store({ lesGroepen: [groep('lg1')] }),
      store({ lesGroepen: [groep('lg1', ['u-mathis', 'u-lotte'])] }),
    );
    const tabel = verschil.tables.find((tb) => tb.table === 'lesGroepen');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['lg1']);
    expect(tabel?.remove).toEqual([]);
  });

  it('zwijgt als er aan de lesgroepen niets veranderde', () => {
    const zelfde = diffStores(store({ lesGroepen: [groep('lg1')] }), store({ lesGroepen: [groep('lg1')] }));
    expect(zelfde.empty).toBe(true);
  });
});

const ziek = (id: string, extra: Partial<SickLeave> = {}): SickLeave => ({
  id,
  coach_id: 'u-koen',
  van: '2026-10-05',
  tot: '2026-10-09',
  reden: 'griep',
  created_at: '2026-10-05T08:00:00.000Z',
  ...extra,
});

describe('diffStores — sickLeaves', () => {
  it('ziet een nieuwe ziekmelding als iets dat weggeschreven moet worden', () => {
    const verschil = diffStores(store(), store({ sickLeaves: [ziek('z1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'sickLeaves');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['z1']);
    expect(verschil.empty).toBe(false);
  });

  it('ziet een verdwenen ziekmelding als een verwijdering', () => {
    const verschil = diffStores(store({ sickLeaves: [ziek('z1')] }), store({ sickLeaves: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'sickLeaves');
    expect(tabel?.remove).toEqual(['z1']);
    expect(tabel?.upsert).toEqual([]);
  });

  it('ziet een ingetrokken melding als een upsert en niet als een verwijdering', () => {
    // Intrekken zet `retracted_at` en gooit de rij niet weg: de club hoort te kunnen
    // terugzien dat de melding er geweest is.
    const verschil = diffStores(
      store({ sickLeaves: [ziek('z1')] }),
      store({ sickLeaves: [ziek('z1', { retracted_at: '2026-10-07T09:00:00.000Z' })] }),
    );
    const tabel = verschil.tables.find((tb) => tb.table === 'sickLeaves');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['z1']);
    expect(tabel?.remove).toEqual([]);
  });

  it('zwijgt als er aan de ziekmeldingen niets veranderde', () => {
    const zelfde = diffStores(store({ sickLeaves: [ziek('z1')] }), store({ sickLeaves: [ziek('z1')] }));
    expect(zelfde.empty).toBe(true);
  });

  it('leest de allereerste bewaaractie zonder vorige opslag als een lege lijst', () => {
    // Zonder `sickLeaves: []` in de terugval leest dit `undefined`, en dan valt het verschil
    // weg dat er nu wél een ziekmelding is — de melding zou stil nooit weggeschreven worden.
    const verschil = diffStores(null, store({ sickLeaves: [ziek('z1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'sickLeaves');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['z1']);
  });
});

const gestuurd = (id: string, extra: Partial<Lesplanning> = {}): Lesplanning => ({
  id, lesson_id: 'l-1', coach_id: 'u-koen',
  van: '2027-03-01', tot: '2027-03-14',
  created_at: '2027-02-20T09:00:00.000Z',
  ...extra,
});

describe('diffStores — lesPlanning', () => {
  it('ziet een nieuwe doorsturing', () => {
    const verschil = diffStores(store(), store({ lesPlanning: [gestuurd('p1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });

  it('ziet een verwijderde doorsturing', () => {
    const verschil = diffStores(store({ lesPlanning: [gestuurd('p1')] }), store({ lesPlanning: [] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.remove).toEqual(['p1']);
  });

  it('ziet een gewijzigde periode', () => {
    const verschil = diffStores(
      store({ lesPlanning: [gestuurd('p1')] }),
      store({ lesPlanning: [gestuurd('p1', { tot: '2027-03-21' })] }),
    );
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });

  it('meldt niets als er niets veranderde', () => {
    const zelfde = diffStores(
      store({ lesPlanning: [gestuurd('p1')] }),
      store({ lesPlanning: [gestuurd('p1')] }),
    );
    expect(zelfde.tables.find((tb) => tb.table === 'lesPlanning')).toBeUndefined();
  });

  it('geeft de allereerste doorsturing door, ook zonder vorige toestand', () => {
    // Zonder `lesPlanning: []` in de lege `before` leest hij als undefined in plaats van als
    // een lege lijst, en dan valt het verschil weg dat er nu wél een doorsturing is — dezelfde
    // val als bij `lesGroepen` en `sickLeaves`.
    const verschil = diffStores(null, store({ lesPlanning: [gestuurd('p1')] }));
    const tabel = verschil.tables.find((tb) => tb.table === 'lesPlanning');
    expect(tabel?.upsert.map((r) => r.id)).toEqual(['p1']);
  });
});
