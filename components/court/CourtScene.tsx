import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TennisCourt } from './TennisCourt';
import { CourtObjectGlyph } from './CourtIcons';
import { scaleFactor } from '../../lib/drawing';
import { tennisColors } from '../../constants/tennis-colors';
import { radius } from '../../constants/theme';
import type { CourtDrawing } from '../../lib/types';

const OBJECT_SIZE = 38;

/**
 * Read-only replay of a saved court situation, scaled to fit `width`. The scene is stored
 * as strokes and objects rather than an image, so this stays sharp at any size.
 */
export function CourtScene({ drawing, width }: { drawing: CourtDrawing; width: number }) {
  const k = scaleFactor(drawing, width);
  const w = drawing.width * k;
  const h = drawing.height * k;

  return (
    <View style={[styles.frame, { width: w, height: h }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TennisCourt orientation={drawing.orientation} />
      </View>

      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {drawing.strokes.map((s) => (
          <Path
            key={s.id}
            d={s.d}
            stroke={s.color}
            strokeWidth={3 * k}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            // The path is in the drawing's own coordinates; scale it as a whole.
            transform={`scale(${k})`}
          />
        ))}
      </Svg>

      {drawing.objects.map((o) => (
        <View
          key={o.id}
          pointerEvents="none"
          style={[
            styles.object,
            {
              left: o.x * k - (OBJECT_SIZE * k) / 2,
              top: o.y * k - (OBJECT_SIZE * k * 1.3) / 2,
              width: OBJECT_SIZE * k,
              height: OBJECT_SIZE * k * 1.3,
            },
          ]}
        >
          <CourtObjectGlyph type={o.type} size={OBJECT_SIZE * k} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: tennisColors.clay,
  },
  object: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
