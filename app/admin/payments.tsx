// Payments as a screen, not a modal: it has its own route, the hub badge can link to it,
// and from a payment you can click through to the player's dossier.
//
// Je bladert erdoorheen in plaats van ze in volgorde te moeten afwerken. Er stond altijd
// alleen de eerste openstaande betaling; wie met een speler voor zich stond die cash wilde
// betalen terwijl zijn les de derde in de rij was, kon niets. Nu swipe je (en op een laptop
// klik je de pijltjes) naar de juiste les.
//
// De knoppen blijven onder het blader-venster staan en verhuizen niet mee. Dat is met opzet:
// je duim ligt onderaan, en het enige dat verandert is wélke les je afrekent.

import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Screen } from '../../components/ui/Screen';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSimpleData, usePendingPaymentBookings } from '../../providers/SimpleDataProvider';
import { useT } from '../../lib/i18n';
import { tennisColors } from '../../constants/tennis-colors';
import { radius, minTapTarget, spacing, typography, webCursor } from '../../constants/theme';
import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../lib/payments';
import { beperkIndex, bladerLabel } from '../../lib/blader';
import { formatDayTimeRange } from '../../lib/datetime';
import type { Booking, PaymentMethod } from '../../lib/types';

export default function Payments() {
  const router = useRouter();
  const t = useT();
  const pending = usePendingPaymentBookings();
  const { setPaymentMethod, deleteBooking, users, courts, error } = useSimpleData();
  const [busy, setBusy] = React.useState<boolean>(false);
  const [plek, setPlek] = React.useState<number>(0);
  // De breedte van één blad. Gemeten in plaats van van het venster afgeleid: dit scherm
  // staat binnen een marge, en op een breed venster is het blad smaller dan de pagina.
  const [breedte, setBreedte] = React.useState<number>(0);
  const baan = React.useRef<ScrollView>(null);

  // De rij wordt korter terwijl je erin staat: een afgerekende les verdwijnt eruit. Blijf
  // dan staan waar je stond — daar staat nu de volgende — en schuif een plek terug als je
  // op de laatste stond.
  const index = beperkIndex(plek, pending.length);
  const b: Booking | undefined = pending[index];

  const ganaar = React.useCallback((naar: number): void => {
    const doel = beperkIndex(naar, pending.length);
    setPlek(doel);
    baan.current?.scrollTo({ x: doel * breedte, animated: true });
  }, [breedte, pending.length]);

  // Verdwijnt het blad waar je op stond, dan moet de baan mee: anders blijf je naar een
  // leeg stuk kijken terwijl de knoppen al over de volgende les gaan.
  React.useEffect(() => {
    if (breedte > 0) baan.current?.scrollTo({ x: index * breedte, animated: false });
  }, [index, breedte, pending.length]);

  if (!b) {
    return (
      <Screen scroll={false}>
        <Text style={styles.done}>{t('Geen openstaande betalingen.')}</Text>
      </Screen>
    );
  }

  const naamVan = (id: string): string =>
    users.find((u) => u.id === id)?.name ?? t('Onbekende speler');
  const baanVan = (id: string): string =>
    courts.find((c) => c.id === id)?.name ?? t('Onbekende baan');

  const run = (fn: () => Promise<unknown>): void => {
    if (busy) return;
    setBusy(true);
    fn().catch(() => undefined).finally(() => setBusy(false));
  };

  // Via `setPaymentMethod`, want alleen die weg boekt de beurt af of geeft hem terug.
  // Een geweigerde keuze laat de provider-foutregel hieronder staan.
  const setMethod = (method: PaymentMethod) => run(() => setPaymentMethod(b.id, method));

  const meet = (e: LayoutChangeEvent): void => setBreedte(e.nativeEvent.layout.width);
  const gestopt = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (breedte <= 0) return;
    setPlek(beperkIndex(Math.round(e.nativeEvent.contentOffset.x / breedte), pending.length));
  };

  const label = bladerLabel(index, pending.length);

  return (
    <Screen>
      <View style={styles.kop}>
        <Text style={styles.counter}>
          {pending.length === 1
            ? t('1 openstaande betaling')
            : t('{n} openstaande betalingen', { n: pending.length })}
        </Text>

        {/* Pijltjes naast de teller: op een laptop swipe je niet. Ze verdwijnen bij één
            betaling, want dan valt er niets te bladeren. */}
        {label !== '' ? (
          <View style={styles.blader}>
            <Pressable
              onPress={() => ganaar(index - 1)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel={t('Vorige betaling')}
              style={[styles.pijl, index === 0 && styles.pijlUit, webCursor]}
            >
              <ChevronLeft size={20} color={tennisColors.primary} />
            </Pressable>
            <Text style={styles.plek}>{label}</Text>
            <Pressable
              onPress={() => ganaar(index + 1)}
              disabled={index >= pending.length - 1}
              accessibilityRole="button"
              accessibilityLabel={t('Volgende betaling')}
              style={[styles.pijl, index >= pending.length - 1 && styles.pijlUit, webCursor]}
            >
              <ChevronRight size={20} color={tennisColors.primary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View onLayout={meet}>
        <ScrollView
          ref={baan}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={gestopt}
          scrollEnabled={pending.length > 1}
        >
          {pending.map((les) => (
            <View key={les.id} style={{ width: breedte }}>
              <Card>
                <Pressable
                  onPress={() => router.push(`/players/${les.player_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Open dossier van {naam}', { naam: naamVan(les.player_id) })}
                  style={[styles.playerRow, webCursor]}
                >
                  <Text style={styles.playerName}>{naamVan(les.player_id)}</Text>
                  <ChevronRight size={20} color={tennisColors.textMuted} />
                </Pressable>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Baan')}</Text>
                  <Text style={styles.detailValue}>{baanVan(les.court_id)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('Tijdstip')}</Text>
                  {/* Dag, uur én einduur: bij een betaling wil je de les kunnen herkennen. */}
                  <Text style={styles.detailValue}>
                    {formatDayTimeRange(les.start_time, les.end_time)}
                  </Text>
                </View>
              </Card>
            </View>
          ))}
        </ScrollView>
      </View>

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
  kop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  counter: { fontSize: 14, color: tennisColors.textMuted, flexShrink: 1 },
  blader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pijl: {
    minWidth: minTapTarget, minHeight: minTapTarget,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, backgroundColor: tennisColors.primaryTint,
  },
  pijlUit: { opacity: 0.35 },
  plek: { fontSize: 13, color: tennisColors.text, fontWeight: '600', minWidth: 64, textAlign: 'center' },
  done: { ...typography.body, color: tennisColors.textMuted },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { ...typography.h2, color: tennisColors.text },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  detailLabel: { fontSize: 14, color: tennisColors.textMuted },
  detailValue: { fontSize: 14, color: tennisColors.text, fontWeight: '600' },
  error: { color: tennisColors.danger, fontSize: 14 },
  actions: { gap: spacing.sm },
});
