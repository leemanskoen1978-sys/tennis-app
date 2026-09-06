import { baanFout, baanNummer, leesBaan, type NieuweBaan } from './banen';
import type { Court } from './types';

const baan = (id: string, number: number, extra: Partial<Court> = {}): Court => ({
  id, name: `Baan ${number}`, number, indoor: false, hourly_rate: 30, ...extra,
});

/** Een ingevuld formulier dat deugt; elke test die een fout wil, sloopt er één ding aan. */
const concept = (extra: Partial<NieuweBaan> = {}): NieuweBaan => ({
  naam: 'Baan 12', nummer: '12', uurtarief: '30', indoor: false, ...extra,
});

const bestaand: Court[] = [baan('court-1', 1), baan('court-2', 2), baan('court-11', 11)];

describe('baanNummer', () => {
  it('reads a whole positive number', () => {
    expect(baanNummer('3')).toBe(3);
    expect(baanNummer(' 12 ')).toBe(12);
  });

  it('is undefined for anything that is not a court number', () => {
    expect(baanNummer('')).toBeUndefined();
    expect(baanNummer('0')).toBeUndefined();
    expect(baanNummer('-1')).toBeUndefined();
    expect(baanNummer('1,5')).toBeUndefined();
    expect(baanNummer('2b')).toBeUndefined();
  });
});

describe('baanFout', () => {
  it('is null for a court that makes sense', () => {
    expect(baanFout(concept(), bestaand)).toBeNull();
    expect(baanFout(concept({ uurtarief: '€ 22,50', indoor: true }), bestaand)).toBeNull();
  });

  it('demands a name', () => {
    expect(baanFout(concept({ naam: '   ' }), bestaand)).toBe('Geef de baan een naam.');
  });

  it('demands a whole positive number', () => {
    const melding = 'Geef de baan een nummer: een heel getal vanaf 1.';
    expect(baanFout(concept({ nummer: '' }), bestaand)).toBe(melding);
    expect(baanFout(concept({ nummer: '0' }), bestaand)).toBe(melding);
    expect(baanFout(concept({ nummer: '3,5' }), bestaand)).toBe(melding);
  });

  it('refuses a number that another court already carries', () => {
    // Twee keer "baan 11" is voor de club één baan met twee tarieven.
    expect(baanFout(concept({ nummer: '11' }), bestaand)).toBe('Baan 11 bestaat al.');
    expect(baanFout(concept({ nummer: ' 2 ' }), bestaand)).toBe('Baan 2 bestaat al.');
  });

  it('demands an amount that lib/money can read', () => {
    const melding = 'Vul een uurtarief in, bijvoorbeeld 30 of 22,50.';
    expect(baanFout(concept({ uurtarief: '' }), bestaand)).toBe(melding);
    expect(baanFout(concept({ uurtarief: 'gratis' }), bestaand)).toBe(melding);
    expect(baanFout(concept({ uurtarief: '-5' }), bestaand)).toBe(melding);
  });

  it('accepts a free amount of zero: that is a choice, not a mistake', () => {
    expect(baanFout(concept({ uurtarief: '0' }), bestaand)).toBeNull();
  });

  it('is happy with an empty club: the very first court has nothing to clash with', () => {
    expect(baanFout(concept({ nummer: '1' }), [])).toBeNull();
  });
});

describe('leesBaan', () => {
  it('turns the typed form into a court, comma and all', () => {
    expect(leesBaan(concept({ naam: '  Gravel 12 ', uurtarief: '22,50', indoor: true }))).toEqual({
      name: 'Gravel 12', number: 12, indoor: true, hourly_rate: 22.5,
    });
  });

  it('leaves the group rates off: a fresh court charges its hourly rate to everyone', () => {
    expect(leesBaan(concept())).not.toHaveProperty('group_rates');
  });

  it('is null when the number or the amount cannot be read', () => {
    expect(leesBaan(concept({ nummer: 'twaalf' }))).toBeNull();
    expect(leesBaan(concept({ uurtarief: '' }))).toBeNull();
  });
});
