import {
  sponsorUsed, sponsorState, fitsInSponsorBudget, sponsorRefusal, sponsorHint, sponsorPriceOf,
  type SponsorBooking, type SponsorPlayer,
} from './sponsor';
import type { Court } from './types';

const courts: Court[] = [
  { id: 'court-1', name: 'Terrein 1', number: 1, indoor: false, hourly_rate: 40 },
  { id: 'court-2', name: 'Terrein 2', number: 2, indoor: true, hourly_rate: 60 },
];

/** Een gesponsorde les van één uur op terrein 1: 40 euro, tenzij anders gevraagd. */
function les(over: Partial<SponsorBooking> & { id: string }): SponsorBooking {
  return {
    player_id: 'anna',
    court_id: 'court-1',
    status: 'confirmed',
    payment_method: 'sponsor',
    start_time: '2026-08-20T10:00:00.000Z',
    end_time: '2026-08-20T11:00:00.000Z',
    ...over,
  };
}

const anna: SponsorPlayer = { id: 'anna', sponsor_budget: 100 };
const zonderContract: SponsorPlayer = { id: 'anna' };

describe('sponsorPriceOf', () => {
  it('rekent naar rato van de duur, net als elke andere les', () => {
    expect(sponsorPriceOf(les({ id: 'b1' }), courts)).toBe(40);
    expect(sponsorPriceOf(les({ id: 'b1', end_time: '2026-08-20T10:30:00.000Z' }), courts)).toBe(20);
    expect(sponsorPriceOf(les({ id: 'b1', court_id: 'weg' }), courts)).toBe(0);
  });
});

describe('sponsorUsed', () => {
  it('telt de gesponsorde lessen van deze speler op', () => {
    const used = sponsorUsed(
      [les({ id: 'b1' }), les({ id: 'b2', court_id: 'court-2' })],
      courts,
      'anna',
    );
    expect(used).toBe(100);
  });

  it('laat een geannuleerde sponsorles buiten beschouwing', () => {
    const used = sponsorUsed(
      [les({ id: 'b1' }), les({ id: 'b2', status: 'cancelled' })],
      courts,
      'anna',
    );
    expect(used).toBe(40);
  });

  it('telt de lessen van een andere speler niet mee', () => {
    const used = sponsorUsed([les({ id: 'b1' }), les({ id: 'b2', player_id: 'bram' })], courts, 'anna');
    expect(used).toBe(40);
  });

  it('telt alleen lessen met betaalwijze sponsor', () => {
    const used = sponsorUsed(
      [les({ id: 'b1' }), les({ id: 'b2', payment_method: 'cash' })],
      courts,
      'anna',
    );
    expect(used).toBe(40);
  });

  it('laat één les buiten de telling als daarom gevraagd wordt', () => {
    const used = sponsorUsed([les({ id: 'b1' }), les({ id: 'b2' })], courts, 'anna', 'b2');
    expect(used).toBe(40);
  });
});

describe('sponsorState', () => {
  it('geeft geen budget bij een speler zonder sponsorcontract', () => {
    const state = sponsorState(zonderContract, [], courts);
    expect(state).toEqual({ budget: 0, hasBudget: false, used: 0, left: 0 });
    expect(sponsorState(null, [], courts).hasBudget).toBe(false);
  });

  it('houdt over wat er van het budget overblijft', () => {
    const state = sponsorState(anna, [les({ id: 'b1' })], courts);
    expect(state).toEqual({ budget: 100, hasBudget: true, used: 40, left: 60 });
  });

  it('komt precies op nul uit als het budget op is', () => {
    const state = sponsorState(anna, [les({ id: 'b1' }), les({ id: 'b2', court_id: 'court-2' })], courts);
    expect(state.left).toBe(0);
  });

  it('toont nooit een negatief bedrag als de trainer het budget verlaagt', () => {
    // Er is al voor 100 euro verlest; het contract wordt daarna op 50 gezet. De gegeven
    // lessen blijven staan — die zijn niet terug te draaien — maar er kan niets meer bij.
    const verlaagd: SponsorPlayer = { id: 'anna', sponsor_budget: 50 };
    const lessen = [les({ id: 'b1' }), les({ id: 'b2', court_id: 'court-2' })];
    const state = sponsorState(verlaagd, lessen, courts);
    expect(state.used).toBe(100);
    expect(state.left).toBe(0);
    expect(fitsInSponsorBudget(state, 1)).toBe(false);
  });
});

