import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Voortgang</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isCoach && currentUser ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nieuwe voortgang</Text>

          <Text style={styles.label}>Speler</Text>
          <View style={styles.chipRow}>
            {students.length === 0 ? (
              <Text style={styles.muted}>Geen spelers beschikbaar.</Text>
            ) : (
              students.map((s) => {
                const active = s.id === selectedStudentId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSelectedStudentId(s.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <Text style={styles.label}>Type training</Text>
          <View style={styles.chipRow}>
            {TRAINING_TYPES.map((t) => {
              const active = t === selectedType;
              return (
                <Pressable
                  key={t}
                  onPress={() => setSelectedType(t)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {TRAINING_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Beoordeling</Text>
          <View style={styles.chipRow}>
            {RATINGS.map((r) => {
              const active = r <= rating;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRating(r === rating ? 0 : r)}
                  style={styles.star}
                >
                  <Text style={[styles.starText, active && styles.starTextActive]}>
                    {active ? '★' : '☆'}
                  </Text>
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

          <Pressable
            onPress={handleSave}
            disabled={!selectedStudentId}
            style={[styles.saveBtn, !selectedStudentId && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveBtnText}>Opslaan</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Overzicht</Text>

      {visibleProgress.length === 0 ? (
        <Text style={styles.muted}>Nog geen voortgang.</Text>
      ) : (
        visibleProgress.map((p) => (
          <View key={p.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryType}>
                {TRAINING_LABELS[p.training_type]}
              </Text>
              {typeof p.rating === 'number' && p.rating > 0 ? (
                <Text style={styles.entryStars}>
                  {'★'.repeat(p.rating)}
                </Text>
              ) : null}
            </View>
            <Text style={styles.entryStudent}>{studentName(p.student_id)}</Text>
            {p.notes ? <Text style={styles.entryText}>{p.notes}</Text> : null}
            {p.homework ? (
              <Text style={styles.entryHomework}>Huiswerk: {p.homework}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 12,
  },
  error: {
    color: tennisColors.danger,
    marginBottom: 12,
    fontSize: 14,
  },
  card: {
    backgroundColor: tennisColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  chipActive: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primaryDark,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.text,
  },
  chipTextActive: {
    color: tennisColors.white,
  },
  star: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  starText: {
    fontSize: 28,
    color: tennisColors.border,
  },
  starTextActive: {
    color: tennisColors.warning,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
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
    marginTop: 20,
    backgroundColor: tennisColors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: tennisColors.border,
  },
  saveBtnText: {
    color: tennisColors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 10,
  },
  muted: {
    color: tennisColors.textMuted,
    fontSize: 14,
  },
  entryCard: {
    backgroundColor: tennisColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 14,
    marginBottom: 12,
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
    fontSize: 15,
    color: tennisColors.warning,
  },
  entryStudent: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginTop: 2,
    marginBottom: 6,
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
