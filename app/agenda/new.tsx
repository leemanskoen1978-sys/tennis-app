import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';
import {
  spacing,
  radius,
  typography,
  minTapTarget,
} from '../../constants/theme';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import {
  generateSlots, isDateBookable, slotsForCoach, worksOnDay, formatWorkingDays, DAY_LABELS,
} from '../../lib/slots';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { BookingModal } from '../../components/BookingModal';
import { StudentCombobox } from '../../components/ui/StudentCombobox';
import { UserManagement } from '../../components/UserManagement';
import type { User } from '../../lib/types';

const MONTH_NAMES = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/** True when the ISO timestamp falls on the same calendar day as d. */
function sameDay(iso: string, d: Date): boolean {
  const dt = new Date(iso);
  return (
    dt.getFullYear() === d.getFullYear() &&
    dt.getMonth() === d.getMonth() &&
    dt.getDate() === d.getDate()
  );
}

/** "HH:MM" from an ISO timestamp. */
function timeOf(iso: string): string {
  const dt = new Date(iso);
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function next14Days(from: Date = new Date()): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function HomeScreen(): JSX.Element {
  const { currentUser, courts, bookings, users, settings, refresh } = useSimpleData();
  // Prefilled when you arrive from a player's dossier.
  const { playerId } = useLocalSearchParams<{ playerId?: string }>();

  const isCoach = currentUser?.role === 'coach';

  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  // The prefill comes from a URL, so it is checked against the real player list before
  // it is trusted: ?playerId=<a coach> would otherwise book a trainer as a player.
  const prefill = users.find((u) => u.id === playerId && u.role !== 'coach')?.id ?? null;
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(prefill);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  // De naam die in de keuzelijst getypt werd voor een speler die nog niet bestaat; null zolang
  // de trainer daar niet om vroeg. Zo staat het invulscherm meteen met die naam klaar.
  const [newPlayerName, setNewPlayerName] = useState<string | null>(null);

  const coaches: User[] = useMemo(
    () => users.filter((u) => u.role === 'coach'),
    [users],
  );

  const players: User[] = useMemo(
    () => users.filter((u) => u.role !== 'coach'),
    [users],
  );

  // Ook een trainer kiest bij wie de les komt: meestal bij zichzelf, maar hij mag een les
  // op de agenda van een collega zetten (invallen, doorverwijzen). Zolang hij niets kiest
  // staat hij op zichzelf, zodat de gewone gang van zaken één klik minder blijft.
  // Een speler kan wél "Alle coaches" kiezen; dat is bij hem een bladermodus (null).
  const bookingCoachId: string | null = isCoach
    ? (selectedCoachId ?? currentUser?.id ?? null)
    : selectedCoachId;

  // A booking needs a specific coach, and — when a coach is booking — a player.
  // "Alle coaches" (selectedCoachId === null bij een speler) is a browse-only state.
  const hasCoach: boolean = bookingCoachId !== null;
  const validPlayerId: string | null =
    players.find((u) => u.id === selectedPlayerId)?.id ?? null;
  const canBook: boolean = hasCoach && (!isCoach || validPlayerId !== null);

  const days: Date[] = useMemo(() => next14Days(), []);

  // The coach whose agenda is being filled — their own days and hours bound what is
  // bookable. Without a specific coach ("Alle coaches") the club window stands; that is
  // a browse-only state anyway.
  const bookingCoach: User | null = useMemo(
    () => coaches.find((c) => c.id === bookingCoachId) ?? null,
    [coaches, bookingCoachId],
  );

  const slots: string[] = useMemo(
    () => (bookingCoach
      ? slotsForCoach(bookingCoach, settings.booking_end_time)
      : generateSlots(settings.booking_end_time)),
    [bookingCoach, settings.booking_end_time],
  );

  const dayIsWorked: boolean =
    selectedDate === null || bookingCoach === null || worksOnDay(bookingCoach, selectedDate);

  // Taken slots are computed for the coach being booked (selectedCoachId).
  // No coaches[0] fallback: without a specific coach nothing is bookable anyway.
  const takenSlots: Set<string> = useMemo(() => {
    const taken = new Set<string>();
    if (selectedDate === null || bookingCoachId === null) return taken;
    for (const b of bookings) {
      if (!sameDay(b.start_time, selectedDate)) continue;
      if (b.coach_id !== bookingCoachId) continue;
      taken.add(timeOf(b.start_time));
    }
    return taken;
  }, [bookings, selectedDate, bookingCoachId]);

  function openSlot(slot: string): void {
    setSelectedSlot(slot);
    setModalOpen(true);
  }

  function closeModal(): void {
    setModalOpen(false);
    setSelectedSlot(null);
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Button
          label="Vernieuwen"
          variant="secondary"
          fullWidth={false}
          icon={<RefreshCw size={16} color={tennisColors.text} />}
          onPress={() => {
            void refresh();
          }}
        />
      </View>

      {isCoach ? (
        <>
          <Text style={styles.sectionLabel}>Speler</Text>
          <StudentCombobox
            students={players}
            value={selectedPlayerId}
            onChange={setSelectedPlayerId}
            placeholder="Typ de naam van de speler…"
            onRequestCreate={setNewPlayerName}
          />
        </>
      ) : null}

      {/* Dezelfde rij coaches voor iedereen. Alleen een speler kan hem op "Alle coaches"
          zetten om te bladeren; een trainer boekt altijd bij een concrete collega. */}
      <Text style={styles.sectionLabel}>Coach</Text>
      <View style={styles.chipRow}>
        {!isCoach && (
          <Chip
            label="Alle coaches"
            selected={selectedCoachId === null}
            onPress={() => setSelectedCoachId(null)}
          />
        )}
        {coaches.map((coach) => (
          <Chip
            key={coach.id}
            label={coach.name}
            selected={bookingCoachId === coach.id}
            onPress={() => setSelectedCoachId(coach.id)}
          />
        ))}
      </View>

      {isCoach && (
        <Text style={styles.hint}>
          {bookingCoachId === currentUser?.id
            ? 'De les komt op jouw agenda.'
            : `De les komt op de agenda van ${bookingCoach?.name ?? 'je collega'}.`}
        </Text>
      )}

      {/* Date strip */}
      <Text style={styles.sectionLabel}>Datum</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
      >
        {days.map((day) => {
          const worked = bookingCoach === null || worksOnDay(bookingCoach, day);
          const bookable = isDateBookable(day) && worked;
          const active =
            selectedDate !== null &&
            selectedDate.getFullYear() === day.getFullYear() &&
            selectedDate.getMonth() === day.getMonth() &&
            selectedDate.getDate() === day.getDate();
          const dayLabel = `${DAY_LABELS[day.getDay()]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`;
          return (
            <Pressable
              key={day.toISOString()}
              disabled={!bookable}
              style={[
                styles.dayCell,
                active && styles.dayCellActive,
                !bookable && styles.dayCellDisabled,
              ]}
              onPress={() => setSelectedDate(day)}
              accessibilityRole="button"
              accessibilityLabel={
                worked ? dayLabel : `${dayLabel}, ${bookingCoach?.name ?? ''} geeft dan geen les`
              }
              accessibilityState={{ selected: active, disabled: !bookable }}
            >
              <Text
                style={[
                  styles.dayName,
                  active && styles.dayTextActive,
                  !bookable && styles.dayTextDisabled,
                ]}
              >
                {DAY_LABELS[day.getDay()]}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  active && styles.dayTextActive,
                  !bookable && styles.dayTextDisabled,
                ]}
              >
                {day.getDate()}
              </Text>
              <Text
                style={[
                  styles.dayMonth,
                  active && styles.dayTextActive,
                  !bookable && styles.dayTextDisabled,
                ]}
              >
                {MONTH_NAMES[day.getMonth()]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {bookingCoach ? (
        <Text style={styles.hint}>
          {bookingCoach.name} geeft les op {formatWorkingDays(bookingCoach)}
          {bookingCoach.working_hours
            ? `, ${bookingCoach.working_hours.start}–${bookingCoach.working_hours.end}`
            : ''}
          .
        </Text>
      ) : null}

      {/* Slot grid */}
      <Text style={styles.sectionLabel}>Tijdslot</Text>
      {selectedDate === null && (
        <Text style={styles.hint}>Kies eerst een datum.</Text>
      )}
      {!canBook && (
        <Text style={styles.hint}>
          {isCoach ? 'Kies eerst een speler om te boeken.' : 'Kies eerst een coach om te boeken.'}
        </Text>
      )}
      {!dayIsWorked && (
        <Text style={styles.hint}>
          {bookingCoach?.name} geeft geen les op deze dag.
        </Text>
      )}
      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const isTaken = takenSlots.has(slot);
          // Bookable only with a date AND a specific coach, and not already taken.
          const disabled = selectedDate === null || !canBook || isTaken || !dayIsWorked;
          const stateLabel = isTaken
            ? 'bezet'
            : disabled
              ? 'niet beschikbaar'
              : 'beschikbaar';
          return (
            <Pressable
              key={slot}
              disabled={disabled}
              style={[
                styles.slot,
                !disabled && styles.slotActive,
                disabled && styles.slotDisabled,
              ]}
              onPress={() => openSlot(slot)}
              accessibilityRole="button"
              accessibilityLabel={`Tijdslot ${slot}, ${stateLabel}`}
              accessibilityState={{ disabled }}
            >
              <Text
                style={[
                  styles.slotText,
                  !disabled && styles.slotTextActive,
                  disabled && styles.slotTextDisabled,
                ]}
              >
                {slot}
              </Text>
              {isTaken && <Text style={styles.slotBezet}>bezet</Text>}
            </Pressable>
          );
        })}
      </View>

      <BookingModal
        visible={modalOpen}
        onClose={closeModal}
        coachId={bookingCoachId ?? ''}
        playerId={isCoach ? validPlayerId ?? undefined : undefined}
        date={selectedDate}
        slot={selectedSlot}
        courts={courts}
      />

      {/* Het volledige invulscherm voor een nieuwe speler. Zodra hij bewaard is, is hij ook
          meteen de speler van de les die de trainer aan het inplannen was. */}
      <UserManagement
        visible={newPlayerName !== null}
        initialName={newPlayerName ?? ''}
        onClose={() => setNewPlayerName(null)}
        onCreated={(u) => {
          setSelectedPlayerId(u.id);
          setNewPlayerName(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLabel: {
    ...typography.label,
    color: tennisColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateStrip: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dayCell: {
    width: 60,
    minHeight: minTapTarget,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellActive: {
    backgroundColor: tennisColors.primaryFill,
    borderColor: tennisColors.primary,
  },
  dayCellDisabled: {
    backgroundColor: tennisColors.background,
    borderColor: tennisColors.border,
    opacity: 0.5,
  },
  dayName: {
    fontSize: 12,
    color: tennisColors.textMuted,
    fontWeight: '600',
  },
  dayNum: {
    fontSize: 18,
    color: tennisColors.text,
    fontWeight: '700',
    marginVertical: 2,
  },
  dayMonth: {
    fontSize: 11,
    color: tennisColors.textMuted,
  },
  dayTextActive: {
    color: tennisColors.onFill,
  },
  dayTextDisabled: {
    color: tennisColors.textMuted,
  },
  hint: {
    color: tennisColors.textMuted,
    fontStyle: 'italic',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slot: {
    width: 88,
    minHeight: minTapTarget,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: {
    backgroundColor: tennisColors.primaryFill,
    borderColor: tennisColors.primary,
  },
  slotDisabled: {
    backgroundColor: tennisColors.background,
    borderColor: tennisColors.border,
    opacity: 0.6,
  },
  slotText: {
    fontSize: 16,
    fontWeight: '700',
    color: tennisColors.text,
  },
  slotTextActive: {
    color: tennisColors.onFill,
  },
  slotTextDisabled: {
    color: tennisColors.textMuted,
  },
  slotBezet: {
    fontSize: 11,
    color: tennisColors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
});
