import React from 'react';
import Svg, { Rect, Line, G } from 'react-native-svg';

export type CourtOrientation = 'vertical' | 'horizontal';

/**
 * A proportional tennis court with correct markings (doubles boundary, singles
 * sidelines, net, service lines + boxes, center service line, center marks).
 * Drawn once in a 400x820 portrait space; horizontal mode rotates that group 90°.
 * The clay surface is painted full-bleed by the canvas behind this SVG.
 */
export function TennisCourt({ orientation = 'vertical' }: { orientation?: CourtOrientation }) {
  // De belijning van een tennisbaan is wit, in elk thema. Dit is geen kleur uit het palet
  // maar een eigenschap van het ding dat hier getekend wordt.
  const W = '#FFFFFF';
  const sw = 4;

  const lines = (
    <>
      {/* doubles boundary (baselines are its top/bottom edges) */}
      <Rect x={20} y={20} width={360} height={780} fill="none" stroke={W} strokeWidth={sw} />
      {/* singles sidelines */}
      <Line x1={65} y1={20} x2={65} y2={800} stroke={W} strokeWidth={sw} />
      <Line x1={335} y1={20} x2={335} y2={800} stroke={W} strokeWidth={sw} />
      {/* service lines (span singles width) */}
      <Line x1={65} y1={200} x2={335} y2={200} stroke={W} strokeWidth={sw} />
      <Line x1={65} y1={620} x2={335} y2={620} stroke={W} strokeWidth={sw} />
      {/* center service line */}
      <Line x1={200} y1={200} x2={200} y2={620} stroke={W} strokeWidth={sw} />
      {/* center marks on baselines */}
      <Line x1={200} y1={20} x2={200} y2={32} stroke={W} strokeWidth={sw} />
      <Line x1={200} y1={788} x2={200} y2={800} stroke={W} strokeWidth={sw} />
      {/* net */}
      <Line x1={20} y1={410} x2={380} y2={410} stroke={W} strokeWidth={sw + 1} opacity={0.95} />
    </>
  );

  if (orientation === 'horizontal') {
    // Rotate the portrait court into an 820x400 landscape box.
    return (
      <Svg width="100%" height="100%" viewBox="0 0 820 400" preserveAspectRatio="xMidYMid meet">
        <G transform="translate(820,0) rotate(90)">{lines}</G>
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 820" preserveAspectRatio="xMidYMid meet">
      {lines}
    </Svg>
  );
}
