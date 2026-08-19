import { useRef, useState } from 'react';
import {
  View,
  PanResponder,
  Pressable,
  Text,
  StyleSheet,
  type GestureResponderEvent,
  type PanResponderInstance,
} from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { tennisColors } from '../../constants/tennis-colors';

// NOTE: Drawing is local UI state only — nothing is persisted.
// Reloading the screen clears the canvas.

type Stroke = { d: string; color: string };

const SWATCHES: readonly string[] = [
  tennisColors.danger,
  tennisColors.court,
  tennisColors.text,
  tennisColors.accent,
];

export default function Drawing(): React.JSX.Element {
  const [paths, setPaths] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [color, setColor] = useState<string>(tennisColors.danger);

  // Ref so the PanResponder closure always reads the latest selected color.
  const colorRef = useRef<string>(color);

  const selectColor = (next: string): void => {
    colorRef.current = next;
    setColor(next);
  };

  const clear = (): void => {
    setPaths([]);
    setCurrent('');
  };

  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrent(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrent((prev) => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        setCurrent((prev) => {
          if (prev !== '') {
            setPaths((existing) => [
              ...existing,
              { d: prev, color: colorRef.current },
            ]);
          }
          return '';
        });
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {SWATCHES.map((swatch) => {
          const active = swatch === color;
          return (
            <Pressable
              key={swatch}
              accessibilityLabel={`Kleur ${swatch}`}
              onPress={() => selectColor(swatch)}
              style={[
                styles.swatch,
                { backgroundColor: swatch },
                active && styles.swatchActive,
              ]}
            />
          );
        })}
        <Pressable onPress={clear} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Wissen</Text>
        </Pressable>
      </View>

      <View style={styles.canvas} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {/* Green court background */}
          <Rect
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            fill={tennisColors.primary}
          />
          {/* White court outline (10% inset) */}
          <Rect
            x="10%"
            y="10%"
            width="80%"
            height="80%"
            fill="none"
            stroke={tennisColors.white}
            strokeWidth={2}
          />
          {/* White center line */}
          <Line
            x1="50%"
            y1="10%"
            x2="50%"
            y2="90%"
            stroke={tennisColors.white}
            strokeWidth={2}
          />
          {/* Committed strokes */}
          {paths.map((stroke, index) => (
            <Path
              key={index}
              d={stroke.d}
              stroke={stroke.color}
              strokeWidth={3}
              fill="none"
            />
          ))}
          {/* In-progress stroke */}
          {current !== '' && (
            <Path d={current} stroke={color} strokeWidth={3} fill="none" />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: tennisColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: tennisColors.border,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: tennisColors.text,
  },
  clearButton: {
    marginLeft: 'auto',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: tennisColors.danger,
  },
  clearButtonText: {
    color: tennisColors.white,
    fontWeight: '600',
  },
  canvas: {
    flex: 1,
    backgroundColor: tennisColors.primary,
  },
});
