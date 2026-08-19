import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';
import {
  spacing,
  radius,
  typography,
  minTapTarget,
} from '../../constants/theme';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { generateSlots, isDateBookable } from '../../lib/slots';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { BookingModal } from '../../components/BookingModal';
import type { User } from '../../lib/types';

const DAY_NAMES = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
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
  const { courts, bookings, users, settings, refresh } = useSimpleData();

  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const coaches: User[] = useMemo(
    () => users.filter((u) => u.role === 'coach'),
    [users],
  );

  // A booking is only possible when a specific coach is selected.
  // "Alle coaches" (selectedCoachId === null) is a browse-only state.
  const hasCoach: boolean = selectedCoachId !== null;

  const days: Date[] = useMemo(() => next14Days(), []);

  const slots: string[] = useMemo(
    () => generateSlots(settings.booking_end_time),
    [settings.booking_end_time],
  );

  // Taken slots are computed for the coach being booked (selectedCoachId).
  // No coaches[0] fallback: without a specific coach nothing is bookable anyway.
  const takenSlots: Set<string> = useMemo(() => {
    const taken = new Set<string>();
    if (selectedDate === null || selectedCoachId === null) return taken;
    for (const b of bookings) {
      if (!sameDay(b.start_time, selectedDate)) continue;
      if (b.coach_id !== selectedCoachId) continue;
      taken.add(timeOf(b.start_time));
    }
    return taken;
  }, [bookings, selectedDate, selectedCoachId]);

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
        <Text style={styles.title}>Reserveren</Text>
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

      {/* Coach filter */}
      <Text style={styles.sectionLabel}>Coach</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Alle coaches"
          selected={selectedCoachId === null}
          onPress={() => setSelectedCoachId(null)}
        />
        {coaches.map((coach) => (
          <Chip
            key={coach.id}
            label={coach.name}
            selected={selectedCoachId === coach.id}
            onPress={() => setSelectedCoachId(coach.id)}
          />
        ))}
      </View>

      {/* Date strip */}
      <Text style={styles.sectionLabel}>Datum</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
      >
        {days.map((day) => {
          const bookable = isDateBookable(day);
          const active =
            selectedDate !== null &&
            selectedDate.getFullYear() === day.getFullYear() &&
            selectedDate.getMonth() === day.getMonth() &&
            selectedDate.getDate() === day.getDate();
          const dayLabel = `${DAY_NAMES[day.getDay()]} ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`;
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
              accessibilityLabel={dayLabel}
              accessibilityState={{ selected: active, disabled: !bookable }}
            >
              <Text
                style={[
                  styles.dayName,
                  active && styles.dayTextActive,
                  !bookable && styles.dayTextDisabled,
                ]}
              >
                {DAY_NAMES[day.getDay()]}
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

      {/* Slot grid */}
      <Text style={styles.sectionLabel}>Tijdslot</Text>
      {selectedDate === null && (
        <Text style={styles.hint}>Kies eerst een datum.</Text>
      )}
      {!hasCoach && (
        <Text style={styles.hint}>Kies eerst een coach om te boeken.</Text>
      )}
      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const isTaken = takenSlots.has(slot);
          // Bookable only with a date AND a specific coach, and not already taken.
          const disabled = selectedDate === null || !hasCoach || isTaken;
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
        coachId={selectedCoachId ?? ''}
        date={selectedDate}
        slot={selectedSlot}
        courts={courts}
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
  title: {
    ...typography.h1,
    color: tennisColors.text,
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
    backgroundColor: tennisColors.primary,
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
    color: tennisColors.white,
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
    backgroundColor: tennisColors.primary,
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
    color: tennisColors.white,
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
