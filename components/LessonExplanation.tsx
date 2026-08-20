import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react-native';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, webCursor } from '../constants/theme';
import type { ExplanationPoint } from '../lib/types';

const newPointId = () => `ep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * The running explanation under a court situation.
 *
 * It sits in the read view rather than behind the edit button: adding a point is the thing
 * you do often, and it should not cost three taps. Every change is written straight away.
 *
 * The points carry no date and no author — the current state is what counts, not the
 * history of how it got there, so an old point can simply be corrected.
 */
export function LessonExplanation({
  lessonId, points, canEdit,
}: {
  lessonId: string;
  points: ExplanationPoint[];
  canEdit: boolean;
}) {
  const { updateLesson } = useSimpleData();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const write = (next: ExplanationPoint[]) =>
    updateLesson(lessonId, { explanation: next.length > 0 ? next : undefined });

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    void write([...points, { id: newPointId(), text }]);
    setDraft('');
  };

  const saveEdit = () => {
    const text = editText.trim();
    if (!text || editingId === null) return;
    void write(points.map((p) => (p.id === editingId ? { ...p, text } : p)));
    setEditingId(null);
  };

  const remove = (id: string) => {
    void write(points.filter((p) => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  if (!canEdit && points.length === 0) return null;

  return (
    <>
      <Text style={styles.label}>Uitleg bij de veldsituatie</Text>

      {points.length === 0 ? (
        <Text style={styles.empty}>Nog geen uitleg.</Text>
      ) : (
        points.map((point) =>
          editingId === point.id ? (
            <View key={point.id} style={styles.editRow}>
              <TextInput
                style={[styles.input, styles.grow]}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
              />
              <Pressable
                onPress={saveEdit}
                accessibilityRole="button"
                accessibilityLabel="Punt opslaan"
                style={[styles.iconBtn, webCursor]}
              >
                <Check size={18} color={tennisColors.primary} />
              </Pressable>
              <Pressable
                onPress={() => setEditingId(null)}
                accessibilityRole="button"
                accessibilityLabel="Wijziging annuleren"
                style={[styles.iconBtn, webCursor]}
              >
                <X size={18} color={tennisColors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View key={point.id} style={styles.row}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>{point.text}</Text>
              {canEdit ? (
                <>
                  <Pressable
                    onPress={() => { setEditingId(point.id); setEditText(point.text); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Punt aanpassen: ${point.text}`}
                    style={[styles.iconBtn, webCursor]}
                  >
                    <Pencil size={16} color={tennisColors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => remove(point.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Punt verwijderen: ${point.text}`}
                    style={[styles.iconBtn, webCursor]}
                  >
                    <Trash2 size={16} color={tennisColors.danger} />
                  </Pressable>
                </>
              ) : null}
            </View>
          ),
        )
      )}

      {canEdit ? (
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.grow]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nog een punt…"
            placeholderTextColor={tennisColors.textMuted}
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <Pressable
            onPress={add}
            disabled={draft.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Uitleg toevoegen"
            accessibilityState={{ disabled: draft.trim().length === 0 }}
            style={[styles.addBtn, draft.trim().length === 0 && styles.addBtnOff, webCursor]}
          >
            <Plus size={18} color={draft.trim() ? tennisColors.onFill : tennisColors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md },
  empty: { fontSize: 14, color: tennisColors.textMuted, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs },
  bullet: { fontSize: 14, color: tennisColors.text, lineHeight: 22 },
  text: { flex: 1, fontSize: 14, color: tennisColors.text, lineHeight: 22 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  grow: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  iconBtn: { padding: 6, borderRadius: radius.sm },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: tennisColors.primaryFill,
  },
  addBtnOff: { backgroundColor: tennisColors.border },
});
