import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useT } from '../lib/i18n';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, webCursor } from '../constants/theme';
import type { TrainingExercise } from '../lib/types';

/**
 * The session-plan half of a lesson: the columns of the club's training booklet. Kept in
 * one file so the read view and the edit form stay in step — a field added to one and
 * forgotten in the other is the whole reason this lived in two places before.
 */
export interface TrainingPlan {
  duration_minutes?: number;
  focus_points: string[];
  materials: string[];
  exercises: TrainingExercise[];
}

const emptyExercise = (): TrainingExercise => ({
  nr: '', duration: '', situation: '', purpose: '',
  description: '', quality: '', organisation: '',
});

export function planFrom(lesson: {
  duration_minutes?: number;
  focus_points?: string[];
  materials?: string[];
  exercises?: TrainingExercise[];
}): TrainingPlan {
  return {
    duration_minutes: lesson.duration_minutes,
    focus_points: lesson.focus_points ?? [],
    materials: lesson.materials ?? [],
    exercises: lesson.exercises ?? [],
  };
}

/** Only the fields that were actually filled in; the rest stays absent from the lesson. */
export function planPatch(plan: TrainingPlan) {
  const exercises = plan.exercises.filter((e) => Object.values(e).some((v) => v.trim() !== ''));
  return {
    duration_minutes: plan.duration_minutes,
    focus_points: plan.focus_points.length > 0 ? plan.focus_points : undefined,
    materials: plan.materials.length > 0 ? plan.materials : undefined,
    exercises: exercises.length > 0 ? exercises : undefined,
  };
}

/** "1u30" reads better on a session plan than "90 minuten". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}u` : `${h}u${String(m).padStart(2, '0')}`;
}

const toLines = (text: string): string[] =>
  text.split('\n').map((l) => l.trim()).filter((l) => l !== '');

// ---------------------------------------------------------------- read view

/**
 * One row of the training table. Every column keeps its own label — the booklet's headings
 * are the vocabulary the coach reads on court, so flattening them into prose would lose it.
 */
function ExerciseCard({ exercise }: { exercise: TrainingExercise }) {
  const t = useT();
  return (
    <View style={styles.exercise}>
      <View style={styles.exerciseHead}>
        {exercise.nr ? <Text style={styles.exerciseNr}>{exercise.nr}</Text> : null}
        {exercise.duration ? <Text style={styles.exerciseChip}>{exercise.duration}</Text> : null}
        {exercise.situation ? <Text style={styles.exerciseChip}>{exercise.situation}</Text> : null}
        {exercise.purpose ? <Text style={styles.exercisePurpose}>{exercise.purpose}</Text> : null}
      </View>
      {exercise.description ? (
        <Text style={styles.exerciseText}>{exercise.description}</Text>
      ) : null}
      {exercise.quality ? (
        <>
          <Text style={styles.exerciseLabel}>{t('Kwaliteit')}</Text>
          <Text style={styles.exerciseText}>{exercise.quality}</Text>
        </>
      ) : null}
      {exercise.organisation ? (
        <>
          <Text style={styles.exerciseLabel}>{t('Organisatie / materiaal')}</Text>
          <Text style={styles.exerciseText}>{exercise.organisation}</Text>
        </>
      ) : null}
    </View>
  );
}

