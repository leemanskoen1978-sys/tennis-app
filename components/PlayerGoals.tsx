import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Target, Plus, Trash2 } from 'lucide-react-native';
import { Card } from './ui/Card';
import { OptionCombobox } from './ui/OptionCombobox';
import { useSimpleData } from '../providers/SimpleDataProvider';
import {
  GOAL_HORIZONS, HORIZON_LABELS, goalsFor, isEmptyGoal, newGoalId,
  shotTypeOptions, changeTypeOptions,
} from '../lib/goals';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, webCursor } from '../constants/theme';
import type { GoalHorizon, PlayerGoal } from '../lib/types';

/**
 * What a player is working towards, over three horizons — with as many goals per horizon
 * as the coach wants. A backhand grip change and more regularity on the serve are two
 * goals for the same ten lessons, not one.
 *
 * Every field writes straight through; there is no save button. A goal is a handful of
 * fields you adjust in passing after a lesson, and a form you must remember to submit is a
 * form that keeps a stale goal on screen. Removing a goal is the one deliberate act, so it
 * has its own link.
 */
export function PlayerGoals({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const { goals, settings, saveGoal, deleteGoal } = useSimpleData();
  const shots = shotTypeOptions(settings);
  const changes = changeTypeOptions(settings);

  return (
    <>
      <View style={styles.heading}>
        <Target size={18} color={tennisColors.primary} />
        <Text style={styles.headingText}>Doelen</Text>
      </View>

      {GOAL_HORIZONS.map((horizon) => (
        <HorizonBlock
          key={horizon}
          horizon={horizon}
          goals={goalsFor(goals, studentId, horizon)}
          shots={shots}
          changes={changes}
          canEdit={canEdit}
          onSave={(goal) => void saveGoal(goal)}
          onDelete={(id) => void deleteGoal(id)}
          onAdd={() =>
            void saveGoal({ id: newGoalId(), student_id: studentId, horizon })
          }
        />
      ))}
    </>
  );
}

function HorizonBlock({
  horizon, goals, shots, changes, canEdit, onSave, onDelete, onAdd,
}: {
  horizon: GoalHorizon;
  goals: PlayerGoal[];
  shots: string[];
  changes: string[];
  canEdit: boolean;
  onSave: (goal: PlayerGoal) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  // A player sees what was agreed, so a goal still being filled in stays out of sight.
  const shown = canEdit ? goals : goals.filter((g) => !isEmptyGoal(g));

  return (
    <Card style={styles.card}>
      <Text style={styles.horizon}>{HORIZON_LABELS[horizon]}</Text>

      {shown.length === 0 ? (
        <Text style={styles.muted}>Nog geen doel afgesproken.</Text>
      ) : null}

      {shown.map((goal, i) =>
        canEdit ? (
          <GoalFields
            key={goal.id}
            goal={goal}
            index={i}
            horizon={horizon}
            shots={shots}
            changes={changes}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : (
          <View key={goal.id} style={styles.readGoal}>
            {goal.shot_type ? <Text style={styles.readValue}>Slag: {goal.shot_type}</Text> : null}
            {goal.change_type ? (
              <Text style={styles.readValue}>Wijziging: {goal.change_type}</Text>
            ) : null}
            {goal.notes ? <Text style={styles.readNotes}>{goal.notes}</Text> : null}
          </View>
        ),
      )}

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
    </Card>
  );
}

function GoalFields({
  goal, index, horizon, shots, changes, onSave, onDelete,
}: {
  goal: PlayerGoal;
  index: number;
  horizon: GoalHorizon;
  shots: string[];
  changes: string[];
  onSave: (goal: PlayerGoal) => void;
  onDelete: (id: string) => void;
}) {
  // The notes box keeps its own text so typing does not fight the stored value.
  const [notes, setNotes] = useState(goal.notes ?? '');
  const where = `doel ${index + 1} — ${HORIZON_LABELS[horizon]}`;

  return (
    <View style={styles.goal}>
      <View style={styles.goalHead}>
        <Text style={styles.goalNr}>Doel {index + 1}</Text>
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
        value={notes}
        onChangeText={setNotes}
        onBlur={() => onSave({ ...goal, notes: notes.trim() || undefined })}
        placeholder="Wat spreek je af?"
        placeholderTextColor={tennisColors.textMuted}
        accessibilityLabel={`Opmerkingen — ${where}`}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  // Zelfde kopstijl als de andere secties van het dossier, anders leest het als een los scherm.
  headingText: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { gap: spacing.xs, zIndex: 1 },
  horizon: { fontSize: 15, fontWeight: '800', color: tennisColors.primaryDark },
  goal: {
    backgroundColor: tennisColors.surfaceAlt,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  goalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
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
  muted: { fontSize: 14, color: tennisColors.textMuted },
  readGoal: {
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: tennisColors.border,
  },
  readValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  readNotes: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs, lineHeight: 20 },
});
