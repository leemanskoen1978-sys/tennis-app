import { beperkIndex, bladerLabel } from './blader';

describe('beperkIndex', () => {
  it('laat een geldige plek staan', () => {
    expect(beperkIndex(0, 3)).toBe(0);
    expect(beperkIndex(2, 3)).toBe(2);
  });

  it('houdt je binnen de lijst als hij korter wordt', () => {
    // Je stond op de laatste en handelde die af: dan schuif je een plek terug.
    expect(beperkIndex(2, 2)).toBe(1);
    expect(beperkIndex(5, 2)).toBe(1);
  });

  it('gaat nooit onder nul', () => {
    expect(beperkIndex(-1, 3)).toBe(0);
    expect(beperkIndex(2, 0)).toBe(0);
    expect(beperkIndex(0, 0)).toBe(0);
  });

  it('vertrouwt geen onzin uit een scrollpositie', () => {
    expect(beperkIndex(Number.NaN, 3)).toBe(0);
    expect(beperkIndex(1.6, 3)).toBe(1);
  });
});

describe('bladerLabel', () => {
  it('zegt waar je bent in de rij', () => {
    expect(bladerLabel(0, 5)).toBe('1 van 5');
    expect(bladerLabel(4, 5)).toBe('5 van 5');
  });

  it('zwijgt als er niets of maar één ding is', () => {
    expect(bladerLabel(0, 1)).toBe('');
    expect(bladerLabel(0, 0)).toBe('');
  });
});
