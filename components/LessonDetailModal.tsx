import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, View, Text, TextInput, Pressable, Linking, Platform, Alert, StyleSheet, ScrollView } from 'react-native';
import { X, ExternalLink, Pencil, Trash2, PenLine, Plus } from 'lucide-react-native';
import { useSimpleData } from '../providers/SimpleDataProvider';
import { StudentCombobox } from './ui/StudentCombobox';
import { Button } from './ui/Button';
import { AttachmentList, LessonAttachments } from './LessonAttachments';
import { CourtScene } from './court/CourtScene';
import { LessonExplanation } from './LessonExplanation';
import {
  TrainingPlanView, TrainingPlanEditor, planFrom, planPatch, type TrainingPlan,
} from './LessonTraining';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow, webCursor, contentMaxWidth } from '../constants/theme';
import type { Lesson, LessonAttachment } from '../lib/types';

function confirmDelete(message: string, onYes: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(message)) onYes(); return; }
  Alert.alert('Bevestigen', message, [
    { text: 'Annuleren', style: 'cancel' },
    { text: 'Verwijderen', style: 'destructive', onPress: onYes },
  ]);
}

/** Shows a lesson's details first; allows opening the video, editing, or deleting. */
export function LessonDetailModal({
  lesson: selected, visible, onClose, canEdit,
}: {
  lesson: Lesson | null;
  visible: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { users, lessons, updateLesson, deleteLesson } = useSimpleData();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [plan, setPlan] = useState<TrainingPlan>({ focus_points: [], materials: [], exercises: [] });
  // Bumped on each edit session so the plan editor remounts with fresh text boxes.
  const [editSession, setEditSession] = useState(0);

  // The caller hands over the lesson it had when the row was tapped. Read it back from
  // the store instead, or saving an edit would leave the details showing the old text
  // until you close and reopen the sheet.
  const lesson = selected ? (lessons.find((l) => l.id === selected.id) ?? selected) : null;
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
    setPlan(planFrom(lesson));
    setEditSession((n) => n + 1);
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
      ...planPatch(plan),
    });
    setEditing(false);
  };

  // The canvas is a screen, not a sheet: close this one first so we do not navigate from
  // underneath an open modal.
  const openCanvas = () => {
    const id = lesson.id;
    close();
    router.push(`/coaches/drawing?lessonId=${encodeURIComponent(id)}`);
  };

  const removeDrawing = () => {
    confirmDelete('Veldsituatie verwijderen?', async () => {
      await updateLesson(lesson.id, { drawing: undefined });
    });
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
                <TrainingPlanEditor key={editSession} value={plan} onChange={setPlan} />
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

                <TrainingPlanView plan={planFrom(lesson)} />

                {lesson.url ? (
                  <Button label="Video openen" variant="primary" icon={<ExternalLink size={18} color={tennisColors.onFill} />} onPress={() => { if (lesson.url) void Linking.openURL(lesson.url); }} />
                ) : (
                  <Text style={styles.descMuted}>Geen video-link.</Text>
                )}

                <Text style={styles.label}>Veldsituatie</Text>
                {lesson.drawing ? (
                  <>
                    <CourtScene drawing={lesson.drawing} width={240} />
                    {canEdit ? (
                      <View style={styles.linkRow}>
                        <Pressable
                          onPress={() => openCanvas()}
                          accessibilityRole="button"
                          accessibilityLabel="Veldsituatie aanpassen"
                          style={[styles.link, webCursor]}
                        >
                          <PenLine size={16} color={tennisColors.primary} />
                          <Text style={styles.linkText}>Aanpassen</Text>
                        </Pressable>
                        <Pressable
                          onPress={removeDrawing}
                          accessibilityRole="button"
                          accessibilityLabel="Veldsituatie verwijderen"
                          style={[styles.link, webCursor]}
                        >
                          <Trash2 size={16} color={tennisColors.danger} />
                          <Text style={styles.linkTextDanger}>Verwijderen</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                ) : canEdit ? (
                  <Pressable
                    onPress={() => openCanvas()}
                    accessibilityRole="button"
                    accessibilityLabel="Veldsituatie toevoegen"
                    style={[styles.link, webCursor]}
                  >
                    <Plus size={16} color={tennisColors.primary} />
                    <Text style={styles.linkText}>Veldsituatie toevoegen</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.descMuted}>Geen veldsituatie.</Text>
                )}

                <LessonExplanation
                  lessonId={lesson.id}
                  points={lesson.explanation ?? []}
                  canEdit={canEdit}
                />

                <Text style={styles.label}>PDF-bijlagen</Text>
                <AttachmentList attachments={lesson.attachments} />

                {canEdit ? (
                  <View style={styles.actions}>
                    <Button label="Bewerken" variant="secondary" icon={<Pencil size={16} color={tennisColors.text} />} onPress={startEdit} />
                    <Button label="Verwijderen" variant="danger" icon={<Trash2 size={16} color={tennisColors.onFill} />} onPress={remove} />
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  // Zonder breedte-cap plakt een blad in een breed venster over de volle breedte, terwijl
  // de rest van de app gecentreerd op zijn maximum staat. Een blad hoort bij het scherm
  // eronder, dus het houdt dezelfde maat aan.
  sheet: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
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
  linkRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  linkText: { fontSize: 14, fontWeight: '600', color: tennisColors.primary },
  linkTextDanger: { fontSize: 14, fontWeight: '600', color: tennisColors.danger },
});
