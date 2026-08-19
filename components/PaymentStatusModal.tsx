import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { tennisColors } from '../constants/tennis-colors';
import {
  usePendingPaymentBookings,
  useSimpleData,
} from '../providers/SimpleDataProvider';

type PaymentStatus = 'paid' | 'invoice' | 'unpaid';

interface ActionButtonProps {
  label: string;
  color: string;
  onPress: () => void;
  disabled: boolean;
}

function ActionButton({
  label,
  color,
  onPress,
  disabled,
}: ActionButtonProps): JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: color },
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

export function PaymentStatusModal(props: {
  visible: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const { visible, onClose } = props;
  const pending = usePendingPaymentBookings();
  const { updateBooking, deleteBooking, users, courts } = useSimpleData();

  const [busy, setBusy] = React.useState<boolean>(false);

  const b = pending[0];

  // Auto-close when there is nothing left to handle.
  React.useEffect(() => {
    if (!b && visible) {
      onClose();
    }
  }, [b, visible, onClose]);

  if (!b) {
    return null;
  }

  const player = users.find((u) => u.id === b.player_id);
  const court = courts.find((c) => c.id === b.court_id);

  const playerName = player?.name ?? 'Onbekende speler';
  const courtName = court?.name ?? 'Onbekende baan';

  let startLabel: string;
  try {
    startLabel = new Date(b.start_time).toLocaleString('nl-BE');
  } catch {
    startLabel = b.start_time;
  }

  const runUpdate = (paymentStatus: PaymentStatus): void => {
    if (busy) {
      return;
    }
    setBusy(true);
    updateBooking(b.id, { payment_status: paymentStatus })
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  };

  const runDelete = (): void => {
    if (busy) {
      return;
    }
    setBusy(true);
    deleteBooking(b.id)
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Betaling verwerken</Text>
          <Text style={styles.counter}>{pending.length} openstaand</Text>

          <View style={styles.details}>
            <Text style={styles.playerName}>{playerName}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Baan</Text>
              <Text style={styles.detailValue}>{courtName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tijdstip</Text>
              <Text style={styles.detailValue}>{startLabel}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <ActionButton
              label="Cash betaald"
              color={tennisColors.success}
              disabled={busy}
              onPress={() => runUpdate('paid')}
            />
            <ActionButton
              label="Op factuur"
              color={tennisColors.court}
              disabled={busy}
              onPress={() => runUpdate('invoice')}
            />
            <ActionButton
              label="Onbetaald"
              color={tennisColors.warning}
              disabled={busy}
              onPress={() => runUpdate('unpaid')}
            />
            <ActionButton
              label="Verwijderen"
              color={tennisColors.danger}
              disabled={busy}
              onPress={runDelete}
            />
          </View>

          {busy ? (
            <ActivityIndicator
              style={styles.spinner}
              color={tennisColors.primary}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            disabled={busy}
            style={styles.laterButton}
          >
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tennisColors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: tennisColors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: tennisColors.text,
    textAlign: 'center',
  },
  counter: {
    fontSize: 13,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  details: {
    backgroundColor: tennisColors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: tennisColors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: tennisColors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tennisColors.white,
  },
  spinner: {
    marginTop: 16,
  },
  laterButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  laterText: {
    fontSize: 14,
    color: tennisColors.textMuted,
    textDecorationLine: 'underline',
  },
});
