import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, PanResponder, Pressable, Text, StyleSheet, ScrollView, Modal, TextInput,
  type LayoutChangeEvent, type GestureResponderEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Pencil, Cone, PersonStanding, Undo2, Trash2, RotateCw, Save, X } from 'lucide-react-native';
import { TennisCourt } from '../../components/court/TennisCourt';
import { CourtObjectGlyph } from '../../components/court/CourtIcons';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { Button } from '../../components/ui/Button';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { isEmptyDrawing, rescaleDrawing } from '../../lib/drawing';
import type {
  CourtDrawing, CourtObject, CourtObjectType, CourtOrientation, CourtStroke,
} from '../../lib/types';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, minTapTarget, webCursor } from '../../constants/theme';

// The canvas keeps the situation in local state. It only becomes durable when you hand it
// to a progress note — see "Bewaren bij voortgang" below.

type Tool = 'pen' | CourtObjectType;
type HistoryItem = { kind: 'stroke' | 'object'; id: string };

const OBJECT_SIZE = 38;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// Vaste kleuren, geen palet-kleuren. Een gekozen penkleur wordt mee opgeslagen in de
// tekening; zou daar een thema-kleur in staan, dan veranderde een bewaarde tekening van
// kleur zodra iemand naar donker omschakelt. Een tekening op een oranje gravelbaan hoort
// er bovendien in elk thema hetzelfde uit te zien.
const PEN_COLORS = [
  { value: '#C0392B', label: 'rood' },
  { value: '#2C5F8A', label: 'blauw' },
  { value: '#FFFFFF', label: 'wit' },
  { value: '#16221A', label: 'zwart' },
] as const;

