import { openReden, staatOpen } from './openstaand';
import type { Booking, SickLeave } from './types';

const ziekmelding: SickLeave = {
  id: 'z-1', coach_id: 'c-1', van: '2027-03-01', tot: '2027-03-05',
  created_at: '2027-02-28T09:00:00.000Z',
};

const basis: Booking = {
  id: 'b-1', player_id: 's-1', coach_id: 'c-1', court_id: 'baan-1',
  start_time: '2027-03-03T17:00:00.000Z', end_time: '2027-03-03T18:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

/** Een les met een afwijking erop, zoals `ziek` in lib/ziekmelding.test. */
const les = (patch: Partial<Booking> = {}): Booking => ({ ...basis, ...patch });

describe('openReden', () => {
  it('noemt een les van een zieke trainer ziek', () => {
    expect(openReden(les(), [ziekmelding])).toBe('ziek');
  });

  it('noemt een vrijgegeven les vrijgegeven', () => {
    expect(openReden(les({ zoekt_trainer: true }), [])).toBe('vrijgegeven');
  });

  it('noemt ziekte eerst als een zieke trainer zijn les ook vrijgaf', () => {
    // Beide gelden; de ziekmelding is wat de kijker moet weten, want die verklaart ook de
    // andere lessen van diezelfde trainer.
    expect(openReden(les({ zoekt_trainer: true }), [ziekmelding])).toBe('ziek');
  });

  it('geeft null voor een gewone les', () => {
    expect(openReden(les(), [])).toBeNull();
  });

  it('geeft null als er al een lesgever op staat', () => {
    // Zowel bij ziekte als bij het merkteken: geregeld is geregeld.
    expect(openReden(les({ taught_by_id: 'c-2' }), [ziekmelding])).toBeNull();
    expect(openReden(les({ taught_by_id: 'c-2', zoekt_trainer: true }), [])).toBeNull();
  });

  it('geeft null voor een afgezegde les', () => {
    expect(openReden(les({ status: 'cancelled' }), [ziekmelding])).toBeNull();
    expect(openReden(les({ status: 'cancelled', zoekt_trainer: true }), [])).toBeNull();
  });

  it('geeft null bij een ingetrokken ziekmelding', () => {
    // Dezelfde regel als `openZiekmeldingen`: ingetrokken telt nergens meer mee, en er hoeft
    // dus ook nooit iets aan de boeking bijgewerkt te worden.
    const ingetrokken = { ...ziekmelding, retracted_at: '2027-03-02T08:00:00.000Z' };
    expect(openReden(les(), [ingetrokken])).toBeNull();
  });

  it('geeft null voor een les buiten de ziekteperiode', () => {
    expect(openReden(les({
      start_time: '2027-03-09T17:00:00.000Z', end_time: '2027-03-09T18:00:00.000Z',
    }), [ziekmelding])).toBeNull();
  });
});

describe('staatOpen', () => {
  it('zegt ja waar openReden een reden geeft en nee waar hij null geeft', () => {
    expect(staatOpen(les(), [ziekmelding])).toBe(true);
    expect(staatOpen(les({ zoekt_trainer: true }), [])).toBe(true);
    expect(staatOpen(les(), [])).toBe(false);
  });
});
