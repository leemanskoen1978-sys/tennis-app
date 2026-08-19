import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookOpen, ExternalLink, Plus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { spacing, typography, radius } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';

const IEDEREEN = '__iedereen__';

export default function LessonsScreen(): React.JSX.Element {
  const { currentUser, lessons, users, addLesson, error } = useSimpleData();

  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>(IEDEREEN);

  const isCoach = currentUser?.role === 'coach';

  const students = users.filter((u) => u.role !== 'coach');

  const visibleLessons = lessons.filter((l) => {
    if (isCoach) {
      return true;
    }
    if (l.student_id === undefined || l.student_id === null) {
      return true;
    }
    return l.student_id === currentUser?.id;
  });

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
      student_id: selectedStudent === IEDEREEN ? undefined : selectedStudent,
    });

    setTitle('');
    setUrl('');
    setDescription('');
    setSelectedStudent(IEDEREEN);
  };

  const handleOpenUrl = (target: string): void => {
    void Linking.openURL(target);
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

          <Text style={styles.label}>Voor</Text>
          <View style={styles.chips}>
            <Chip
              label="Iedereen"
              selected={selectedStudent === IEDEREEN}
              onPress={() => setSelectedStudent(IEDEREEN)}
            />
            {students.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                selected={selectedStudent === s.id}
                onPress={() => setSelectedStudent(s.id)}
              />
            ))}
          </View>

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
            <Card key={lesson.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <BookOpen size={22} color={tennisColors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{lesson.title}</Text>
                {lesson.description !== undefined &&
                lesson.description !== null &&
                lesson.description.length > 0 ? (
                  <Text style={styles.rowDescription}>{lesson.description}</Text>
                ) : null}
                {lesson.url !== undefined &&
                lesson.url !== null &&
                lesson.url.length > 0 ? (
                  <Pressable
                    onPress={() => handleOpenUrl(lesson.url as string)}
                    style={styles.openButton}
                  >
                    <ExternalLink size={16} color={tennisColors.primary} />
                    <Text style={styles.openButtonText}>Openen</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      )}
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
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: tennisColors.text,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  },
  rowIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: tennisColors.text,
  },
  rowDescription: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.primary,
  },
});
