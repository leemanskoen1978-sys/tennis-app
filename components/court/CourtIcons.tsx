import React from 'react';
import Svg, { Polygon, Ellipse, Circle, Line, Path } from 'react-native-svg';

export type CourtObjectType = 'cone' | 'player' | 'racket';

/** Orange training cone (triangle + base + white band). */
export function ConeIcon({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={28} rx={11} ry={3} fill="#B5541F" />
      <Polygon points="16,4 25,28 7,28" fill="#E8752A" stroke="#B5541F" strokeWidth={1} />
      <Polygon points="11,17 21,17 22.5,21 9.5,21" fill="#FFFFFF" opacity={0.9} />
    </Svg>
  );
}

/** Blue player figure. */
export function PlayerIcon({ size = 34 }: { size?: number }) {
  const c = '#2C5F8A';
  return (
    <Svg width={size} height={size * 1.15} viewBox="0 0 32 38">
      <Circle cx={16} cy={7} r={5} fill={c} />
      {/* torso */}
      <Path d="M16 12 C 11 12, 11 15, 11 20 L 21 20 C 21 15, 21 12, 16 12 Z" fill={c} />
      {/* arms */}
      <Line x1={12} y1={14} x2={6} y2={20} stroke={c} strokeWidth={3} strokeLinecap="round" />
      <Line x1={20} y1={14} x2={26} y2={20} stroke={c} strokeWidth={3} strokeLinecap="round" />
      {/* legs */}
      <Line x1={14} y1={20} x2={13} y2={34} stroke={c} strokeWidth={3.5} strokeLinecap="round" />
      <Line x1={18} y1={20} x2={19} y2={34} stroke={c} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Tennis racket. */
export function RacketIcon({ size = 34 }: { size?: number }) {
  const frame = '#2E6B30';
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 32 40">
      <Ellipse cx={16} cy={12} rx={9} ry={11} fill="#FFFFFF" stroke={frame} strokeWidth={2.5} />
      {/* strings */}
      <Line x1={11} y1={3} x2={11} y2={21} stroke="#CBD5C0" strokeWidth={0.8} />
      <Line x1={16} y1={2} x2={16} y2={22} stroke="#CBD5C0" strokeWidth={0.8} />
      <Line x1={21} y1={3} x2={21} y2={21} stroke="#CBD5C0" strokeWidth={0.8} />
      <Line x1={8} y1={8} x2={24} y2={8} stroke="#CBD5C0" strokeWidth={0.8} />
      <Line x1={7} y1={12} x2={25} y2={12} stroke="#CBD5C0" strokeWidth={0.8} />
      <Line x1={8} y1={16} x2={24} y2={16} stroke="#CBD5C0" strokeWidth={0.8} />
      {/* handle */}
      <Line x1={16} y1={23} x2={16} y2={37} stroke="#7A4A22" strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

export function CourtObjectGlyph({ type, size }: { type: CourtObjectType; size?: number }) {
  if (type === 'cone') return <ConeIcon size={size} />;
  if (type === 'player') return <PlayerIcon size={size} />;
  return <RacketIcon size={size} />;
}
