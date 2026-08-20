import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Target } from 'lucide-react-native';
import { Card } from './ui/Card';
import { OptionCombobox } from './ui/OptionCombobox';
import { useSimpleData } from '../providers/SimpleDataProvider';
import {
  GOAL_HORIZONS, HORIZON_LABELS, goalFor, shotTypeOptions, changeTypeOptions,
} from '../lib/goals';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography } from '../constants/theme';
import type { GoalHorizon, PlayerGoal } from '../lib/types';

const goalId = (studentId: string, horizon: GoalHorizon) => `goal-${studentId}-${horizon}`;

/**
 * What a player is working towards, over three horizons.
 *
 * Every field writes straight through — there is no save button. A goal is a handful of
 * fields you adjust in passing after a lesson, and a form you must remember to submit is
 * a form that keeps a stale goal on screen.
 */
export function PlayerGoals({ studentId, canEdit }: { studentId: string; canEdit: boolean }) {
  const { goals, settings, saveGoal } = useSimpleData();
  const shots = shotTypeOptions(settings);
  const changes = changeTypeOptions(settings);

  return (
    <>
      <View style={styles.heading}>
        <Target size={18} color={tennisColors.primary} />
        <Text style={styles.headingText}>Doelen</Text>
      </View>

      {GOAL_HORIZONS.map((horizon) => (
        <GoalCard
          key={horizon}
          horizon={horizon}
          goal={goalFor(goals, studentId, horizon)}
          shots={shots}
          changes={changes}
          canEdit={canEdit}
          onChange={(patch) =>
            void saveGoal({
              id: goalId(studentId, horizon),
              student_id: studentId,
              horizon,
              ...goalFor(goals, studentId, horizon),
              ...patch,
            })
          }
        />
      ))}
    </>
  );
}

function GoalCard({
  horizon, goal, shots, changes, canEdit, onChange,
}: {
  horizon: GoalHorizon;
  goal: PlayerGoal | null;
  shots: string[];
  changes: string[];
  canEdit: boolean;
  onChange: (patch: Partial<PlayerGoal>) => void;
}) {
  // The notes box keeps its own text so typing does not fight the stored value.
  const [notes, setNotes] = useState(goal?.notes ?? '');

  if (!canEdit) {
    const empty = !goal || (!goal.shot_type && !goal.change_type && !goal.notes);
    return (
      <Card style={styles.card}>
        <Text style={styles.horizon}>{HORIZON_LABELS[horizon]}</Text>
        {empty ? (
          <Text style={styles.muted}>Nog geen doel afgesproken.</Text>
        ) : (
          <>
            {goal.shot_type ? <Text style={styles.readValue}>Slag: {goal.shot_type}</Text> : null}
            {goal.change_type ? (
              <Text style={styles.readValue}>Wijziging: {goal.change_type}</Text>
            ) : null}
            {goal.notes ? <Text style={styles.readNotes}>{goal.notes}</Text> : null}
          </>
        )}
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text style={styles.horizon}>{HORIZON_LABELS[horizon]}</Text>

      <Text style={styles.label}>Type slag</Text>
      <OptionCombobox
        label={`Type slag — ${HORIZON_LABELS[horizon]}`}
        options={shots}
        value={goal?.shot_type ?? null}
        onChange={(v) => onChange({ shot_type: v ?? undefined })}
        placeholder="Forehand, Backhand…"
      />

      <Text style={styles.label}>Type wijziging</Text>
      <OptionCombobox
        label={`Type wijziging — ${HORIZON_LABELS[horizon]}`}
        options={changes}
        value={goal?.change_type ?? null}
        onChange={(v) => onChange({ change_type: v ?? undefined })}
        placeholder="Greepwissel, Regelmaat…"
      />

      <Text style={styles.label}>Opmerkingen</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        onBlur={() => onChange({ notes: notes.trim() || undefined })}
        placeholder="Wat spreek je af?"
        placeholderTextColor={tennisColors.textMuted}
        accessibilityLabel={`Opmerkingen — ${HORIZON_LABELS[horizon]}`}
        multiline
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  headingText: { ...typography.h2, color: tennisColors.text },
  card: { gap: spacing.xs, zIndex: 1 },
  horizon: { fontSize: 15, fontWeight: '800', color: tennisColors.primaryDark },
  label: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  muted: { fontSize: 14, color: tennisColors.textMuted },
  readValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  readNotes: { fontSize: 14, color: tennisColors.text, marginTop: spacing.xs, lineHeight: 20 },
});
