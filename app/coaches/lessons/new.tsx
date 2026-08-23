// Nieuw lesmateriaal toevoegen. Alleen het formulier: wat er al is, staat in de databank.
//
// Dezelfde velden als bij het bewerken van een bestaande les, en dat is het punt: duur,
// aandachtspunten, materiaal en oefeningen stonden hier niet, dus moest een trainer eerst
// opslaan en dan meteen weer bewerken om zijn lesplan kwijt te kunnen. Het invulblok komt
// uit components/LessonTraining, precies zoals in het bewerkscherm — één formulier op twee
// plekken, zodat een veld dat erbij komt niet op één van de twee vergeten wordt.
//
// De tags onderaan zijn geen verplicht invoerveld. De app leidt ze af uit titel,
// beschrijving, aandachtspunten, materiaal en oefeningen (lib/tags); het veld is er voor wat
// níet in de tekst staat — "U9", de naam van een oefenreeks. Wat de app zelf al herkent,
// staat er live onder, zodat een trainer niet gaat overtypen wat hij al geschreven heeft.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

import { Screen } from '../../../components/ui/Screen';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StudentCombobox } from '../../../components/ui/StudentCombobox';
import { LessonAttachments } from '../../../components/LessonAttachments';
import { TagPill } from '../../../components/LessonDatabase';
import {
  TrainingPlanEditor, planPatch, type TrainingPlan,
} from '../../../components/LessonTraining';
import { parseTagInput, tagsForLesson } from '../../../lib/tags';
import { spacing, typography, webCursor } from '../../../constants/theme';
import { useT } from '../../../lib/i18n';
import { tennisColors } from '../../../constants/tennis-colors';
import { useSimpleData } from '../../../providers/SimpleDataProvider';
import type { LessonAttachment, User } from '../../../lib/types';
import { isCoach } from '../../../lib/rechten';
import { playersOf } from '../../../lib/hub';

/** Een leeg lesplan. Eén plek, zodat het beginnen en het opnieuw beginnen niet uiteenlopen. */
const leegPlan = (): TrainingPlan => ({ focus_points: [], materials: [], exercises: [] });

export default function NewLessonScreen(): React.JSX.Element {
  const t = useT();
  const { currentUser, users, addLesson, error } = useSimpleData();
  const router = useRouter();

  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [plan, setPlan] = useState<TrainingPlan>(leegPlan);
  // Loopt op na elk opslaan, zodat het invulblok opnieuw opgebouwd wordt met lege velden.
  // Zonder dit blijven de tekstvakjes van de vorige les staan — dezelfde truc als in het
  // bewerkscherm.
  const [ronde, setRonde] = useState<number>(0);
  const [saved, setSaved] = useState<string | null>(null);

  const students: User[] = playersOf(users);

  // Wat de app zelf uit de tekst haalt, terwijl je typt — langs precies dezelfde velden als
  // waar de les straks zijn tags uit krijgt.
  const auto = useMemo(
    () => tagsForLesson({ title, description, ...planPatch(plan) }),
    [title, description, plan],
  );
  const own = useMemo(() => parseTagInput(tagInput), [tagInput]);
  const extra = auto.filter((t) => !own.some((o) => o.toLowerCase() === t.toLowerCase()));

  if (!isCoach(currentUser)) {
    return (
      <Screen>
        <Text style={styles.empty}>{t('Alleen een trainer kan lesmateriaal toevoegen.')}</Text>
      </Screen>
    );
  }

  const handleAdd = async (): Promise<void> => {
    if (!currentUser) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) return;

    await addLesson({
      title: trimmedTitle,
      url: url.trim().length > 0 ? url.trim() : undefined,
      description: description.trim().length > 0 ? description.trim() : undefined,
      tags: own.length > 0 ? own : undefined,
      ...planPatch(plan),
      uploaded_by: currentUser.id,
      coach_id: currentUser.id,
      student_id: studentId ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setSaved(trimmedTitle);
    setTitle('');
    setUrl('');
    setDescription('');
    setTagInput('');
    setStudentId(null);
    setAttachments([]);
    setPlan(leegPlan());
    setRonde((n) => n + 1);
  };

  return (
    <Screen>
      {error !== undefined && error !== null && error.length > 0 ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {saved !== null ? (
        <Card>
          <Text style={styles.savedText}>{t('“{titel}” is toegevoegd.', { titel: saved })}</Text>
          <Text
            style={styles.link}
            accessibilityRole="button"
            accessibilityLabel={t('Bekijk in de databank')}
            onPress={() => router.push('/coaches/lessons/databank')}
          >
            {t('Bekijk in de databank')}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.label}>{t('Titel')}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t('Titel')}
          placeholderTextColor={tennisColors.textMuted}
        />

        <Text style={styles.label}>{t('Link (optioneel)')}</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={tennisColors.textMuted}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t('Beschrijving (optioneel)')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('Beschrijving')}
          placeholderTextColor={tennisColors.textMuted}
          multiline
        />

        {/* Het lesplan: duur, aandachtspunten, materiaal en de oefeningentabel. Hetzelfde
            blok als in het bewerkscherm. */}
        <TrainingPlanEditor key={ronde} value={plan} onChange={setPlan} />

        <Text style={styles.label}>{t('Tags (optioneel)')}</Text>
        <TextInput
          style={styles.input}
          value={tagInput}
          onChangeText={setTagInput}
          placeholder={t('U9, wedstrijdvorm')}
          placeholderTextColor={tennisColors.textMuted}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          Scheid met een komma. De app herkent zelf al waar de tekst over gaat.
        </Text>
        {own.length > 0 || extra.length > 0 ? (
          <View style={styles.pills}>
            {own.map((t) => (
              <TagPill key={`own-${t}`} label={t} />
            ))}
            {extra.map((t) => (
              <TagPill key={`auto-${t}`} label={t} />
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>{t('PDF (optioneel)')}</Text>
        <LessonAttachments attachments={attachments} onChange={setAttachments} />

        <Text style={styles.label}>{t('Voor wie')}</Text>
        <StudentCombobox
          students={students}
          value={studentId}
          onChange={setStudentId}
          placeholder={t('Iedereen')}
        />

        <Button
          label={t('Toevoegen')}
          variant="primary"
          icon={<Plus size={18} color={tennisColors.onFill} />}
          disabled={title.trim().length === 0}
          onPress={() => {
            void handleAdd();
          }}
          style={styles.addButton}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, fontSize: 14 },
  savedText: { fontSize: 15, color: tennisColors.text },
  link: { fontSize: 14, fontWeight: '600', color: tennisColors.primary, ...webCursor },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  hint: { fontSize: 12, color: tennisColors.textMuted, marginTop: spacing.xs },
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
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  addButton: { marginTop: spacing.lg },
  empty: {
    ...typography.h3,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