describe('fitsInSponsorBudget', () => {
  it('laat een les toe die er ruim in past', () => {
    expect(fitsInSponsorBudget(sponsorState(anna, [], courts), 40)).toBe(true);
  });

  it('laat een les toe die het budget precies opmaakt', () => {
    expect(fitsInSponsorBudget(sponsorState(anna, [les({ id: 'b1' })], courts), 60)).toBe(true);
  });

  it('weigert een les die er net niet meer in past', () => {
    expect(fitsInSponsorBudget(sponsorState(anna, [les({ id: 'b1' })], courts), 60.01)).toBe(false);
  });

  it('weigert alles zonder sponsorcontract', () => {
    expect(fitsInSponsorBudget(sponsorState(zonderContract, [], courts), 0)).toBe(false);
  });
});

describe('sponsorRefusal', () => {
  const ctx = (player: SponsorPlayer | null, bookings: SponsorBooking[] = []) => ({
    player, bookings, courts,
  });

  it('laat een les door die nog in het budget past', () => {
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(anna))).toBeNull();
  });

  it('weigert zonder sponsorcontract', () => {
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(zonderContract)))
      .toBe('Deze speler heeft geen sponsorbudget.');
  });

  it('weigert als het budget helemaal op is', () => {
    const op = [les({ id: 'b1' }), les({ id: 'b2', court_id: 'court-2' })];
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(anna, op)))
      .toBe('Het sponsorbudget van deze speler is op.');
  });

  it('zegt hoeveel er nog over is als de les er net niet meer in past', () => {
    const bijna = [les({ id: 'b1' }), les({ id: 'b2', end_time: '2026-08-20T10:45:00.000Z' })];
    // Verbruikt: 40 + 30 = 70, dus nog 30 over voor een les van 40.
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(anna, bijna)))
      .toBe('Deze les past niet meer in het sponsorbudget: nog € 30,00 over.');
  });

  it('laat een les die al op sponsor staat zichzelf niet weigeren', () => {
    // Het budget is precies op door deze ene les; hem nog eens op sponsor zetten mag,
    // anders zou hij van zijn eigen kosten de conclusie "past niet meer" krijgen.
    const zelf = les({ id: 'b1', court_id: 'court-2' });
    const ook = les({ id: 'b2' });
    expect(sponsorRefusal(zelf, ctx(anna, [zelf, ook]))).toBeNull();
  });

  it('telt de lessen van een andere speler niet tegen dit budget', () => {
    const vanBram = [les({ id: 'b1', player_id: 'bram' }), les({ id: 'b2', player_id: 'bram', court_id: 'court-2' })];
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(anna, vanBram))).toBeNull();
  });

  it('telt een geannuleerde sponsorles niet tegen het budget', () => {
    const geannuleerd = [
      les({ id: 'b1', status: 'cancelled' }),
      les({ id: 'b2', court_id: 'court-2', status: 'cancelled' }),
    ];
    expect(sponsorRefusal(les({ id: 'b9' }), ctx(anna, geannuleerd))).toBeNull();
  });
});

describe('sponsorHint', () => {
  it('zegt het als er geen contract is', () => {
    expect(sponsorHint(sponsorState(zonderContract, [], courts)))
      .toBe('Deze speler heeft geen sponsorbudget.');
  });

  it('zegt wat er nog van het budget over is', () => {
    expect(sponsorHint(sponsorState(anna, [les({ id: 'b1' })], courts)))
      .toBe('Nog € 60,00 van € 100,00 over.');
  });
});
