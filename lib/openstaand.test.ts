import {
  claimBezwaar, openReden, openstaandeLessen, staatOpen, teruggeefBezwaar,
} from './openstaand';
import type { Booking, SickLeave, Vakantie } from './types';

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

describe('openstaandeLessen', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');
  const vrij = (patch: Partial<Booking>): Booking => les({ zoekt_trainer: true, ...patch });

  it('geeft de openstaande lessen op tijd gesorteerd, met hun reden', () => {
    // Een andere trainer, want een les van de zieke `c-1` zou 'ziek' als reden krijgen:
    // ziekte gaat voor het merkteken als ze allebei gelden.
    const laat = vrij({ id: 'b-laat', coach_id: 'c-2', start_time: '2027-03-04T17:00:00.000Z' });
    const vroeg = les({ id: 'b-vroeg', start_time: '2027-03-02T17:00:00.000Z' });
    const rijen = openstaandeLessen([laat, vroeg], [ziekmelding], [], nu, 'c-9');
    expect(rijen.map((r) => r.les.id)).toEqual(['b-vroeg', 'b-laat']);
    expect(rijen.map((r) => r.reden)).toEqual(['ziek', 'vrijgegeven']);
  });

  it('laat wat al begonnen is weg', () => {
    // Een les die loopt of geweest is valt niet meer over te nemen; daar valt niets te
    // beslissen en hij zou de lijst alleen vervuilen.
    const voorbij = vrij({ id: 'b-oud', start_time: '2027-02-27T17:00:00.000Z' });
    expect(openstaandeLessen([voorbij], [], [], nu, 'c-9')).toEqual([]);
  });

  it('laat een les weg op een dag dat de club dicht is', () => {
    // Die les gaat sowieso niet door: er een trainer voor zoeken is werk voor niets. Dezelfde
    // regel als `lessenVoorZiekmelding` in lib/ziekmelding.
    const vakanties: Vakantie[] = [{ id: 'v-1', van: '2027-03-03', tot: '2027-03-03', naam: 'Feestdag' }];
    expect(openstaandeLessen([vrij({ id: 'b-1' })], [], vakanties, nu, 'c-9')).toEqual([]);
  });

  it('laat de eigen lessen van de kijker weg', () => {
    // Jezelf overnemen betekent niets: `taught_by_id` gelijk aan `coach_id` is precies de
    // toestand die "de vaste trainer gaf hem zelf" al uitdrukt met leeg.
    expect(openstaandeLessen([vrij({ id: 'b-1' })], [], [], nu, 'c-1')).toEqual([]);
  });

  it('laat een onleesbare begintijd weg in plaats van te crashen', () => {
    const kapot = vrij({ id: 'b-kapot', start_time: 'geen datum' });
    expect(openstaandeLessen([kapot], [], [], nu, 'c-9')).toEqual([]);
  });
});

describe('claimBezwaar', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');

  it('geeft null voor een openstaande les van een collega', () => {
    expect(claimBezwaar(les(), 'c-9', [ziekmelding], nu)).toBeNull();
  });

  it('klaagt als de les niet meer bestaat', () => {
    expect(claimBezwaar(undefined, 'c-9', [], nu)).not.toBeNull();
  });

  it('klaagt over je eigen les', () => {
    expect(claimBezwaar(les(), 'c-1', [ziekmelding], nu)).not.toBeNull();
  });

  it('zegt dat een collega je voor was als er al een lesgever op staat', () => {
    // Twee trainers kunnen tegelijk naar dezelfde lijst kijken. De tweede hoort te lezen wat
    // er gebeurd is, en niet een knop in te drukken die stil niets doet.
    const bezwaar = claimBezwaar(les({ taught_by_id: 'c-2' }), 'c-9', [ziekmelding], nu);
    expect(bezwaar).not.toBeNull();
    expect(bezwaar).toContain('collega');
  });

  it('klaagt over een les die al begonnen is', () => {
    const laat = new Date('2027-03-03T17:30:00.000Z');
    expect(claimBezwaar(les(), 'c-9', [ziekmelding], laat)).not.toBeNull();
  });

  it('klaagt over een les die niet openstaat', () => {
    expect(claimBezwaar(les(), 'c-9', [], nu)).not.toBeNull();
  });
});

describe('teruggeefBezwaar', () => {
  const nu = new Date('2027-03-01T08:00:00.000Z');

  it('geeft null voor je eigen overgenomen les', () => {
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-9' }), 'c-9', nu)).toBeNull();
  });

  it('klaagt als de les niet meer bestaat', () => {
    expect(teruggeefBezwaar(undefined, 'c-9', nu)).not.toBeNull();
  });

  it('klaagt over de les van iemand anders', () => {
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-2' }), 'c-9', nu)).not.toBeNull();
    expect(teruggeefBezwaar(les(), 'c-9', nu)).not.toBeNull();
  });

  it('klaagt over een les die al begonnen is', () => {
    const laat = new Date('2027-03-03T17:30:00.000Z');
    expect(teruggeefBezwaar(les({ taught_by_id: 'c-9' }), 'c-9', laat)).not.toBeNull();
  });
});
