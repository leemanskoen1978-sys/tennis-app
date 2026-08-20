import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, Pencil, Users, type LucideIcon } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ActionTile, TileGrid } from '../../components/ui/ActionTile';
import { DetailSheet } from '../../components/ui/DetailSheet';
import { CoachDetailsModal } from '../../components/CoachDetailsModal';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { groupSize, shortGroupLabel } from '../../lib/groups';
import { playersForCoach } from '../../lib/relations';
import { formatWorkingDays } from '../../lib/slots';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import { formatDay, formatTimeRange } from '../../lib/datetime';
import { totalCoachPayout } from '../../lib/payments';
import { bookingsInPeriod, currentPeriod } from '../../lib/period';
import { formatEuro } from '../../lib/csv';

/**
 * Zelfde opbouw als het spelersdossier: de kop-kaart met de trainer blijft altijd staan, en
 * daaronder staan de onderdelen als tegels met hun telling erbij. Een tik opent het
 * onderdeel in een blad. Dezelfde iconen als elders in de app: de kalender van Agenda en de
 * mensen van Spelers.
 */

/** De onderdelen van het trainersdossier; elk krijgt een tegel en een blad. */
type SectionKey = 'agenda' | 'spelers';
export default function CoachDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { users, bookings, courts, lessons, progress, currentUser } = useSimpleData();
  const [editOpen, setEditOpen] = useState(false);
  // Welk onderdeel openstaat; null = je kijkt naar het raster. Niet onthouden tussen
  // bezoeken: een stand van vorige week zegt niets over vandaag.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const coach = users.find((u) => u.id === id && u.role === 'coach') ?? null;

  if (!coach) {
    return (
      <Screen scroll={false}>
        <Text style={styles.muted}>Trainer niet gevonden.</Text>
      </Screen>
    );
  }

  const courtName = (cid: string) => courts.find((c) => c.id === cid)?.name ?? '';
  const now = Date.now();

  const coachBookings = bookings
    .filter((b) => b.coach_id === coach.id && b.status !== 'cancelled');
  const upcoming = coachBookings
    .filter((b) => new Date(b.end_time).getTime() >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const past = coachBookings
    .filter((b) => new Date(b.end_time).getTime() < now)
    .sort((a, b) => b.start_time.localeCompare(a.start_time));

  const playerName = (pid: string) => users.find((u) => u.id === pid)?.name ?? 'Onbekend';

  // Wat deze trainer deze maand verdient: zijn eigen uurtarief over zijn eigen lessen, langs
  // dezelfde weg als op zijn profiel. Geen tarief ingevuld geeft 0, met een melding erbij.
  const rateMissing = coach.hourly_rate === undefined;
  const earnedThisMonth = totalCoachPayout(
    bookingsInPeriod(bookings.filter((b) => b.coach_id === coach.id), currentPeriod()),
    [coach],
  );

  // Derived from bookings/lessons/progress — see lib/relations.ts. No assignment screen.
  const players = playersForCoach(coach.id, bookings, lessons, progress)
    .map((pid) => ({ id: pid, name: playerName(pid) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  // Wat er op de tegel staat, geteld op dezelfde lijsten als de inhoud van het blad.
  const agendaSummary = upcoming.length > 0
    ? `${upcoming.length} aankomend`
    : past.length > 0 ? 'niets aankomend' : 'geen afspraken';
  const spelersSummary = players.length === 0
    ? 'nog geen'
    : players.length === 1 ? '1 speler' : `${players.length} spelers`;

  const tiles: Array<{ key: SectionKey; title: string; subtitle: string; icon: LucideIcon }> = [
    { key: 'agenda', title: 'Agenda', subtitle: agendaSummary, icon: CalendarDays },
    { key: 'spelers', title: 'Spelers', subtitle: spelersSummary, icon: Users },
  ];

  const closeSheet = () => setOpenSection(null);
  /** Een blad verlaten om ergens anders heen te gaan: eerst dicht, dan pas navigeren. */
  const goTo = (path: string) => { closeSheet(); router.push(path); };

  return (
    // Geen `reading`: het scherm zelf is een raster tegels, en dat mag op een breed venster
    // dezelfde ruimte gebruiken als de andere tegelschermen. De lijsten zitten in de bladen,
    // en die houden hun eigen, smallere maximumbreedte aan.
    <Screen>
      <Card>
        <Text style={styles.name}>{coach.name}</Text>
        <Badge label="Trainer" color={tennisColors.primary} />
        {coach.email ? <Text style={styles.contact}>{coach.email}</Text> : null}
        {coach.phone ? <Text style={styles.contact}>{coach.phone}</Text> : null}

        <Text style={styles.fieldLabel}>Geeft les</Text>
        <Text style={styles.fieldValue}>{formatWorkingDays(coach)}</Text>
        <Text style={styles.fieldValue}>
          {coach.working_hours
            ? `${coach.working_hours.start} – ${coach.working_hours.end}`
            : 'De hele dag'}
        </Text>

        {/* Het uurtarief van de trainer is wat híj krijgt; wat de speler betaalt loopt op het
            uurtarief van de baan. Twee verschillende bedragen — zie lib/payments. */}
        <Text style={styles.fieldLabel}>Uurtarief</Text>
        <Text style={rateMissing ? styles.warnValue : styles.fieldValue}>
          {rateMissing ? 'Nog niet ingesteld' : `€${coach.hourly_rate} per uur`}
        </Text>

        <Text style={styles.fieldLabel}>Verdiend deze maand</Text>
        <Text style={styles.fieldValue}>€{formatEuro(earnedThisMonth)}</Text>
        {/* Zonder tarief is dat bedrag nul, en dat mag niet als een gewone nul overkomen. */}
        {rateMissing ? (
          <Text style={styles.warnValue}>
            Zolang het uurtarief leeg is, blijft dit op €0,00 staan.
          </Text>
        ) : null}

        {/* Only your own details. A colleague's card has no button at all — a control
            you may never use should not be sitting there greyed out. */}
        {currentUser?.id === coach.id ? (
          <Button
            label="Bewerken"
            variant="secondary"
            icon={<Pencil size={16} color={tennisColors.text} />}
            onPress={() => setEditOpen(true)}
            style={styles.editButton}
          />
        ) : null}
      </Card>

      {currentUser?.id === coach.id ? (
        <CoachDetailsModal
          coach={coach}
          visible={editOpen}
          onClose={() => setEditOpen(false)}
        />
      ) : null}

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

      <DetailSheet title="Agenda" visible={openSection === 'agenda'} onClose={closeSheet}>
        {upcoming.length === 0 && past.length === 0 ? (
          <Text style={styles.muted}>Nog geen afspraken.</Text>
        ) : (
          <>
            {upcoming.length > 0 ? <Text style={styles.subLabel}>Aankomend</Text> : null}
            {upcoming.map((b) => (
              <Card key={b.id} style={styles.rowCard}>
                <View style={styles.rowLine}>
                  <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                  <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                </View>
                <Text style={styles.rowMeta}>{courtName(b.court_id)} · {shortGroupLabel(playerName(b.player_id), groupSize(b))}</Text>
              </Card>
            ))}
            {past.length > 0 ? <Text style={styles.subLabel}>Geweest</Text> : null}
            {past.slice(0, 6).map((b) => (
              <Card key={b.id} style={styles.rowCard}>
                <View style={styles.rowLine}>
                  <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                  <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
                </View>
                <Text style={styles.rowMeta}>{courtName(b.court_id)} · {shortGroupLabel(playerName(b.player_id), groupSize(b))}</Text>
              </Card>
            ))}
          </>
        )}
      </DetailSheet>

      <DetailSheet title="Spelers" visible={openSection === 'spelers'} onClose={closeSheet}>
        {players.length === 0 ? (
          <Text style={styles.muted}>Nog geen spelers.</Text>
        ) : (
          players.map((p) => (
            <Card key={p.id} style={styles.rowCard}>
              <Pressable
                onPress={() => goTo(`/players/${p.id}`)}
                style={[styles.playerRow, webCursor]}
                accessibilityRole="button"
                accessibilityLabel={`Open dossier van ${p.name}`}
              >
                <Text style={styles.playerName}>{p.name}</Text>
                <ChevronRight size={18} color={tennisColors.textMuted} />
              </Pressable>
            </Card>
          ))
        )}
      </DetailSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: tennisColors.text },
  contact: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  warnValue: { fontSize: 14, color: tennisColors.warning, marginTop: 2 },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.md,
  },
  fieldValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  editButton: { marginTop: spacing.lg },
  subLabel: { fontSize: 12, fontWeight: '700', color: tennisColors.textMuted, textTransform: 'uppercase', marginTop: spacing.sm, marginBottom: spacing.xs },
  muted: { fontSize: 14, color: tennisColors.textMuted },
  rowCard: { marginBottom: spacing.sm },
  rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDay: { fontSize: 15, fontWeight: '600', color: tennisColors.text },
  rowTime: { fontSize: 14, color: tennisColors.textMuted },
  rowMeta: { fontSize: 13, color: tennisColors.textMuted, marginTop: 2 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { fontSize: 15, fontWeight: '600', color: tennisColors.text },
});
