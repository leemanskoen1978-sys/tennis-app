import React from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import { tennisColors } from '../../constants/tennis-colors';

/**
 * A proportional tennis court (portrait) drawn with correct markings:
 * doubles boundary, singles sidelines, net, service lines + boxes,
 * center service line and center marks. Clay surface.
 */
export function TennisCourt() {
  const W = tennisColors.white;
  const sw = 4;
  // Lines only + a transparent background: the clay is painted full-bleed by the
  // canvas behind this SVG, so the court fills the whole screen. The viewBox is
  // cropped tight to the court so meet-scaling makes the lines as large as possible.
  return (
    <Svg width="100%" height="100%" viewBox="10 8 380 804" preserveAspectRatio="xMidYMid meet">
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
    </Svg>
  );
}
