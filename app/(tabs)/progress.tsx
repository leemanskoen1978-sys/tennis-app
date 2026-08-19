import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star, UserPlus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { spacing, typography, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { UserManagement } from '../../components/UserManagement';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import { SpeechToText } from '../../components/SpeechToText';
import type { TrainingType } from '../../lib/types';

const TRAINING_TYPES: readonly TrainingType[] = [
  'techniek',
  'tactiek',
  'fysiek',
  'mentaal',
  'match',
] as const;

const TRAINING_LABELS: Record<TrainingType, string> = {
  techniek: 'Techniek',
  tactiek: 'Tactiek',
  fysiek: 'Fysiek',
  mentaal: 'Mentaal',
  match: 'Match',
};

const RATINGS: readonly number[] = [1, 2, 3, 4, 5] as const;

export default function ProgressScreen(): React.JSX.Element {
  const { currentUser, progress, users, addProgress, error } = useSimpleData();

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TrainingType>('techniek');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [homework, setHomework] = useState<string>('');
  const [addPlayerOpen, setAddPlayerOpen] = useState<boolean>(false);

  const isCoach = currentUser?.role === 'coach';
  const students = users.filter((u) => u.role !== 'coach');

  const studentName = (id: string): string => {
    const u = users.find((x) => x.id === id);
    return u ? u.name : 'Onbekend';
  };

  const visibleProgress = progress.filter((p) => {
    if (!currentUser) {
      return false;
    }
    if (isCoach) {
      return p.coach_id === currentUser.id;
    }
    return p.student_id === currentUser.id;
  });

  const resetForm = (): void => {
    setSelectedStudentId('');
    setSelectedType('techniek');
    setRating(0);
    setNotes('');
    setHomework('');
  };

  const handleSave = async (): Promise<void> => {
    if (!currentUser || !selectedStudentId) {
      return;
    }
    await addProgress({
      student_id: selectedStudentId,
      coach_id: currentUser.id,
      training_type: selectedType,
      rating: rating > 0 ? rating : undefined,
      notes: notes.trim().length > 0 ? notes.trim() : undefined,
      homework: homework.trim().length > 0 ? homework.trim() : undefined,
    });
    resetForm();
  };

  const appendNotes = (text: string): void => {
    setNotes((prev) => (prev.length > 0 ? `${prev} ${text}` : text));
  };

  return (
    <Screen>
      <Text style={styles.pageTitle}>Voortgang</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isCoach && currentUser ? (
        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>Nieuwe voortgang</Text>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Speler</Text>
            <Pressable
              onPress={() => setAddPlayerOpen(true)}
              style={[styles.addLink, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Speler toevoegen"
            >
              <UserPlus size={16} color={tennisColors.primary} />
              <Text style={styles.addLinkText}>Speler toevoegen</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {students.length === 0 ? (
              <Text style={styles.muted}>Geen spelers beschikbaar.</Text>
            ) : (
              students.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={s.id === selectedStudentId}
                  onPress={() => setSelectedStudentId(s.id)}
                />
              ))
            )}
          </View>

          <Text style={styles.label}>Type training</Text>
          <View style={styles.chipRow}>
            {TRAINING_TYPES.map((t) => (
              <Chip
                key={t}
                label={TRAINING_LABELS[t]}
                selected={t === selectedType}
                onPress={() => setSelectedType(t)}
              />
            ))}
          </View>

          <Text style={styles.label}>Beoordeling</Text>
          <View style={styles.starRow}>
            {RATINGS.map((r) => {
              const active = r <= rating;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRating(r === rating ? 0 : r)}
                  style={styles.star}
                  accessibilityRole="button"
                  accessibilityLabel={`${r} sterren`}
                >
                  <Star
                    size={28}
                    fill={active ? tennisColors.warning : 'transparent'}
                    color={active ? tennisColors.warning : tennisColors.border}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Notities</Text>
          <View style={styles.notesRow}>
            <TextInput
              style={[styles.input, styles.multiline, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notities over de training"
              placeholderTextColor={tennisColors.textMuted}
              multiline
            />
            <SpeechToText onText={appendNotes} />
          </View>

          <Text style={styles.label}>Huiswerk</Text>
          <TextInput
            style={styles.input}
            value={homework}
            onChangeText={setHomework}
            placeholder="Huiswerk voor de speler"
            placeholderTextColor={tennisColors.textMuted}
          />

          <Text style={styles.label}>Spraakmemo</Text>
          <VoiceRecorder />

          <Button
            label="Opslaan"
            variant="primary"
            onPress={handleSave}
            disabled={!selectedStudentId}
            style={styles.saveBtn}
          />
        </Card>
      ) : null}

      <UserManagement visible={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} />

      <Text style={styles.sectionTitle}>Overzicht</Text>

      {visibleProgress.length === 0 ? (
        <Text style={styles.muted}>Nog geen voortgang.</Text>
      ) : (
        visibleProgress.map((p) => (
          <Card key={p.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryType}>
                {TRAINING_LABELS[p.training_type]}
              </Text>
              {typeof p.rating === 'number' && p.rating > 0 ? (
                <View
                  style={styles.entryStars}
                  accessibilityRole="image"
                  accessibilityLabel={`${p.rating} sterren`}
                >
                  {Array.from({ length: p.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill={tennisColors.warning}
                      color={tennisColors.warning}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <Text style={styles.entryStudent}>{studentName(p.student_id)}</Text>
            {p.notes ? <Text style={styles.entryText}>{p.notes}</Text> : null}
            {p.homework ? (
              <Text style={styles.entryHomework}>Huiswerk: {p.homework}</Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    ...typography.h1,
    color: tennisColors.text,
    marginBottom: spacing.md,
  },
  error: {
    color: tennisColors.danger,
    marginBottom: spacing.md,
    fontSize: 14,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  addLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: tennisColors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  starRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  star: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notesInput: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: spacing.sm,
  },
  muted: {
    color: tennisColors.textMuted,
    fontSize: 14,
  },
  entryCard: {
    marginBottom: spacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryType: {
    fontSize: 15,
    fontWeight: '700',
    color: tennisColors.primaryDark,
  },
  entryStars: {
    flexDirection: 'row',
    gap: 2,
  },
  entryStudent: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  entryText: {
    fontSize: 14,
    color: tennisColors.text,
    marginBottom: 4,
  },
  entryHomework: {
    fontSize: 13,
    color: tennisColors.clay,
    fontWeight: '600',
  },
});
