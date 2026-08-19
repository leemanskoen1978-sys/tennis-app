import { isEmptyDrawing, scaleFactor } from './drawing';
import type { CourtDrawing } from './types';

const base: CourtDrawing = {
  width: 400, height: 800, orientation: 'vertical', strokes: [], objects: [],
};

describe('isEmptyDrawing', () => {
  it('is empty without a drawing at all', () => {
    expect(isEmptyDrawing(undefined)).toBe(true);
    expect(isEmptyDrawing(null)).toBe(true);
  });
  it('is empty when nothing was drawn or placed', () => {
    expect(isEmptyDrawing(base)).toBe(true);
  });
  it('is not empty with a stroke, or with only a placed object', () => {
    expect(isEmptyDrawing({ ...base, strokes: [{ id: '1', d: 'M0,0', color: '#000' }] })).toBe(false);
    expect(isEmptyDrawing({ ...base, objects: [{ id: '1', type: 'cone', x: 5, y: 5 }] })).toBe(false);
  });
});

describe('scaleFactor', () => {
  it('shrinks to fit the target width', () => {
    expect(scaleFactor(base, 200)).toBe(0.5);
  });
  it('never scales up beyond the original size', () => {
    expect(scaleFactor(base, 900)).toBe(1);
    expect(scaleFactor(base, 400)).toBe(1);
  });
  it('falls back to 1 on nonsense sizes instead of dividing by zero', () => {
    expect(scaleFactor({ ...base, width: 0 }, 200)).toBe(1);
    expect(scaleFactor(base, 0)).toBe(1);
  });
});
