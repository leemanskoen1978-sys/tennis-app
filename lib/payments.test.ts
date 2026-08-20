import type { Booking, Court, User } from './types';
import {
  needsPayment, filterPendingPayment, bookingsFor, bookingsByCoach, visibleBookings,
  pendingPaymentsFor, totalRevenue,
  bookingMinutes, bookingPrice, coachPayout, totalCoachPayout, clubMargin,
  defaultMethodFor, paymentMeta, PAYMENT_METHODS, PAYMENT_LABELS,
} from './payments';

const base: Booking = {
  id: '1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-08-20T10:00:00.000Z', end_time: '2026-08-20T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

const courts: Court[] = [
  { id: 'court-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
];

describe('PAYMENT_METHODS', () => {
  it('are the six agreed values, with open first', () => {
    expect(PAYMENT_METHODS).toEqual(['open', 'cash', 'invoice', 'qr', 'beurtenkaart', 'sponsor']);
  });

  it('all have a Dutch label', () => {
    expect(PAYMENT_LABELS).toEqual({
      open: 'Open',
      cash: 'Cash',
      invoice: 'Factuur',
      qr: 'QR-code',
      beurtenkaart: '10-beurtenkaart',
      sponsor: 'Sponsor',
    });
  });

  it('gives every method its own colour, matching label, and only "open" is subtle', () => {
    const metas = PAYMENT_METHODS.map((m) => paymentMeta(m));
    const colors = metas.map((meta) => meta.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const m of PAYMENT_METHODS) {
      expect(paymentMeta(m).label).toBe(PAYMENT_LABELS[m]);
    }
    expect(PAYMENT_METHODS.filter((m) => paymentMeta(m).subtle)).toEqual(['open']);
  });
});

describe('needsPayment', () => {
  it('is true for a realized booking still on open', () => {
    expect(needsPayment(base)).toBe(true);
    expect(needsPayment({ ...base, status: 'completed' })).toBe(true);
    expect(needsPayment({ ...base, status: 'synchronized' })).toBe(true);
  });

  it('is false once any method is chosen', () => {
    expect(needsPayment({ ...base, payment_method: 'cash' })).toBe(false);
    expect(needsPayment({ ...base, payment_method: 'sponsor' })).toBe(false);
    expect(needsPayment({ ...base, payment_method: 'beurtenkaart' })).toBe(false);
  });

  it('is false for pending or cancelled bookings', () => {
    expect(needsPayment({ ...base, status: 'pending' })).toBe(false);
    expect(needsPayment({ ...base, status: 'cancelled' })).toBe(false);
  });
});

describe('filterPendingPayment', () => {
  it('returns only bookings that need payment', () => {
    const list: Booking[] = [base, { ...base, id: '2', payment_method: 'cash' }];
    expect(filterPendingPayment(list).map((b) => b.id)).toEqual(['1']);
  });
});

const coach: User = { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach' };
const player: User = { id: 'p1', name: 'Mathis', email: 'm@x.be', role: 'player' };

describe('bookingsFor', () => {
  it('gives a coach the lessons they teach', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(bookingsFor(coach, list).map((b) => b.id)).toEqual(['1']);
  });

  it('gives a player the lessons they take', () => {
    const list: Booking[] = [base, { ...base, id: '2', player_id: 'p2' }];
    expect(bookingsFor(player, list).map((b) => b.id)).toEqual(['1']);
  });

  it('does not look at status or payment method', () => {
    const list: Booking[] = [{ ...base, status: 'cancelled', payment_method: 'cash' }];
    expect(bookingsFor(player, list).map((b) => b.id)).toEqual(['1']);
  });

  it('returns nothing without a user', () => {
    expect(bookingsFor(null, [base])).toEqual([]);
  });
});

describe('visibleBookings', () => {
  it('geeft een trainer alle lessen, ook die van een collega — hij mag verder kijken dan zichzelf', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(visibleBookings(coach, list).map((b) => b.id)).toEqual(['1', '2']);
  });

  it('houdt een speler bij zijn eigen lessen', () => {
    const list: Booking[] = [base, { ...base, id: '2', player_id: 'p2' }];
    expect(visibleBookings(player, list).map((b) => b.id)).toEqual(['1']);
  });

  it('geeft niets terug zonder gebruiker', () => {
    expect(visibleBookings(null, [base])).toEqual([]);
  });
});

describe('bookingsByCoach', () => {
  it('houdt alleen de lessen van die ene trainer over', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(bookingsByCoach(list, 'sanne').map((b) => b.id)).toEqual(['2']);
  });

  it('laat bij "alle trainers" alles staan', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(bookingsByCoach(list, null)).toEqual(list);
  });

  it('laat een speler ook met een trainerfilter nooit de les van een andere speler zien', () => {
    const list: Booking[] = [base, { ...base, id: '2', player_id: 'p2', coach_id: 'sanne' }];
    expect(bookingsByCoach(visibleBookings(player, list), 'sanne')).toEqual([]);
  });
});