export default function Drawing() {
  const router = useRouter();
  const { currentUser, users, lessons, addLesson, updateLesson } = useSimpleData();

  // Arriving from a lesson: draw the situation that belongs to it and go back when done.
  // The id comes from a URL, so it is checked against the real lessons before it is
  // trusted; an unknown id falls back to the plain "make a new lesson" behaviour.
  const { lessonId } = useLocalSearchParams<{ lessonId?: string }>();
  const forLesson = lessons.find((l) => l.id === lessonId) ?? null;
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [savePlayerId, setSavePlayerId] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState<string>(PEN_COLORS[0].value);
  const [strokes, setStrokes] = useState<CourtStroke[]>([]);
  const [current, setCurrent] = useState('');
  const [objects, setObjects] = useState<CourtObject[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [orientation, setOrientation] = useState<CourtOrientation>('vertical');
  const loadedFor = useRef<string | null>(null);

  // Load the lesson's drawing once the canvas knows its size — it was saved in whatever
  // size it was drawn in, so it has to be rescaled to fit this one.
  useEffect(() => {
    if (!forLesson?.drawing || size.w === 0 || size.h === 0) return;
    if (loadedFor.current === forLesson.id) return;
    loadedFor.current = forLesson.id;
    const scene = rescaleDrawing(forLesson.drawing, size.w, size.h);
    setStrokes(scene.strokes);
    setObjects(scene.objects);
    setOrientation(scene.orientation);
    setHistory([
      ...scene.strokes.map((x) => ({ kind: 'stroke' as const, id: x.id })),
      ...scene.objects.map((x) => ({ kind: 'object' as const, id: x.id })),
    ]);
  }, [forLesson, size.w, size.h]);

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

  const isCoach = currentUser?.role === 'coach';
  const students = users.filter((u) => u.role !== 'coach');

  const scene = (): CourtDrawing => ({
    width: size.w, height: size.h, orientation, strokes, objects,
  });
  const nothingDrawn = isEmptyDrawing(scene());

  /** Drawing for a lesson that already exists: save straight onto it and go back. */
  const saveToLesson = async () => {
    if (!forLesson || nothingDrawn) return;
    await updateLesson(forLesson.id, { drawing: scene() });
    router.back();
  };

  /**
   * A court situation is teaching material: an exercise you draw once and use again, not
   * a remark about one player. So it becomes a lesson in the library. Assigning it to a
   * player runs through the normal lesson plan, same as a video or a PDF.
   */
  const saveAsLesson = async () => {
    if (!currentUser || nothingDrawn || !saveTitle.trim()) return;
    await addLesson({
      title: saveTitle.trim(),
      description: saveDescription.trim() || undefined,
      uploaded_by: currentUser.id,
      coach_id: currentUser.id,
      drawing: scene(),
      ...(savePlayerId ? { student_id: savePlayerId, status: 'gepland' as const } : {}),
    });
    setSaveOpen(false);
    setSaveTitle('');
    setSaveDescription('');
    setSavePlayerId(null);
    // Naar de databank en niet naar de tegels: je wilt de veldsituatie die je net
    // opsloeg terugzien, niet opnieuw een keuze maken.
    router.push('/coaches/lessons/databank');
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarWrap} contentContainerStyle={styles.toolbar}>
        <ToolButton label="Tekenen" active={tool === 'pen'} onPress={() => setTool('pen')} icon={<Pencil size={18} color={tool === 'pen' ? tennisColors.onFill : tennisColors.text} />} />
        <ToolButton label="Kegel" active={tool === 'cone'} onPress={() => setTool('cone')} icon={<Cone size={18} color={tool === 'cone' ? tennisColors.onFill : tennisColors.text} />} />
        <ToolButton label="Speler" active={tool === 'player'} onPress={() => setTool('player')} icon={<PersonStanding size={18} color={tool === 'player' ? tennisColors.onFill : tennisColors.text} />} />
        <ToolButton label="Racket" active={tool === 'racket'} onPress={() => setTool('racket')} icon={<Text style={{ fontSize: 15 }}>🎾</Text>} />
        <ToolButton
          label={orientation === 'vertical' ? 'Horizontaal' : 'Verticaal'}
          active={false}
          onPress={() => setOrientation((o) => (o === 'vertical' ? 'horizontal' : 'vertical'))}
          icon={<RotateCw size={18} color={tennisColors.text} />}
        />
        <ToolButton label="Ongedaan" active={false} onPress={undo} icon={<Undo2 size={18} color={tennisColors.text} />} />
        <ToolButton label="Wissen" active={false} onPress={clearAll} danger icon={<Trash2 size={18} color={tennisColors.danger} />} />
        {isCoach ? (
          <ToolButton
            label={forLesson ? `Bewaren bij "${forLesson.title}"` : 'Bewaren als lesmateriaal'}
            active={false}
            disabled={nothingDrawn}
            onPress={() => { if (forLesson) void saveToLesson(); else setSaveOpen(true); }}
            icon={<Save size={18} color={nothingDrawn ? tennisColors.textMuted : tennisColors.text} />}
          />
        ) : null}
      </ScrollView>

      {tool === 'pen' ? (
        <View style={styles.swatches}>
          {PEN_COLORS.map((c) => (
            <Pressable
              key={c.value}
              accessibilityRole="button"
              accessibilityLabel={`Kleur ${c.label}`}
              onPress={() => setColor(c.value)}
              style={[styles.swatch, { backgroundColor: c.value }, color === c.value && styles.swatchActive, webCursor]}
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
          <TennisCourt orientation={orientation} />
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

      <Modal visible={saveOpen} transparent animationType="slide" onRequestClose={() => setSaveOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Bewaren als lesmateriaal</Text>
              <Pressable
                onPress={() => setSaveOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Sluiten"
                style={webCursor}
              >
                <X size={22} color={tennisColors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>
              De oefening komt in de bibliotheek. Je kunt hem later aan een speler toewijzen.
            </Text>

            <Text style={styles.sheetLabel}>Titel</Text>
            <TextInput
              style={styles.input}
              value={saveTitle}
              onChangeText={setSaveTitle}
              placeholder="bv. Kruisoefening met kegels"
              placeholderTextColor={tennisColors.textMuted}
            />

            <Text style={styles.sheetLabel}>Beschrijving (optioneel)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={saveDescription}
              onChangeText={setSaveDescription}
              placeholder="Wat oefen je hiermee?"
              placeholderTextColor={tennisColors.textMuted}
              multiline
            />

            <Text style={styles.sheetLabel}>Meteen toewijzen (optioneel)</Text>
            <StudentCombobox
              students={students}
              value={savePlayerId}
              onChange={setSavePlayerId}
              placeholder="Typ de naam van de speler…"
            />

            <Button
              label="Bewaren"
              variant="primary"
              disabled={!saveTitle.trim()}
              onPress={() => { void saveAsLesson(); }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolButton({ label, active, onPress, icon, danger, disabled }: {
  label: string; active: boolean; onPress: () => void; icon: React.ReactNode;
  danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, active && styles.toolActive, disabled && styles.toolDisabled, webCursor]}
    >
      {icon}
      <Text style={[
        styles.toolText,
        active && styles.toolTextActive,
        danger && { color: tennisColors.danger },
        disabled && { color: tennisColors.textMuted },
      ]}>{label}</Text>
    </Pressable>
  );
}

function DraggableObject({ obj, onMove, bounds }: {
  obj: CourtObject; onMove: (id: string, x: number, y: number) => void; bounds: { w: number; h: number };
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
  toolActive: { backgroundColor: tennisColors.primaryFill, borderColor: tennisColors.primaryFill },
  toolDisabled: { opacity: 0.5 },
  toolText: { fontSize: 13, fontWeight: '600', color: tennisColors.text },
  toolTextActive: { color: tennisColors.onFill },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xs, flexWrap: 'wrap' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: tennisColors.border },
  swatchActive: { borderColor: tennisColors.primary, borderWidth: 3 },
  hint: { color: tennisColors.textMuted, fontSize: 12, flexShrink: 1 },
  canvas: { flex: 1, overflow: 'hidden', backgroundColor: tennisColors.clay },
  object: { position: 'absolute', width: OBJECT_SIZE, height: OBJECT_SIZE * 1.3, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, gap: spacing.md,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...typography.h2, color: tennisColors.text },
  sheetHint: { fontSize: 13, color: tennisColors.textMuted },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: tennisColors.text },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: tennisColors.text, backgroundColor: tennisColors.background,
  },
  multiline: { minHeight: 64, textAlignVertical: 'top' },
});
