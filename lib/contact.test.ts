import { isValidEmail, normalizePhone } from './contact';

describe('isValidEmail', () => {
  it('keurt een gewoon adres goed', () => {
    expect(isValidEmail('jonas@club.be')).toBe(true);
    expect(isValidEmail('marie.claire@tennisclub.example.com')).toBe(true);
  });

  it('keurt spaties eromheen goed, die halen we er zelf af', () => {
    expect(isValidEmail('  jonas@club.be ')).toBe(true);
  });

  it('keurt een adres zonder apenstaartje af', () => {
    expect(isValidEmail('jonas.club.be')).toBe(false);
  });

  it('keurt een adres zonder punt in het domein af', () => {
    expect(isValidEmail('jonas@club')).toBe(false);
  });

  it('keurt een leeg adres af', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('   ')).toBe(false);
  });

  it('keurt een adres met een spatie erin af', () => {
    expect(isValidEmail('jonas de vries@club.be')).toBe(false);
    expect(isValidEmail('jonas@club be.be')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('houdt een ingevuld nummer, zonder spaties eromheen', () => {
    expect(normalizePhone('  0470 12 34 56 ')).toBe('0470 12 34 56');
  });

  it('laat een leeg veld weg in plaats van een lege string te bewaren', () => {
    expect(normalizePhone('')).toBeUndefined();
    expect(normalizePhone('   ')).toBeUndefined();
  });
});
