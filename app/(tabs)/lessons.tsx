import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookOpen, ExternalLink, Plus } from 'lucide-react-native';
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.heading}>Lessen</Text>

      {error !== undefined && error !== null && error.length > 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {isCoach ? (
        <View style={styles.form}>
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
            <Pressable
              onPress={() => setSelectedStudent(IEDEREEN)}
              style={[
                styles.chip,
                selectedStudent === IEDEREEN ? styles.chipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedStudent === IEDEREEN ? styles.chipTextActive : null,
                ]}
              >
                Iedereen
              </Text>
            </Pressable>
            {students.map((s) => {
              const active = selectedStudent === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedStudent(s.id)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active ? styles.chipTextActive : null,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              void handleAdd();
            }}
            style={[
              styles.addButton,
              title.trim().length === 0 ? styles.addButtonDisabled : null,
            ]}
            disabled={title.trim().length === 0}
          >
            <Plus size={18} color={tennisColors.white} />
            <Text style={styles.addButtonText}>Toevoegen</Text>
          </Pressable>
        </View>
      ) : null}

      {visibleLessons.length === 0 ? (
        <Text style={styles.empty}>Nog geen lesmateriaal.</Text>
      ) : (
        <View style={styles.list}>
          {visibleLessons.map((lesson) => (
            <View key={lesson.id} style={styles.row}>
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
                    <ExternalLink size={16} color={tennisColors.accent} />
                    <Text style={styles.openButtonText}>Openen</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: tennisColors.text,
    marginBottom: 16,
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
    marginBottom: 12,
  },
  form: {
    backgroundColor: tennisColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 16,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
  },
  chipActive: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.text,
  },
  chipTextActive: {
    color: tennisColors.white,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tennisColors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: tennisColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    fontSize: 15,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: 32,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: tennisColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tennisColors.border,
    padding: 14,
  },
  rowIcon: {
    marginRight: 12,
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
    marginTop: 4,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: tennisColors.accent,
  },
});
