import { magStilVerversen, VERVERS_PAUZE_MS } from './verversen';

const rustig = {
  ingelogd: true,
  laadt: false,
  schrijft: false,
  sindsLaatsteLading: VERVERS_PAUZE_MS + 1,
};

describe('magStilVerversen', () => {
  it('ververst als iemand na een tijd terugkomt', () => {
    expect(magStilVerversen(rustig)).toBe(true);
  });

  it('doet niets zonder login: er valt niets op te halen', () => {
    expect(magStilVerversen({ ...rustig, ingelogd: false })).toBe(false);
  });

  it('doet niets terwijl er al een lading loopt', () => {
    expect(magStilVerversen({ ...rustig, laadt: true })).toBe(false);
  });

  it('doet niets terwijl er geschreven wordt', () => {
    // Anders zou de lading de wijziging kunnen overschrijven met de stand van ervoor.
    expect(magStilVerversen({ ...rustig, schrijft: true })).toBe(false);
  });

  it('wacht de pauze af: even wegklikken en terugkomen haalt niet opnieuw op', () => {
    expect(magStilVerversen({ ...rustig, sindsLaatsteLading: 1000 })).toBe(false);
    expect(magStilVerversen({ ...rustig, sindsLaatsteLading: VERVERS_PAUZE_MS })).toBe(false);
  });
});
