// Payments as a screen, not a modal: it has its own route, the hub badge can link to it,
// and from a payment you can click through to the player's dossier.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import type { PaymentStatus } from '../../lib/types';

type SettablePaymentStatus = Exclude<PaymentStatus, null>;

export default function Payments() {
  const router = useRouter();
  const pending = usePendingPaymentBookings();
  const { updateBooking, deleteBooking, users, courts } = useSimpleData();
  const [busy, setBusy] = React.useState<boolean>(false);

  const b = pending[0];

  if (!b) {
    return (
      <Screen scroll={false}>
        <Text style={styles.done}>Geen openstaande betalingen.</Text>
      </Screen>
    );
  }

  const player = users.find((u) => u.id === b.player_id);
  const playerName = player?.name ?? 'Onbekende speler';
  const courtName = courts.find((c) => c.id === b.court_id)?.name ?? 'Onbekende baan';

  let startLabel: string;
  try {
    startLabel = new Date(b.start_time).toLocaleString('nl-BE');
  } catch {
    startLabel = b.start_time;
  }

  const run = (fn: () => Promise<unknown>): void => {
    if (busy) return;
    setBusy(true);
    fn().catch(() => undefined).finally(() => setBusy(false));
  };

  const setStatus = (paymentStatus: SettablePaymentStatus) =>
    run(() => updateBooking(b.id, { payment_status: paymentStatus }));

  return (
    <Screen>
      <Text style={styles.counter}>
        {pending.length === 1 ? '1 openstaande betaling' : `${pending.length} openstaande betalingen`}
      </Text>

      <Card>
        <Pressable
          onPress={() => router.push(`/players/${b.player_id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open dossier van ${playerName}`}
          style={[styles.playerRow, webCursor]}
        >
          <Text style={styles.playerName}>{playerName}</Text>
          <ChevronRight size={20} color={tennisColors.textMuted} />
        </Pressable>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Baan</Text>
          <Text style={styles.detailValue}>{courtName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tijdstip</Text>
          <Text style={styles.detailValue}>{startLabel}</Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button label="Cash betaald" variant="primary" disabled={busy} onPress={() => setStatus('paid')} />
        <Button label="Op factuur" variant="secondary" disabled={busy} onPress={() => setStatus('invoice')} />
        <Button label="Onbetaald" variant="secondary" disabled={busy} onPress={() => setStatus('unpaid')} />
        <Button label="Verwijderen" variant="danger" disabled={busy} onPress={() => run(() => deleteBooking(b.id))} />
      </View>

      {busy ? <ActivityIndicator color={tennisColors.primary} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { fontSize: 14, color: tennisColors.textMuted },
  done: { ...typography.body, color: tennisColors.textMuted },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { ...typography.h2, color: tennisColors.text },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  detailLabel: { fontSize: 14, color: tennisColors.textMuted },
  detailValue: { fontSize: 14, color: tennisColors.text, fontWeight: '600' },
  actions: { gap: spacing.sm },
});
