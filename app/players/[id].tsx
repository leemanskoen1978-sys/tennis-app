import { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, Plus, X, CheckCircle2, Circle, BookOpen, CalendarPlus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import { LessonDetailModal } from '../../components/LessonDetailModal';
import {
  TRAINING_TYPES, TRAINING_LABELS, byDateDesc, ProgressEntryCard, ReportSummary,
} from '../../components/progress/ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { coachesForPlayer } from '../../lib/relations';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, shadow, webCursor } from '../../constants/theme';
import type { Lesson, TrainingType } from '../../lib/types';

const RATINGS = [1, 2, 3, 4, 5] as const;

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', { weekday: 'short', day: '2-digit', month: 'short' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
}

export default function PlayerDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser, users, bookings, courts, lessons, progress,
    addLesson, updateLesson, addProgress,
  } = useSimpleData();

  const player = users.find((u) => u.id === id) ?? null;
  const isCoach = currentUser?.role === 'coach';

  // Voortgang form
  const [type, setType] = useState<TrainingType>('techniek');
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');
  const [voiceUri, setVoiceUri] = useState<string | undefined>(undefined);
  const [linkLessonId, setLinkLessonId] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!player) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Speler niet gevonden.</Text>
      </Screen>
    );
  }

  const courtName = (cid: string) => courts.find((c) => c.id === cid)?.name ?? '';
  const nameOf = (uid?: string) => users.find((u) => u.id === uid)?.name ?? 'Onbekend';

  // The dossier is shared between every coach who works with this player. The relation is
  // derived from bookings/lessons/progress — there is no assignment screen to keep in sync.
  const playerCoaches = coachesForPlayer(player.id, bookings, lessons, progress)
    .map((cid) => ({ id: cid, name: nameOf(cid) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const now = Date.now();
  const playerBookings = bookings.filter((b) => b.player_id === player.id && b.status !== 'cancelled');
  const upcoming = playerBookings.filter((b) => new Date(b.end_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = playerBookings.filter((b) => new Date(b.end_time).getTime() < now)
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const playerLessons = lessons.filter((l) => l.student_id === player.id);
  const planned = playerLessons.filter((l) => l.status !== 'gegeven');
  const given = playerLessons.filter((l) => l.status === 'gegeven');
  const lessonTitle = (lid?: string) => (lid ? lessons.find((l) => l.id === lid)?.title : undefined);

  const entries = progress.filter((p) => p.student_id === player.id).sort(byDateDesc);

  const openLesson = (l: Lesson) => { setDetailLesson(l); setDetailOpen(true); };
  const toggleGiven = (l: Lesson) =>
    updateLesson(l.id, { status: l.status === 'gegeven' ? 'gepland' : 'gegeven' });

  const saveProgress = async () => {
    if (!currentUser) return;
    await addProgress({
      student_id: player.id,
      coach_id: currentUser.id,
      training_type: type,
      rating: rating > 0 ? rating : undefined,
      notes: notes.trim() || undefined,
      homework: homework.trim() || undefined,
      voice_memo_uri: voiceUri,
      lesson_id: linkLessonId ?? undefined,
    });
    setType('techniek'); setRating(0); setNotes(''); setHomework('');
    setVoiceUri(undefined); setLinkLessonId(null);
  };

  return (
    <Screen>
      {/* Kop */}
      <Card>
        <Text style={styles.name}>{player.name}</Text>
        <Badge label={player.role === 'coach' ? 'Coach' : player.role === 'parent' ? 'Ouder' : 'Speler'} color={tennisColors.primary} />
        {player.email ? <Text style={styles.contact}>{player.email}</Text> : null}
        {player.phone ? <Text style={styles.contact}>{player.phone}</Text> : null}
        {playerCoaches.length > 0 ? (
          <View style={styles.coachRow}>
            <Text style={styles.coachRowLabel}>Trainers: </Text>
            {playerCoaches.map((c, i) => (
              <View key={c.id} style={styles.coachRowItem}>
                {i > 0 ? <Text style={styles.coachRowLabel}> · </Text> : null}
                <Pressable
                  onPress={() => router.push(`/coaches/${c.id}`)}
                  style={webCursor}
                  accessibilityRole="button"
                  accessibilityLabel={`Open dossier van trainer ${c.name}`}
                >
                  <Text style={styles.coachLink}>{c.name}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {/* Lesdagen */}
      <View style={styles.sectionHeader}>
        <Text style={styles.section}>Lesdagen</Text>
        {isCoach ? (
          <Pressable
            onPress={() => router.push(`/agenda/new?playerId=${player.id}`)}
            style={[styles.addLink, webCursor]}
            accessibilityRole="button"
            accessibilityLabel={`Nieuwe afspraak met ${player.name}`}
          >
            <CalendarPlus size={16} color={tennisColors.primary} />
            <Text style={styles.addLinkText}>Nieuwe afspraak</Text>
          </Pressable>
        ) : null}
      </View>
      {upcoming.length === 0 && past.length === 0 ? (
        <Text style={styles.muted}>Nog geen afspraken.</Text>
      ) : (
        <>
          {upcoming.length > 0 ? <Text style={styles.subLabel}>Aankomend</Text> : null}
          {upcoming.map((b) => (
            <Card key={b.id} style={styles.rowCard}>
              <View style={styles.rowLine}>
                <Text style={styles.rowDay}>{fmtDay(b.start_time)}</Text>
                <Text style={styles.rowTime}>{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</Text>
              </View>
              <Text style={styles.rowMeta}>{courtName(b.court_id)} · {nameOf(b.coach_id)}</Text>
            </Card>
          ))}
          {past.length > 0 ? <Text style={styles.subLabel}>Geweest</Text> : null}
          {past.slice(0, 6).map((b) => (
            <Card key={b.id} style={styles.rowCard}>
              <View style={styles.rowLine}>
                <Text style={styles.rowDay}>{fmtDay(b.start_time)}</Text>
                <Text style={styles.rowTime}>{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</Text>
              </View>
              <Text style={styles.rowMeta}>{courtName(b.court_id)} · {nameOf(b.coach_id)}</Text>
            </Card>
          ))}
        </>
      )}

      {/* Lesplan */}
      <View style={styles.sectionHeader}>
        <Text style={styles.section}>Lesplan</Text>
        {isCoach ? (
          <Pressable onPress={() => setAssignOpen(true)} style={[styles.addLink, webCursor]} accessibilityRole="button" accessibilityLabel="Les toewijzen">
            <Plus size={16} color={tennisColors.primary} />
            <Text style={styles.addLinkText}>Les toewijzen</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.subLabel}>Doelen / Te doen</Text>
      {planned.length === 0 ? <Text style={styles.muted}>Geen geplande lessen.</Text> : planned.map((l) => (
        <PlanRow key={l.id} lesson={l} onOpen={() => openLesson(l)} onToggle={() => toggleGiven(l)} canEdit={!!isCoach} given={false} ownerName={nameOf(l.coach_id)} />
      ))}
      <Text style={styles.subLabel}>Gegeven</Text>
      {given.length === 0 ? <Text style={styles.muted}>Nog niets gegeven.</Text> : given.map((l) => (
        <PlanRow key={l.id} lesson={l} onOpen={() => openLesson(l)} onToggle={() => toggleGiven(l)} canEdit={!!isCoach} given ownerName={nameOf(l.coach_id)} />
      ))}

      {/* Voortgang */}
      <Text style={styles.section}>Voortgang</Text>

      {isCoach && currentUser ? (
        <Card style={styles.formCard}>
          <Text style={styles.cardTitle}>Nieuwe voortgang</Text>
          <Text style={styles.label}>Type training</Text>
          <View style={styles.chipRow}>
            {TRAINING_TYPES.map((t) => (
              <Chip key={t} label={TRAINING_LABELS[t]} selected={t === type} onPress={() => setType(t)} />
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

          {playerLessons.length > 0 ? (
            <>
              <Text style={styles.label}>Koppel aan les (optioneel)</Text>
              <View style={styles.chipRow}>
                <Chip label="Geen" selected={linkLessonId === null} onPress={() => setLinkLessonId(null)} />
                {playerLessons.map((l) => (
                  <Chip key={l.id} label={l.title} selected={linkLessonId === l.id} onPress={() => setLinkLessonId(l.id)} />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Notities</Text>
          <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Notities over de training" placeholderTextColor={tennisColors.textMuted} multiline />
          <Text style={styles.label}>Huiswerk</Text>
          <TextInput style={styles.input} value={homework} onChangeText={setHomework} placeholder="Huiswerk" placeholderTextColor={tennisColors.textMuted} />
          <Text style={styles.label}>Spraakmemo</Text>
          <VoiceRecorder value={voiceUri} onRecorded={setVoiceUri} onClear={() => setVoiceUri(undefined)} />
          <Button label="Opslaan" variant="primary" onPress={saveProgress} style={styles.saveBtn} />
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <Text style={styles.muted}>Nog geen voortgang.</Text>
      ) : (
        <>
          <ReportSummary entries={entries} />
          {entries.map((p) => (
            <ProgressEntryCard key={p.id} p={p} studentName={player.name} showStudent={false} lessonTitle={lessonTitle(p.lesson_id)} coachName={nameOf(p.coach_id)} />
          ))}
        </>
      )}

      <LessonDetailModal lesson={detailLesson} visible={detailOpen} onClose={() => setDetailOpen(false)} canEdit={!!isCoach} />
      <AssignLessonModal visible={assignOpen} onClose={() => setAssignOpen(false)} playerId={player.id} />
    </Screen>
  );
}

function PlanRow({ lesson, onOpen, onToggle, canEdit, given, ownerName }: {
  lesson: Lesson; onOpen: () => void; onToggle: () => void; canEdit: boolean; given: boolean;
  ownerName?: string;
}) {
  return (
    <Card style={styles.rowCard}>
      <View style={styles.planRow}>
        <Pressable onPress={onOpen} style={[styles.planOpen, webCursor]} accessibilityRole="button" accessibilityLabel={lesson.title}>
          <BookOpen size={18} color={tennisColors.primary} />
          <View style={styles.planTitleWrap}>
            <Text style={styles.planTitle} numberOfLines={1}>{lesson.title}</Text>
            {ownerName ? <Text style={styles.planOwner}>van {ownerName}</Text> : null}
          </View>
        </Pressable>
        {canEdit ? (
          <Pressable onPress={onToggle} style={[styles.toggle, webCursor]} accessibilityRole="button" accessibilityLabel={given ? 'Terug naar gepland' : 'Markeer als gegeven'}>
            {given ? <CheckCircle2 size={22} color={tennisColors.success} /> : <Circle size={22} color={tennisColors.textMuted} />}
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function AssignLessonModal({ visible, onClose, playerId }: { visible: boolean; onClose: () => void; playerId: string }) {
  const { currentUser, users, lessons, addLesson, updateLesson } = useSimpleData();
  const ownerName = (uid?: string) => users.find((u) => u.id === uid)?.name ?? 'Onbekend';
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  // The whole library, not just your own material: coaches share what they make. The
  // !student_id check stays — that hides lessons already assigned to a player.
  const library = lessons.filter((l) => !l.student_id);

  const assign = (lessonId: string) => updateLesson(lessonId, { student_id: playerId, status: 'gepland' });

  const create = async () => {
    if (!currentUser || !title.trim()) return;
    await addLesson({
      title: title.trim(),
      url: url.trim() || undefined,
      uploaded_by: currentUser.id,
      coach_id: currentUser.id,
      student_id: playerId,
      status: 'gepland',
    });
    setTitle(''); setUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Les toewijzen</Text>
            <Pressable onPress={onClose} style={webCursor} accessibilityRole="button" accessibilityLabel="Sluiten"><X size={22} color={tennisColors.textMuted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.label}>Nieuwe les</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Titel" placeholderTextColor={tennisColors.textMuted} />
            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="Video-URL (optioneel)" placeholderTextColor={tennisColors.textMuted} autoCapitalize="none" />
            <Button label="Aanmaken & toewijzen" variant="primary" onPress={create} disabled={!title.trim()} />

            {library.length > 0 ? (
              <>
                <Text style={[styles.label, { marginTop: spacing.lg }]}>Uit bibliotheek</Text>
                {library.map((l) => (
                  <View key={l.id} style={styles.libRow}>
                    <View style={styles.libTitleWrap}>
                      <Text style={styles.libTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={styles.libOwner}>van {ownerName(l.coach_id ?? l.uploaded_by)}</Text>
                    </View>
                    <Button label="Toewijzen" variant="secondary" fullWidth={false} onPress={() => { assign(l.id); onClose(); }} />
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: tennisColors.text },
  contact: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  coachRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.sm },
  coachRowItem: { flexDirection: 'row', alignItems: 'center' },
  coachRowLabel: { fontSize: 14, fontWeight: '600', color: tennisColors.text },
  coachLink: { fontSize: 14, fontWeight: '600', color: tennisColors.primary, textDecorationLine: 'underline' },
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  subLabel: { fontSize: 13, fontWeight: '700', color: tennisColors.textMuted, marginTop: spacing.sm, textTransform: 'uppercase' },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  rowCard: { paddingVertical: spacing.md },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowDay: { fontSize: 15, fontWeight: '700', color: tennisColors.text, textTransform: 'capitalize' },
  rowTime: { fontSize: 14, color: tennisColors.text },
  rowMeta: { fontSize: 13, color: tennisColors.textMuted, marginTop: 2 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planTitleWrap: { flex: 1 },
  planTitle: { fontSize: 15, fontWeight: '600', color: tennisColors.text },
  planOwner: { fontSize: 12, color: tennisColors.textMuted, marginTop: 1 },
  toggle: { padding: 4 },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLinkText: { fontSize: 13, fontWeight: '700', color: tennisColors.primary },
  formCard: { marginTop: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginBottom: spacing.sm },
  label: { fontSize: 13, fontWeight: '600', color: tennisColors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starRow: { flexDirection: 'row', flexWrap: 'wrap' },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1, borderColor: tennisColors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tennisColors.text,
    backgroundColor: tennisColors.surface, marginBottom: spacing.sm,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.lg },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: tennisColors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, maxHeight: '85%', ...shadow('lg'),
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { ...typography.h2, color: tennisColors.text },
  sheetBody: { paddingBottom: spacing.lg },
  libRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: tennisColors.border },
  libTitleWrap: { flex: 1 },
  libTitle: { fontSize: 14, color: tennisColors.text },
  libOwner: { fontSize: 12, color: tennisColors.textMuted, marginTop: 1 },
});
