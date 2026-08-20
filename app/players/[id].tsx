import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, CheckCircle2, Circle, BookOpen, CalendarPlus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { LessonDetailModal } from '../../components/LessonDetailModal';
import { AssignLessonModal } from '../../components/AssignLessonModal';
import { PlayerGoals } from '../../components/PlayerGoals';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { byDateDesc, ProgressEntryCard, ReportSummary } from '../../components/progress/ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { coachesForPlayer } from '../../lib/relations';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import type { Lesson, PaymentMethod, StudentProgress } from '../../lib/types';
import { formatDay, formatTimeRange } from '../../lib/datetime';

/**
 * Het dossier leest van boven naar onder zoals een trainer eraan denkt: wie is dit en wat
 * staat er gepland, dan het werk (voortgang en doelen), dan het materiaal, en pas onderaan
 * de administratie die je maar één keer instelt.
 */
export default function PlayerDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser, users, bookings, courts, lessons, progress, updateLesson, updateUser,
  } = useSimpleData();

  const player = users.find((u) => u.id === id) ?? null;
  const isCoach = currentUser?.role === 'coach';

  const [progressOpen, setProgressOpen] = useState(false);
  // Welke voortgangsnotitie openstaat; null = blad dicht.
  const [openEntry, setOpenEntry] = useState<StudentProgress | null>(null);
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

  return (
    // `reading`: dit dossier is vooral lopende tekst (doelen, lesplan, notities);
    // die leest niet op de volle breedte van een breed venster.
    <Screen reading>
      {/* Wie is dit */}
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

      {/* Wat staat er gepland */}
      <SectionHeader
        label="Lesdagen"
        action={isCoach ? {
          icon: <CalendarPlus size={16} color={tennisColors.primary} />,
          label: 'Nieuwe afspraak',
          accessibilityLabel: `Nieuwe afspraak met ${player.name}`,
          onPress: () => router.push(`/agenda/new?playerId=${player.id}`),
        } : undefined}
      />
      {upcoming.length === 0 && past.length === 0 ? (
        <Text style={styles.muted}>Nog geen afspraken.</Text>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <>
              <Text style={styles.subLabel}>Aankomend</Text>
              <Card style={styles.listCard}>
                {upcoming.map((b, i) => (
                  <View key={b.id} style={[styles.listRow, i > 0 && styles.divided]}>
                    <View style={styles.rowLine}>
                      <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                      <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                    </View>
                    <Text style={styles.rowMeta}>{courtName(b.court_id)} · {nameOf(b.coach_id)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
          {past.length > 0 ? (
            <>
              <Text style={styles.subLabel}>Geweest</Text>
              <Card style={styles.listCard}>
                {past.slice(0, 6).map((b, i) => (
                  <View key={b.id} style={[styles.listRow, i > 0 && styles.divided]}>
                    <View style={styles.rowLine}>
                      <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                      <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                    </View>
                    <Text style={styles.rowMeta}>{courtName(b.court_id)} · {nameOf(b.coach_id)}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      {/* Het werk: wat er gebeurd is */}
      <SectionHeader label="Voortgang" />
      {isCoach && currentUser ? (
        <Button
          label="Voortgang toevoegen"
          variant="secondary"
          icon={<Plus size={16} color={tennisColors.text} />}
          onPress={() => setProgressOpen(true)}
        />
      ) : null}
      {entries.length === 0 ? (
        <Text style={styles.muted}>Nog geen voortgang.</Text>
      ) : (
        <>
          <ReportSummary entries={entries} />
          {entries.map((p) => (
            <ProgressEntryCard key={p.id} p={p} studentName={player.name} showStudent={false} lessonTitle={lessonTitle(p.lesson_id)} coachName={nameOf(p.coach_id)} onPress={() => setOpenEntry(p)} />
          ))}
        </>
      )}

      {/* Het werk: waar het naartoe gaat */}
      <PlayerGoals studentId={player.id} canEdit={!!isCoach} />

      {/* Het materiaal */}
      <SectionHeader
        label="Lesplan"
        action={isCoach ? {
          icon: <Plus size={16} color={tennisColors.primary} />,
          label: 'Les toewijzen',
          accessibilityLabel: 'Les toewijzen',
          onPress: () => setAssignOpen(true),
        } : undefined}
      />
      <Text style={styles.subLabel}>Te doen</Text>
      {planned.length === 0 ? <Text style={styles.muted}>Geen geplande lessen.</Text> : (
        <Card style={styles.listCard}>
          {planned.map((l, i) => (
            <PlanRow key={l.id} lesson={l} onOpen={() => openLesson(l)} onToggle={() => toggleGiven(l)} canEdit={!!isCoach} given={false} ownerName={nameOf(l.coach_id)} divided={i > 0} />
          ))}
        </Card>
      )}
      <Text style={styles.subLabel}>Gegeven</Text>
      {given.length === 0 ? <Text style={styles.muted}>Nog niets gegeven.</Text> : (
        <Card style={styles.listCard}>
          {given.map((l, i) => (
            <PlanRow key={l.id} lesson={l} onOpen={() => openLesson(l)} onToggle={() => toggleGiven(l)} canEdit={!!isCoach} given ownerName={nameOf(l.coach_id)} divided={i > 0} />
          ))}
        </Card>
      )}

      {/* De administratie: één keer instellen, daarna vergeten */}
      {isCoach ? (
        <>
          <SectionHeader label="Administratie" />
          <Card>
            <Text style={styles.cardTitle}>Standaard betaalwijze</Text>
            <Text style={styles.muted}>
              Een nieuwe les van {player.name} krijgt deze betaalwijze meteen.
            </Text>
            <View style={styles.chipRow}>
              {PAYMENT_METHODS.map((method) => (
                <Chip
                  key={method}
                  label={PAYMENT_LABELS[method]}
                  selected={(player.default_payment_method ?? 'open') === method}
                  onPress={() => {
                    void updateUser(player.id, {
                      default_payment_method: method as PaymentMethod,
                    });
                  }}
                />
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <LessonDetailModal lesson={detailLesson} visible={detailOpen} onClose={() => setDetailOpen(false)} canEdit={!!isCoach} />
      <AssignLessonModal visible={assignOpen} onClose={() => setAssignOpen(false)} playerId={player.id} />
      <ProgressForm visible={progressOpen} onClose={() => setProgressOpen(false)} studentId={player.id} />
      {/* Hetzelfde blad, nu met een notitie erin: bewerken voor de trainer, lezen voor de speler. */}
      <ProgressForm
        visible={openEntry !== null}
        onClose={() => setOpenEntry(null)}
        studentId={player.id}
        entry={openEntry}
        canEdit={!!isCoach}
      />
    </Screen>
  );
}

/** Sectiekopje in de stijl van de rest van de app, met eventueel één actie rechts. */
function SectionHeader({ label, action }: {
  label: string;
  action?: { icon: ReactNode; label: string; accessibilityLabel: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={[styles.addLink, webCursor]}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
        >
          {action.icon}
          <Text style={styles.addLinkText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlanRow({ lesson, onOpen, onToggle, canEdit, given, ownerName, divided }: {
  lesson: Lesson; onOpen: () => void; onToggle: () => void; canEdit: boolean; given: boolean;
  ownerName?: string; divided: boolean;
}) {
  return (
    <View style={[styles.planRow, styles.listRow, divided && styles.divided]}>
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
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: tennisColors.text },
  contact: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  coachRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.sm },
  coachRowItem: { flexDirection: 'row', alignItems: 'center' },
  coachRowLabel: { fontSize: 14, fontWeight: '600', color: tennisColors.text },
  coachLink: { fontSize: 14, fontWeight: '600', color: tennisColors.primary, textDecorationLine: 'underline' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subLabel: { fontSize: 13, fontWeight: '700', color: tennisColors.textMuted, marginTop: spacing.sm, textTransform: 'uppercase' },
  muted: { color: tennisColors.textMuted, fontSize: 14 },
  listCard: { gap: 0, paddingVertical: spacing.xs },
  listRow: { paddingVertical: spacing.md },
  divided: { borderTopWidth: 1, borderTopColor: tennisColors.border },
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
  cardTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
