import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star, UserPlus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { spacing, typography, radius, webCursor } from '../../constants/theme';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { UserManagement } from '../../components/UserManagement';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import type { StudentProgress, TrainingType } from '../../lib/types';

const TRAINING_TYPES: readonly TrainingType[] = ['techniek', 'tactiek', 'fysiek', 'mentaal', 'match'] as const;
const TRAINING_LABELS: Record<TrainingType, string> = {
  techniek: 'Techniek', tactiek: 'Tactiek', fysiek: 'Fysiek', mentaal: 'Mentaal', match: 'Match',
};
const RATINGS: readonly number[] = [1, 2, 3, 4, 5] as const;

const byDateDesc = (a: StudentProgress, b: StudentProgress) =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '');

function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stars({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.starsInline} accessibilityRole="image" accessibilityLabel={`${count} sterren`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} fill={tennisColors.warning} color={tennisColors.warning} />
      ))}
    </View>
  );
}

function AudioMemo({ uri }: { uri: string }) {
  if (Platform.OS !== 'web') return <Text style={styles.memoNative}>🔊 Spraakmemo</Text>;
  return React.createElement('audio', { src: uri, controls: true, style: { height: 32, width: '100%', marginTop: 4 } });
}

function EntryCard({ p, studentName, showStudent }: { p: StudentProgress; studentName: string; showStudent: boolean }) {
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryType}>{TRAINING_LABELS[p.training_type]}</Text>
        <Stars count={p.rating ?? 0} />
      </View>
      {showStudent ? <Text style={styles.entryStudent}>{studentName}</Text> : null}
      {p.created_at ? <Text style={styles.entryDate}>{formatDate(p.created_at)}</Text> : null}
      {p.notes ? <Text style={styles.entryText}>{p.notes}</Text> : null}
      {p.homework ? <Text style={styles.entryHomework}>Huiswerk: {p.homework}</Text> : null}
      {p.voice_memo_uri ? <AudioMemo uri={p.voice_memo_uri} /> : null}
    </Card>
  );
}

function ReportSummary({ entries }: { entries: StudentProgress[] }) {
  const rated = entries.filter((e) => (e.rating ?? 0) > 0);
  const avg = rated.length ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length : 0;
  const byType = TRAINING_TYPES
    .map((t) => ({ t, n: entries.filter((e) => e.training_type === t).length }))
    .filter((x) => x.n > 0);
  return (
    <Card>
      <Text style={styles.cardTitle}>Samenvatting</Text>
      <Text style={styles.summaryLine}>Aantal sessies: {entries.length}</Text>
      <Text style={styles.summaryLine}>Gemiddelde beoordeling: {avg ? `${avg.toFixed(1)} / 5` : '—'}</Text>
      <View style={styles.typeChips}>
        {byType.map((x) => (
          <View key={x.t} style={styles.typePill}><Text style={styles.typePillText}>{TRAINING_LABELS[x.t]}: {x.n}</Text></View>
        ))}
      </View>
    </Card>
  );
}

export default function ProgressScreen(): React.JSX.Element {
  const { currentUser, progress, users, addProgress, error } = useSimpleData();

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
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

  // "Waar de trainer mee bezig is": most recent entries by this coach.
  const recent = isCoach && currentUser
    ? [...progress].filter((p) => p.coach_id === currentUser.id).sort(byDateDesc).slice(0, 5)
    : [];

  const reportEntries = (studentId: string) =>
    progress.filter((p) => p.student_id === studentId).sort(byDateDesc);

  const ownEntries = currentUser ? reportEntries(currentUser.id) : [];

  return (
    <Screen>
      <Text style={styles.pageTitle}>Voortgang</Text>
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
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notities over de training"
              placeholderTextColor={tennisColors.textMuted}
              multiline
            />

            <Text style={styles.label}>Huiswerk</Text>
            <TextInput
              style={styles.input}
              value={homework}
              onChangeText={setHomework}
              placeholder="Huiswerk voor de speler"
              placeholderTextColor={tennisColors.textMuted}
            />

            <Text style={styles.label}>Spraakmemo</Text>
            <VoiceRecorder value={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(undefined)} />

            <Button label="Opslaan" variant="primary" onPress={handleSave} disabled={!selectedStudentId} style={styles.saveBtn} />
          </Card>

          <Text style={styles.sectionTitle}>Waar je mee bezig bent</Text>
          {recent.length === 0 ? (
            <Text style={styles.muted}>Nog geen recente activiteit.</Text>
          ) : (
            recent.map((p) => <EntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent />)
          )}

          <Text style={styles.sectionTitle}>Rapport per speler</Text>
          <StudentCombobox students={students} value={reportStudentId} onChange={setReportStudentId} placeholder="Kies een speler voor het rapport…" />
          {reportStudentId ? (
            <>
              <Text style={styles.reportName}>{studentName(reportStudentId)}</Text>
              {reportEntries(reportStudentId).length === 0 ? (
                <Text style={styles.muted}>Nog geen voortgang voor deze speler.</Text>
              ) : (
                <>
                  <ReportSummary entries={reportEntries(reportStudentId)} />
                  {reportEntries(reportStudentId).map((p) => (
                    <EntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent={false} />
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
              {ownEntries.map((p) => <EntryCard key={p.id} p={p} studentName={studentName(p.student_id)} showStudent={false} />)}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { ...typography.h1, color: tennisColors.text, marginBottom: spacing.md },
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
  reportName: { ...typography.h3, color: tennisColors.text, marginTop: spacing.xs },
  entryCard: { marginBottom: spacing.md },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryType: { fontSize: 15, fontWeight: '700', color: tennisColors.primaryDark },
  starsInline: { flexDirection: 'row', gap: 2 },
  entryStudent: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: 2 },
  entryDate: { fontSize: 12, color: tennisColors.textMuted, marginTop: 2 },
  entryText: { fontSize: 14, color: tennisColors.text, marginTop: 4 },
  entryHomework: { fontSize: 13, color: tennisColors.clay, fontWeight: '600', marginTop: 4 },
  memoNative: { fontSize: 13, color: tennisColors.textMuted, marginTop: 4 },
  summaryLine: { fontSize: 14, color: tennisColors.text },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  typePill: { backgroundColor: tennisColors.primaryTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  typePillText: { fontSize: 12, fontWeight: '600', color: tennisColors.primaryDark },
});
