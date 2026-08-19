import { useCallback, useRef, useState } from 'react';
import {
  View, PanResponder, Pressable, Text, StyleSheet, ScrollView,
  type LayoutChangeEvent, type GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Pencil, Cone, PersonStanding, Undo2, Trash2 } from 'lucide-react-native';
import { TennisCourt } from '../../components/court/TennisCourt';
import { CourtObjectGlyph, type CourtObjectType } from '../../components/court/CourtIcons';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, minTapTarget, webCursor } from '../../constants/theme';

// Court situations are local UI state only (not persisted).

type Tool = 'pen' | CourtObjectType;
interface Stroke { id: string; d: string; color: string }
interface PlacedObject { id: string; type: CourtObjectType; x: number; y: number }
type HistoryItem = { kind: 'stroke' | 'object'; id: string };

const OBJECT_SIZE = 38;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const PEN_COLORS = [tennisColors.danger, tennisColors.court, tennisColors.white, tennisColors.text];

export default function Drawing() {
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(tennisColors.danger);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState('');
  const [objects, setObjects] = useState<PlacedObject[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Refs so the (once-created) PanResponder reads the latest tool/color/path.
  const toolRef = useRef(tool); toolRef.current = tool;
  const colorRef = useRef(color); colorRef.current = color;
  const currentRef = useRef(current); currentRef.current = current;

  const placeObject = useCallback((type: CourtObjectType, x: number, y: number) => {
    const id = uid();
    setObjects((o) => [...o, { id, type, x, y }]);
    setHistory((h) => [...h, { kind: 'object', id }]);
  }, []);

  const moveObject = useCallback((id: string, x: number, y: number) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, x, y } : o)));
  }, []);

  const canvasPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => toolRef.current === 'pen',
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        if (toolRef.current === 'pen') {
          const d = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setCurrent(d);
          currentRef.current = d;
        } else {
          placeObject(toolRef.current, locationX, locationY);
        }
      },
      onPanResponderMove: (e) => {
        if (toolRef.current !== 'pen') return;
        const { locationX, locationY } = e.nativeEvent;
        setCurrent((c) => {
          const next = `${c} L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          currentRef.current = next;
          return next;
        });
      },
      onPanResponderRelease: () => {
        if (toolRef.current === 'pen' && currentRef.current) {
          const id = uid();
          const d = currentRef.current;
          const strokeColor = colorRef.current;
          setStrokes((s) => [...s, { id, d, color: strokeColor }]);
          setHistory((h) => [...h, { kind: 'stroke', id }]);
          setCurrent('');
          currentRef.current = '';
        }
      },
    }),
  ).current;

  const undo = () => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (!last) return h;
      if (last.kind === 'stroke') setStrokes((s) => s.filter((x) => x.id !== last.id));
      else setObjects((o) => o.filter((x) => x.id !== last.id));
      return h.slice(0, -1);
    });
  };

  const clearAll = () => {
    setStrokes([]); setObjects([]); setHistory([]); setCurrent('');
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarWrap} contentContainerStyle={styles.toolbar}>
        <ToolButton label="Tekenen" active={tool === 'pen'} onPress={() => setTool('pen')} icon={<Pencil size={18} color={tool === 'pen' ? tennisColors.white : tennisColors.text} />} />
        <ToolButton label="Kegel" active={tool === 'cone'} onPress={() => setTool('cone')} icon={<Cone size={18} color={tool === 'cone' ? tennisColors.white : tennisColors.text} />} />
        <ToolButton label="Speler" active={tool === 'player'} onPress={() => setTool('player')} icon={<PersonStanding size={18} color={tool === 'player' ? tennisColors.white : tennisColors.text} />} />
        <ToolButton label="Racket" active={tool === 'racket'} onPress={() => setTool('racket')} icon={<Text style={{ fontSize: 15 }}>🎾</Text>} />
        <ToolButton label="Ongedaan" active={false} onPress={undo} icon={<Undo2 size={18} color={tennisColors.text} />} />
        <ToolButton label="Wissen" active={false} onPress={clearAll} danger icon={<Trash2 size={18} color={tennisColors.danger} />} />
      </ScrollView>

      {tool === 'pen' ? (
        <View style={styles.swatches}>
          {PEN_COLORS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Kleur ${c === tennisColors.danger ? 'rood' : c === tennisColors.court ? 'blauw' : c === tennisColors.white ? 'wit' : 'zwart'}`}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive, webCursor]}
            />
          ))}
          <Text style={styles.hint}>Teken met je vinger. Kies een object om het op het veld te zetten.</Text>
        </View>
      ) : (
        <View style={styles.swatches}>
          <Text style={styles.hint}>Tik op het veld om een {tool === 'cone' ? 'kegel' : tool === 'player' ? 'speler' : 'racket'} te plaatsen. Sleep om te verplaatsen.</Text>
        </View>
      )}

      <View style={styles.canvas} onLayout={onLayout}>
        {/* Court background */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <TennisCourt />
        </View>

        {/* Drawing + placement surface */}
        <View style={StyleSheet.absoluteFill} {...canvasPan.panHandlers}>
          {size.w > 0 ? (
            <Svg width={size.w} height={size.h}>
              {strokes.map((s) => (
                <Path key={s.id} d={s.d} stroke={s.color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {current ? <Path d={current} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </Svg>
          ) : null}
        </View>

        {/* Placed objects (draggable) — above the drawing layer */}
        {objects.map((o) => (
          <DraggableObject key={o.id} obj={o} onMove={moveObject} bounds={size} />
        ))}
      </View>
    </View>
  );
}

function ToolButton({ label, active, onPress, icon, danger }: {
  label: string; active: boolean; onPress: () => void; icon: React.ReactNode; danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tool, active && styles.toolActive, webCursor]}
    >
      {icon}
      <Text style={[styles.toolText, active && styles.toolTextActive, danger && { color: tennisColors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function DraggableObject({ obj, onMove, bounds }: {
  obj: PlacedObject; onMove: (id: string, x: number, y: number) => void; bounds: { w: number; h: number };
}) {
  const posRef = useRef({ x: obj.x, y: obj.y });
  posRef.current = { x: obj.x, y: obj.y };
  const startRef = useRef({ x: obj.x, y: obj.y });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { startRef.current = { ...posRef.current }; },
      onPanResponderMove: (_e: GestureResponderEvent, g) => {
        let nx = startRef.current.x + g.dx;
        let ny = startRef.current.y + g.dy;
        if (bounds.w > 0) {
          nx = Math.max(0, Math.min(bounds.w, nx));
          ny = Math.max(0, Math.min(bounds.h, ny));
        }
        onMove(obj.id, nx, ny);
      },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.object,
        { left: obj.x - OBJECT_SIZE / 2, top: obj.y - OBJECT_SIZE / 2 },
        webCursor,
      ]}
    >
      <CourtObjectGlyph type={obj.type} size={OBJECT_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tennisColors.background },
  toolbarWrap: { flexGrow: 0, flexShrink: 0 },
  toolbar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: minTapTarget, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: tennisColors.surface,
    borderWidth: 1, borderColor: tennisColors.border,
  },
  toolActive: { backgroundColor: tennisColors.primary, borderColor: tennisColors.primary },
  toolText: { fontSize: 13, fontWeight: '600', color: tennisColors.text },
  toolTextActive: { color: tennisColors.white },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs, flexWrap: 'wrap' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: tennisColors.border },
  swatchActive: { borderColor: tennisColors.primary, borderWidth: 3 },
  hint: { color: tennisColors.textMuted, fontSize: 12, flexShrink: 1 },
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: tennisColors.clay },
  object: { position: 'absolute', width: OBJECT_SIZE, height: OBJECT_SIZE * 1.3, alignItems: 'center', justifyContent: 'center' },
});
