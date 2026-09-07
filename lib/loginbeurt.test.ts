import { maakBeurtenteller } from './loginbeurt';

describe('loginbeurt', () => {
  it('laat een lading die binnen dezelfde beurt begint en eindigt gewoon door', () => {
    const teller = maakBeurtenteller();
    const beurt = teller.nu();
    expect(teller.geldig(beurt)).toBe(true);
  });

  it('gooit weg wat begon vóór het uitloggen', () => {
    // Precies de gemeten fout: start() vroeg wie er ingelogd is, en kreeg het antwoord pas
    // terug nádat de sessie al ingetrokken was. Zonder deze grens schreef dat antwoord de
    // uitgelogde stand weer vol en stond je terug op de hub.
    const teller = maakBeurtenteller();
    const beurt = teller.nu();
    teller.volgende();
    expect(teller.geldig(beurt)).toBe(false);
  });

  it('maakt bij twee keer uitloggen ook de tweede lading ongeldig', () => {
    const teller = maakBeurtenteller();
    teller.volgende();
    const tweede = teller.nu();
    teller.volgende();
    expect(teller.geldig(tweede)).toBe(false);
  });

  it('laat een lading van ná de wissel wél door', () => {
    const teller = maakBeurtenteller();
    teller.volgende();
    const verse = teller.nu();
    expect(teller.geldig(verse)).toBe(true);
  });

  it('geeft bij elke wissel een beurt die nog niet eerder bestond', () => {
    const teller = maakBeurtenteller();
    const gezien = new Set<number>([teller.nu()]);
    for (let i = 0; i < 5; i += 1) {
      teller.volgende();
      expect(gezien.has(teller.nu())).toBe(false);
      gezien.add(teller.nu());
    }
  });
});
