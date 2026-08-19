import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star, UserPlus } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import {
  TRAINING_TYPES, TRAINING_LABELS, byDateDesc, ProgressEntryCard, ReportSummary,
} from '../../components/progress/ProgressViews';
import { spacing, typography, radius, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { UserManagement } from '../../components/UserManagement';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import type { TrainingType } from '../../lib/types';

const RATINGS: readonly number[] = [1, 2, 3, 4, 5] as const;

export default function ProgressScreen(): React.JSX.Element {
  const router = useRouter();
  const { currentUser, progress, users, addProgress, error } = useSimpleData();
  const { playerId } = useLocalSearchParams<{ playerId?: string }>();

  const prefill = users.find((u) => u.id === playerId && u.role !== 'coach')?.id ?? null;
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(prefill);
  const [selectedType, setSelectedType] = useState<TrainingType>('techniek');
  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [homework, setHomework] = useState<string>('');
  const [voiceUri, setVoiceUri] = useState<string | undefined>(undefined);
  const [addPlayerOpen, setAddPlayerOpen] = useState<boolean>(false);
  const [reportStudentId, setReportStudentId] = useState<string | null>(null);

  const isCoach = currentUser?.role === 'coach';
  const students = users.filter((u) => u.role !== 'coach');
  const studentName = (id: string): string => users.find((x) => x.id === id)?.name ?? 'Onbekend';
  const coachName = (id?: string): string => users.find((x) => x.id === id)?.name ?? 'Onbekend';

  const resetForm = (): void => {
    setSelectedStudentId(null);
    setSelectedType('techniek');
    setRating(0);
    setNotes('');
    setHomework('');
    setVoiceUri(undefined);
  };

  const handleSave = async (): Promise<void> => {
    if (!currentUser || !selectedStudentId) return;
    await addProgress({
      student_id: selectedStudentId,
      coach_id: currentUser.id,
      training_type: selectedType,
      rating: rating > 0 ? rating : undefined,
      notes: notes.trim() || undefined,
      homework: homework.trim() || undefined,
      voice_memo_uri: voiceUri,
    });
    resetForm();
  };

  // All recent activity, from every coach — with a label saying who wrote it.
  const recent = isCoach ? [...progress].sort(byDateDesc).slice(0, 5) : [];

  const reportEntries = (studentId: string) =>
    progress.filter((p) => p.student_id === studentId).sort(byDateDesc);

  const ownEntries = currentUser ? reportEntries(currentUser.id) : [];

  return (
    <Screen>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isCoach && currentUser ? (
        <>
          <Card style={styles.formCard}>
            <Text style={styles.cardTitle}>Nieuwe voortgang</Text>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Speler</Text>
              <Pressable onPress={() => setAddPlayerOpen(true)} style={[styles.addLink, webCursor]} accessibilityRole="button" accessibilityLabel="Speler toevoegen">
                <UserPlus size={16} color={tennisColors.primary} />
                <Text style={styles.addLinkText}>Speler toevoegen</Text>
              </Pressable>
            </View>
            <StudentCombobox students={students} value={selectedStudentId} onChange={setSelectedStudentId} placeholder="Typ de naam van de speler…" />

            <Text style={styles.label}>Type training</Text>
            <View style={styles.chipRow}>
              {TRAINING_TYPES.map((t) => (
                <Chip key={t} label={TRAINING_LABELS[t]} selected={t === selectedType} onPress={() => setSelectedType(t)} />
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

            <Text style={styles.label}>Notities</Text>
            <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Notities over de training" placeholderTextColor={tennisColors.textMuted} multiline />

            <Text style={styles.label}>Huiswerk</Text>
            <TextInput style={styles.input} value={homework} onChangeText={setHomework} placeholder="Huiswerk voor de speler" placeholderTextColor={tennisColors.textMuted} />

            <Text style={styles.label}>Spraakmemo</Text>
            <VoiceRecorder value={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(undefined)} />

            <Button label="Opslaan" variant="primary" onPress={handleSave} disabled={!selectedStudentId} style={styles.saveBtn} />
          </Card>

          <Text style={styles.sectionTitle}>Waar je mee bezig bent</Text>
          {recent.length === 0 ? (
            <Text style={styles.muted}>Nog geen recente activiteit.</Text>
          ) : (
            recent.map((p) => <ProgressEntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent coachName={coachName(p.coach_id)} />)
          )}

          <Text style={styles.sectionTitle}>Rapport per speler</Text>
          <StudentCombobox students={students} value={reportStudentId} onChange={setReportStudentId} placeholder="Kies een speler voor het rapport…" />
          {reportStudentId ? (
            <>
              <View style={styles.reportHeader}>
                <Text style={styles.reportName}>{studentName(reportStudentId)}</Text>
                <Button label="Open dossier" variant="secondary" fullWidth={false} onPress={() => router.push(`/players/${reportStudentId}`)} />
              </View>
              {reportEntries(reportStudentId).length === 0 ? (
                <Text style={styles.muted}>Nog geen voortgang voor deze speler.</Text>
              ) : (
                <>
                  <ReportSummary entries={reportEntries(reportStudentId)} />
                  {reportEntries(reportStudentId).map((p) => (
                    <ProgressEntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent={false} coachName={coachName(p.coach_id)} />
                  ))}
                </>
              )}
            </>
          ) : null}

          <UserManagement visible={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} />
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Mijn rapport</Text>
          {ownEntries.length === 0 ? (
            <Text style={styles.muted}>Nog geen voortgang.</Text>
          ) : (
            <>
              <ReportSummary entries={ownEntries} />
              {ownEntries.map((p) => <ProgressEntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent={false} coachName={coachName(p.coach_id)} />)}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: tennisColors.danger, marginBottom: spacing.md, fontSize: 14 },
  formCard: { marginBottom: spacing.lg },
  cardTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  addLinkText: { fontSize: 13, fontWeight: '700', color: tennisColors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starRow: { flexDirection: 'row', flexWrap: 'wrap' },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tennisColors.text, backgroundColor: tennisColors.surface,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, gap: spacing.md },
  reportName: { ...typography.h3, color: tennisColors.text },
});
