import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Plus, CheckCircle2, Circle, BookOpen, CalendarPlus, CalendarDays, Target,
  SlidersHorizontal, type LucideIcon,
} from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Badge } from '../../components/ui/Badge';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { DetailSheet } from '../../components/ui/DetailSheet';
import { LessonDetailModal } from '../../components/LessonDetailModal';
import { AssignLessonModal } from '../../components/AssignLessonModal';
import { GoalHorizonRows, PlayerGoalSheet } from '../../components/PlayerGoals';
import { ProgressForm } from '../../components/progress/ProgressForm';
import { ProgressEntryCard } from '../../components/progress/ProgressViews';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  buildLesplan, coachesForPlayer, lesplanSummary, type LessonWithProgress,
} from '../../lib/relations';
import { filledGoalCount, goalCountLabel } from '../../lib/goals';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import { parseSponsorBudget, sponsorHint, sponsorState } from '../../lib/sponsor';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, radius, typography, webCursor, minTapTarget } from '../../constants/theme';
import type { GoalHorizon, Lesson, PaymentMethod, StudentProgress } from '../../lib/types';
import { formatDay, formatTimeRange } from '../../lib/datetime';

/**
 * Het dossier is een kop-kaart met de speler en daaronder een raster tegels — dezelfde
 * tegels als het hoofdscherm en Beheer, met hetzelfde icoon voor hetzelfde begrip. Elke
 * tegel draagt zijn telling ("2 aankomend", "3 notities"), zodat je in één scherm ziet waar
 * dit dossier vol zit; een tik opent het onderdeel in een blad.
 *
 * Waarom bladen en geen uitklappers: alle onderdelen tegelijk open was eindeloos scrollen,
 * en uitgeklapt zag je nog steeds niet waar je was. Een blad geeft het onderdeel het hele
 * scherm en laat het dossier eronder onaangeroerd staan.
 *
 * De kop-kaart klapt nooit weg: dat is de identiteit van het scherm, geen onderdeel.
 *
 * Lesplan en voortgang zijn één onderdeel. Als twee lijsten naast elkaar moest je zelf
 * uitzoeken welke notitie bij welke les hoorde, terwijl de notitie dat zelf al weet
 * (`lesson_id`). Nu staat elke notitie onder zijn les, en wat nergens bij hoort onderaan.
 */

/** De onderdelen van het dossier; elk krijgt een tegel en een blad. */
type SectionKey = 'lesdagen' | 'lesplan' | 'doelen' | 'administratie';

