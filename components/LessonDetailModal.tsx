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
});
