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
import type { PaymentStatus } from '../lib/types';
import { Button } from './ui/Button';
import { spacing, radius, typography, shadow } from '../constants/theme';

// The three concrete statuses this modal can set (excludes null).
type SettablePaymentStatus = Exclude<PaymentStatus, null>;

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

  const runUpdate = (paymentStatus: SettablePaymentStatus): void => {
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
            <Button
              label="Cash betaald"
              variant="primary"
              disabled={busy}
              onPress={() => runUpdate('paid')}
            />
            <Button
              label="Op factuur"
              variant="secondary"
              disabled={busy}
              onPress={() => runUpdate('invoice')}
            />
            <Button
              label="Onbetaald"
              variant="secondary"
              disabled={busy}
              onPress={() => runUpdate('unpaid')}
            />
            <Button
              label="Verwijderen"
              variant="danger"
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
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tennisColors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: tennisColors.border,
    ...shadow('lg'),
  },
  title: {
    ...typography.h2,
    color: tennisColors.text,
    textAlign: 'center',
  },
  counter: {
    ...typography.label,
    color: tennisColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  details: {
    backgroundColor: tennisColors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: tennisColors.text,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  detailLabel: {
    ...typography.body,
    color: tennisColors.textMuted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: tennisColors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  actions: {
    gap: spacing.sm,
  },
  spinner: {
    marginTop: spacing.lg,
  },
  laterButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  laterText: {
    ...typography.body,
    color: tennisColors.textMuted,
    textDecorationLine: 'underline',
  },
});
