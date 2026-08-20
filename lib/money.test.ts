import { formatEuro, parseEuro } from './money';

describe('formatEuro', () => {
  it('writes two decimals with a comma', () => {
    expect(formatEuro(30)).toBe('30,00');
    expect(formatEuro(22.5)).toBe('22,50');
    expect(formatEuro(0)).toBe('0,00');
  });
});

describe('parseEuro', () => {
  it('reads what a trainer types, comma and all', () => {
    expect(parseEuro('45')).toBe(45);
    expect(parseEuro('45,50')).toBe(45.5);
    expect(parseEuro('€ 45,50')).toBe(45.5);
    expect(parseEuro('0')).toBe(0);
  });

  it('is undefined for empty or nonsense, and for a negative amount', () => {
    expect(parseEuro('')).toBeUndefined();
    expect(parseEuro('   ')).toBeUndefined();
    expect(parseEuro('gratis')).toBeUndefined();
    expect(parseEuro('-10')).toBeUndefined();
  });
});