describe('pendingPaymentsFor', () => {

  it('gives a coach only their own bookings', () => {
    const list: Booking[] = [base, { ...base, id: '2', coach_id: 'sanne' }];
    expect(pendingPaymentsFor(coach, list).map((b) => b.id)).toEqual(['1']);
  });

  it('gives a player only their own bookings', () => {
    const list: Booking[] = [base, { ...base, id: '2', player_id: 'p2' }];
    expect(pendingPaymentsFor(player, list).map((b) => b.id)).toEqual(['1']);
  });

  it('returns nothing without a user', () => {
    expect(pendingPaymentsFor(null, [base])).toEqual([]);
  });
});

describe('bookingMinutes', () => {
  it('is the distance between start and end', () => {
    expect(bookingMinutes(base)).toBe(60);
    expect(bookingMinutes({ ...base, end_time: '2026-08-20T10:30:00.000Z' })).toBe(30);
  });

  it('is 0 for a reversed or unusable time', () => {
    expect(bookingMinutes({ ...base, end_time: '2026-08-20T09:00:00.000Z' })).toBe(0);
    expect(bookingMinutes({ ...base, end_time: 'geen datum' })).toBe(0);
  });
});

describe('bookingPrice', () => {
  it('charges the hourly rate pro rata of the duration', () => {
    expect(bookingPrice({ ...base, end_time: '2026-08-20T10:30:00.000Z' }, 30)).toBe(15);
    expect(bookingPrice(base, 30)).toBe(30);
    expect(bookingPrice({ ...base, end_time: '2026-08-20T11:30:00.000Z' }, 30)).toBe(45);
  });

  it('is 0 without a known rate or with an unusable time', () => {
    expect(bookingPrice(base, undefined)).toBe(0);
    expect(bookingPrice({ ...base, end_time: 'geen datum' }, 30)).toBe(0);
  });
});

describe('totalRevenue', () => {
  it('counts half an hour as half the hourly rate, like the monthly export', () => {
    const list: Booking[] = [
      { ...base, payment_method: 'cash', end_time: '2026-08-20T10:30:00.000Z' },
    ];
    expect(totalRevenue(list, courts)).toBe(15);
  });

  it('counts a full hour as the whole hourly rate', () => {
    expect(totalRevenue([{ ...base, payment_method: 'cash' }], courts)).toBe(30);
  });

  it('counts nothing for a court that is not in the list', () => {
    const list: Booking[] = [{ ...base, payment_method: 'cash', court_id: 'weg' }];
    expect(totalRevenue(list, courts)).toBe(0);
  });

  it('counts nothing for a reversed or unusable time, instead of a negative amount or NaN', () => {
    const reversed: Booking[] = [
      { ...base, payment_method: 'cash', end_time: '2026-08-20T09:00:00.000Z' },
    ];
    expect(totalRevenue(reversed, courts)).toBe(0);
    const broken: Booking[] = [{ ...base, payment_method: 'cash', end_time: 'geen datum' }];
    expect(totalRevenue(broken, courts)).toBe(0);
  });

  it('counts cash, invoice, qr, beurtenkaart and sponsor', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_method: 'cash' },
      { ...base, id: '2', payment_method: 'invoice' },
      { ...base, id: '3', payment_method: 'qr' },
      { ...base, id: '4', payment_method: 'beurtenkaart' },
      // Sponsor hoort hierbij: de les zit in het sponsorcontract en dat contract is
      // betaald geld. Zie de toelichting bij `countsAsRevenue`.
      { ...base, id: '5', payment_method: 'sponsor' },
    ];
    expect(totalRevenue(list, courts)).toBe(150);
  });

  it('skips open — daar is nog niets afgesproken', () => {
    const list: Booking[] = [{ ...base, id: '1', payment_method: 'open' }];
    expect(totalRevenue(list, courts)).toBe(0);
  });

  it('skips cancelled bookings', () => {
    const list: Booking[] = [{ ...base, payment_method: 'cash', status: 'cancelled' }];
    expect(totalRevenue(list, courts)).toBe(0);
  });

  it('skips a pending booking, even with a revenue-generating payment method', () => {
    const list: Booking[] = [{ ...base, payment_method: 'cash', status: 'pending' }];
    expect(totalRevenue(list, courts)).toBe(0);
  });
});

