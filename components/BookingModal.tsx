import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { tennisColors } from '../constants/tennis-colors';
import { spacing, radius, typography, shadow } from '../constants/theme';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import type { Court } from '../lib/types';
import { useSimpleData } from '../providers/SimpleDataProvider';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  coachId: string;
  date: Date | null;
  slot: string | null; // "HH:00"
  courts: Court[];
  /**
   * Who the lesson is for. Omitted, the booking is for the logged-in user — a player
   * booking their own lesson. Set, a coach is booking on behalf of that player.
   */
  playerId?: string;
}

function parseHour(slot: string): number {
  const [hourPart] = slot.split(':');
  return parseInt(hourPart, 10);
}

export function BookingModal(props: BookingModalProps): JSX.Element | null {
  const { visible, onClose, coachId, date, slot, courts, playerId } = props;
  const { currentUser, users, addBooking, error } = useSimpleData();

  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    courts[0]?.id ?? '',
  );
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (date === null || slot === null) {
    return null;
  }

  const hour = parseHour(slot);
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    0,
    0,
  );
  const endDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour + 1,
    0,
    0,
  );
  const start_time = startDate.toISOString();
  const end_time = endDate.toISOString();

  const handleConfirm = async (): Promise<void> => {
    if (!currentUser) {
      return;
    }
    if (submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await addBooking({
        player_id: playerId ?? currentUser.id,
        coach_id: coachId,
        court_id: selectedCourtId || courts[0]?.id || '',
        start_time,
        end_time,
        status: 'confirmed',
        payment_method: 'open',
        notes: notes.trim() ? notes.trim() : undefined,
      });
      setNotes('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const slotEndLabel = `${String(hour + 1).padStart(2, '0')}:00`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Les boeken</Text>
          <Text style={styles.subtitle}>
            {date.toLocaleDateString('nl-BE')} · {slot} – {slotEndLabel}
          </Text>
          {/* Booking for someone else is easy to do by accident, so name them. */}
          {playerId && playerId !== currentUser?.id ? (
            <Text style={styles.forWhom}>
              Voor {users.find((u) => u.id === playerId)?.name ?? 'onbekende speler'}
            </Text>
          ) : null}

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Terrein</Text>
            <View style={styles.chipRow}>
              {courts.map((court) => (
                <Chip
                  key={court.id}
                  label={court.name}
                  selected={court.id === selectedCourtId}
                  onPress={() => setSelectedCourtId(court.id)}
                />
              ))}
            </View>

            <Text style={styles.label}>Notities (optioneel)</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Voeg een notitie toe…"
              placeholderTextColor={tennisColors.textMuted}
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label="Annuleren"
              variant="secondary"
              onPress={onClose}
              disabled={submitting}
              fullWidth
            />
            <Button
              label="Bevestigen"
              variant="primary"
              onPress={handleConfirm}
              disabled={submitting}
              fullWidth
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tennisColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    ...shadow('lg'),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: tennisColors.border,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: tennisColors.text,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forWhom: {
    ...typography.body,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: spacing.md,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: tennisColors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 72,
    color: tennisColors.text,
    backgroundColor: tennisColors.background,
    textAlignVertical: 'top',
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
