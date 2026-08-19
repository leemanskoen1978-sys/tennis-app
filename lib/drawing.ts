// Helpers for court drawings saved with a progress note.

import type { CourtDrawing } from './types';

/** Nothing drawn and nothing placed — not worth attaching to a note. */
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
