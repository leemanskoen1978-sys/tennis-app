import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { VoiceRecorder } from '../VoiceRecorder';
import { TRAINING_TYPES, TRAINING_LABELS } from './ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, shadow, webCursor } from '../../constants/theme';
import type { TrainingType } from '../../lib/types';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Nieuwe voortgang noteren. Staat in een sheet en niet op het dossier zelf: een trainer
 * vult dit hooguit na een les in, terwijl hij het dossier de rest van de tijd leest.
 */
export function ProgressForm({ visible, onClose, studentId }: {
  visible: boolean;
  onClose: () => void;
  studentId: string;
}) {
  const { currentUser, lessons, addProgress } = useSimpleData();

  const [type, setType] = useState<TrainingType>('techniek');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [voiceUri, setVoiceUri] = useState<string | undefined>(undefined);
  const [linkLessonId, setLinkLessonId] = useState<string | null>(null);

  const playerLessons = lessons.filter((l) => l.student_id === studentId);

  const save = async () => {
    if (!currentUser) return;
    await addProgress({
      student_id: studentId,
      coach_id: currentUser.id,
      training_type: type,
      rating: rating > 0 ? rating : undefined,
      notes: notes.trim() || undefined,
      homework: homework.trim() || undefined,
      voice_memo_uri: voiceUri,
      lesson_id: linkLessonId ?? undefined,
    });
    setType('techniek'); setRating(0); setNotes(''); setHomework('');
    setVoiceUri(undefined); setLinkLessonId(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Nieuwe voortgang</Text>
            <Pressable onPress={onClose} style={webCursor} accessibilityRole="button" accessibilityLabel="Sluiten">
              <X size={22} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.label}>Type training</Text>
            <View style={styles.chipRow}>
              {TRAINING_TYPES.map((t) => (
                <Chip key={t} label={TRAINING_LABELS[t]} selected={t === type} onPress={() => setType(t)} />
              ))}
            </View>

            <Text style={styles.label}>Beoordeling</Text>
            <View style={styles.starRow}>
              {RATINGS.map((r) => {
                const active = r <= rating;
                return (
                  <Pressable key={r} onPress={() => setRating(r === rating ? 0 : r)} style={styles.star} accessibilityRole="button" accessibilityLabel={`${r} sterren`}>
                    <Star size={28} fill={active ? tennisColors.warning : 'transparent'} color={active ? tennisColors.warning : tennisColors.border} />
                  </Pressable>
                );
              })}
            </View>

            {playerLessons.length > 0 ? (
              <>
                <Text style={styles.label}>Koppel aan les (optioneel)</Text>
                <View style={styles.chipRow}>
                  <Chip label="Geen" selected={linkLessonId === null} onPress={() => setLinkLessonId(null)} />
                  {playerLessons.map((l) => (
                    <Chip key={l.id} label={l.title} selected={linkLessonId === l.id} onPress={() => setLinkLessonId(l.id)} />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.label}>Notities</Text>
            <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Notities over de training" placeholderTextColor={tennisColors.textMuted} multiline />
            <Text style={styles.label}>Huiswerk</Text>
            <TextInput style={styles.input} value={homework} onChangeText={setHomework} placeholder="Huiswerk" placeholderTextColor={tennisColors.textMuted} />
            <Text style={styles.label}>Spraakmemo</Text>
            <VoiceRecorder value={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(undefined)} />
            <Button label="Opslaan" variant="primary" onPress={save} style={styles.saveBtn} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, maxHeight: '85%', ...shadow('lg'),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2, color: tennisColors.text },
  sheetBody: { paddingBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starRow: { flexDirection: 'row', flexWrap: 'wrap' },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tennisColors.text,
    backgroundColor: tennisColors.surface, marginBottom: spacing.sm,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.lg },
});
