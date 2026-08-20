import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, CheckCircle2, Circle, BookOpen, CalendarPlus } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { CollapsibleSection } from '../../components/ui/CollapsibleSection';
import { LessonDetailModal } from '../../components/LessonDetailModal';
import { AssignLessonModal } from '../../components/AssignLessonModal';
import { PlayerGoals } from '../../components/PlayerGoals';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { byDateDesc, ProgressEntryCard } from '../../components/progress/ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { coachesForPlayer } from '../../lib/relations';
import { filledGoalCount, goalCountLabel } from '../../lib/goals';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor, minTapTarget } from '../../constants/theme';
import type { Lesson, PaymentMethod, StudentProgress } from '../../lib/types';
import { formatDay, formatTimeRange } from '../../lib/datetime';

/**
 * Het dossier leest van boven naar onder zoals een trainer eraan denkt: wie is dit en wat
 * staat er gepland, dan het werk (voortgang en doelen), dan het materiaal, en pas onderaan
 * de administratie die je maar één keer instelt.
 *
 * Elke sectie is dichtgeklapt één regel met een telling erbij, want alles tegelijk open
 * betekende eindeloos scrollen. De kop-kaart met de speler blijft altijd staan: dat is de
 * identiteit van het scherm, niet een sectie die je wegklapt.
 */

/** De secties die open of dicht kunnen staan. */
type SectionKey = 'lesdagen' | 'voortgang' | 'doelen' | 'lesplan' | 'administratie';

/**
 * Wat er openstaat als je een dossier opent: alleen Doelen.
 *
 * Doelen is de kortste sectie (hooguit drie compacte regels, ongeacht hoe vol het dossier
 * zit), dus het scherm blijft een overzicht. En het antwoordt op de vraag die een trainer
 * elke keer heeft als hij een dossier opent: waar werkt deze speler aan? De rest zegt met
 * zijn telling genoeg om te weten of je hem nodig hebt.
 */
const DEFAULT_OPEN: SectionKey = 'doelen';

export default function PlayerDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser, users, bookings, courts, lessons, progress, goals, updateLesson, updateUser,
  } = useSimpleData();

  const player = users.find((u) => u.id === id) ?? null;
  const isCoach = currentUser?.role === 'coach';

  // Meerdere secties mogen tegelijk open: je vergelijkt soms voortgang met het lesplan.
  // Niet onthouden tussen bezoeken — dat zou state zijn die niemand beheert.
  const [openSections, setOpenSections] = useState<Partial<Record<SectionKey, boolean>>>({
    [DEFAULT_OPEN]: true,
  });
  const isOpen = (key: SectionKey) => openSections[key] ?? false;
  const toggle = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

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

  // Wat er dichtgeklapt van elke sectie te zien is. De tellingen komen uit precies dezelfde
  // lijsten als de inhoud eronder, zodat de regel nooit iets anders belooft dan er staat.
  const lesdagenSummary = upcoming.length > 0
    ? `${upcoming.length} aankomend`
    : past.length > 0 ? 'niets aankomend' : 'geen afspraken';
  const voortgangSummary = entries.length === 0
    ? 'nog geen'
    : entries.length === 1 ? '1 notitie' : `${entries.length} notities`;
  // Zelfde telling als de badges bij de horizonnen zelf: een leeg doel telt niet mee.
  const goalCount = filledGoalCount(goals.filter((g) => g.student_id === player.id));
  const doelenSummary = goalCount === 0 ? 'nog geen doel' : goalCountLabel(goalCount);
  const lesplanSummary = planned.length > 0 ? `${planned.length} te doen` : 'niets te doen';
  const betaalwijze = PAYMENT_LABELS[player.default_payment_method ?? 'open'];

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
      <CollapsibleSection
        title="Lesdagen"
        summary={lesdagenSummary}
        open={isOpen('lesdagen')}
        onToggle={() => toggle('lesdagen')}
      >
        {/* De actie staat in de sectie zelf, niet op de dichtgeklapte regel: die regel is
            één knop (openklappen), en een tweede knop erin maakt onduidelijk wat je aantikt. */}
        {isCoach ? (
          <SectionAction
            icon={<CalendarPlus size={16} color={tennisColors.primary} />}
            label="Nieuwe afspraak"
            accessibilityLabel={`Nieuwe afspraak met ${player.name}`}
            onPress={() => router.push(`/agenda/new?playerId=${player.id}`)}
          />
        ) : null}
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
      </CollapsibleSection>

      {/* Het werk: wat er gebeurd is */}
      <CollapsibleSection
        title="Voortgang"
        summary={voortgangSummary}
        open={isOpen('voortgang')}
        onToggle={() => toggle('voortgang')}
      >
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
          entries.map((p) => (
            <ProgressEntryCard key={p.id} p={p} studentName={player.name} showStudent={false} lessonTitle={lessonTitle(p.lesson_id)} coachName={nameOf(p.coach_id)} onPress={() => setOpenEntry(p)} />
          ))
        )}
      </CollapsibleSection>

      {/* Het werk: waar het naartoe gaat */}
      <CollapsibleSection
        title="Doelen"
        summary={doelenSummary}
        open={isOpen('doelen')}
        onToggle={() => toggle('doelen')}
      >
        {/* De kop staat al op de sectieregel hierboven; PlayerGoals laat de zijne weg. */}
        <PlayerGoals studentId={player.id} canEdit={!!isCoach} showHeading={false} />
      </CollapsibleSection>

      {/* Het materiaal */}
      <CollapsibleSection
        title="Lesplan"
        summary={lesplanSummary}
        open={isOpen('lesplan')}
        onToggle={() => toggle('lesplan')}
      >
        {isCoach ? (
          <SectionAction
            icon={<Plus size={16} color={tennisColors.primary} />}
            label="Les toewijzen"
            accessibilityLabel="Les toewijzen"
            onPress={() => setAssignOpen(true)}
          />
        ) : null}
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
      </CollapsibleSection>

      {/* De administratie: één keer instellen, daarna vergeten */}
      {isCoach ? (
        <CollapsibleSection
          title="Administratie"
          summary={betaalwijze}
          open={isOpen('administratie')}
          onToggle={() => toggle('administratie')}
        >
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
        </CollapsibleSection>
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

/** De ene actie van een sectie, bovenin de opengeklapte sectie. */
function SectionAction({ icon, label, accessibilityLabel, onPress }: {
  icon: ReactNode; label: string; accessibilityLabel: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.addLink, webCursor]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
      <Text style={styles.addLinkText}>{label}</Text>
    </Pressable>
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
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: minTapTarget },
  addLinkText: { fontSize: 13, fontWeight: '700', color: tennisColors.primary },
  cardTitle: { fontSize: 18, fontWeight: '700', color: tennisColors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
