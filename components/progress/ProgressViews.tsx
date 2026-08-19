import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius } from '../../constants/theme';
import type { StudentProgress, TrainingType } from '../../lib/types';

export const TRAINING_TYPES: readonly TrainingType[] = ['techniek', 'tactiek', 'fysiek', 'mentaal', 'match'] as const;
export const TRAINING_LABELS: Record<TrainingType, string> = {
  techniek: 'Techniek', tactiek: 'Tactiek', fysiek: 'Fysiek', mentaal: 'Mentaal', match: 'Match',
};

export const byDateDesc = (a: StudentProgress, b: StudentProgress) =>
  (b.created_at ?? '').localeCompare(a.created_at ?? '');

export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function Stars({ count }: { count: number }) {
  if (!count) return null;
  return (
    <View style={styles.starsInline} accessibilityRole="image" accessibilityLabel={`${count} sterren`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} fill={tennisColors.warning} color={tennisColors.warning} />
      ))}
    </View>
  );
}

export function AudioMemo({ uri }: { uri: string }) {
  if (Platform.OS !== 'web') return <Text style={styles.memoNative}>🔊 Spraakmemo</Text>;
  return React.createElement('audio', { src: uri, controls: true, style: { height: 32, width: '100%', marginTop: 4 } });
}

export function ProgressEntryCard({ p, studentName, showStudent, lessonTitle }: {
  p: StudentProgress; studentName: string; showStudent: boolean; lessonTitle?: string;
}) {
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryType}>{TRAINING_LABELS[p.training_type]}</Text>
        <Stars count={p.rating ?? 0} />
      </View>
      {showStudent ? <Text style={styles.entryStudent}>{studentName}</Text> : null}
      {p.created_at ? <Text style={styles.entryDate}>{formatDate(p.created_at)}</Text> : null}
      {lessonTitle ? <Text style={styles.entryLesson}>Les: {lessonTitle}</Text> : null}
      {p.notes ? <Text style={styles.entryText}>{p.notes}</Text> : null}
      {p.homework ? <Text style={styles.entryHomework}>Huiswerk: {p.homework}</Text> : null}
      {p.voice_memo_uri ? <AudioMemo uri={p.voice_memo_uri} /> : null}
    </Card>
  );
}

export function ReportSummary({ entries }: { entries: StudentProgress[] }) {
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

const styles = StyleSheet.create({
  cardTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginBottom: spacing.sm },
  entryCard: { marginBottom: spacing.md },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryType: { fontSize: 15, fontWeight: '700', color: tennisColors.primaryDark },
  starsInline: { flexDirection: 'row', gap: 2 },
  entryStudent: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: 2 },
  entryDate: { fontSize: 12, color: tennisColors.textMuted, marginTop: 2 },
  entryLesson: { fontSize: 13, color: tennisColors.court, fontWeight: '600', marginTop: 2 },
  entryText: { fontSize: 14, color: tennisColors.text, marginTop: 4 },
  entryHomework: { fontSize: 13, color: tennisColors.clay, fontWeight: '600', marginTop: 4 },
  memoNative: { fontSize: 13, color: tennisColors.textMuted, marginTop: 4 },
  summaryLine: { fontSize: 14, color: tennisColors.text },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  typePill: { backgroundColor: tennisColors.primaryTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  typePillText: { fontSize: 12, fontWeight: '600', color: tennisColors.primaryDark },
});
