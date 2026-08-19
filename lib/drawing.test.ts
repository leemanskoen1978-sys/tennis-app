import { isEmptyDrawing, scaleFactor, rescaleDrawing } from './drawing';
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

describe('rescaleDrawing', () => {
  const drawn: CourtDrawing = {
    width: 400,
    height: 800,
    orientation: 'vertical',
    strokes: [{ id: 's1', d: 'M10,20 L30.5,40', color: '#f00' }],
    objects: [{ id: 'o1', type: 'cone', x: 100, y: 200 }],
  };

  it('halves every coordinate when the canvas is half the size', () => {
    const out = rescaleDrawing(drawn, 200, 400);
    expect(out.width).toBe(200);
    expect(out.height).toBe(400);
    expect(out.strokes[0].d).toBe('M5,10 L15.25,20');
    expect(out.objects[0]).toEqual({ id: 'o1', type: 'cone', x: 50, y: 100 });
  });

  it('uses one factor for both axes, so a court never turns into an oval', () => {
    // A canvas twice as wide but the same height: the height is what limits it.
    const out = rescaleDrawing(drawn, 800, 800);
    expect(out.width).toBe(400);
    expect(out.height).toBe(800);
    expect(out.strokes[0].d).toBe('M10,20 L30.5,40');
  });

  it('scales up as readily as down — reopening on a bigger screen must still fill it', () => {
    const out = rescaleDrawing(drawn, 800, 1600);
    expect(out.width).toBe(800);
    expect(out.strokes[0].d).toBe('M20,40 L61,80');
    expect(out.objects[0].x).toBe(200);
  });

  it('keeps the orientation and the ids', () => {
    const out = rescaleDrawing(drawn, 200, 400);
    expect(out.orientation).toBe('vertical');
    expect(out.strokes[0].id).toBe('s1');
    expect(out.strokes[0].color).toBe('#f00');
  });

  it('leaves an empty drawing alone', () => {
    const out = rescaleDrawing(base, 200, 400);
    expect(out.strokes).toEqual([]);
    expect(out.objects).toEqual([]);
    expect(out.width).toBe(200);
  });

  it('returns the drawing untouched on nonsense sizes instead of dividing by zero', () => {
    expect(rescaleDrawing(drawn, 0, 400)).toEqual(drawn);
    expect(rescaleDrawing({ ...drawn, width: 0 }, 200, 400)).toEqual({ ...drawn, width: 0 });
  });
});
