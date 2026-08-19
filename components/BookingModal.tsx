import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { tennisColors } from '../constants/tennis-colors';
import type { Court } from '../lib/types';
import { useSimpleData } from '../providers/SimpleDataProvider';

interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  coachId: string;
  date: Date | null;
  slot: string | null; // "HH:00"
  courts: Court[];
}

function parseHour(slot: string): number {
  const [hourPart] = slot.split(':');
  return parseInt(hourPart, 10);
}

export function BookingModal(props: BookingModalProps): JSX.Element | null {
  const { visible, onClose, coachId, date, slot, courts } = props;
  const { currentUser, addBooking, error } = useSimpleData();

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
    setSubmitting(true);
    try {
      await addBooking({
        player_id: currentUser.id,
        coach_id: coachId,
        court_id: selectedCourtId || courts[0]?.id || '',
        start_time,
        end_time,
        status: 'confirmed',
        payment_status: null,
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

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Terrein</Text>
            <View style={styles.chipRow}>
              {courts.map((court) => {
                const active = court.id === selectedCourtId;
                return (
                  <Pressable
                    key={court.id}
                    onPress={() => setSelectedCourtId(court.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {court.name}
                    </Text>
                  </Pressable>
                );
              })}
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
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.cancelButton]}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Annuleren</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[
                styles.button,
                styles.confirmButton,
                submitting && styles.buttonDisabled,
              ]}
              disabled={submitting}
            >
              <Text style={styles.confirmButtonText}>Bevestigen</Text>
            </Pressable>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tennisColors.border,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tennisColors.text,
  },
  subtitle: {
    fontSize: 14,
    color: tennisColors.textMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tennisColors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tennisColors.border,
    backgroundColor: tennisColors.background,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: tennisColors.primary,
    borderColor: tennisColors.primary,
  },
  chipText: {
    fontSize: 14,
    color: tennisColors.text,
  },
  chipTextActive: {
    color: tennisColors.white,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: tennisColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 72,
    color: tennisColors.text,
    backgroundColor: tennisColors.background,
    textAlignVertical: 'top',
  },
  error: {
    color: tennisColors.danger,
    fontSize: 14,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: tennisColors.background,
    borderWidth: 1,
    borderColor: tennisColors.border,
    marginRight: 8,
  },
  cancelButtonText: {
    color: tennisColors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: tennisColors.primary,
    marginLeft: 8,
  },
  confirmButtonText: {
    color: tennisColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
