import { diffStores, sameRow, type SyncableStore } from './sync';
import type { Booking, Memo, Settings, User } from './types';

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
