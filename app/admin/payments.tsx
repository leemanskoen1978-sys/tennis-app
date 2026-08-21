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
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { spacing, typography, webCursor } from '../../constants/theme';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import { formatDayTimeRange } from '../../lib/datetime';
import type { PaymentMethod } from '../../lib/types';

export default function Payments() {
  const router = useRouter();
  const t = useT();
  const pending = usePendingPaymentBookings();
  const { setPaymentMethod, deleteBooking, users, courts, error } = useSimpleData();
  const [busy, setBusy] = React.useState<boolean>(false);

  const b = pending[0];

  if (!b) {
    return (
      <Screen scroll={false}>
        <Text style={styles.done}>{t('Geen openstaande betalingen.')}</Text>
      </Screen>
    );
  }

  const player = users.find((u) => u.id === b.player_id);
  const playerName = player?.name ?? t('Onbekende speler');
  const courtName = courts.find((c) => c.id === b.court_id)?.name ?? t('Onbekende baan');

  // Dag, uur én einduur: bij een betaling wil je de les kunnen herkennen, en de gedeelde
  // opmaak vangt een onbruikbare tijd zelf al op.
  const startLabel = formatDayTimeRange(b.start_time, b.end_time);

  const run = (fn: () => Promise<unknown>): void => {
    if (busy) return;
    setBusy(true);
    fn().catch(() => undefined).finally(() => setBusy(false));
  };

  // Via `setPaymentMethod`, want alleen die weg boekt de beurt af of geeft hem terug.
  // Een geweigerde keuze laat de provider-foutregel hieronder staan.
  const setMethod = (method: PaymentMethod) => run(() => setPaymentMethod(b.id, method));

  return (
    <Screen>
      <Text style={styles.counter}>
        {pending.length === 1
          ? t('1 openstaande betaling')
          : t('{n} openstaande betalingen', { n: pending.length })}
      </Text>

      <Card>
        <Pressable
          onPress={() => router.push(`/players/${b.player_id}`)}
          accessibilityRole="button"
          accessibilityLabel={t('Open dossier van {naam}', { naam: playerName })}
          style={[styles.playerRow, webCursor]}
        >
          <Text style={styles.playerName}>{playerName}</Text>
          <ChevronRight size={20} color={tennisColors.textMuted} />
        </Pressable>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('Baan')}</Text>
          <Text style={styles.detailValue}>{courtName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('Tijdstip')}</Text>
          <Text style={styles.detailValue}>{startLabel}</Text>
        </View>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {/* 'open' staat er niet bij: dat is de toestand waarin de les hier al staat. */}
        {PAYMENT_METHODS.filter((m) => m !== 'open').map((method) => (
          <Button
            key={method}
            label={t(PAYMENT_LABELS[method])}
            variant={method === 'cash' ? 'primary' : 'secondary'}
            disabled={busy}
            onPress={() => setMethod(method)}
          />
        ))}
        <Button label={t('Verwijderen')} variant="danger" disabled={busy} onPress={() => run(() => deleteBooking(b.id))} />
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
  error: { color: tennisColors.danger, fontSize: 14 },
  actions: { gap: spacing.sm },
});
