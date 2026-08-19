import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { tennisColors } from '../../constants/tennis-colors';
import { useSimpleData } from '../../providers/SimpleDataProvider';
import { generateSlots, isDateBookable } from '../../lib/slots';
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

  const effectiveCoachId: string = selectedCoachId ?? coaches[0]?.id ?? '';

  const days: Date[] = useMemo(() => next14Days(), []);

  const slots: string[] = useMemo(
    () => generateSlots(settings.booking_end_time),
    [settings.booking_end_time],
  );

  const takenSlots: Set<string> = useMemo(() => {
    const taken = new Set<string>();
    if (selectedDate === null) return taken;
    for (const b of bookings) {
      if (!sameDay(b.start_time, selectedDate)) continue;
      if (selectedCoachId !== null && b.coach_id !== selectedCoachId) continue;
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Reserveren</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => {
            void refresh();
          }}
          accessibilityRole="button"
          accessibilityLabel="Vernieuwen"
        >
          <RefreshCw size={16} color={tennisColors.primary} />
          <Text style={styles.refreshText}>Vernieuwen</Text>
        </Pressable>
      </View>

      {/* Coach filter */}
      <Text style={styles.sectionLabel}>Coach</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, selectedCoachId === null && styles.chipActive]}
          onPress={() => setSelectedCoachId(null)}
          accessibilityRole="button"
        >
          <Text
            style={[
              styles.chipText,
              selectedCoachId === null && styles.chipTextActive,
            ]}
          >
            Alle coaches
          </Text>
        </Pressable>
        {coaches.map((coach) => {
          const active = selectedCoachId === coach.id;
          return (
            <Pressable
              key={coach.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedCoachId(coach.id)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {coach.name}
              </Text>
            </Pressable>
          );
        })}
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
      <View style={styles.slotGrid}>
        {slots.map((slot) => {
          const isTaken = takenSlots.has(slot);
          const disabled = selectedDate === null || isTaken;
          return (
            <Pressable
              key={slot}
              disabled={disabled}
              style={[styles.slot, disabled && styles.slotDisabled]}
              onPress={() => openSlot(slot)}
              accessibilityRole="button"
            >
              <Text
                style={[styles.slotText, disabled && styles.slotTextDisabled]}
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
        coachId={effectiveCoachId}
        date={selectedDate}
        slot={selectedSlot}
        courts={courts}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tennisColors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tennisColors.text,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
  },
  refreshText: {
    color: tennisColors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tennisColors.textMuted,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
  },
  chipActive: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primary,
  },
  chipText: {
    color: tennisColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: tennisColors.white,
  },
  dateStrip: {
    gap: 8,
    paddingVertical: 4,
  },
  dayCell: {
    width: 60,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
    alignItems: 'center',
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
    marginBottom: 8,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: 88,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.surface,
    alignItems: 'center',
  },
  slotDisabled: {
    backgroundColor: tennisColors.background,
    opacity: 0.6,
  },
  slotText: {
    fontSize: 16,
    fontWeight: '700',
    color: tennisColors.text,
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
