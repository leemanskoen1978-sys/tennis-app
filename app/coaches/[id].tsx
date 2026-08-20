import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Pencil } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { CoachDetailsModal } from '../../components/CoachDetailsModal';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { playersForCoach } from '../../lib/relations';
import { formatWorkingDays } from '../../lib/slots';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import { formatDay, formatTimeRange } from '../../lib/datetime';

export default function CoachDossier() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { users, bookings, courts, lessons, progress, currentUser } = useSimpleData();
  const [editOpen, setEditOpen] = useState(false);

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

  // Derived from bookings/lessons/progress — see lib/relations.ts. No assignment screen.
  const players = playersForCoach(coach.id, bookings, lessons, progress)
    .map((pid) => ({ id: pid, name: playerName(pid) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return (
    // `reading`: dit dossier is vooral lopende tekst (doelen, lesplan, notities);
    // die leest niet op de volle breedte van een breed venster.
    <Screen reading>
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

        {/* Display only: the revenue sums run on the court rate, never on this. */}
        {coach.hourly_rate ? (
          <Text style={styles.rate}>Uurtarief: €{coach.hourly_rate} per uur</Text>
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

      <Text style={styles.section}>Agenda</Text>
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
              <Text style={styles.rowMeta}>{courtName(b.court_id)} · {playerName(b.player_id)}</Text>
            </Card>
          ))}
          {past.length > 0 ? <Text style={styles.subLabel}>Geweest</Text> : null}
          {past.slice(0, 6).map((b) => (
            <Card key={b.id} style={styles.rowCard}>
              <View style={styles.rowLine}>
                <Text style={styles.rowDay}>{formatDay(b.start_time)}</Text>
                <Text style={styles.rowTime}>{formatTimeRange(b.start_time, b.end_time)}</Text>
              </View>
              <Text style={styles.rowMeta}>{courtName(b.court_id)} · {playerName(b.player_id)}</Text>
            </Card>
          ))}
        </>
      )}

      <Text style={styles.section}>Spelers</Text>
      {players.length === 0 ? (
        <Text style={styles.muted}>Nog geen spelers.</Text>
      ) : (
        players.map((p) => (
          <Card key={p.id} style={styles.rowCard}>
            <Pressable
              onPress={() => router.push(`/players/${p.id}`)}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { ...typography.h1, color: tennisColors.text },
  contact: { fontSize: 14, color: tennisColors.textMuted, marginTop: 2 },
  rate: { fontSize: 14, color: tennisColors.text, marginTop: spacing.sm },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: tennisColors.textMuted,
    textTransform: 'uppercase', marginTop: spacing.md,
  },
  fieldValue: { fontSize: 14, color: tennisColors.text, marginTop: 2 },
  editButton: { marginTop: spacing.lg },
  section: { ...typography.h2, color: tennisColors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
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