export default function PlayerDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser, users, bookings, courts, lessons, progress, goals, updateLesson, updateUser,
  } = useSimpleData();

  const player = users.find((u) => u.id === id) ?? null;
  const isCoach = currentUser?.role === 'coach';

  // Welk onderdeel openstaat; null = je kijkt naar het raster. Niet onthouden tussen
  // bezoeken — dat zou state zijn die niemand beheert.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const [progressOpen, setProgressOpen] = useState(false);
  // Welke voortgangsnotitie openstaat; null = blad dicht.
  const [openEntry, setOpenEntry] = useState<StudentProgress | null>(null);
  const [openHorizon, setOpenHorizon] = useState<GoalHorizon | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // Wat er in het budgetveld staat terwijl de trainer typt; null = nog niets aangeraakt,
  // dan komt de waarde uit de speler zelf.
  const [budgetTyped, setBudgetTyped] = useState<string | null>(null);

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

  // Lesplan en voortgang zijn één lijst: elke notitie hangt onder de les waar hij bij hoort
  // (lib/relations legt die koppeling), en wat nergens bij hoort staat onderaan los.
  const plan = buildLesplan(player.id, lessons, progress);
  const lessonTitle = (lid?: string) => (lid ? lessons.find((l) => l.id === lid)?.title : undefined);
  const nothingYet = plan.planned.length === 0 && plan.given.length === 0 && plan.loose.length === 0;

  // Wat er op de tegel staat. De tellingen komen uit precies dezelfde lijsten als de inhoud
  // van het blad, zodat een tegel nooit iets anders belooft dan wat je erachter vindt.
  const lesdagenSummary = upcoming.length > 0
    ? `${upcoming.length} aankomend`
    : past.length > 0 ? 'niets aankomend' : 'geen afspraken';
  // Zelfde telling als de badges bij de horizonnen zelf: een leeg doel telt niet mee.
  const goalCount = filledGoalCount(goals.filter((g) => g.student_id === player.id));
  const doelenSummary = goalCount === 0 ? 'nog geen doel' : goalCountLabel(goalCount);
  const betaalwijze = PAYMENT_LABELS[player.default_payment_method ?? 'open'];

  // Het sponsorbudget: wat er in het contract staat en wat er nog van over is. De rest
  // rekent lib/sponsor uit de gesponsorde lessen — er is geen tweede saldo dat kan gaan
  // afwijken, net zoals bij de beurtenkaart.
  const budget = sponsorState(player, bookings, courts);
  const budgetVeld = budgetTyped ?? (player.sponsor_budget === undefined ? '' : String(player.sponsor_budget));
  const saveBudget = () => {
    if (budgetTyped === null) return;
    void updateUser(player.id, { sponsor_budget: parseSponsorBudget(budgetTyped) });
    setBudgetTyped(null);
  };

  const openLesson = (l: Lesson) => { setDetailLesson(l); setDetailOpen(true); };
  const toggleGiven = (l: Lesson) =>
    updateLesson(l.id, { status: l.status === 'gegeven' ? 'gepland' : 'gegeven' });

  /** Eén les met de notities die eronder horen; die staan ingesprongen achter een streep. */
  const lessonBlock = (item: LessonWithProgress, given: boolean) => (
    <View key={item.lesson.id} style={styles.lessonBlock}>
      <Card style={styles.listCard}>
        <PlanRow
          lesson={item.lesson}
          onOpen={() => openLesson(item.lesson)}
          onToggle={() => toggleGiven(item.lesson)}
          canEdit={!!isCoach}
          given={given}
          ownerName={nameOf(item.lesson.coach_id)}
          divided={false}
        />
      </Card>
      {item.entries.length > 0 ? (
        <View style={styles.lessonNotes}>
          {item.entries.map((p) => (
            // De lestitel staat hierboven al; hem per notitie herhalen zegt niets nieuws.
            <ProgressEntryCard key={p.id} p={p} studentName={player.name} showStudent={false} coachName={nameOf(p.coach_id)} onPress={() => setOpenEntry(p)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  // Vanuit een blad open je soms nog iets: een notitie, een horizon, een les, het toewijzen.
  // Twee bladen over elkaar heen is rommelig — de tweede backdrop verduistert de eerste en op
  // Android sluit één druk op terug ze allebei. Daarom sluit het onderste blad zolang het
  // bovenste openstaat (zelfde truc als LessonDetailSheet met de betaalwijze). `openSection`
  // blijft ondertussen staan, dus je komt terug in het blad waar je vandaan kwam.
  const stacked = progressOpen || openEntry !== null || openHorizon !== null
    || assignOpen || detailOpen;
  const sheetOpen = (key: SectionKey) => openSection === key && !stacked;
  const closeSheet = () => setOpenSection(null);

  /** Een blad verlaten om ergens anders heen te gaan: eerst dicht, dan pas navigeren. */
  const goTo = (path: string) => { closeSheet(); router.push(path); };

  const tiles: Array<{ key: SectionKey; title: string; subtitle: string; icon: LucideIcon }> = [
    // Dezelfde iconen als elders in de app: de agenda-kalender, het boek van lesmateriaal,
    // de roos van Doelen (ook op de tegel in Beheer) en de schuifjes van Beheer. Geen
    // badges: een badge vraagt aandacht voor iets wat af moet (openstaande betalingen in
    // Beheer), en in een dossier is niets dringend.
    { key: 'lesdagen', title: 'Lesdagen', subtitle: lesdagenSummary, icon: CalendarDays },
    { key: 'lesplan', title: 'Lesplan & voortgang', subtitle: lesplanSummary(plan), icon: BookOpen },
    { key: 'doelen', title: 'Doelen', subtitle: doelenSummary, icon: Target },
  ];
  if (isCoach) {
    tiles.push({ key: 'administratie', title: 'Administratie', subtitle: betaalwijze, icon: SlidersHorizontal });
  }

  return (
    // Geen `reading`: het scherm zelf is een raster tegels, en dat mag op een breed venster
    // dezelfde ruimte gebruiken als de andere tegelschermen. De lopende tekst zit nu in de
    // bladen, en die houden hun eigen, smallere maximumbreedte aan.
    <Screen>
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

      <TileGrid>
        {tiles.map((t) => (
          <ActionTile
            key={t.key}
            title={t.title}
            subtitle={t.subtitle}
            icon={t.icon}
            onPress={() => setOpenSection(t.key)}
          />
        ))}
      </TileGrid>

      {/* Wat staat er gepland */}
      <DetailSheet title="Lesdagen" visible={sheetOpen('lesdagen')} onClose={closeSheet}>
        {isCoach ? (
          <SheetAction
            icon={<CalendarPlus size={16} color={tennisColors.primary} />}
            label="Nieuwe afspraak"
            accessibilityLabel={`Nieuwe afspraak met ${player.name}`}
            onPress={() => goTo(`/agenda/new?playerId=${player.id}`)}
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
      </DetailSheet>

      {/* Het werk: waar het naartoe gaat */}
      <DetailSheet title="Doelen" visible={sheetOpen('doelen')} onClose={closeSheet}>
        <GoalHorizonRows studentId={player.id} onOpen={setOpenHorizon} />
      </DetailSheet>

      {/* Het materiaal en wat het opleverde: één lijst, notities onder hun les */}
      <DetailSheet title="Lesplan & voortgang" visible={sheetOpen('lesplan')} onClose={closeSheet}>
        {isCoach && currentUser ? (
          <View style={styles.actionRow}>
            <SheetAction
              icon={<Plus size={16} color={tennisColors.primary} />}
              label="Les toewijzen"
              accessibilityLabel="Les toewijzen"
              onPress={() => setAssignOpen(true)}
            />
            <SheetAction
              icon={<Plus size={16} color={tennisColors.primary} />}
              label="Voortgang toevoegen"
              accessibilityLabel={`Voortgang toevoegen voor ${player.name}`}
              onPress={() => setProgressOpen(true)}
            />
          </View>
        ) : null}

        {/* Eén rustige regel als er in het geheel nog niets is. Per les geen "geen
            notities"-regel: dat maakt de lijst alleen maar langer. */}
        {nothingYet ? <Text style={styles.muted}>Nog geen lessen of notities.</Text> : null}

        {plan.planned.length > 0 ? (
          <>
            <Text style={styles.subLabel}>Te doen</Text>
            {plan.planned.map((item) => lessonBlock(item, false))}
          </>
        ) : null}

        {plan.given.length > 0 ? (
          <>
            <Text style={styles.subLabel}>Gegeven</Text>
            {plan.given.map((item) => lessonBlock(item, true))}
          </>
        ) : null}

        {/* Een notitie zonder les — of eentje die naar een les buiten dit plan wijst —
            hoort nergens onder, maar mag ook niet van het scherm vallen. */}
        {plan.loose.length > 0 ? (
          <>
            <Text style={styles.subLabel}>Losse notities</Text>
            {plan.loose.map((p) => (
              <ProgressEntryCard key={p.id} p={p} studentName={player.name} showStudent={false} lessonTitle={lessonTitle(p.lesson_id)} coachName={nameOf(p.coach_id)} onPress={() => setOpenEntry(p)} />
            ))}
          </>
        ) : null}
      </DetailSheet>

      {/* De administratie: één keer instellen, daarna vergeten */}
      {isCoach ? (
        <DetailSheet title="Administratie" visible={sheetOpen('administratie')} onClose={closeSheet}>
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

          <Text style={[styles.cardTitle, styles.blockTop]}>Sponsorbudget</Text>
          <Text style={styles.muted}>
            Het bedrag uit het sponsorcontract van {player.name}. Elke gesponsorde les gaat
            hier vanaf; is het budget op, dan kan een les niet meer op “Sponsor”. Laat het
            veld leeg als er geen sponsorcontract is.
          </Text>
          <TextInput
            style={styles.input}
            value={budgetVeld}
            onChangeText={setBudgetTyped}
            // Pas wegschrijven als de trainer klaar is met typen: bij elke toets opslaan
            // maakt van "500" onderweg een budget van 5 en daarna van 50.
            onBlur={saveBudget}
            onSubmitEditing={saveBudget}
            placeholder="Bijvoorbeeld 500"
            placeholderTextColor={tennisColors.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel={`Sponsorbudget van ${player.name} in euro`}
          />
          <Text style={styles.muted}>{sponsorHint(budget)}</Text>
        </DetailSheet>
      ) : null}

      {/* De bladen die vanuit een blad opengaan, staan hier op het scherm zelf: een Modal
          binnen een gesloten Modal wordt door React Native niet meer getekend. */}
      <LessonDetailModal lesson={detailLesson} visible={detailOpen} onClose={() => setDetailOpen(false)} canEdit={!!isCoach} />
      <AssignLessonModal visible={assignOpen} onClose={() => setAssignOpen(false)} playerId={player.id} />
      <PlayerGoalSheet studentId={player.id} horizon={openHorizon} canEdit={!!isCoach} onClose={() => setOpenHorizon(null)} />
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

/** De ene actie van een onderdeel, bovenin het blad. */
function SheetAction({ icon, label, accessibilityLabel, onPress }: {
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
  // Het tweede blok in hetzelfde blad krijgt lucht, anders plakt het aan de chips erboven.
  blockTop: { marginTop: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.sm,
    color: tennisColors.text,
    backgroundColor: tennisColors.surface,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  lessonBlock: { gap: spacing.xs, marginTop: spacing.xs },
  // Ingesprongen achter een streep: zo zie je dat deze notities bij de les erboven horen.
  lessonNotes: {
    marginLeft: spacing.sm, paddingLeft: spacing.sm, gap: spacing.xs,
    borderLeftWidth: 2, borderLeftColor: tennisColors.border,
  },
});
