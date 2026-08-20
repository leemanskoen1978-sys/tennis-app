import { migrateBooking, migrateBookings } from './migrate';

const legacy = {
  id: '1', player_id: 'p1', coach_id: 'c1', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed' as const,
};

describe('migrateBooking', () => {
  it('maps paid to cash', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'paid' })!.payment_method).toBe('cash');
  });

  it('maps invoice to invoice', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'invoice' })!.payment_method).toBe('invoice');
  });

  it('maps unpaid and null to open', () => {
    expect(migrateBooking({ ...legacy, payment_status: 'unpaid' })!.payment_method).toBe('open');
    expect(migrateBooking({ ...legacy, payment_status: null })!.payment_method).toBe('open');
  });

  it('treats a missing field as open', () => {
    expect(migrateBooking({ ...legacy })!.payment_method).toBe('open');
  });

  it('leaves an already migrated booking alone', () => {
    expect(migrateBooking({ ...legacy, payment_method: 'sponsor' })!.payment_method).toBe('sponsor');
  });

  it('drops the old field', () => {
    const out = migrateBooking({ ...legacy, payment_status: 'paid' })!;
    expect('payment_status' in out).toBe(false);
  });

  it('keeps the other fields untouched', () => {
    const out = migrateBooking({ ...legacy, payment_status: 'paid', notes: 'Techniek' })!;
    expect(out.id).toBe('1');
    expect(out.notes).toBe('Techniek');
  });
});

describe('migrateBookings', () => {
  it('migrates every booking in the list', () => {
    const out = migrateBookings([
      { ...legacy, id: '1', payment_status: 'paid' },
      { ...legacy, id: '2', payment_status: null },
    ]);
    expect(out.map((b) => b.payment_method)).toEqual(['cash', 'open']);
  });

  it('survives a missing list', () => {
    expect(migrateBookings(undefined)).toEqual([]);
  });
});

describe('kapotte opslag', () => {
  it('geeft een lege lijst als de invoer geen array is', () => {
    expect(migrateBookings('kapot')).toEqual([]);
    expect(migrateBookings(42)).toEqual([]);
    expect(migrateBookings({ bookings: [] })).toEqual([]);
    expect(migrateBookings(null)).toEqual([]);
  });

  it('gooit niet op een item dat geen object is', () => {
    expect(() => migrateBooking(null)).not.toThrow();
    expect(() => migrateBooking('kapot')).not.toThrow();
    expect(migrateBooking(null)).toBeNull();
  });

  it('houdt de overige boekingen over bij een null-item in de lijst', () => {
    const out = migrateBookings([
      { ...legacy, id: '1', payment_status: 'paid' },
      null,
      'kapot',
      7,
      { ...legacy, id: '2', payment_status: 'invoice' },
    ]);
    expect(out.map((b) => b.id)).toEqual(['1', '2']);
    expect(out.map((b) => b.payment_method)).toEqual(['cash', 'invoice']);
  });

  it('negeert een lege payment_method en gebruikt de oude payment_status', () => {
    const out = migrateBooking({ ...legacy, payment_method: '', payment_status: 'paid' });
    expect(out?.payment_method).toBe('cash');
  });

  it('valt terug op open bij een lege payment_method zonder payment_status', () => {
    expect(migrateBooking({ ...legacy, payment_method: '' })?.payment_method).toBe('open');
  });

  it('vervangt een onbekende payment_method door een geldige waarde', () => {
    // 'paid' is een half gemigreerde waarde: geen geldige PaymentMethod.
    expect(migrateBooking({ ...legacy, payment_method: 'paid' })?.payment_method).toBe('open');
    expect(
      migrateBooking({ ...legacy, payment_method: 'paid', payment_status: 'invoice' })
        ?.payment_method,
    ).toBe('invoice');
    expect(migrateBooking({ ...legacy, payment_method: 42 })?.payment_method).toBe('open');
  });

  it('is idempotent: twee keer draaien geeft hetzelfde resultaat', () => {
    const raw = [
      { ...legacy, id: '1', payment_status: 'paid' },
      { ...legacy, id: '2', payment_method: 'paid' },
      { ...legacy, id: '3', payment_method: '' },
      null,
      { ...legacy, id: '4', payment_method: 'sponsor' },
    ];
    const once = migrateBookings(raw);
    expect(migrateBookings(once)).toEqual(once);
  });
});