describe('coachPayout en totalCoachPayout', () => {
  // De trainers: Koen met een tarief, Nele zonder, Sam met een tarief van nul.
  const coaches: User[] = [
    { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach', hourly_rate: 24 },
    { id: 'nele', name: 'Nele', email: 'n@x.be', role: 'coach' },
    { id: 'sam', name: 'Sam', email: 's@x.be', role: 'coach', hourly_rate: 0 },
  ];

  it('pays a full hour at the whole coach rate', () => {
    expect(coachPayout(base, 24)).toBe(24);
    expect(totalCoachPayout([{ ...base }], coaches)).toBe(24);
  });

  it('pays half an hour at half the coach rate, like bookingPrice does for the player', () => {
    const half: Booking = { ...base, end_time: '2026-08-20T10:30:00.000Z' };
    expect(coachPayout(half, 24)).toBe(12);
    expect(totalCoachPayout([half], coaches)).toBe(12);
  });

  it('pays nothing when the coach has no rate set', () => {
    expect(coachPayout(base, undefined)).toBe(0);
    expect(totalCoachPayout([{ ...base, coach_id: 'nele' }], coaches)).toBe(0);
  });

  it('pays nothing at a rate of zero', () => {
    expect(coachPayout(base, 0)).toBe(0);
    expect(totalCoachPayout([{ ...base, coach_id: 'sam' }], coaches)).toBe(0);
  });

  it('pays nothing for a coach who no longer exists', () => {
    expect(totalCoachPayout([{ ...base, coach_id: 'weg' }], coaches)).toBe(0);
  });

  it('skips a cancelled lesson, just like the revenue does', () => {
    expect(totalCoachPayout([{ ...base, status: 'cancelled' }], coaches)).toBe(0);
  });

  it('skips a lesson that is not confirmed yet', () => {
    expect(totalCoachPayout([{ ...base, status: 'pending' }], coaches)).toBe(0);
  });

  it('pays the coach whatever the payment method is — his hour was given', () => {
    const list: Booking[] = [
      { ...base, id: '1', payment_method: 'open' },
      { ...base, id: '2', payment_method: 'sponsor' },
    ];
    expect(totalCoachPayout(list, coaches)).toBe(48);
  });

  it('gives zero for a reversed or unusable time, instead of a negative amount or NaN', () => {
    expect(coachPayout({ ...base, end_time: '2026-08-20T09:00:00.000Z' }, 24)).toBe(0);
    expect(coachPayout({ ...base, end_time: 'geen datum' }, 24)).toBe(0);
    expect(totalCoachPayout([{ ...base, end_time: 'geen datum' }], coaches)).toBe(0);
  });

  it('adds up several lessons as amounts, without cent drift', () => {
    // 25 euro per uur is voor twintig minuten 8,33 — drie keer precies dat, en niet 24,99…97.
    const iris: User[] = [...coaches, { id: 'iris', name: 'Iris', email: 'i@x.be', role: 'coach', hourly_rate: 25 }];
    const list: Booking[] = ['1', '2', '3'].map((id) => ({
      ...base, id, coach_id: 'iris', end_time: '2026-08-20T10:20:00.000Z',
    }));
    expect(totalCoachPayout(list, iris)).toBe(24.99);
  });

  it('is nothing at all without lessons', () => {
    expect(totalCoachPayout([], coaches)).toBe(0);
  });
});

describe('clubMargin', () => {
  const coaches: User[] = [
    { id: 'koen', name: 'Koen', email: 'k@x.be', role: 'coach', hourly_rate: 24 },
    { id: 'nele', name: 'Nele', email: 'n@x.be', role: 'coach' },
  ];

  it('is what is left of the court revenue after the coach is paid', () => {
    // Baan 30 per uur, Koen 24 per uur: de club houdt 6 over.
    expect(clubMargin([{ ...base, payment_method: 'cash' }], coaches, courts)).toBe(6);
  });

  it('keeps the whole revenue when the coach has no rate set', () => {
    const list: Booking[] = [{ ...base, coach_id: 'nele', payment_method: 'cash' }];
    expect(clubMargin(list, coaches, courts)).toBe(30);
  });

  it('goes negative when the coach costs more than the lesson brings in', () => {
    // Een openstaande les is nog geen omzet, maar de trainer gaf zijn uur wel.
    expect(clubMargin([{ ...base, payment_method: 'open' }], coaches, courts)).toBe(-24);
  });

  it('is zero without lessons', () => {
    expect(clubMargin([], coaches, courts)).toBe(0);
  });
});

describe('defaultMethodFor', () => {
  it('takes the player default when set', () => {
    const p: User = { id: 'p1', name: 'M', email: 'm@x.be', role: 'player', default_payment_method: 'qr' };
    expect(defaultMethodFor(p)).toBe('qr');
  });

  it('falls back to open', () => {
    const p: User = { id: 'p1', name: 'M', email: 'm@x.be', role: 'player' };
    expect(defaultMethodFor(p)).toBe('open');
    expect(defaultMethodFor(null)).toBe('open');
  });
});