export function TrainingPlanView({ plan }: { plan: TrainingPlan }) {
  const t = useT();
  return (
    <>
      {plan.duration_minutes !== undefined ? (
        <Text style={styles.meta}>{t('Duur: {duur}', { duur: formatDuration(plan.duration_minutes) })}</Text>
      ) : null}

      {plan.focus_points.length > 0 ? (
        <>
          <Text style={styles.label}>{t('Aandachtspunten training')}</Text>
          {plan.focus_points.map((point) => (
            <Text key={point} style={styles.bullet}>• {point}</Text>
          ))}
        </>
      ) : null}

      {plan.materials.length > 0 ? (
        <>
          <Text style={styles.label}>{t('Materiaal per terrein')}</Text>
          {plan.materials.map((item) => (
            <Text key={item} style={styles.bullet}>• {item}</Text>
          ))}
        </>
      ) : null}

      {plan.exercises.length > 0 ? (
        <>
          <Text style={styles.label}>{t('Oefeningen')}</Text>
          {plan.exercises.map((exercise, i) => (
            <ExerciseCard key={`${exercise.nr}-${i}`} exercise={exercise} />
          ))}
        </>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------- editor

/**
 * The same breakdown, editable. Mount it fresh per edit session (give it a key) — the
 * multi-line boxes hold their own text so that typing an empty line does not fight with
 * the parsed list above them.
 */
export function TrainingPlanEditor({
  value, onChange,
}: {
  value: TrainingPlan;
  onChange: (plan: TrainingPlan) => void;
}) {
  const t = useT();
  const [durationText, setDurationText] = useState(
    value.duration_minutes !== undefined ? String(value.duration_minutes) : '',
  );
  const [focusText, setFocusText] = useState(value.focus_points.join('\n'));
  const [materialsText, setMaterialsText] = useState(value.materials.join('\n'));

  const setExercise = (index: number, patch: Partial<TrainingExercise>) => {
    onChange({
      ...value,
      exercises: value.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  };

  const addExercise = () => {
    onChange({
      ...value,
      exercises: [...value.exercises, { ...emptyExercise(), nr: String(value.exercises.length + 1) }],
    });
  };

  const removeExercise = (index: number) => {
    onChange({ ...value, exercises: value.exercises.filter((_, i) => i !== index) });
  };

  return (
    <>
      <Text style={styles.label}>{t('Duur (minuten)')}</Text>
      <TextInput
        style={styles.input}
        value={durationText}
        onChangeText={(text) => {
          setDurationText(text);
          const n = Number(text.trim());
          onChange({
            ...value,
            duration_minutes: text.trim() === '' || !Number.isFinite(n) ? undefined : n,
          });
        }}
        placeholder="90"
        placeholderTextColor={tennisColors.textMuted}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t('Aandachtspunten training')}</Text>
      <Text style={styles.helper}>{t('Eén per regel.')}</Text>
      <TextInput
        style={[styles.input, styles.tall]}
        value={focusText}
        onChangeText={(text) => {
          setFocusText(text);
          onChange({ ...value, focus_points: toLines(text) });
        }}
        placeholder={t('Drukvol uitwisselen met hoog tempo\nSterk starten vanuit opslag 1')}
        placeholderTextColor={tennisColors.textMuted}
        multiline
      />

      <Text style={styles.label}>{t('Materiaal per terrein')}</Text>
      <Text style={styles.helper}>{t('Eén per regel.')}</Text>
      <TextInput
        style={[styles.input, styles.tall]}
        value={materialsText}
        onChangeText={(text) => {
          setMaterialsText(text);
          onChange({ ...value, materials: toLines(text) });
        }}
        placeholder={'1 netverhoger\n10 markeerpotjes'}
        placeholderTextColor={tennisColors.textMuted}
        multiline
      />

      <Text style={styles.label}>{t('Oefeningen')}</Text>
      {value.exercises.length === 0 ? (
        <Text style={styles.helper}>{t('Nog geen oefeningen.')}</Text>
      ) : null}

      {value.exercises.map((exercise, i) => (
        <View key={i} style={styles.exercise}>
          <View style={styles.exerciseTopRow}>
            <Text style={styles.exerciseTitle}>Oefening {i + 1}</Text>
            <Pressable
              onPress={() => removeExercise(i)}
              accessibilityRole="button"
              accessibilityLabel={t('Oefening {nr} verwijderen', { nr: i + 1 })}
              style={[styles.removeBtn, webCursor]}
            >
              <Trash2 size={16} color={tennisColors.danger} />
              <Text style={styles.removeText}>{t('Verwijderen')}</Text>
            </Pressable>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldSmall}>
              <Text style={styles.fieldLabel}>N°</Text>
              <TextInput
                style={styles.input}
                value={exercise.nr}
                onChangeText={(t) => setExercise(i, { nr: t })}
                placeholder="1"
                placeholderTextColor={tennisColors.textMuted}
              />
            </View>
            <View style={styles.fieldSmall}>
              <Text style={styles.fieldLabel}>{t('Duur')}</Text>
              <TextInput
                style={styles.input}
                value={exercise.duration}
                onChangeText={(t) => setExercise(i, { duration: t })}
                placeholder="20'"
                placeholderTextColor={tennisColors.textMuted}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>{t('Situatie')}</Text>
          <TextInput
            style={styles.input}
            value={exercise.situation}
            onChangeText={(t) => setExercise(i, { situation: t })}
            placeholder={t('basislijnspel')}
            placeholderTextColor={tennisColors.textMuted}
          />

          <Text style={styles.fieldLabel}>{t('Bedoeling')}</Text>
          <TextInput
            style={styles.input}
            value={exercise.purpose}
            onChangeText={(t) => setExercise(i, { purpose: t })}
            placeholder={t('AANVALLEN')}
            placeholderTextColor={tennisColors.textMuted}
          />

          <Text style={styles.fieldLabel}>{t('Omschrijving')}</Text>
          <TextInput
            style={[styles.input, styles.tall]}
            value={exercise.description}
            onChangeText={(t) => setExercise(i, { description: t })}
            placeholder={t('Wat doen de spelers?')}
            placeholderTextColor={tennisColors.textMuted}
            multiline
          />

          <Text style={styles.fieldLabel}>{t('Kwaliteit')}</Text>
          <TextInput
            style={[styles.input, styles.medium]}
            value={exercise.quality}
            onChangeText={(t) => setExercise(i, { quality: t })}
            placeholder={t('Waar let je op?')}
            placeholderTextColor={tennisColors.textMuted}
            multiline
          />

          <Text style={styles.fieldLabel}>{t('Organisatie / materiaal')}</Text>
          <TextInput
            style={[styles.input, styles.medium]}
            value={exercise.organisation}
            onChangeText={(t) => setExercise(i, { organisation: t })}
            placeholder={t('4 markeerschijven voor de speelbasis')}
            placeholderTextColor={tennisColors.textMuted}
            multiline
          />
        </View>
      ))}

      <Pressable
        onPress={addExercise}
        accessibilityRole="button"
        accessibilityLabel={t('Oefening toevoegen')}
        style={[styles.addBtn, webCursor]}
      >
        <Plus size={18} color={tennisColors.primary} />
        <Text style={styles.addText}>{t('Oefening toevoegen')}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.sm },
  helper: { fontSize: 12, color: tennisColors.textMuted, marginBottom: spacing.xs },
  bullet: { fontSize: 14, color: tennisColors.text, marginTop: 2, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  medium: { minHeight: 56, textAlignVertical: 'top' },
  tall: { minHeight: 84, textAlignVertical: 'top' },
  exercise: {
    backgroundColor: tennisColors.surfaceAlt,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  exerciseTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  exerciseTitle: { fontSize: 14, fontWeight: '800', color: tennisColors.text },
  exerciseNr: {
    fontSize: 13, fontWeight: '800', color: tennisColors.onFill,
    backgroundColor: tennisColors.primaryFill, borderRadius: radius.pill,
    minWidth: 24, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 2,
  },
  exerciseChip: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted },
  exercisePurpose: { fontSize: 12, fontWeight: '800', color: tennisColors.court },
  exerciseLabel: {
    fontSize: 11, fontWeight: '800', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.sm,
  },
  exerciseText: { fontSize: 14, color: tennisColors.text, marginTop: 4, lineHeight: 20 },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  fieldSmall: { flex: 1 },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: 2,
  },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  removeText: { fontSize: 13, fontWeight: '600', color: tennisColors.danger },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: tennisColors.border, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  addText: { fontSize: 14, fontWeight: '700', color: tennisColors.primary },
});
