import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BookOpen, Plus, ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { LessonDetailModal } from '../../components/LessonDetailModal';
import { LessonAttachments } from '../../components/LessonAttachments';
import { spacing, typography, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import type { Lesson, LessonAttachment, User } from '../../lib/types';

export default function LessonsScreen(): React.JSX.Element {
  const { currentUser, lessons, users, addLesson, error } = useSimpleData();

  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);

  const [selected, setSelected] = useState<Lesson | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  const isCoach = currentUser?.role === 'coach';

  const students: User[] = users.filter((u) => u.role !== 'coach');

  const visibleLessons = lessons.filter((l) => {
    if (isCoach) {
      return true;
    }
    if (l.student_id === undefined || l.student_id === null) {
      return true;
    }
    return l.student_id === currentUser?.id;
  });

  const studentNameFor = (id: string | null | undefined): string => {
    if (id === undefined || id === null) {
      return 'Iedereen';
    }
    const match = students.find((s) => s.id === id);
    return match !== undefined ? match.name : 'Iedereen';
  };

  const handleAdd = async (): Promise<void> => {
    if (!currentUser) {
      return;
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return;
    }
    const trimmedUrl = url.trim();
    const trimmedDescription = description.trim();

    await addLesson({
      title: trimmedTitle,
      url: trimmedUrl.length > 0 ? trimmedUrl : undefined,
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      uploaded_by: currentUser.id,
      coach_id: currentUser.id,
      student_id: studentId ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setTitle('');
    setUrl('');
    setDescription('');
    setStudentId(null);
    setAttachments([]);
  };

  return (
    <Screen>
      <Text style={styles.heading}>Lessen</Text>

      {error !== undefined && error !== null && error.length > 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {isCoach ? (
        <Card>
          <Text style={styles.formTitle}>Nieuw lesmateriaal</Text>

          <Text style={styles.label}>Titel</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Titel"
            placeholderTextColor={tennisColors.textMuted}
          />

          <Text style={styles.label}>Link (optioneel)</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor={tennisColors.textMuted}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Beschrijving (optioneel)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Beschrijving"
            placeholderTextColor={tennisColors.textMuted}
            multiline
          />

          <Text style={styles.label}>PDF (optioneel)</Text>
          <LessonAttachments attachments={attachments} onChange={setAttachments} />

          <Text style={styles.label}>Voor wie</Text>
          <StudentCombobox
            students={students}
            value={studentId}
            onChange={setStudentId}
            placeholder="Iedereen"
          />

          <Button
            label="Toevoegen"
            variant="primary"
            icon={<Plus size={18} color={tennisColors.white} />}
            disabled={title.trim().length === 0}
            onPress={() => {
              void handleAdd();
            }}
            style={styles.addButton}
          />
        </Card>
      ) : null}

      {visibleLessons.length === 0 ? (
        <Text style={styles.empty}>Nog geen lesmateriaal.</Text>
      ) : (
        <View style={styles.list}>
          {visibleLessons.map((lesson) => (
            <Card
              key={lesson.id}
              style={styles.row}
              onPress={() => {
                setSelected(lesson);
                setDetailOpen(true);
              }}
            >
              <View style={styles.rowIcon}>
                <BookOpen size={22} color={tennisColors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>
                  {lesson.training_number !== undefined
                    ? `${lesson.training_number}. ${lesson.title}`
                    : lesson.title}
                </Text>
                <Text style={styles.rowMuted}>
                  Voor: {studentNameFor(lesson.student_id)}
                  {lesson.duration_minutes !== undefined
                    ? ` • ${Math.floor(lesson.duration_minutes / 60)}u${String(
                        lesson.duration_minutes % 60,
                      ).padStart(2, '0')}`
                    : ''}
                  {lesson.exercises !== undefined && lesson.exercises.length > 0
                    ? ` • ${lesson.exercises.length} oefeningen`
                    : ''}
                  {lesson.attachments !== undefined && lesson.attachments.length > 0
                    ? ` • ${lesson.attachments.length} PDF`
                    : ''}
                  {lesson.drawing ? ' • veldsituatie' : ''}
                </Text>
              </View>
              <View style={styles.rowChevron}>
                <ChevronRight size={20} color={tennisColors.textMuted} />
              </View>
            </Card>
          ))}
        </View>
      )}

      <LessonDetailModal
        lesson={selected}
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        canEdit={isCoach}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.h1,
    color: tennisColors.text,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  addButton: {
    marginTop: spacing.lg,
  },
  empty: {
    fontSize: 15,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...webCursor,
  },
  rowIcon: {
    marginRight: spacing.md,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tennisColors.text,
  },
  rowMuted: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
  },
  rowChevron: {
    marginLeft: spacing.sm,
  },
});
