import { useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Linking, Platform, Alert, StyleSheet, ScrollView } from 'react-native';
import { X, ExternalLink, Pencil, Trash2 } from 'lucide-react-native';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { StudentCombobox } from './ui/StudentCombobox';
import { Button } from './ui/Button';
import { AttachmentList, LessonAttachments } from './LessonAttachments';
import { CourtScene } from './court/CourtScene';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow, webCursor } from '../constants/theme';
import type { Lesson, LessonAttachment, TrainingExercise } from '../lib/types';

function confirmDelete(message: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(message)) onYes(); return; }
  Alert.alert('Bevestigen', message, [
    { text: 'Annuleren', style: 'cancel' },
    { text: 'Verwijderen', style: 'destructive', onPress: onYes },
  ]);
}

/** Shows a lesson's details first; allows opening the video, editing, or deleting. */
export function LessonDetailModal({
  lesson, visible, onClose, canEdit,
}: {
  lesson: Lesson | null;
  visible: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const { users, updateLesson, deleteLesson } = useSimpleData();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);

  if (!lesson) return null;
  const students = users.filter((u) => u.role !== 'coach');
  const studentName = lesson.student_id
    ? (users.find((u) => u.id === lesson.student_id)?.name ?? 'Onbekend')
    : 'Iedereen';

  const startEdit = () => {
    setTitle(lesson.title);
    setUrl(lesson.url ?? '');
    setDescription(lesson.description ?? '');
    setStudentId(lesson.student_id ?? null);
    setAttachments(lesson.attachments ?? []);
    setEditing(true);
  };

  const save = async () => {
    if (!title.trim()) return;
    await updateLesson(lesson.id, {
      title: title.trim(),
      url: url.trim() || undefined,
      description: description.trim() || undefined,
      student_id: studentId ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setEditing(false);
  };

  const remove = () => {
    confirmDelete(`"${lesson.title}" verwijderen?`, async () => {
      await deleteLesson(lesson.id);
      onClose();
    });
  };

  const close = () => { setEditing(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? 'Les bewerken' : 'Lesdetails'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Sluiten" onPress={close} style={webCursor}>
              <X size={22} color={tennisColors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {editing ? (
              <>
                <Text style={styles.label}>Titel</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Titel" placeholderTextColor={tennisColors.textMuted} />
                <Text style={styles.label}>Video-URL</Text>
                <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={tennisColors.textMuted} autoCapitalize="none" />
                <Text style={styles.label}>Beschrijving</Text>
                <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Beschrijving" placeholderTextColor={tennisColors.textMuted} multiline />
                <Text style={styles.label}>PDF-bijlagen</Text>
                <LessonAttachments attachments={attachments} onChange={setAttachments} />
                <Text style={styles.label}>Voor wie</Text>
                <StudentCombobox students={students} value={studentId} onChange={setStudentId} />
                <View style={styles.actions}>
                  <Button label="Annuleren" variant="secondary" onPress={() => setEditing(false)} />
                  <Button label="Opslaan" variant="primary" onPress={save} disabled={!title.trim()} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <Text style={styles.meta}>Voor: {studentName}</Text>
                {lesson.description ? <Text style={styles.desc}>{lesson.description}</Text> : <Text style={styles.descMuted}>Geen beschrijving.</Text>}

                {lesson.duration_minutes !== undefined ? (
                  <Text style={styles.meta}>Duur: {formatDuration(lesson.duration_minutes)}</Text>
                ) : null}

                {lesson.focus_points !== undefined && lesson.focus_points.length > 0 ? (
                  <>
                    <Text style={styles.label}>Aandachtspunten training</Text>
                    {lesson.focus_points.map((point) => (
                      <Text key={point} style={styles.bullet}>• {point}</Text>
                    ))}
                  </>
                ) : null}

                {lesson.materials !== undefined && lesson.materials.length > 0 ? (
                  <>
                    <Text style={styles.label}>Materiaal per terrein</Text>
                    {lesson.materials.map((item) => (
                      <Text key={item} style={styles.bullet}>• {item}</Text>
                    ))}
                  </>
                ) : null}

                {lesson.exercises !== undefined && lesson.exercises.length > 0 ? (
                  <>
                    <Text style={styles.label}>Oefeningen</Text>
                    {lesson.exercises.map((exercise, i) => (
                      <ExerciseCard key={`${exercise.nr}-${i}`} exercise={exercise} />
                    ))}
                  </>
                ) : null}

                {lesson.url ? (
                  <Button label="Video openen" variant="primary" icon={<ExternalLink size={18} color={tennisColors.white} />} onPress={() => { if (lesson.url) void Linking.openURL(lesson.url); }} />
                ) : (
                  <Text style={styles.descMuted}>Geen video-link.</Text>
                )}

                {lesson.drawing ? (
                  <>
                    <Text style={styles.label}>Veldsituatie</Text>
                    <CourtScene drawing={lesson.drawing} width={240} />
                  </>
                ) : null}

                <Text style={styles.label}>PDF-bijlagen</Text>
                <AttachmentList attachments={lesson.attachments} />

                {canEdit ? (
                  <View style={styles.actions}>
                    <Button label="Bewerken" variant="secondary" icon={<Pencil size={16} color={tennisColors.text} />} onPress={startEdit} />
                    <Button label="Verwijderen" variant="danger" icon={<Trash2 size={16} color={tennisColors.white} />} onPress={remove} />
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** "1u30" reads better on a session plan than "90 minuten". */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}u` : `${h}u${String(m).padStart(2, '0')}`;
}

/**
 * One row of the training table. Every column keeps its own label — the booklet's headings
 * are the vocabulary the coach reads on court, so flattening them into prose would lose it.
 */
function ExerciseCard({ exercise }: { exercise: TrainingExercise }) {
  return (
    <View style={styles.exercise}>
      <View style={styles.exerciseHead}>
        <Text style={styles.exerciseNr}>{exercise.nr}</Text>
        {exercise.duration ? <Text style={styles.exerciseChip}>{exercise.duration}</Text> : null}
        {exercise.situation ? <Text style={styles.exerciseChip}>{exercise.situation}</Text> : null}
        {exercise.purpose ? <Text style={styles.exercisePurpose}>{exercise.purpose}</Text> : null}
      </View>
      {exercise.description ? (
        <Text style={styles.exerciseText}>{exercise.description}</Text>
      ) : null}
      {exercise.quality ? (
        <>
          <Text style={styles.exerciseLabel}>Kwaliteit</Text>
          <Text style={styles.exerciseText}>{exercise.quality}</Text>
        </>
      ) : null}
      {exercise.organisation ? (
        <>
          <Text style={styles.exerciseLabel}>Organisatie / materiaal</Text>
          <Text style={styles.exerciseText}>{exercise.organisation}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, maxHeight: '85%', ...shadow('lg'),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.h2, color: tennisColors.text },
  body: { gap: spacing.sm, paddingBottom: spacing.lg },
  lessonTitle: { ...typography.h1, color: tennisColors.text },
  meta: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted },
  desc: { fontSize: 15, color: tennisColors.text, marginVertical: spacing.sm },
  descMuted: { fontSize: 14, color: tennisColors.textMuted, marginVertical: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  bullet: { fontSize: 14, color: tennisColors.text, marginTop: 2, lineHeight: 20 },
  exercise: {
    backgroundColor: tennisColors.surfaceAlt,
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.sm,
  },
  exerciseHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  exerciseNr: {
    fontSize: 13, fontWeight: '800', color: tennisColors.white,
    backgroundColor: tennisColors.primary, borderRadius: radius.pill,
    minWidth: 24, textAlign: 'center', paddingHorizontal: 6, paddingVertical: 2,
  },
  exerciseChip: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted },
  exercisePurpose: { fontSize: 12, fontWeight: '800', color: tennisColors.court },
  exerciseLabel: {
    fontSize: 11, fontWeight: '800', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.sm,
  },
  exerciseText: { fontSize: 14, color: tennisColors.text, marginTop: 4, lineHeight: 20 },
});
