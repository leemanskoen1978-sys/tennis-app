// Helpers for court drawings saved as lesson material.

import type { CourtDrawing } from './types';

/** Nothing drawn and nothing placed — not worth saving as an exercise. */
export function isEmptyDrawing(d: CourtDrawing | undefined | null): boolean {
  if (!d) return true;
  return d.strokes.length === 0 && d.objects.length === 0;
}

/**
 * How much to shrink a drawing to fit a target width. Never scales up: a thumbnail of a
 * court situation should stay crisp, and a wide card should not blow up a small sketch.
 */
export function scaleFactor(d: CourtDrawing, targetWidth: number): number {
  if (d.width <= 0 || targetWidth <= 0) return 1;
  return Math.min(1, targetWidth / d.width);
}

/** Trim float noise: 15.250000000000002 is not a coordinate anyone wants to read. */
const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Reopen a saved drawing on a canvas of a different size.
 *
 * The scene is stored in the size it was drawn in, and the canvas it comes back to is
 * almost never that size. One factor is used for both axes — the smaller of the two — so a
 * court keeps its proportions instead of stretching into an oval. Unlike `scaleFactor`
 * this does scale up: reopening on a larger screen should fill it, not sit in a corner.
 *
 * The paths are our own format ('M x,y L x,y …'), so every number in them is a coordinate
 * and can be scaled without parsing SVG.
 */
export function rescaleDrawing(d: CourtDrawing, width: number, height: number): CourtDrawing {
  if (d.width <= 0 || d.height <= 0 || width <= 0 || height <= 0) return d;
  const k = Math.min(width / d.width, height / d.height);
  if (k === 1) return d;

  return {
    ...d,
    width: round(d.width * k),
    height: round(d.height * k),
    strokes: d.strokes.map((s) => ({
      ...s,
      d: s.d.replace(/-?\d+(\.\d+)?/g, (n) => String(round(Number(n) * k))),
    })),
    objects: d.objects.map((o) => ({ ...o, x: round(o.x * k), y: round(o.y * k) })),
  };
}
