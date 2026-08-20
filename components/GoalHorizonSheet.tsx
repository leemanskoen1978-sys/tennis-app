// Alle doelen van één horizon, in een blad. Het dossier toonde ze eerder als drie grote
// blokken met alle invulvelden open; daardoor was er van "Binnen 10 lessen" nauwelijks meer
// te zien dan de kop. Nu draagt de regel in het dossier alleen wat je nodig hebt om te zien
// of er iets is afgesproken, en wonen de velden — met toevoegen en verwijderen — hier.
// Zelfde opbouw als het detailblad van het maandoverzicht (components/LessonDetailSheet).

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';

import { OptionCombobox } from './ui/OptionCombobox';
import { HORIZON_LABELS, isEmptyGoal } from '../lib/goals';
import type { GoalHorizon, PlayerGoal } from '../lib/types';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow, minTapTarget, webCursor } from '../constants/theme';

export function GoalHorizonSheet({
  horizon, goals, shots, changes, canEdit, visible, onClose, onSave, onDelete, onAdd,
}: {
  horizon: GoalHorizon;
  goals: PlayerGoal[];
  shots: string[];
  changes: string[];
  /** Alleen een trainer vult doelen in; een speler mag wel lezen wat er is afgesproken. */
  canEdit: boolean;
  visible: boolean;
  onClose: () => void;
  onSave: (goal: PlayerGoal) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}): React.JSX.Element {
  // De opmerkingen houden hier hun eigen tekst bij, per doel, zodat typen niet vecht met de
  // opgeslagen waarde. Ze staan met opzet in het blad en niet in het veld zelf: bij het
  // sluiten moet wat er getypt is nog bewaard kunnen worden, en dan bestaat het veld niet meer.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Een blad dat opnieuw opengaat begint bij wat er is opgeslagen. Bleven de oude concepten
  // staan, dan zou een doel dat elders is gewijzigd hier met verouderde tekst terugkomen.
  useEffect(() => {
    if (visible) setDrafts({});
  }, [visible]);

  const notesOf = (goal: PlayerGoal): string => drafts[goal.id] ?? goal.notes ?? '';

  const saveNotes = (goal: PlayerGoal, text: string): void => {
    const notes = text.trim() || undefined;
    if (notes === (goal.notes ?? undefined)) return;
    onSave({ ...goal, notes });
  };

  /**
   * Opslaan gebeurt op `onBlur` — `onEndEditing` doet op web niets. Maar op een telefoon
   * sluit je het blad met de kruisknop of met de terugknop terwijl de cursor nog in het
   * opmerkingenveld staat: dan komt die blur nooit. Daarom loopt het sluiten altijd eerst
   * langs de concepten en bewaart wat er is veranderd.
   */
  const closeAndSave = (): void => {
    for (const goal of goals) {
      const draft = drafts[goal.id];
      if (draft !== undefined) saveNotes(goal, draft);
    }
    onClose();
  };

  // Een speler ziet wat er is afgesproken, dus een doel dat nog wordt ingevuld blijft
  // buiten beeld. Zelfde regel als voorheen op de kaart in het dossier.
  const shown = canEdit ? goals : goals.filter((g) => !isEmptyGoal(g));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeAndSave}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{HORIZON_LABELS[horizon]}</Text>
            <Pressable
              onPress={closeAndSave}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              style={[styles.close, webCursor]}
            >
              <X size={20} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {shown.length === 0 ? (
              <Text style={styles.muted}>Nog geen doel afgesproken.</Text>
            ) : null}

            {shown.map((goal, i) => {
              const where = `doel ${i + 1} — ${HORIZON_LABELS[horizon]}`;
              if (!canEdit) {
                return (
                  <View key={goal.id} style={styles.goal}>
                    <Text style={styles.goalNr}>Doel {i + 1}</Text>
                    {goal.shot_type ? (
                      <Text style={styles.readValue}>Slag: {goal.shot_type}</Text>
                    ) : null}
                    {goal.change_type ? (
                      <Text style={styles.readValue}>Wijziging: {goal.change_type}</Text>
                    ) : null}
                    {goal.notes ? <Text style={styles.readNotes}>{goal.notes}</Text> : null}
                  </View>
                );
              }
              return (
                <View key={goal.id} style={styles.goal}>
                  <View style={styles.goalHead}>
                    <Text style={styles.goalNr}>Doel {i + 1}</Text>
                    <Pressable
                      onPress={() => onDelete(goal.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Verwijder ${where}`}
                      style={[styles.removeBtn, webCursor]}
                    >
                      <Trash2 size={16} color={tennisColors.danger} />
                      <Text style={styles.removeText}>Verwijderen</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>Type slag</Text>
                  <OptionCombobox
                    label={`Type slag — ${where}`}
                    options={shots}
                    value={goal.shot_type ?? null}
                    onChange={(v) => onSave({ ...goal, shot_type: v ?? undefined })}
                    placeholder="Forehand, Backhand…"
                  />

                  <Text style={styles.label}>Type wijziging</Text>
                  <OptionCombobox
                    label={`Type wijziging — ${where}`}
                    options={changes}
                    value={goal.change_type ?? null}
                    onChange={(v) => onSave({ ...goal, change_type: v ?? undefined })}
                    placeholder="Greepwissel, Regelmaat…"
                  />

                  <Text style={styles.label}>Opmerkingen</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    value={notesOf(goal)}
                    onChangeText={(t) => setDrafts((d) => ({ ...d, [goal.id]: t }))}
                    onBlur={() => saveNotes(goal, notesOf(goal))}
                    placeholder="Wat spreek je af?"
                    placeholderTextColor={tennisColors.textMuted}
                    accessibilityLabel={`Opmerkingen — ${where}`}
                    multiline
                  />
                </View>
              );
            })}

            {canEdit ? (
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel={`Doel toevoegen — ${HORIZON_LABELS[horizon]}`}
                style={[styles.addBtn, webCursor]}
              >
                <Plus size={18} color={tennisColors.primary} />
                <Text style={styles.addText}>Doel toevoegen</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h2, color: tennisColors.text, flexShrink: 1 },
  close: {
    minHeight: minTapTarget, minWidth: minTapTarget,
    alignItems: 'flex-end', justifyContent: 'center',
  },
  body: { gap: spacing.xs, paddingBottom: spacing.lg },
  muted: { ...typography.body, color: tennisColors.textMuted },
  goal: {
    backgroundColor: tennisColors.surfaceAlt,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalNr: { fontSize: 13, fontWeight: '800', color: tennisColors.text },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  removeText: { fontSize: 13, fontWeight: '600', color: tennisColors.danger },
  label: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: 2,
  },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: tennisColors.border, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  addText: { fontSize: 14, fontWeight: '700', color: tennisColors.primary },
  readValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  readNotes: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs, lineHeight: 20 },
});
